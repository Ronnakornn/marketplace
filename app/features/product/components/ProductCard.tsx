"use client";

import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, MapPinIcon, ShoppingCartIcon, StarIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { addCartItem, addFavoriteProduct, fetchFavoriteStatus, formatMoney, removeFavoriteProduct } from "#/features/buyer/api";
import type { BuyerProduct } from "#/features/product/queries";
import { useDiscoveryTracking } from "#/features/tracking";
import { resolveUploadedImageUrl } from "#/lib/assets";
import { useSession } from "#/lib/auth-client";

export function ProductCard({ product }: { product: BuyerProduct }) {
  const tracking = useDiscoveryTracking("product_card");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const image = resolveUploadedImageUrl(product.images[0]);
  const hasPriceRange = product.maxPrice > product.minPrice;
  const purchasableVariants = product.variants.filter((variant) => variant.stock > 0);
  const quickAddVariant = product.options.length === 0 && purchasableVariants.length === 1 ? purchasableVariants[0] : null;
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["buyer-cart"] }),
  });
  const priceLabel = hasPriceRange
    ? `${formatMoney(product.minPrice, product.currency)} - ${formatMoney(product.maxPrice, product.currency)}`
    : formatMoney(product.price, product.currency);
  const cardBadges = product.badges.length
    ? product.badges
    : [
        product.stock <= 0 ? "Out" : null,
        product.soldCount >= 20 ? "Hot" : null,
        hasPriceRange ? "Options" : null,
      ].filter((badge): badge is string => Boolean(badge));

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
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link
        href={`/products/${product.id}`}
        onClick={() => tracking.trackProductClick({ productId: product.id, shopId: product.shop.id })}
        className="block"
      >
        <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
          <Image src={image} alt={product.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" />
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-3.5rem)] flex-wrap gap-1">
            {cardBadges.slice(0, 2).map((badge) => <Badge key={badge} className="rounded-md bg-orange-600 px-1.5 py-0.5 text-[10px] leading-none text-white">{badge}</Badge>)}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 size-9 rounded-full bg-white/90 shadow-sm"
            aria-label="Wishlist"
            disabled={!canFetchBuyerState || favoriteMutation.isPending}
            onClick={handleFavorite}
          >
            <HeartIcon className={`size-4 ${favoriteQuery.data ? "fill-orange-500 text-orange-500" : "text-slate-700"}`} />
          </Button>
        </div>
      </Link>
      <div className="space-y-2 p-3">
        <Link
          href={`/products/${product.id}`}
          onClick={() => tracking.trackProductClick({ productId: product.id, shopId: product.shop.id })}
          className="block"
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-slate-900">{product.title}</h3>
        </Link>
        {product.brand ? <p className="truncate text-xs font-medium text-slate-500">{product.brand.name}</p> : null}
        <div className="flex min-h-10 items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-orange-600">{priceLabel}</p>
            {product.originalPrice && product.originalPrice > product.minPrice ? (
              <p className="text-xs text-slate-400 line-through">{formatMoney(product.originalPrice, product.currency)}</p>
            ) : null}
          </div>
          <span className="text-xs text-slate-500">{product.stock > 0 ? `${product.soldCount} sold` : "Out of stock"}</span>
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
              className="size-8 shrink-0 rounded-full"
              disabled={addToCartMutation.isPending}
              onClick={handleQuickAdd}
            >
              <ShoppingCartIcon className="size-4" />
              <span className="sr-only">Quick add to cart</span>
            </Button>
          ) : (
            <span className="h-8 w-8 shrink-0" aria-hidden="true" />
          )}
        </div>
      </div>
    </article>
  );
}
