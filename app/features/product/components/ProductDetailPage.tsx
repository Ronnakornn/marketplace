"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, MessageCircleIcon, ShieldCheckIcon, ShoppingCartIcon, StarIcon, TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerProductDetailSkeleton } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  addCartItem,
  addFavoriteProduct,
  fetchCart,
  fetchFavoriteStatus,
  fetchShopFollowStatus,
  followShop,
  formatMoney,
  removeFavoriteProduct,
  unfollowShop,
} from "#/features/buyer/api";
import { createChatRoom } from "#/features/chat";
import { ProductCard } from "#/features/product/components/ProductCard";
import {
  normalizePublicProduct,
  normalizePublicProducts,
  publicProductDetailQueryOptions,
  publicProductListQueryOptions,
} from "#/features/product/queries";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { resolveUploadedImageUrl } from "#/lib/assets";
import { useSession } from "#/lib/auth-client";

export function ProductDetailPage({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const localePath = useLocalePath();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canUseBuyerCart = session?.user.role === "USER";
  const canUseBuyerActions = session?.user.role === "USER";
  const productQuery = useQuery({
    ...publicProductDetailQueryOptions({ productId, locale }),
    select: normalizePublicProduct,
  });
  const relatedQuery = useQuery({
    ...publicProductListQueryOptions({ limit: 4, locale }),
    select: normalizePublicProducts,
  });
  const favoriteQuery = useQuery({
    queryKey: ["buyer-favorite-status", productId],
    queryFn: () => fetchFavoriteStatus(productId),
    enabled: canUseBuyerActions,
  });
  const shopId = productQuery.data?.shop.id ?? "";
  const followQuery = useQuery({
    queryKey: ["buyer-shop-follow-status", shopId],
    queryFn: () => fetchShopFollowStatus(shopId),
    enabled: canUseBuyerActions && Boolean(shopId),
  });
  const cartQuery = useQuery({
    queryKey: ["buyer-cart", locale],
    queryFn: () => fetchCart(locale),
    enabled: canUseBuyerCart,
  });
  const addCartMutation = useMutation({
    mutationFn: () => {
      const variantId = productQuery.data?.variants[0]?.id;
      if (!variantId) throw new Error(t("product.noPurchasableVariant"));
      return addCartItem(variantId, 1);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart"] }),
  });
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t("common.login"));
      return favoriteQuery.data ? removeFavoriteProduct(productId) : addFavoriteProduct(productId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buyer-favorite-status", productId] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-favorites"] });
    },
  });
  const createChatMutation = useMutation({
    mutationFn: () => {
      const product = productQuery.data;
      if (!product?.shop.id) throw new Error(t("product.shopNotFound"));
      return createChatRoom({ shopId: product.shop.id, productId: product.id });
    },
    onSuccess: (room) => {
      router.push(localePath(`/chat/${room.roomId}`));
    },
  });
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t("common.login"));
      if (!shopId) throw new Error(t("product.shopNotFound"));
      return followQuery.data ? unfollowShop(shopId) : followShop(shopId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buyer-shop-follow-status", shopId] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-followed-shops"] });
    },
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;

  function handleCartAction() {
    if (!session) {
      router.push(localePath("/login"));
      return;
    }
    if (!canUseBuyerCart) return;
    addCartMutation.mutate();
  }

  function handleChatSeller() {
    if (!session) {
      router.push(localePath("/login"));
      return;
    }
    if (!canUseBuyerActions) return;
    createChatMutation.mutate();
  }

  if (productQuery.isLoading) {
    return (
      <>
        <BuyerTopBar title={t("product.products")} />
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4"><BuyerProductDetailSkeleton /></div>
      </>
    );
  }

  if (productQuery.isError) {
    return (
      <>
        <BuyerTopBar title={t("product.products")} />
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4"><BuyerErrorState message={productQuery.error.message} onRetry={() => void productQuery.refetch()} /></div>
      </>
    );
  }

  const product = productQuery.data;
  if (!product) {
    return (
      <>
        <BuyerTopBar title={t("product.products")} />
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4">
          <BuyerEmptyState title={t("product.noProductsFound")} description={t("product.noProductsDescription")} />
        </div>
      </>
    );
  }
  const mainImage = resolveUploadedImageUrl(product.images[0]);
  const galleryImages = product.images.length > 0 ? product.images.map((image) => resolveUploadedImageUrl(image)) : [mainImage];

  return (
    <>
      <BuyerTopBar title={product.title} />
      <article className="mx-auto max-w-6xl space-y-4 px-3 pb-28 pt-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
              <Image src={mainImage} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            </div>
            {galleryImages.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {galleryImages.slice(0, 6).map((image) => (
                  <div key={image} className="relative size-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <Image src={image} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {product.brand ? <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">{product.brand.name}</Badge> : null}
              <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">{product.shop.name}</Badge>
              <Button variant="outline" size="sm" className="rounded-full" disabled={followMutation.isPending} onClick={() => {
                if (!session) router.push(localePath("/login"));
                else followMutation.mutate();
              }}>
                {followQuery.data ? t("product.following") : t("product.followShop")}
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-slate-950">{product.title}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1"><StarIcon className="size-4 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>
              <span>{product.soldCount} {t("product.sold")}</span>
              <span>{product.stock} {t("product.inStock")}</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{formatMoney(product.price, product.currency)}</p>
            <div className="space-y-2">
              <h2 className="font-semibold">{t("product.variants")}</h2>
              <div className="flex flex-wrap gap-2">
                {(product.variants.length ? product.variants : [{ id: product.id, title: t("common.default"), stock: product.stock }]).map((variant) => (
                  <Badge key={variant.id} variant="outline" className="rounded-md px-3 py-1">{variant.title}</Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
              <span className="flex items-center gap-2"><TruckIcon className="size-4 text-orange-600" />{t("product.shippingCalculated")}</span>
              <span className="flex items-center gap-2"><ShieldCheckIcon className="size-4 text-emerald-600" />{t("product.buyerProtection")}</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">{product.description ?? t("product.noDescription")}</p>
            {product.highlights.length ? (
              <ul className="grid gap-2 text-sm text-slate-700">
                {product.highlights.map((highlight) => <li key={highlight} className="rounded-lg bg-slate-50 px-3 py-2">{highlight}</li>)}
              </ul>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Product facts</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {product.condition ? <FactRow label="Condition" value={product.condition} /> : null}
            {product.countryOfOrigin ? <FactRow label="Country of origin" value={product.countryOfOrigin} /> : null}
            {product.warrantyInfo ? <FactRow label="Warranty" value={product.warrantyInfo} /> : null}
            {product.brand ? <FactRow label="Brand" value={product.brand.name} /> : null}
          </dl>
          {product.attributes.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              {product.attributes.map((attribute) => (
                <div key={`${attribute.key}-${attribute.name}`} className="grid grid-cols-[140px_minmax(0,1fr)] border-b border-slate-100 text-sm last:border-b-0">
                  <dt className="bg-slate-50 px-3 py-2 font-medium text-slate-600">{attribute.name}</dt>
                  <dd className="px-3 py-2 text-slate-800">{attribute.value}</dd>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">{t("product.reviews")}</h2>
          <BuyerEmptyState title={t("product.noReviewsTitle")} description={t("product.noReviewsDescription")} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t("product.relatedProducts")}</h2>
          {relatedQuery.isSuccess && relatedQuery.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{relatedQuery.data.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div>
          ) : null}
        </section>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] md:bottom-0">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button variant="outline" size="icon" className="size-12 shrink-0 rounded-2xl" disabled={favoriteMutation.isPending} onClick={() => {
            if (!session) router.push(localePath("/login"));
            else if (canUseBuyerActions) favoriteMutation.mutate();
          }}>
            <HeartIcon className={`size-5 ${favoriteQuery.data ? "fill-orange-500 text-orange-500" : ""}`} />
            <span className="sr-only">{t("product.wishlist")}</span>
          </Button>
          {canUseBuyerActions ? (
            <>
              <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={handleChatSeller} disabled={createChatMutation.isPending}>
                <MessageCircleIcon className="size-4" />
                {t("chat.chatSeller")}
              </Button>
              <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={handleCartAction} disabled={addCartMutation.isPending}>
                <span className="relative inline-flex">
                  <ShoppingCartIcon className="size-4" />
                  {cartItemCount > 0 ? (
                    <span className="absolute -right-2.5 -top-2.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  ) : null}
                </span>
                {t("product.addToCart")}
              </Button>
              <Button className="h-12 flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700" onClick={handleCartAction} disabled={addCartMutation.isPending}>{t("product.buyNow")}</Button>
            </>
          ) : (
            <Button asChild className="h-12 flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700">
              <Link href={localePath("/seller/chat")}>{t("chat.sellerInbox")}</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}
