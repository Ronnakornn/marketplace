"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  normalizePublicProductQuestionsPage,
  normalizePublicProductRatingSummary,
  normalizePublicProductReviewsPage,
  normalizePublicProducts,
  createProductQuestion,
  publicProductDetailQueryOptions,
  publicProductQuestionsQueryOptions,
  publicProductRatingSummaryQueryOptions,
  publicRelatedProductsQueryOptions,
  publicProductReviewsQueryOptions,
  productQueryKeys,
  type BuyerProductQuestion,
  type BuyerProductQuestionsPage,
  type BuyerProductRatingSummary,
  type BuyerProductReview,
  type BuyerProductReviewsPage,
  type PublicProductQuestionAnswerStatus,
  type PublicProductQuestionSort,
  type PublicProductReviewSort,
} from "#/features/product/queries";
import {
  fetchRecentlyViewedProducts,
  getLocalRecentlyViewedProducts,
  normalizeLocalRecentlyViewedProducts,
  saveLocalRecentlyViewedProduct,
  useDiscoveryTracking,
  type RecentlyViewedProductCard as RecentlyViewedProductCardData,
} from "#/features/tracking";
import { showAddToCartError, showAddToCartSuccess } from "#/features/product/cart-handoff";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { resolveUploadedImageUrl } from "#/lib/assets";
import { useSession } from "#/lib/auth-client";

type OptionValueState = "selected" | "available" | "unavailable" | "out-of-stock";
type TrustItem = {
  icon: ReactNode;
  title: string;
  description: string;
};
type ReviewContentFilter = "all" | "media" | "comment";

