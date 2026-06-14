"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, MapPinIcon, ShoppingCartIcon, StarIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { addCartItem, addFavoriteProduct, fetchFavoriteStatus, formatMoney, removeFavoriteProduct } from "#/features/buyer/api";
import { showAddToCartError, showAddToCartSuccess } from "#/features/product/cart-handoff";
import type { BuyerProduct } from "#/features/product/queries";
import { useDiscoveryTracking } from "#/features/tracking";
import { useLocalePath } from "#/i18n/navigation";
import { resolveUploadedImageUrl } from "#/lib/assets";
import { useSession } from "#/lib/auth-client";

export function ProductCard({ product }: { product: BuyerProduct }) {
  const router = useRouter();
  const localePath = useLocalePath();
  const tracking = useDiscoveryTracking("product_card");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const image = resolveUploadedImageUrl(product.images[0]);
  const hasPriceRange = product.maxPrice > product.minPrice;
  const purchasableVariants = product.variants.filter((variant) => variant.stock > 0);
  const quickAddVariant =
    product.options.length === 0 && purchasableVariants.length === 1 && purchasableVariants[0]?.optionValues.length === 0
      ? purchasableVariants[0]
      : null;
  const isOutOfStock = product.stock <= 0;
  const canFetchBuyerState = session?.user.role === "USER";
  const favoriteQuery = useQuery({
    queryKey: ["buyer-favorite-status", product.id],
    queryFn: () => fetchFavoriteStatus(product.id),
    enabled: canFetchBuyerState,
  });
  const favoriteMutation = useMutation({
    mutationFn: () => favoriteQuery.data ? removeFavoriteProduct(product.id) : addFavoriteProduct(product.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buyer-favorite-status", product.id] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-favorites"] });
    },
  });
  const addToCartMutation = useMutation({
    mutationFn: () => quickAddVariant ? addCartItem(quickAddVariant.id, 1) : Promise.resolve(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart"] });
      showAddToCartSuccess({
        context: {
          productTitle: product.title,
          variantTitle: quickAddVariant?.title,
        },
        onViewCart: () => router.push(localePath("/cart")),
      });
    },
    onError: (error) => showAddToCartError({ error }),
  });
  const priceLabel = hasPriceRange
    ? `${formatMoney(product.minPrice, product.currency)} - ${formatMoney(product.maxPrice, product.currency)}`
    : formatMoney(product.price, product.currency);
  const fallbackBadges = [
    isOutOfStock ? "Out of stock" : null,
    product.soldCount >= 20 ? "Hot" : null,
    hasPriceRange ? "Options" : null,
  ].filter((badge): badge is string => Boolean(badge));
  const cardBadges = product.badges.length ? product.badges : fallbackBadges;
  const discountLabel = product.discountPercent && product.discountPercent > 0 ? `${product.discountPercent}% off` : null;
  const favoriteLabel = favoriteQuery.data ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`;
  const favoriteUnavailableLabel = canFetchBuyerState ? "Wishlist unavailable" : "Sign in as a buyer to use wishlist";
  const quickAddLabel = quickAddVariant ? `Quick add ${product.title} to cart` : `Open ${product.title} details`;

  function handleFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canFetchBuyerState || favoriteMutation.isPending) return;
    favoriteMutation.mutate();
  }

  function handleQuickAdd(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!quickAddVariant || addToCartMutation.isPending) return;
    addToCartMutation.mutate();
  }

  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2">
      <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
        <Link
          href={`/products/${product.id}`}
          onClick={() => tracking.trackProductClick({ productId: product.id, shopId: product.shop.id })}
          className="block size-full focus-visible:outline-none"
          aria-label={`View ${product.title}`}
        >
          <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
            <Image src={image} alt={product.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" />
          </div>
        </Link>
        <div className="absolute left-2 top-2 flex min-h-5 max-w-[calc(100%-3.5rem)] flex-wrap gap-1">
          {cardBadges.slice(0, 2).map((badge) => (
            <Badge key={badge} className="rounded-md bg-orange-600 px-1.5 py-0.5 text-[10px] leading-none text-white">
              {badge}
            </Badge>
          ))}
        </div>
        {discountLabel ? (
          <Badge className="absolute bottom-2 left-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] leading-none text-white">
            {discountLabel}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-2 top-2 size-9 rounded-full bg-white/90 shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500"
          aria-label={canFetchBuyerState ? favoriteLabel : favoriteUnavailableLabel}
          title={canFetchBuyerState ? favoriteLabel : favoriteUnavailableLabel}
          disabled={!canFetchBuyerState || favoriteMutation.isPending}
          onClick={handleFavorite}
        >
          <HeartIcon className={`size-4 ${favoriteQuery.data ? "fill-orange-500 text-orange-500" : "text-slate-700"}`} />
        </Button>
        {isOutOfStock ? (
          <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1 text-center text-xs font-semibold text-white">
            Out of stock
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <Link
          href={`/products/${product.id}`}
          onClick={() => tracking.trackProductClick({ productId: product.id, shopId: product.shop.id })}
          className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-slate-900">{product.title}</h3>
        </Link>
        {product.brand ? <p className="truncate text-xs font-medium text-slate-500">{product.brand.name}</p> : null}
        <div className="flex min-h-12 items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-orange-600" title={priceLabel}>{priceLabel}</p>
            {product.originalPrice && product.originalPrice > product.minPrice ? (
              <p className="truncate text-xs text-slate-400 line-through" title={formatMoney(product.originalPrice, product.currency)}>
                {formatMoney(product.originalPrice, product.currency)}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-slate-500">{isOutOfStock ? "Unavailable" : `${product.soldCount} sold`}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{product.shop.location}</span>
          </span>
        </div>
        <div className="flex min-h-9 items-center justify-between gap-2">
          <Badge variant="outline" className="min-w-0 max-w-full truncate rounded-full border-orange-200 bg-orange-50 font-normal text-orange-700">
            {product.shop.name}
          </Badge>
          {quickAddVariant ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label={quickAddLabel}
              title={quickAddLabel}
              disabled={addToCartMutation.isPending}
              onClick={handleQuickAdd}
            >
              <ShoppingCartIcon className="size-4" />
            </Button>
          ) : (
            <Link
              href={`/products/${product.id}`}
              onClick={() => tracking.trackProductClick({ productId: product.id, shopId: product.shop.id })}
              className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label={quickAddLabel}
            >
              Details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
