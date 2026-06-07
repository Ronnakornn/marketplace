"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, ImageOffIcon, MessageCircleIcon, MinusIcon, PlayIcon, PlusIcon, RotateCcwIcon, ShieldCheckIcon, ShoppingCartIcon, StarIcon, StoreIcon, TruckIcon } from "lucide-react";
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
  normalizePublicProductQuestions,
  normalizePublicProductRatingSummary,
  normalizePublicProductReviews,
  normalizePublicProducts,
  createProductQuestion,
  publicProductDetailQueryOptions,
  publicProductListQueryOptions,
  publicProductQuestionsQueryOptions,
  publicProductRatingSummaryQueryOptions,
  publicProductReviewsQueryOptions,
  productQueryKeys,
  type BuyerProductQuestion,
  type BuyerProductRatingSummary,
  type BuyerProductReview,
} from "#/features/product/queries";
import { saveLocalRecentlyViewedProduct, useDiscoveryTracking } from "#/features/tracking";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { resolveUploadedImageUrl } from "#/lib/assets";
import { useSession } from "#/lib/auth-client";

type OptionValueState = "selected" | "available" | "unavailable" | "out-of-stock";

export function ProductDetailPage({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const localePath = useLocalePath();
  const { data: session } = useSession();
  const tracking = useDiscoveryTracking("product_detail");
  const queryClient = useQueryClient();
  const canFetchBuyerState = session?.user.role === "USER";
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [selectedOptionValues, setSelectedOptionValues] = useState<Record<string, string>>({});
  const [selectedStandaloneVariantId, setSelectedStandaloneVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [questionText, setQuestionText] = useState("");

  const productQuery = useQuery({
    ...publicProductDetailQueryOptions({ productId, locale }),
    select: normalizePublicProduct,
  });
  const relatedQuery = useQuery({
    ...publicProductListQueryOptions({ limit: 4, locale }),
    select: normalizePublicProducts,
  });
  const reviewsQuery = useQuery({
    ...publicProductReviewsQueryOptions(productId),
    select: normalizePublicProductReviews,
  });
  const ratingSummaryQuery = useQuery({
    ...publicProductRatingSummaryQueryOptions(productId),
    select: normalizePublicProductRatingSummary,
  });
  const questionsQuery = useQuery({
    ...publicProductQuestionsQueryOptions(productId),
    select: normalizePublicProductQuestions,
  });
  const favoriteQuery = useQuery({
    queryKey: ["buyer-favorite-status", productId],
    queryFn: () => fetchFavoriteStatus(productId),
    enabled: canFetchBuyerState,
  });
  const shopId = productQuery.data?.shop.id ?? "";
  const followQuery = useQuery({
    queryKey: ["buyer-shop-follow-status", shopId],
    queryFn: () => fetchShopFollowStatus(shopId),
    enabled: canFetchBuyerState && Boolean(shopId),
  });
  const cartQuery = useQuery({
    queryKey: ["buyer-cart", locale],
    queryFn: () => fetchCart(locale),
    enabled: canFetchBuyerState,
  });
  const addCartMutation = useMutation({
    mutationFn: ({ variantId, itemQuantity }: { variantId: string; itemQuantity: number }) => addCartItem(variantId, itemQuantity),
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
    onSuccess: (room) => router.push(localePath(`/chat/${room.roomId}`)),
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
  const questionMutation = useMutation({
    mutationFn: (question: string) => createProductQuestion(productId, question),
    onSuccess: () => {
      setQuestionText("");
      void queryClient.invalidateQueries({ queryKey: productQueryKeys.public.questions(productId) });
    },
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;

  const product = productQuery.data;
  const requiredOptions = product?.options.slice(0, 2) ?? [];
  const selectedVariant = useMemo(() => {
    if (!product?.variants.length) return null;
    if (!requiredOptions.length) {
      if (product.variants.length === 1) return product.variants[0];
      return product.variants.find((variant) => variant.id === selectedStandaloneVariantId) ?? null;
    }
    const selectedEntries = Object.entries(selectedOptionValues).filter(([, valueId]) => valueId);
    if (selectedEntries.length < requiredOptions.length) return null;
    return product.variants.find((variant) =>
      selectedEntries.every(([optionId, valueId]) =>
        variant.optionValues.some((optionValue) => optionValue.optionId === optionId && optionValue.valueId === valueId),
      ),
    ) ?? null;
  }, [product, requiredOptions, selectedOptionValues, selectedStandaloneVariantId]);
  const displayedStock = selectedVariant?.stock ?? product?.stock ?? 0;

  useEffect(() => {
    setQuantity((current) => Math.max(1, Math.min(current, Math.max(1, displayedStock))));
  }, [displayedStock]);

  useEffect(() => {
    if (!product) return;
    tracking.trackRecentlyViewed({ productId: product.id, shopId: product.shop.id });
    saveLocalRecentlyViewedProduct({
      productId: product.id,
      title: product.title,
      imageUrl: resolveUploadedImageUrl(product.images[0]),
      href: localePath(`/products/${product.id}`),
    });
  }, [product?.id]);

  function handleChatSeller() {
    if (!session) {
      router.push(localePath("/login"));
      return;
    }
    if (!canFetchBuyerState) return;
    createChatMutation.mutate();
  }

  function handlePurchaseAction(action: "cart" | "buy-now") {
    if (!session) {
      router.push(localePath("/login"));
      return;
    }
    if (!canFetchBuyerState || !selectedVariant || displayedStock < 1) return;
    addCartMutation.mutate({ variantId: selectedVariant.id, itemQuantity: quantity }, {
      onSuccess: () => {
        if (action === "buy-now") router.push(localePath("/cart"));
      },
    });
  }

  function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = questionText.trim();
    if (!trimmed || !canFetchBuyerState) return;
    questionMutation.mutate(trimmed);
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

  const galleryImages = product.images.map((image) => resolveUploadedImageUrl(image)).filter(Boolean);
  const hasGalleryImages = galleryImages.length > 0;
  const selectedImage = galleryImages[selectedImageIndex] ?? galleryImages[0] ?? resolveUploadedImageUrl(undefined);
  const displayPrice = selectedVariant?.price ?? product.minPrice;
  const displayCurrency = selectedVariant?.currency ?? product.currency;
  const hasPriceRange = !selectedVariant && product.maxPrice > product.minPrice;
  const originalPriceLabel = product.originalPrice && product.originalPrice > displayPrice
    ? formatMoney(product.originalPrice, displayCurrency)
    : null;
  const isOutOfStock = displayedStock < 1 || product.stock < 1;
  const canPurchase = Boolean(selectedVariant) && !isOutOfStock;
  const selectedOptionCount = Object.values(selectedOptionValues).filter(Boolean).length;
  const missingOptionCount = Math.max(0, requiredOptions.length - selectedOptionCount);
  const selectedSummary = selectedVariant
    ? [selectedVariant.title, selectedVariant.sku ? `SKU ${selectedVariant.sku}` : null].filter(Boolean).join(" | ")
    : requiredOptions.length
      ? `Select ${requiredOptions.map((option) => option.name).join(" / ")}`
      : product.variants.length > 1
        ? "Select a variant"
        : t("product.noPurchasableVariant");
  const priceLabel = hasPriceRange
    ? `${formatMoney(product.minPrice, product.currency)} - ${formatMoney(product.maxPrice, product.currency)}`
    : formatMoney(displayPrice, displayCurrency);
  const purchaseDisabledReason = (() => {
    if (!product.variants.length) return t("product.noPurchasableVariant");
    if (!requiredOptions.length && product.variants.length > 1 && !selectedVariant) return "Select a variant before purchasing.";
    if (missingOptionCount > 0) return missingOptionCount === requiredOptions.length
      ? "Choose product options before purchasing."
      : `Choose ${missingOptionCount} more option${missingOptionCount > 1 ? "s" : ""} before purchasing.`;
    if (!selectedVariant) return "This option combination is unavailable.";
    if (selectedVariant.stock < 1 || product.stock < 1) return "Selected variant is out of stock.";
    if (!canFetchBuyerState && session) return "Only buyer accounts can purchase.";
    return null;
  })();
  const stockSummary = selectedVariant
    ? selectedVariant.stock > 0
      ? `${selectedVariant.stock} ${t("product.inStock")}`
      : "Out of stock"
    : product.stock > 0
      ? `${product.stock} ${t("product.inStock")}`
      : "Out of stock";
  const selectedPurchaseSummary = selectedVariant
    ? `${selectedSummary} · Qty ${quantity}`
    : selectedSummary;

  function getOptionValueState(optionId: string, valueId: string): OptionValueState {
    if (selectedOptionValues[optionId] === valueId) return "selected";
    if (!product) return "unavailable";
    const matchingValueVariants = product.variants.filter((variant) =>
      variant.optionValues.some((optionValue) => optionValue.optionId === optionId && optionValue.valueId === valueId),
    );
    if (!matchingValueVariants.length) return "unavailable";
    const compatibleVariants = matchingValueVariants.filter((variant) =>
      Object.entries(selectedOptionValues).every(([selectedOptionId, selectedValueId]) => {
        if (!selectedValueId || selectedOptionId === optionId) return true;
        return variant.optionValues.some((optionValue) => optionValue.optionId === selectedOptionId && optionValue.valueId === selectedValueId);
      }),
    );
    if (!compatibleVariants.length) return "unavailable";
    return compatibleVariants.some((variant) => variant.stock > 0) ? "available" : "out-of-stock";
  }

  function getOptionValueClasses(state: OptionValueState) {
    if (state === "selected") return "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100";
    if (state === "available") return "border-slate-200 bg-white text-slate-700 hover:border-orange-300";
    if (state === "out-of-stock") return "cursor-not-allowed border-red-200 bg-red-50 text-red-500 opacity-70";
    return "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70";
  }

  function getOptionValueHint(state: OptionValueState) {
    if (state === "out-of-stock") return "Out of stock";
    if (state === "unavailable") return "Unavailable";
    return null;
  }

  return (
    <>
      <BuyerTopBar title={product.title} />
      <article className="mx-auto max-w-6xl space-y-4 px-3 pb-32 pt-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-square bg-slate-100">
              {showVideo && product.video ? (
                <video controls className="size-full object-contain" aria-label={`${product.title} video`}>
                  <source src={product.video.url} type={product.video.contentType} />
                </video>
              ) : hasGalleryImages ? (
                <Image src={selectedImage} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-3 px-4 text-center text-slate-500" role="img" aria-label={`${product.title} has no product images`}>
                  <ImageOffIcon className="size-12 text-slate-400" aria-hidden="true" />
                  <p className="max-w-xs text-sm font-medium text-slate-600">No product image available</p>
                </div>
              )}
            </div>
            {(hasGalleryImages || product.video) ? (
              <div className="flex gap-2 overflow-x-auto p-3" aria-label="Product media gallery" role="listbox">
                {galleryImages.slice(0, 8).map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    aria-label={`Show product image ${index + 1}`}
                    aria-selected={!showVideo && selectedImageIndex === index}
                    role="option"
                    className={`relative size-16 shrink-0 overflow-hidden rounded-md border bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${!showVideo && selectedImageIndex === index ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}
                    onClick={() => {
                      setShowVideo(false);
                      setSelectedImageIndex(index);
                    }}
                  >
                    <Image src={image} alt={`${product.title} image ${index + 1}`} fill sizes="64px" className="object-cover" />
                  </button>
                ))}
                {product.video ? (
                  <button
                    type="button"
                    aria-label="Show product video"
                    aria-selected={showVideo}
                    role="option"
                    className={`flex size-16 shrink-0 items-center justify-center rounded-md border bg-slate-950 text-white outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${showVideo ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}
                    onClick={() => setShowVideo(true)}
                  >
                    <PlayIcon className="size-5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1"><StarIcon className="size-4 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>
              <span>{product.soldCount} {t("product.sold")}</span>
              <span>{stockSummary}</span>
            </div>
            <div className="space-y-1">
              <p className="break-words text-3xl font-bold text-orange-600">{priceLabel}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {originalPriceLabel ? <span className="text-slate-400 line-through">{originalPriceLabel}</span> : null}
                {product.discountPercent ? <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">{product.discountPercent}% off</Badge> : null}
              </div>
            </div>

            <div className="space-y-3">
              {requiredOptions.length ? requiredOptions.map((option) => (
                <div key={option.id} className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">{option.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const selected = selectedOptionValues[option.id] === value.id;
                      const state = getOptionValueState(option.id, value.id);
                      const disabled = state === "unavailable" || state === "out-of-stock";
                      const hint = getOptionValueHint(state);
                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={disabled}
                          title={hint ?? (selected ? "Selected" : "Available")}
                          aria-pressed={selected}
                          aria-describedby={hint ? `${option.id}-${value.id}-hint` : undefined}
                          className={`min-h-10 max-w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${getOptionValueClasses(state)}`}
                          onClick={() => setSelectedOptionValues((current) => ({ ...current, [option.id]: selected ? "" : value.id }))}
                        >
                          {value.colorHex ? <span className="mr-2 inline-block size-3 rounded-full align-middle ring-1 ring-slate-300" style={{ backgroundColor: value.colorHex }} aria-hidden="true" /> : null}
                          <span className="break-words">{value.value}</span>
                          {hint ? <span id={`${option.id}-${value.id}-hint`} className="ml-2 text-[11px] font-semibold uppercase tracking-normal">{hint}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )) : (
                <div className="space-y-2">
                  <h2 className="font-semibold">{t("product.variants")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.length ? product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={variant.stock < 1}
                        title={variant.stock < 1 ? "Out of stock" : selectedVariant?.id === variant.id ? "Selected" : "Available"}
                        aria-pressed={selectedVariant?.id === variant.id}
                        className={`min-h-10 max-w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                          selectedVariant?.id === variant.id
                            ? "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100"
                            : variant.stock < 1
                              ? "cursor-not-allowed border-red-200 bg-red-50 text-red-500 opacity-70"
                              : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                        }`}
                        onClick={() => setSelectedStandaloneVariantId((current) => current === variant.id ? "" : variant.id)}
                      >
                        <span className="break-words">{variant.title}</span>
                        {variant.stock < 1 ? <span aria-hidden="true" className="ml-2 text-[11px] font-semibold uppercase tracking-normal">Out of stock</span> : null}
                      </button>
                    )) : <Badge variant="outline" className="rounded-md px-3 py-1">{t("product.noPurchasableVariant")}</Badge>}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Selected variant</p>
                <p className="mt-1">{selectedSummary}</p>
                <p className={`mt-2 ${purchaseDisabledReason ? "text-orange-700" : "text-emerald-700"}`}>
                  {purchaseDisabledReason ?? `${stockSummary} ready for cart.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div>
                <span className="text-sm font-medium text-slate-700">Quantity</span>
                <p className="mt-1 text-xs text-slate-500">{selectedVariant ? `Maximum ${selectedVariant.stock}` : "Select a variant to choose quantity"}</p>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200">
                <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" aria-label="Decrease quantity" disabled={quantity <= 1 || !selectedVariant} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <MinusIcon className="size-4" />
                </Button>
                <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
                <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" aria-label="Increase quantity" disabled={!selectedVariant || quantity >= displayedStock} onClick={() => setQuantity((current) => Math.min(displayedStock, current + 1))}>
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
              <span className="flex items-start gap-2"><TruckIcon className="mt-0.5 size-4 shrink-0 text-orange-600" /> <span>{t("product.shippingCalculated")}</span></span>
              <span className="flex items-start gap-2"><ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" /> <span>{t("product.buyerProtection")}</span></span>
              <span className="flex items-start gap-2"><RotateCcwIcon className="mt-0.5 size-4 shrink-0 text-sky-600" /> <span>Returns follow marketplace policy.</span></span>
            </div>
            {isOutOfStock ? <Badge variant="outline" className="w-fit rounded-full border-red-200 bg-red-50 text-red-700">Out of stock</Badge> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Highlights</h2>
          {product.highlights.length ? (
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {product.highlights.map((highlight) => <li key={highlight} className="rounded-lg bg-slate-50 px-3 py-2">{highlight}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">No highlights provided.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{product.shop.name}</h2>
              <p className="text-sm text-slate-500">{product.shop.location}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full" disabled={createChatMutation.isPending} onClick={handleChatSeller}>
                <MessageCircleIcon className="size-4" />
                {t("chat.chatSeller")}
              </Button>
              <Button type="button" variant="outline" className="rounded-full" disabled={followMutation.isPending} onClick={() => {
                if (!session) router.push(localePath("/login"));
                else followMutation.mutate();
              }}>
                <StoreIcon className="size-4" />
                {followQuery.data ? t("product.following") : t("product.followShop")}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Product facts</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {product.condition ? <FactRow label="Condition" value={product.condition} /> : null}
            {product.countryOfOrigin ? <FactRow label="Country of origin" value={product.countryOfOrigin} /> : null}
            {product.warrantyInfo ? <FactRow label="Warranty" value={product.warrantyInfo} /> : null}
            {product.brand ? <FactRow label="Brand" value={product.brand.name} /> : null}
          </dl>
          {product.attributes.length ? (
            <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              {product.attributes.map((attribute) => (
                <div key={`${attribute.key}-${attribute.name}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <dt className="font-medium text-slate-500">{attribute.name}</dt>
                  <dd className="mt-1 break-words text-slate-900">{attribute.value}</dd>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{product.description ?? t("product.noDescription")}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">{t("product.reviews")}</h2>
          <ProductReviewsSection
            fallbackRating={product.rating}
            ratingSummary={ratingSummaryQuery.data}
            ratingSummaryError={ratingSummaryQuery.error}
            ratingSummaryLoading={ratingSummaryQuery.isLoading}
            onRetryRatingSummary={() => void ratingSummaryQuery.refetch()}
            reviews={reviewsQuery.data ?? []}
            reviewsError={reviewsQuery.error}
            reviewsLoading={reviewsQuery.isLoading}
            onRetryReviews={() => void reviewsQuery.refetch()}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Questions & answers</h2>
              <p className="mt-1 text-sm text-slate-500">Ask the seller about this product.</p>
            </div>
            {questionsQuery.data?.length ? (
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                {questionsQuery.data.length} question{questionsQuery.data.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          <ProductQuestionsSection
            questions={questionsQuery.data ?? []}
            questionsError={questionsQuery.error}
            questionsLoading={questionsQuery.isLoading}
            onRetryQuestions={() => void questionsQuery.refetch()}
            canAskQuestion={canFetchBuyerState}
            isAuthenticated={Boolean(session)}
            questionText={questionText}
            onQuestionTextChange={setQuestionText}
            questionError={questionMutation.error}
            questionPending={questionMutation.isPending}
            questionSuccess={questionMutation.isSuccess}
            onQuestionSubmit={handleQuestionSubmit}
            onLogin={() => router.push(localePath("/login"))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t("product.relatedProducts")}</h2>
          {relatedQuery.isSuccess && relatedQuery.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{relatedQuery.data.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div>
          ) : null}
        </section>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{priceLabel}</p>
              <p className="truncate text-xs text-slate-600">{selectedPurchaseSummary}</p>
              <p className={`truncate text-xs ${purchaseDisabledReason ? "text-orange-700" : "text-emerald-700"}`}>
                {purchaseDisabledReason ?? `${quantity} item${quantity > 1 ? "s" : ""} | ${stockSummary}`}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-center">
              <p className="text-[11px] font-medium uppercase tracking-normal text-slate-500">Qty</p>
              <p className="text-sm font-bold text-slate-950">{quantity}</p>
            </div>
          </div>
          <div className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[48px_140px_150px_150px]">
            <Button variant="outline" size="icon" className="size-12 shrink-0 rounded-2xl" disabled={favoriteMutation.isPending} onClick={() => {
              if (!session) router.push(localePath("/login"));
              else if (canFetchBuyerState) favoriteMutation.mutate();
            }}>
              <HeartIcon className={`size-5 ${favoriteQuery.data ? "fill-orange-500 text-orange-500" : ""}`} />
              <span className="sr-only">{t("product.wishlist")}</span>
            </Button>
            <Button variant="outline" className="hidden h-12 rounded-2xl sm:inline-flex" onClick={handleChatSeller} disabled={createChatMutation.isPending}>
              <MessageCircleIcon className="size-4" />
              {t("chat.chatSeller")}
            </Button>
            <Button variant="outline" className="h-12 min-w-0 rounded-2xl px-2 text-xs sm:px-4 sm:text-sm" onClick={() => handlePurchaseAction("cart")} disabled={!canPurchase || addCartMutation.isPending}>
              <span className="relative inline-flex">
                <ShoppingCartIcon className="size-4" />
                {cartItemCount > 0 ? (
                  <span className="absolute -right-2.5 -top-2.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{t("product.addToCart")}</span>
            </Button>
            <Button className="h-12 min-w-0 rounded-2xl bg-orange-600 px-2 text-xs hover:bg-orange-700 sm:px-4 sm:text-sm" onClick={() => handlePurchaseAction("buy-now")} disabled={!canPurchase || addCartMutation.isPending}>
              <span className="truncate">{t("product.buyNow")}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProductReviewsSection({
  fallbackRating,
  ratingSummary,
  ratingSummaryError,
  ratingSummaryLoading,
  onRetryRatingSummary,
  reviews,
  reviewsError,
  reviewsLoading,
  onRetryReviews,
}: {
  fallbackRating: number;
  ratingSummary: BuyerProductRatingSummary | undefined;
  ratingSummaryError: Error | null;
  ratingSummaryLoading: boolean;
  onRetryRatingSummary: () => void;
  reviews: BuyerProductReview[];
  reviewsError: Error | null;
  reviewsLoading: boolean;
  onRetryReviews: () => void;
}) {
  const totalReviewCount = ratingSummary?.totalReviewCount ?? reviews.length;
  const averageRating = ratingSummary ? ratingSummary.averageRating : fallbackRating;

  return (
    <div className="mt-3 space-y-4">
      {ratingSummaryLoading ? (
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[180px_minmax(0,1fr)]" aria-label="Loading rating summary">
          <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => <div key={rating} className="h-4 animate-pulse rounded bg-slate-200" />)}
          </div>
        </div>
      ) : ratingSummaryError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <BuyerErrorState message={ratingSummaryError.message} onRetry={onRetryRatingSummary} />
        </div>
      ) : (
        <RatingSummaryCard averageRating={averageRating} totalReviewCount={totalReviewCount} distribution={ratingSummary?.distribution} />
      )}

      {reviewsLoading ? (
        <div className="space-y-3" aria-label="Loading reviews">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-xl border border-slate-100 p-4">
              <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : reviewsError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <BuyerErrorState message={reviewsError.message} onRetry={onRetryReviews} />
        </div>
      ) : reviews.length ? (
        <div className="space-y-3">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      ) : (
        <BuyerEmptyState title="No reviews yet" description="Published buyer reviews will appear here." />
      )}
    </div>
  );
}

function ProductQuestionsSection({
  questions,
  questionsError,
  questionsLoading,
  onRetryQuestions,
  canAskQuestion,
  isAuthenticated,
  questionText,
  onQuestionTextChange,
  questionError,
  questionPending,
  questionSuccess,
  onQuestionSubmit,
  onLogin,
}: {
  questions: BuyerProductQuestion[];
  questionsError: Error | null;
  questionsLoading: boolean;
  onRetryQuestions: () => void;
  canAskQuestion: boolean;
  isAuthenticated: boolean;
  questionText: string;
  onQuestionTextChange: (value: string) => void;
  questionError: Error | null;
  questionPending: boolean;
  questionSuccess: boolean;
  onQuestionSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLogin: () => void;
}) {
  const trimmedQuestion = questionText.trim();

  return (
    <div className="mt-3 space-y-4">
      {isAuthenticated && canAskQuestion ? (
        <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={onQuestionSubmit}>
          <label htmlFor="product-question" className="text-sm font-semibold text-slate-900">Your question</label>
          <textarea
            id="product-question"
            value={questionText}
            onChange={(event) => onQuestionTextChange(event.target.value)}
            placeholder="Ask about sizing, warranty, packaging, or product details."
            className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            disabled={questionPending}
          />
          {questionError ? <p className="text-sm text-red-600">{questionError.message}</p> : null}
          {questionSuccess && !questionError ? <p className="text-sm text-emerald-700">Question submitted.</p> : null}
          <Button type="submit" disabled={!trimmedQuestion || questionPending}>
            {questionPending ? "Submitting..." : "Submit question"}
          </Button>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {isAuthenticated ? "Only buyer accounts can ask product questions." : (
            <Button type="button" variant="outline" className="rounded-full" onClick={onLogin}>Log in to ask a question</Button>
          )}
        </div>
      )}

      {questionsLoading ? (
        <div className="space-y-3" aria-label="Loading questions">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-xl border border-slate-100 p-4">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : questionsError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <BuyerErrorState message={questionsError.message} onRetry={onRetryQuestions} />
        </div>
      ) : questions.length ? (
        <div className="space-y-3">
          {questions.map((question) => <QuestionCard key={question.id} question={question} />)}
        </div>
      ) : (
        <BuyerEmptyState title="No questions yet" description="Buyer questions and seller answers will appear here." />
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: BuyerProductQuestion }) {
  return (
    <article className="rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-orange-600">Question</p>
          <p className="mt-1 font-semibold text-slate-950">{question.user.name}</p>
        </div>
        {question.createdAt ? <time dateTime={question.createdAt} className="text-sm text-slate-500">{formatReviewDate(question.createdAt)}</time> : null}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{question.question}</p>
      {question.answers.length ? (
        <div className="mt-4 space-y-3 border-l-2 border-orange-200 pl-3">
          {question.answers.map((answer) => (
            <div key={answer.id} className="rounded-lg bg-orange-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-orange-900">Seller answer from {answer.user.name}</p>
                {answer.createdAt ? <time dateTime={answer.createdAt} className="text-xs text-orange-700">{formatReviewDate(answer.createdAt)}</time> : null}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{answer.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">The seller has not answered yet.</p>
      )}
    </article>
  );
}

function RatingSummaryCard({
  averageRating,
  totalReviewCount,
  distribution,
}: {
  averageRating: number;
  totalReviewCount: number;
  distribution: BuyerProductRatingSummary["distribution"] | undefined;
}) {
  const hasDistribution = distribution && Object.values(distribution).some((count) => count > 0);

  return (
    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <div className="flex items-center gap-2">
          <StarIcon className="size-5 fill-amber-400 text-amber-400" />
          <span className="text-3xl font-bold text-slate-950">{averageRating.toFixed(1)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{totalReviewCount} review{totalReviewCount === 1 ? "" : "s"}</p>
      </div>
      {hasDistribution ? (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = distribution[rating as 1 | 2 | 3 | 4 | 5];
            const width = totalReviewCount > 0 ? `${Math.round((count / totalReviewCount) * 100)}%` : "0%";
            return (
              <div key={rating} className="grid grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-2 text-sm text-slate-600">
                <span>{rating} star</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-amber-400" style={{ width }} />
                </div>
                <span className="text-right tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReviewCard({ review }: { review: BuyerProductReview }) {
  return (
    <article className="rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{review.reviewerName}</p>
          <div className="mt-1 flex items-center gap-1 text-sm text-amber-500" aria-label={`${review.rating} star review`}>
            {Array.from({ length: 5 }, (_, index) => (
              <StarIcon key={index} className={`size-4 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            ))}
          </div>
        </div>
        {review.createdAt ? <time dateTime={review.createdAt} className="text-sm text-slate-500">{formatReviewDate(review.createdAt)}</time> : null}
      </div>
      {review.comment ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review.comment}</p> : null}
      {review.media.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto" aria-label="Review media">
          {review.media.map((media) => (
            <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <Image src={media.url} alt={media.altText ?? "Review image"} fill sizes="80px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      {review.snapshot ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-medium text-slate-800">{review.snapshot.productTitle}</p>
          <p className="mt-1">
            {[review.snapshot.variantTitle, review.snapshot.variantSku ? `SKU ${review.snapshot.variantSku}` : null, review.snapshot.shopName].filter(Boolean).join(" | ")}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