const PRODUCT_DETAIL_REVIEW_PAGE_LIMIT = 5;
const PRODUCT_DETAIL_QUESTION_PAGE_LIMIT = 5;

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
  const [reviewRatingFilter, setReviewRatingFilter] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  const [reviewContentFilter, setReviewContentFilter] = useState<ReviewContentFilter>("all");
  const [reviewSort, setReviewSort] = useState<PublicProductReviewSort>("latest");
  const [reviewPage, setReviewPage] = useState(1);
  const [loadedReviews, setLoadedReviews] = useState<BuyerProductReview[]>([]);
  const [questionAnswerStatus, setQuestionAnswerStatus] = useState<PublicProductQuestionAnswerStatus>("all");
  const [questionSort, setQuestionSort] = useState<PublicProductQuestionSort>("latest");
  const [questionPage, setQuestionPage] = useState(1);
  const [loadedQuestions, setLoadedQuestions] = useState<BuyerProductQuestion[]>([]);

  const productQuery = useQuery({
    ...publicProductDetailQueryOptions({ productId, locale }),
    select: normalizePublicProduct,
  });
  const relatedQuery = useQuery({
    ...publicRelatedProductsQueryOptions({ productId, limit: 8, locale }),
    select: normalizePublicProducts,
  });
  const recentlyViewedQuery = useQuery({
    queryKey: ["discovery", "recently-viewed", { limit: 8, locale }],
    queryFn: async () => {
      const remote = await fetchRecentlyViewedProducts(8);
      return remote.length ? remote : normalizeLocalRecentlyViewedProducts(getLocalRecentlyViewedProducts());
    },
    staleTime: 30_000,
  });
  const reviewsQuery = useQuery({
    ...publicProductReviewsQueryOptions({
      productId,
      rating: reviewRatingFilter,
      hasMedia: reviewContentFilter === "media" ? true : undefined,
      hasComment: reviewContentFilter === "comment" ? true : undefined,
      sort: reviewSort,
      page: reviewPage,
      limit: PRODUCT_DETAIL_REVIEW_PAGE_LIMIT,
    }),
    select: normalizePublicProductReviewsPage,
  });
  const ratingSummaryQuery = useQuery({
    ...publicProductRatingSummaryQueryOptions(productId),
    select: normalizePublicProductRatingSummary,
  });
  const questionsQuery = useQuery({
    ...publicProductQuestionsQueryOptions({
      productId,
      answerStatus: questionAnswerStatus,
      sort: questionSort,
      page: questionPage,
      limit: PRODUCT_DETAIL_QUESTION_PAGE_LIMIT,
    }),
    select: normalizePublicProductQuestionsPage,
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
    onError: (error) => showAddToCartError({
      error,
      copy: {
        errorTitle: t("cart.handoffErrorTitle"),
        errorDescription: t("cart.handoffErrorDescription"),
      },
    }),
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

  useEffect(() => {
    setReviewPage(1);
    setLoadedReviews([]);
  }, [productId, reviewRatingFilter, reviewContentFilter, reviewSort]);

  useEffect(() => {
    setQuestionPage(1);
    setLoadedQuestions([]);
  }, [productId, questionAnswerStatus, questionSort]);

  useEffect(() => {
    if (!reviewsQuery.data) return;
    setLoadedReviews((current) => mergeById(reviewPage === 1 ? [] : current, reviewsQuery.data.items));
  }, [reviewsQuery.data, reviewPage]);

  useEffect(() => {
    if (!questionsQuery.data) return;
    setLoadedQuestions((current) => mergeById(questionPage === 1 ? [] : current, questionsQuery.data.items));
  }, [questionsQuery.data, questionPage]);

  const product = productQuery.data;
  const relatedProducts = (relatedQuery.data ?? []).filter((item) => item.id !== product?.id).slice(0, 4);
  const recentlyViewedProducts = (recentlyViewedQuery.data ?? []).filter((item) => item.productId !== product?.id).slice(0, 4);
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
      router.push(getProductLoginPath());
      return;
    }
    if (!canFetchBuyerState) return;
    createChatMutation.mutate();
  }

  function handlePurchaseAction(action: "cart" | "buy-now") {
    if (!session) {
      router.push(getProductLoginPath());
      return;
    }
    if (!canFetchBuyerState || !selectedVariant || displayedStock < 1) return;
    addCartMutation.mutate({ variantId: selectedVariant.id, itemQuantity: quantity }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["buyer-cart"] });
        showAddToCartSuccess({
          copy: {
            successTitle: t("cart.handoffAddedTitle"),
            successDescription: t("cart.handoffAddedDescription"),
            viewCart: t("cart.viewCart"),
            continueShopping: t("cart.continueShopping"),
          },
          context: {
            productTitle: product?.title,
            variantTitle: selectedVariant.title,
          },
          onViewCart: () => router.push(localePath("/cart")),
        });
        if (action === "buy-now") router.push(localePath("/cart"));
      },
    });
  }

  function getProductLoginPath() {
    return localePath(`/login?next=${encodeURIComponent(`/products/${productId}`)}`);
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
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4">
          <BuyerErrorState message={getReadableErrorMessage(productQuery.error, t("product.productUnavailable"))} onRetry={() => void productQuery.refetch()} />
        </div>
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
        ? t("product.selectVariant")
        : t("product.noPurchasableVariant");
  const priceLabel = hasPriceRange
    ? `${formatMoney(product.minPrice, product.currency)} - ${formatMoney(product.maxPrice, product.currency)}`
    : formatMoney(displayPrice, displayCurrency);
  const purchaseDisabledReason = (() => {
    if (!product.variants.length) return t("product.noPurchasableVariant");
    if (!session) return t("product.loginToAddToCart");
    if (!requiredOptions.length && product.variants.length > 1 && !selectedVariant) return t("product.selectVariantBeforePurchase");
    if (missingOptionCount > 0) return missingOptionCount === requiredOptions.length
      ? t("product.chooseOptionsBeforePurchase")
      : t("product.chooseMoreOptions").replace("{count}", String(missingOptionCount));
    if (!selectedVariant) return t("product.optionCombinationUnavailable");
    if (selectedVariant.stock < 1 || product.stock < 1) return t("product.selectedVariantOutOfStock");
    if (!canFetchBuyerState && session) return t("product.onlyBuyerAccountsCanPurchase");
    return null;
  })();
  const purchaseBlockedReason = session ? purchaseDisabledReason : null;
  const purchaseActionDisabled = Boolean(purchaseBlockedReason) || !canPurchase || addCartMutation.isPending;
  const purchaseStatusId = "product-purchase-status";
  const purchaseErrorId = "product-purchase-error";
  const purchaseErrorMessage = addCartMutation.error
    ? getReadableErrorMessage(addCartMutation.error, t("product.actionUnavailableTryAgain"))
    : null;
  const stockSummary = selectedVariant
    ? selectedVariant.stock > 0
      ? `${selectedVariant.stock} ${t("product.inStock")}`
      : t("product.outOfStock")
    : product.stock > 0
      ? `${product.stock} ${t("product.inStock")}`
      : t("product.outOfStock");
  const quantityLabel = t(quantity === 1 ? "product.selectedQuantityOne" : "product.selectedQuantity").replace("{quantity}", String(quantity));
  const purchaseStatusText = purchaseErrorMessage ?? purchaseDisabledReason ?? `${quantityLabel} | ${stockSummary}`;
  const selectedPurchaseSummary = selectedVariant
    ? `${selectedSummary} | Qty ${quantity}`
    : selectedSummary;
  const trustItems: TrustItem[] = [
    {
      icon: <TruckIcon className="size-4 text-orange-600" aria-hidden="true" />,
      title: t("product.shipping"),
      description: t("product.shippingCalculated"),
    },
    {
      icon: <ShieldCheckIcon className="size-4 text-emerald-600" aria-hidden="true" />,
      title: t("product.buyerProtectionTitle"),
      description: t("product.buyerProtection"),
    },
    {
      icon: <RotateCcwIcon className="size-4 text-sky-600" aria-hidden="true" />,
      title: t("product.returns"),
      description: t("product.returnsPolicy"),
    },
  ];
  const factCount = [product.condition, product.countryOfOrigin, product.warrantyInfo, product.brand?.name].filter(Boolean).length;

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
    if (state === "out-of-stock") return t("product.outOfStock");
    if (state === "unavailable") return t("common.unavailable");
    return null;
  }

  return (
    <>
      <BuyerTopBar title={product.title} />
      <article className="mx-auto max-w-6xl space-y-4 px-3 pb-40 pt-4 sm:pb-36">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-square bg-slate-100">
              {showVideo && product.video ? (
                <video controls className="size-full object-contain" aria-label={t("product.productVideo").replace("{title}", product.title)}>
                  <source src={product.video.url} type={product.video.contentType} />
                </video>
              ) : hasGalleryImages ? (
                <Image src={selectedImage} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-3 px-4 text-center text-slate-500" role="img" aria-label={t("product.noProductImages").replace("{title}", product.title)}>
                  <ImageOffIcon className="size-12 text-slate-400" aria-hidden="true" />
                  <p className="max-w-xs text-sm font-medium text-slate-600">{t("product.noProductImageAvailable")}</p>
                </div>
              )}
            </div>
            {(hasGalleryImages || product.video) ? (
              <div className="flex gap-2 overflow-x-auto p-3" aria-label={t("product.productMediaGallery")} role="listbox">
                {galleryImages.slice(0, 8).map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    aria-label={t("product.showProductImage").replace("{index}", String(index + 1))}
                    aria-selected={!showVideo && selectedImageIndex === index}
                    role="option"
                    className={`relative size-16 shrink-0 overflow-hidden rounded-md border bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${!showVideo && selectedImageIndex === index ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}
                    onClick={() => {
                      setShowVideo(false);
                      setSelectedImageIndex(index);
                    }}
                  >
                    <Image src={image} alt={t("product.productImage").replace("{title}", product.title).replace("{index}", String(index + 1))} fill sizes="64px" className="object-cover" />
                  </button>
                ))}
                {product.video ? (
                  <button
                    type="button"
                    aria-label={t("product.showProductVideo")}
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
              <p className="break-words text-2xl font-bold leading-tight text-orange-600 sm:text-3xl">{priceLabel}</p>
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
                          title={hint ?? (selected ? t("product.selected") : t("common.available"))}
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
                        title={variant.stock < 1 ? t("product.outOfStock") : selectedVariant?.id === variant.id ? t("product.selected") : t("common.available")}
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
                        {variant.stock < 1 ? <span aria-hidden="true" className="ml-2 text-[11px] font-semibold uppercase tracking-normal">{t("product.outOfStock")}</span> : null}
                      </button>
                    )) : <Badge variant="outline" className="rounded-md px-3 py-1">{t("product.noPurchasableVariant")}</Badge>}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{t("product.selectedVariant")}</p>
                    <p className="mt-1 break-words">{selectedSummary}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 rounded-full ${isOutOfStock ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {stockSummary}
                  </Badge>
                </div>
                <p id={purchaseStatusId} className={`mt-2 break-words ${purchaseDisabledReason || purchaseErrorMessage ? "text-orange-700" : "text-emerald-700"}`}>
                  {purchaseStatusText}
                </p>
                {purchaseErrorMessage ? (
                  <p id={purchaseErrorId} className="mt-2 line-clamp-2 break-words text-red-600">
                    {purchaseErrorMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <span className="text-sm font-medium text-slate-700">{t("product.quantity")}</span>
                <p className="mt-1 break-words text-xs text-slate-500">{selectedVariant ? t("product.maximumStock").replace("{count}", String(selectedVariant.stock)) : t("product.selectVariantForQuantity")}</p>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200">
                <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" aria-label={t("product.decreaseQuantity")} disabled={quantity <= 1 || !selectedVariant} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <MinusIcon className="size-4" />
                </Button>
                <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
                <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" aria-label={t("product.increaseQuantity")} disabled={!selectedVariant || quantity >= displayedStock} onClick={() => setQuantity((current) => Math.min(displayedStock, current + 1))}>
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-sm text-slate-700" aria-label={t("product.marketplaceAssurances")}>
              {trustItems.map((item) => (
                <div key={item.title} className="grid grid-cols-[32px_minmax(0,1fr)] gap-2 rounded-xl bg-white/70 p-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">{item.title}</span>
                    <span className="block break-words text-sm text-slate-700">{item.description}</span>
                  </span>
                </div>
              ))}
            </div>
            {isOutOfStock ? <Badge variant="outline" className="w-fit rounded-full border-red-200 bg-red-50 text-red-700">{t("product.outOfStock")}</Badge> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader title={t("product.highlights")} description={t("product.highlightsDescription")} />
          {product.highlights.length ? (
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {product.highlights.map((highlight) => <li key={highlight} className="break-words rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">{highlight}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">{t("product.noHighlights")}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={t("product.shopTrust")}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-orange-600">{t("product.soldBy")}</p>
              <h2 className="mt-1 break-words text-lg font-bold text-slate-950">{product.shop.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{product.shop.location}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{t("product.activeMarketplaceShop")}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
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
          <SectionHeader title={t("product.productFacts")} description={t("product.productFactsDescription")} meta={factCount ? t("product.factsCount").replace("{count}", String(factCount)) : undefined} />
          {factCount ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {product.condition ? <FactRow label={t("product.condition")} value={product.condition} /> : null}
              {product.countryOfOrigin ? <FactRow label={t("product.countryOfOrigin")} value={product.countryOfOrigin} /> : null}
              {product.warrantyInfo ? <FactRow label={t("product.warranty")} value={product.warrantyInfo} /> : null}
              {product.brand ? <FactRow label={t("product.brand")} value={product.brand.name} /> : null}
            </dl>
          ) : (
            <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t("product.noProductFacts")}</p>
          )}
          {product.attributes.length ? (
            <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              {product.attributes.map((attribute) => (
                <div key={`${attribute.key}-${attribute.name}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <dt className="break-words font-medium text-slate-500">{attribute.name}</dt>
                  <dd className="mt-1 break-words text-slate-900">{attribute.value}</dd>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader title={t("product.description")} description={t("product.descriptionSubtitle")} />
          <p className="mt-3 whitespace-pre-line break-words rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{product.description ?? t("product.noDescription")}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader title={t("product.reviews")} description={t("product.reviewsSubtitle")} />
          <ProductReviewsSection
            fallbackRating={product.rating}
            ratingSummary={ratingSummaryQuery.data}
            ratingSummaryError={ratingSummaryQuery.error}
            ratingSummaryLoading={ratingSummaryQuery.isLoading}
            onRetryRatingSummary={() => void ratingSummaryQuery.refetch()}
            reviews={loadedReviews}
            reviewPage={reviewsQuery.data}
            ratingFilter={reviewRatingFilter}
            contentFilter={reviewContentFilter}
            sort={reviewSort}
            onRatingFilterChange={setReviewRatingFilter}
            onContentFilterChange={setReviewContentFilter}
            onSortChange={setReviewSort}
            onLoadMore={() => setReviewPage((page) => page + 1)}
            reviewsError={reviewsQuery.error}
            reviewsLoading={reviewsQuery.isLoading && !loadedReviews.length}
            reviewsFetchingMore={reviewsQuery.isFetching && reviewPage > 1}
            onRetryReviews={() => void reviewsQuery.refetch()}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader title={t("product.questionsTitle")} description={t("product.questionsSubtitle")} />
            {loadedQuestions.length ? (
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                {t(loadedQuestions.length === 1 ? "product.questionCountOne" : "product.questionCount").replace("{count}", String(loadedQuestions.length))}
              </Badge>
            ) : null}
          </div>
          <ProductQuestionsSection
            questions={loadedQuestions}
            questionsPage={questionsQuery.data}
            answerStatus={questionAnswerStatus}
            sort={questionSort}
            onAnswerStatusChange={setQuestionAnswerStatus}
            onSortChange={setQuestionSort}
            onLoadMore={() => setQuestionPage((page) => page + 1)}
            questionsError={questionsQuery.error}
            questionsLoading={questionsQuery.isLoading && !loadedQuestions.length}
            questionsFetchingMore={questionsQuery.isFetching && questionPage > 1}
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

        <ProductDiscoverySection
          title={t("product.relatedProducts")}
          isLoading={relatedQuery.isLoading}
          error={relatedQuery.error}
          onRetry={() => void relatedQuery.refetch()}
          emptyTitle={t("product.relatedEmptyTitle")}
          emptyDescription={t("product.relatedEmptyDescription")}
        >
          {relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}
        </ProductDiscoverySection>

        <ProductDiscoverySection
          title={t("home.recentlyViewedTitle")}
          isLoading={recentlyViewedQuery.isLoading}
          error={recentlyViewedQuery.error}
          onRetry={() => void recentlyViewedQuery.refetch()}
          emptyTitle={t("home.recentlyViewedEmptyTitle")}
          emptyDescription={t("product.recentlyViewedEmptyDescription")}
        >
          {recentlyViewedProducts.map((item) => <RecentlyViewedProductCard key={item.productId} product={item} />)}
        </ProductDiscoverySection>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-2 pb-[max(env(safe-area-inset-bottom),0.65rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] sm:p-3 sm:pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto grid max-w-6xl gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_auto]" data-testid="product-sticky-buy-bar">
          <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{priceLabel}</p>
              <p className="truncate text-xs text-slate-600">{selectedPurchaseSummary}</p>
              <p className={`truncate text-xs ${purchaseDisabledReason || purchaseErrorMessage ? "text-orange-700" : "text-emerald-700"}`}>
                {purchaseStatusText}
              </p>
              <p className="sr-only" aria-live="polite">
                {purchaseStatusText}
              </p>
            </div>
            <div className="rounded-lg bg-white px-2 py-2 text-center sm:px-3">
              <p className="text-[11px] font-medium uppercase tracking-normal text-slate-500">{t("product.quantityShort")}</p>
              <p className="text-sm font-bold text-slate-950">{quantity}</p>
            </div>
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[48px_140px_150px_150px]">
            <Button variant="outline" size="icon" className="size-11 shrink-0 rounded-2xl sm:size-12" aria-label={favoriteQuery.data ? t("product.removeFromWishlistShort") : t("product.addToWishlist")} disabled={favoriteMutation.isPending} onClick={() => {
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
            <Button
              variant="outline"
              className="h-11 min-w-0 rounded-2xl px-2 text-xs sm:h-12 sm:px-4 sm:text-sm"
              aria-describedby={`${purchaseStatusId}${purchaseErrorMessage ? ` ${purchaseErrorId}` : ""}`}
              title={purchaseBlockedReason ?? undefined}
              onClick={() => handlePurchaseAction("cart")}
              disabled={purchaseActionDisabled}
            >
              <span className="relative inline-flex">
                <ShoppingCartIcon className="size-4" />
                {cartItemCount > 0 ? (
                  <span className="absolute -right-2.5 -top-2.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : null}
              </span>
              <span className="inline-block min-w-0 max-w-full truncate text-center sm:min-w-[5.75rem]">
                {addCartMutation.isPending ? t("product.adding") : t("product.addToCart")}
              </span>
            </Button>
            <Button
              className="h-11 min-w-0 rounded-2xl bg-orange-600 px-2 text-xs hover:bg-orange-700 sm:h-12 sm:px-4 sm:text-sm"
              aria-describedby={`${purchaseStatusId}${purchaseErrorMessage ? ` ${purchaseErrorId}` : ""}`}
              title={purchaseBlockedReason ?? undefined}
              onClick={() => handlePurchaseAction("buy-now")}
              disabled={purchaseActionDisabled}
            >
              <span className="inline-block min-w-0 max-w-full truncate text-center sm:min-w-[4.75rem]">
                {addCartMutation.isPending ? t("product.adding") : t("product.buyNow")}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProductDiscoverySection({
  title,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode[];
}) {
  const hasItems = children.length > 0;
  const t = useTranslations();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <SectionHeader title={title} description={hasItems ? t("product.discoveryRailDescription") : emptyDescription} meta={hasItems ? t("product.shownCount").replace("{count}", String(children.length)) : undefined} />
        {error ? (
          <Button type="button" variant="ghost" size="sm" className="rounded-full text-slate-600" onClick={onRetry}>
            {t("state.retry")}
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("product.loadingRail").replace("{title}", title)}>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {t("product.railUnavailable").replace("{title}", title)}
        </p>
      ) : hasItems ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

function RecentlyViewedProductCard({ product }: { product: RecentlyViewedProductCardData }) {
  const image = resolveUploadedImageUrl(product.imageUrl ?? undefined);
  const priceLabel = product.minPrice && product.currency ? formatMoney(product.minPrice, product.currency) : null;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <a href={product.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
          <Image src={image} alt={product.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
        </div>
        <div className="space-y-2 p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">{product.title}</h3>
          {priceLabel ? <p className="truncate text-base font-bold text-orange-600">{priceLabel}</p> : null}
          <p className="break-words text-xs text-slate-500">{product.shop.name}</p>
        </div>
      </a>
    </article>
  );
}

function ProductReviewsSection({
  fallbackRating,
  ratingSummary,
  ratingSummaryError,
  ratingSummaryLoading,
  onRetryRatingSummary,
  reviews,
  reviewPage,
  ratingFilter,
  contentFilter,
  sort,
  onRatingFilterChange,
  onContentFilterChange,
  onSortChange,
  onLoadMore,
  reviewsError,
  reviewsLoading,
  reviewsFetchingMore,
  onRetryReviews,
}: {
  fallbackRating: number;
  ratingSummary: BuyerProductRatingSummary | undefined;
  ratingSummaryError: Error | null;
  ratingSummaryLoading: boolean;
  onRetryRatingSummary: () => void;
  reviews: BuyerProductReview[];
  reviewPage: BuyerProductReviewsPage | undefined;
  ratingFilter: 1 | 2 | 3 | 4 | 5 | undefined;
  contentFilter: ReviewContentFilter;
  sort: PublicProductReviewSort;
  onRatingFilterChange: (rating: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onContentFilterChange: (filter: ReviewContentFilter) => void;
  onSortChange: (sort: PublicProductReviewSort) => void;
  onLoadMore: () => void;
  reviewsError: Error | null;
  reviewsLoading: boolean;
  reviewsFetchingMore: boolean;
  onRetryReviews: () => void;
}) {
  const t = useTranslations();
  const totalReviewCount = ratingSummary?.totalReviewCount ?? reviews.length;
  const averageRating = ratingSummary ? ratingSummary.averageRating : fallbackRating;
  const hasActiveFilter = ratingFilter !== undefined || contentFilter !== "all";

  return (
    <div className="mt-3 space-y-4">
      {ratingSummaryLoading ? (
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[180px_minmax(0,1fr)]" aria-label={t("product.loadingRatingSummary")}>
          <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => <div key={rating} className="h-4 animate-pulse rounded bg-slate-200" />)}
          </div>
        </div>
      ) : ratingSummaryError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <BuyerErrorState message={getReadableErrorMessage(ratingSummaryError, t("product.ratingSummaryUnavailable"))} onRetry={onRetryRatingSummary} />
        </div>
      ) : (
        <RatingSummaryCard averageRating={averageRating} totalReviewCount={totalReviewCount} distribution={ratingSummary?.distribution} />
      )}

      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2" aria-label={t("product.reviewRatingFilter")}>
          <FilterButton active={ratingFilter === undefined} onClick={() => onRatingFilterChange(undefined)}>{t("product.allRatings")}</FilterButton>
          {[5, 4, 3, 2, 1].map((rating) => (
            <FilterButton key={rating} active={ratingFilter === rating} onClick={() => onRatingFilterChange(rating as 1 | 2 | 3 | 4 | 5)}>
              {t("product.starCount").replace("{count}", String(rating))}
            </FilterButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label={t("product.reviewContentFilter")}>
          <FilterButton active={contentFilter === "all"} onClick={() => onContentFilterChange("all")}>{t("product.allReviews")}</FilterButton>
          <FilterButton active={contentFilter === "media"} onClick={() => onContentFilterChange("media")}>{t("product.withMedia")}</FilterButton>
          <FilterButton active={contentFilter === "comment"} onClick={() => onContentFilterChange("comment")}>{t("product.withComment")}</FilterButton>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={t("product.reviewSort")}>
          <FilterButton active={sort === "latest"} onClick={() => onSortChange("latest")}>{t("product.latest")}</FilterButton>
          <FilterButton active={sort === "rating_desc"} onClick={() => onSortChange("rating_desc")}>{t("product.ratingHigh")}</FilterButton>
          <FilterButton active={sort === "rating_asc"} onClick={() => onSortChange("rating_asc")}>{t("product.ratingLow")}</FilterButton>
        </div>
      </div>

      {reviewsLoading ? (
        <div className="space-y-3" aria-label={t("product.loadingReviews")}>
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
          <BuyerErrorState message={getReadableErrorMessage(reviewsError, t("product.reviewsUnavailable"))} onRetry={onRetryReviews} />
        </div>
      ) : reviews.length ? (
        <div className="grid gap-3">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          {reviewPage?.meta.hasNextPage ? (
            <Button type="button" variant="outline" className="justify-self-center rounded-full" disabled={reviewsFetchingMore} onClick={onLoadMore}>
              {reviewsFetchingMore ? t("common.loading") : t("product.loadMoreReviews")}
            </Button>
          ) : null}
        </div>
      ) : (
        <BuyerEmptyState
          title={hasActiveFilter ? t("product.noReviewsMatchFilters") : t("product.noReviewsTitle")}
          description={hasActiveFilter ? t("product.tryDifferentReviewFilter") : t("product.noPublishedReviewsDescription")}
        />
      )}
    </div>
  );
}

function ProductQuestionsSection({
  questions,
  questionsPage,
  answerStatus,
  sort,
  onAnswerStatusChange,
  onSortChange,
  onLoadMore,
  questionsError,
  questionsLoading,
  questionsFetchingMore,
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
  questionsPage: BuyerProductQuestionsPage | undefined;
  answerStatus: PublicProductQuestionAnswerStatus;
  sort: PublicProductQuestionSort;
  onAnswerStatusChange: (status: PublicProductQuestionAnswerStatus) => void;
  onSortChange: (sort: PublicProductQuestionSort) => void;
  onLoadMore: () => void;
  questionsError: Error | null;
  questionsLoading: boolean;
  questionsFetchingMore: boolean;
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
  const t = useTranslations();
  const trimmedQuestion = questionText.trim();
  const hasActiveFilter = answerStatus !== "all";

  return (
    <div className="mt-3 space-y-4">
      {isAuthenticated && canAskQuestion ? (
        <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={onQuestionSubmit}>
          <label htmlFor="product-question" className="text-sm font-semibold text-slate-900">{t("product.yourQuestion")}</label>
          <textarea
            id="product-question"
            value={questionText}
            onChange={(event) => onQuestionTextChange(event.target.value)}
            placeholder={t("product.questionPlaceholder")}
            className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            disabled={questionPending}
          />
          {questionError ? <p className="text-sm text-red-600">{getReadableErrorMessage(questionError, t("product.questionUnavailable"))}</p> : null}
          {questionSuccess && !questionError ? <p className="text-sm text-emerald-700">{t("product.questionSubmitted")}</p> : null}
          <Button type="submit" disabled={!trimmedQuestion || questionPending}>
            {questionPending ? t("product.submittingQuestion") : t("product.submitQuestion")}
          </Button>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {isAuthenticated ? t("product.onlyBuyerQuestions") : (
            <Button type="button" variant="outline" className="rounded-full" onClick={onLogin}>{t("product.loginToAskQuestion")}</Button>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2" aria-label={t("product.questionAnswerFilter")}>
          <FilterButton active={answerStatus === "all"} onClick={() => onAnswerStatusChange("all")}>{t("product.allQuestions")}</FilterButton>
          <FilterButton active={answerStatus === "answered"} onClick={() => onAnswerStatusChange("answered")}>{t("product.answered")}</FilterButton>
          <FilterButton active={answerStatus === "unanswered"} onClick={() => onAnswerStatusChange("unanswered")}>{t("product.unanswered")}</FilterButton>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={t("product.questionSort")}>
          <FilterButton active={sort === "latest"} onClick={() => onSortChange("latest")}>{t("product.latest")}</FilterButton>
          <FilterButton active={sort === "oldest"} onClick={() => onSortChange("oldest")}>{t("product.oldest")}</FilterButton>
        </div>
      </div>

      {questionsLoading ? (
        <div className="space-y-3" aria-label={t("product.loadingQuestions")}>
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
          <BuyerErrorState message={getReadableErrorMessage(questionsError, t("product.questionsUnavailable"))} onRetry={onRetryQuestions} />
        </div>
      ) : questions.length ? (
        <div className="grid gap-3">
          {questions.map((question) => <QuestionCard key={question.id} question={question} />)}
          {questionsPage?.meta.hasNextPage ? (
            <Button type="button" variant="outline" className="justify-self-center rounded-full" disabled={questionsFetchingMore} onClick={onLoadMore}>
              {questionsFetchingMore ? t("common.loading") : t("product.loadMoreQuestions")}
            </Button>
          ) : null}
        </div>
      ) : (
        <BuyerEmptyState
          title={hasActiveFilter ? t("product.noQuestionsMatchFilters") : t("product.noQuestionsTitle")}
          description={hasActiveFilter ? t("product.tryAnotherQuestionFilter") : t("product.noQuestionsDescription")}
        />
      )}
    </div>
  );
}

function getReadableErrorMessage(error: unknown, fallback: string) {
  const extracted = extractErrorText(error);
  return extracted && extracted !== "[object Object]" ? extracted : fallback;
}

function mergeById<T extends { id: string }>(current: T[], next: T[]): T[] {
  const itemsById = new Map(current.map((item) => [item.id, item]));
  for (const item of next) itemsById.set(item.id, item);
  return [...itemsById.values()];
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className={`min-h-9 rounded-full px-3 text-xs sm:text-sm ${active ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-white text-slate-700"}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function extractErrorText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["message", "detail", "error", "reason", "response"]) {
    const nested = extractErrorText(record[key]);
    if (nested) return nested;
  }

  return null;
}

function QuestionCard({ question }: { question: BuyerProductQuestion }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <article className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-orange-600">{t("product.question")}</p>
          <p className="mt-1 break-words font-semibold text-slate-950">{question.user.name}</p>
        </div>
        {question.createdAt ? <time dateTime={question.createdAt} className="text-sm text-slate-500">{formatReviewDate(question.createdAt, locale)}</time> : null}
      </div>
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{question.question}</p>
      {question.answers.length ? (
        <div className="mt-4 space-y-3 border-l-2 border-orange-200 pl-3">
          {question.answers.map((answer) => (
            <div key={answer.id} className="rounded-lg bg-orange-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-words text-sm font-semibold text-orange-900">{t("product.sellerAnswerFrom").replace("{name}", answer.user.name)}</p>
                {answer.createdAt ? <time dateTime={answer.createdAt} className="text-xs text-orange-700">{formatReviewDate(answer.createdAt, locale)}</time> : null}
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{answer.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{t("product.sellerNotAnswered")}</p>
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
  const t = useTranslations();
  const hasDistribution = distribution && Object.values(distribution).some((count) => count > 0);

  return (
    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <div className="flex items-center gap-2">
          <StarIcon className="size-5 fill-amber-400 text-amber-400" />
          <span className="text-3xl font-bold text-slate-950">{averageRating.toFixed(1)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{t(totalReviewCount === 1 ? "product.reviewCountOne" : "product.reviewCount").replace("{count}", String(totalReviewCount))}</p>
      </div>
      {hasDistribution ? (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = distribution[rating as 1 | 2 | 3 | 4 | 5];
            const width = totalReviewCount > 0 ? `${Math.round((count / totalReviewCount) * 100)}%` : "0%";
            return (
              <div key={rating} className="grid grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-2 text-sm text-slate-600">
                <span>{t("product.starCount").replace("{count}", String(rating))}</span>
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
  const t = useTranslations();
  const locale = useLocale();
  return (
    <article className="rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{review.reviewerName}</p>
          <div className="mt-1 flex items-center gap-1 text-sm text-amber-500" aria-label={t("product.starReview").replace("{rating}", String(review.rating))}>
            {Array.from({ length: 5 }, (_, index) => (
              <StarIcon key={index} className={`size-4 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            ))}
          </div>
        </div>
        {review.createdAt ? <time dateTime={review.createdAt} className="text-sm text-slate-500">{formatReviewDate(review.createdAt, locale)}</time> : null}
      </div>
      {review.comment ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review.comment}</p> : null}
      {review.media.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto" aria-label={t("product.reviewMedia")}>
          {review.media.map((media) => (
            <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img src={media.url} alt={media.altText ?? t("product.reviewImage")} className="size-full object-cover" loading="lazy" />
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

function formatReviewDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <dt className="break-words font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-900">{value}</dd>
    </div>
  );
}

function SectionHeader({ title, description, meta }: { title: string; description?: string; meta?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start gap-2">
        <h2 className="break-words text-lg font-bold text-slate-950">{title}</h2>
        {meta ? <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">{meta}</Badge> : null}
      </div>
      {description ? <p className="mt-1 max-w-2xl break-words text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

