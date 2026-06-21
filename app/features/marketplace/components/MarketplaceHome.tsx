"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlameIcon,
  Grid3X3Icon,
  HeartIcon,
  HomeIcon,
  MenuIcon,
  PackageIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  StarIcon,
  TicketPercentIcon,
  UserCircleIcon,
  ZapIcon,
} from "lucide-react";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { addCartItem } from "#/features/buyer/api";
import {
  marketplaceHomeQueryOptions,
  normalizeMarketplaceHome,
  type MarketplaceBanner,
  type MarketplaceCategory,
  type MarketplaceHomeData,
  type MarketplaceProductCard,
  type MarketplacePromotion,
  type MarketplaceShop,
} from "#/features/marketplace/queries";
import { ProductCard as BuyerProductCard } from "#/features/product/components/ProductCard";
import { showAddToCartError, showAddToCartSuccess } from "#/features/product/cart-handoff";
import { getAnonymousSessionId, trackDiscoveryEvent, useTrackVisibleProducts } from "#/features/tracking";
import { useFormatters, useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { resolveUploadedImageUrl } from "#/lib/assets";

interface MarketplaceHomeProps {
  user?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
}

const fallbackCategoryItems = [
  ["fashion", "Fashion", "bg-rose-100 text-rose-600"],
  ["beauty", "Beauty", "bg-pink-100 text-pink-600"],
  ["gadgets", "Gadgets", "bg-slate-100 text-slate-700"],
  ["home", "Home", "bg-emerald-100 text-emerald-700"],
  ["sports", "Sports", "bg-orange-100 text-orange-600"],
  ["kids", "Kids", "bg-violet-100 text-violet-600"],
  ["groceries", "Groceries", "bg-lime-100 text-lime-700"],
  ["pets", "Pets", "bg-amber-100 text-amber-700"],
  ["deals", "Deals", "bg-red-100 text-red-600"],
  ["more", "More", "bg-slate-100 text-slate-700"],
] as const;

const categoryStyles = [
  "bg-rose-100 text-rose-600",
  "bg-pink-100 text-pink-600",
  "bg-slate-100 text-slate-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-600",
  "bg-violet-100 text-violet-600",
  "bg-lime-100 text-lime-700",
  "bg-amber-100 text-amber-700",
  "bg-red-100 text-red-600",
  "bg-slate-100 text-slate-700",
];

const productGradients = [
  "from-orange-100 via-rose-100 to-white",
  "from-cyan-100 via-sky-100 to-white",
  "from-emerald-100 via-lime-100 to-white",
  "from-violet-100 via-fuchsia-100 to-white",
  "from-amber-100 via-orange-100 to-white",
  "from-slate-100 via-zinc-100 to-white",
];

function ClientReadyBuyerTopBar({ title }: { title: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="sticky top-0 z-40 h-[76px] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl"
      />
    );
  }

  return <BuyerTopBar title={title} />;
}

export function MarketplaceHome({ user = null }: MarketplaceHomeProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const localePath = useLocalePath();
  const locale = useLocale();
  const formatters = useFormatters();
  const t = useTranslations();
  const [sessionId, setSessionId] = useState("");
  const canUseBuyerCart = user?.role === "USER";
  const homeQuery = useQuery({
    ...marketplaceHomeQueryOptions({ locale, limit: 12, sessionId }),
    select: normalizeMarketplaceHome,
  });
  const addToCartMutation = useMutation({
    mutationFn: ({ product, variantId }: { product: MarketplaceProductCard; variantId: string }) => addCartItem(variantId, 1).then(() => product),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] });
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart"] });
      showAddToCartSuccess({
        copy: {
          successTitle: t("cart.handoffAddedTitle"),
          successDescription: t("cart.handoffAddedDescription"),
          viewCart: t("cart.viewCart"),
          continueShopping: t("cart.continueShopping"),
        },
        context: {
          productTitle: product.title,
        },
        onViewCart: () => router.push(localePath("/cart")),
      });
    },
    onError: (error) => showAddToCartError({
      error,
      copy: {
        errorTitle: t("cart.handoffErrorTitle"),
        errorDescription: t("cart.handoffErrorDescription"),
      },
    }),
  });
  const [visibleCount, setVisibleCount] = useState(8);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const home = homeQuery.data ?? emptyMarketplaceHome;
  const visibleProducts = home.recommendedProducts.slice(0, visibleCount);
  const categories = useMemo(() => {
    if (home.categories.length) return home.categories.map((category, index) => ({
      slug: category.slug,
      label: category.name,
      className: categoryStyles[index % categoryStyles.length] ?? categoryStyles.at(-1)!,
    }));
    return fallbackCategoryItems.map(([slug, label, className]) => ({ slug, label, className }));
  }, [home.categories]);
  useTrackVisibleProducts(
    [...visibleProducts, ...home.newArrivals, ...(home.flashSale?.items ?? [])].map((product) => ({ id: product.id, shop: { id: product.shop.id } })),
    "marketplace_home",
  );

  function handleAddToCart(product: MarketplaceProductCard) {
    if (!user) {
      router.push(localePath("/login"));
      return;
    }
    if (!canUseBuyerCart) return;
    if (product.variantId && product.stock !== 0) addToCartMutation.mutate({ product, variantId: product.variantId });
  }

  useEffect(() => {
    setSessionId(getAnonymousSessionId());
  }, []);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(home.recommendedProducts.length, current + 6));
        }
      },
      { rootMargin: "420px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [home.recommendedProducts.length]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-36 text-slate-950">
      <ClientReadyBuyerTopBar title={user?.name ? t("home.welcomeBack").replace("{name}", user.name) : t("common.marketplace")} />

      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-5 lg:px-8">
        <HeroPromo banners={home.banners} isLoading={homeQuery.isLoading} />
        <VoucherStrip
          promotions={home.promotions}
          hasProducts={home.recommendedProducts.length > 0 || home.newArrivals.length > 0}
          isLoading={homeQuery.isLoading}
        />
        <FlashSaleSection
          flashSale={home.flashSale}
          isLoading={homeQuery.isLoading}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables?.variantId}
          formatMoney={formatters.currency}
        />
        <CategoryGrid categories={categories} apiCategories={home.categories} isLoading={homeQuery.isLoading} />
        <ProductRail
          title={t("home.recommendedTitle")}
          subtitle={t("home.recommendedSubtitle")}
          products={visibleProducts}
          source="marketplace_home_recommended"
          isLoading={homeQuery.isLoading}
          isError={homeQuery.isError}
          emptyTitle={t("home.recommendedEmptyTitle")}
          emptyDescription={t("home.recommendedEmptyDescription")}
          hasMore={visibleCount < home.recommendedProducts.length}
          loadMoreRef={loadMoreRef}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables?.variantId}
          formatMoney={formatters.currency}
          onRetry={() => void homeQuery.refetch()}
        />
        <ProductRail
          title={t("home.newArrivalsTitle")}
          subtitle={t("home.newArrivalsSubtitle")}
          products={home.newArrivals}
          source="marketplace_home_new_arrivals"
          isLoading={homeQuery.isLoading}
          isError={false}
          emptyTitle={t("home.newArrivalsEmptyTitle")}
          emptyDescription={t("home.newArrivalsEmptyDescription")}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables?.variantId}
          formatMoney={formatters.currency}
        />
        <FeaturedShopsSection shops={home.featuredShops} isLoading={homeQuery.isLoading} />
        <ProductRail
          title={t("home.recentlyViewedTitle")}
          subtitle={t("home.recentlyViewedSubtitle")}
          products={home.recentlyViewed}
          source="marketplace_home_recently_viewed"
          isLoading={homeQuery.isLoading}
          isError={false}
          emptyTitle={t("home.recentlyViewedEmptyTitle")}
          emptyDescription={t("home.recentlyViewedEmptyDescription")}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables?.variantId}
          formatMoney={formatters.currency}
        />
        {homeQuery.isError ? <HomeErrorState onRetry={() => void homeQuery.refetch()} /> : null}
      </main>

      <StickyCheckoutCTA />
      <MobileBottomNav />
    </div>
  );
}

const emptyMarketplaceHome: MarketplaceHomeData = {
  banners: [],
  categories: [],
  flashSale: null,
  recommendedProducts: [],
  newArrivals: [],
  featuredShops: [],
  recentlyViewed: [],
  promotions: [],
};

function HeroPromo({ banners, isLoading }: { banners: MarketplaceBanner[]; isLoading: boolean }) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const banner = banners[0];
  if (isLoading) return <Skeleton className="h-72 rounded-3xl" />;
  const href = normalizeHomepageHref(banner?.targetUrl, localePath("/search?q=deals"));
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-[0_18px_48px_rgba(244,63,94,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge className="mb-3 border-white/20 bg-white/20 text-white">
            <ZapIcon className="size-3" />
            {t("home.heroKicker")}
          </Badge>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {banner?.title ?? t("home.heroTitle")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
            {banner?.subtitle ?? t("home.heroSubtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-white text-rose-600 hover:bg-white/95">
              <Link
                href={href}
                onClick={() => banner ? trackDiscoveryEvent({ eventType: "banner_clicked", bannerId: banner.id, source: "marketplace_home_hero", position: 0 }) : undefined}
              >
                {t("home.shopNow")}
              </Link>
            </Button>
            <Button variant="outline" className="rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              {t("home.claimVoucher")}
            </Button>
          </div>
        </div>
        <div className="hidden aspect-square w-40 shrink-0 rounded-[2rem] bg-white/15 p-4 sm:block">
          <div className="flex h-full items-center justify-center rounded-[1.5rem] bg-white/15">
            <ShoppingBagIcon className="size-20 text-white" />
          </div>
        </div>
      </div>
    </section>
  );
}

function VoucherStrip({ promotions, hasProducts, isLoading }: { promotions: MarketplacePromotion[]; hasProducts: boolean; isLoading: boolean }) {
  const t = useTranslations();
  const liveVouchers = promotions.slice(0, 3).map((promotion) => [
    promotion.title,
    promotion.description ?? promotion.code,
  ]);
  if (isLoading) {
    return <div className="mt-3 flex gap-2 overflow-hidden">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 min-w-[154px] rounded-2xl" />)}</div>;
  }
  const vouchers = liveVouchers.length
    ? liveVouchers
    : [
        [t("home.freeShipping"), t("home.voucherAmount").replace("{amount}", "500")],
        [t("home.voucherPercentOff").replace("{percent}", "15"), t("home.selectedShops")],
        [t("home.coinsCashback"), t("home.upToCashback")],
      ];

  return (
    <section className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[
        ...vouchers,
        [hasProducts ? t("home.liveCatalog") : t("product.noProductsFound"), hasProducts ? t("home.syncedFromApi") : t("product.noProductsDescription")],
      ].map(([title, subtitle]) => (
        <div key={title} className="flex min-w-[154px] items-center gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-2 shadow-sm">
          <div className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <TicketPercentIcon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">{title}</p>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function FlashSaleSection({
  flashSale,
  isLoading,
  onAddToCart,
  pendingVariantId,
  formatMoney,
}: {
  flashSale: MarketplaceHomeData["flashSale"];
  isLoading: boolean;
  onAddToCart: (product: MarketplaceProductCard) => void;
  pendingVariantId?: string;
  formatMoney: (cents: number, currency?: string) => string;
}) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const products = flashSale?.items ?? [];
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600">
            <FlameIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">{flashSale?.title ?? t("home.flashSale")}</h2>
            <p className="text-xs text-slate-600">{flashSale?.description ?? (flashSale?.endsAt ? t("home.endsAt").replace("{time}", new Date(flashSale.endsAt).toLocaleDateString()) : t("home.limitedTimeDeals"))}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700">
          {t("home.seeAll")}
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-52 min-w-[132px] rounded-2xl" />
        )) : products.length ? products.map((product, index) => (
          <article key={product.id} className="min-w-[132px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <Link
              href={localePath(`/products/${product.id}`)}
              onClick={() => trackDiscoveryEvent({ eventType: "recommendation_clicked", productId: product.id, shopId: product.shop.id, source: "flash_sale", position: index })}
            >
              <ProductVisual product={product} compact />
            </Link>
            <div className="p-2">
              <p className="line-clamp-2 min-h-9 text-xs font-semibold text-slate-800">{product.title}</p>
              <p className="mt-1 text-base font-extrabold text-orange-600">{formatMoney(product.price, product.currency)}</p>
              <div className="mt-2 h-2 rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(92, 42 + product.soldCount * 4)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-600">{product.soldCount.toLocaleString()} {t("product.sold")}</p>
              <Button
                size="sm"
                className="mt-2 h-8 w-full rounded-full bg-orange-600 text-white hover:bg-orange-700"
                disabled={!product.variantId || pendingVariantId === product.variantId}
                onClick={() => onAddToCart(product)}
              >
                {pendingVariantId === product.variantId ? t("product.adding") : t("product.add")}
              </Button>
            </div>
          </article>
        )) : <SectionEmptyState title={t("home.noFlashSaleTitle")} description={t("home.noFlashSaleDescription")} />}
      </div>
    </section>
  );
}

function CategoryGrid({
  categories,
  apiCategories,
  isLoading,
}: {
  categories: Array<{ slug: string; label: string; className: string }>;
  apiCategories: MarketplaceCategory[];
  isLoading: boolean;
}) {
  const t = useTranslations();
  const localePath = useLocalePath();
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-950">{t("common.categories")}</h2>
        <Grid3X3Icon className="size-5 text-slate-600" />
      </div>
      {isLoading ? <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}</div> : null}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {categories.map(({ slug, label, className }) => (
          <Link
            key={slug}
            href={localePath(`/categories/${slug}`)}
            onClick={() => trackDiscoveryEvent({ eventType: "category_viewed", categoryId: apiCategories.find((category) => category.slug === slug)?.id ?? slug, source: "marketplace_home_categories" })}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 transition hover:bg-slate-50"
          >
            <span className={`flex size-11 items-center justify-center rounded-2xl ${className}`}>
              <PackageIcon className="size-5" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold text-slate-700">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductRail(props: {
  title: string;
  subtitle: string;
  source: string;
  products: MarketplaceProductCard[];
  isLoading: boolean;
  isError: boolean;
  emptyTitle: string;
  emptyDescription: string;
  hasMore?: boolean;
  loadMoreRef?: React.RefObject<HTMLDivElement | null>;
  onAddToCart: (product: MarketplaceProductCard) => void;
  pendingVariantId?: string;
  formatMoney: (cents: number, currency?: string) => string;
  onRetry?: () => void;
}) {
  const t = useTranslations();
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">{props.title}</h2>
          <p className="text-xs text-slate-600">{props.subtitle}</p>
        </div>
        <SparklesIcon className="size-5 text-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {props.products.map((product, index) => (
          <div key={`${props.source}-${product.id}-${index}`}>
            <BuyerProductCard product={product.buyerProduct} />
          </div>
        ))}
        {props.isLoading ? Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl" />
        )) : null}
      </div>
      {props.isError ? (
        <div className="mt-3 rounded-3xl border border-red-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-950">{t("state.loadErrorTitle")}</p>
          {props.onRetry ? <Button className="mt-3 rounded-full" variant="outline" onClick={props.onRetry}>{t("state.retry")}</Button> : null}
        </div>
      ) : null}
      {!props.isLoading && !props.isError && props.products.length === 0 ? (
        <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-950">{props.emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-600">{props.emptyDescription}</p>
        </div>
      ) : null}
      <div ref={props.loadMoreRef} className="py-6 text-center text-xs text-slate-600">
        {props.hasMore ? t("home.loadingMore") : t("home.youAreCaughtUp")}
      </div>
    </section>
  );
}

function ProductVisual({ product, compact = false }: { product: MarketplaceProductCard; compact?: boolean }) {
  const t = useTranslations();
  const imageUrl = resolveUploadedImageUrl(product.imageUrl);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${productGradients[Math.abs(hashString(product.id)) % productGradients.length]} ${compact ? "h-28" : "aspect-square"}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={product.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : null}
      {imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 via-transparent to-transparent" /> : null}
      {product.originalPrice && product.originalPrice > product.price ? <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-orange-600 shadow-sm">{t("home.saleBadge")}</div> : null}
      <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm">
        <HeartIcon className="size-4" />
        <span className="sr-only">{t("product.saveProduct")}</span>
      </span>
      <div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? "hidden" : ""}`}>
        <ShoppingBagIcon className={`${compact ? "size-12" : "size-20"} text-slate-600/60`} />
      </div>
    </div>
  );
}

function FeaturedShopsSection({ shops, isLoading }: { shops: MarketplaceShop[]; isLoading: boolean }) {
  const localePath = useLocalePath();
  const t = useTranslations();
  if (isLoading) return <Skeleton className="mt-5 h-40 rounded-3xl" />;
  if (shops.length === 0) return <SectionEmptyState title={t("home.featuredShopsEmptyTitle")} description={t("home.featuredShopsEmptyDescription")} />;
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-950">{t("home.featuredShopsTitle")}</h2>
        <ShoppingBagIcon className="size-5 text-orange-500" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shops.map((shop, index) => (
          <Link
            key={shop.id}
            href={localePath(`/shops/${shop.slug || shop.id}`)}
            onClick={() => trackDiscoveryEvent({ eventType: "recommendation_clicked", shopId: shop.id, source: "marketplace_home_featured_shops", position: index })}
            className="min-w-0 rounded-2xl border border-slate-100 p-3 transition hover:bg-slate-50"
          >
            <p className="truncate text-sm font-extrabold text-slate-950">{shop.name}</p>
            <p className="mt-1 text-xs text-slate-600">
              {t("buyer.productsCount").replace("{count}", shop.productCount.toLocaleString())} · {t("buyer.followersCount").replace("{count}", shop.followerCount.toLocaleString())}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><StarIcon className="size-3 fill-amber-400 text-amber-400" /> {shop.ratingAverage.toFixed(1)} ({shop.ratingCount})</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HomeErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="mt-5 rounded-3xl border border-red-100 bg-white p-5 text-center shadow-sm">
      <p className="text-sm font-bold text-slate-950">{t("home.homepageLoadError")}</p>
      <Button className="mt-3 rounded-full" variant="outline" onClick={onRetry}>{t("state.retry")}</Button>
    </div>
  );
}

function SectionEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  );
}

function normalizeHomepageHref(href: string | null | undefined, fallback: string): string {
  if (!href) return fallback;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/")) return href;
  return fallback;
}

function hashString(value: string): number {
  return [...value].reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function StickyCheckoutCTA() {
  const t = useTranslations();
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white/95 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="min-w-0 pl-2">
          <p className="truncate text-sm font-extrabold text-slate-950">{t("home.extraOff")}</p>
          <p className="text-xs text-slate-600">{t("home.voucherAutoApplies")}</p>
        </div>
        <Button className="rounded-xl bg-orange-600 px-4 text-white hover:bg-orange-700">
          {t("product.buyNow")}
        </Button>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const items = [
    [HomeIcon, t("common.home"), "/"],
    [MenuIcon, t("common.categories"), "/categories/deals"],
    [FlameIcon, t("common.deals"), "/search?q=deal"],
    [ShoppingCartIcon, t("common.cart"), "/cart"],
    [UserCircleIcon, t("common.account"), "/profile"],
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(([Icon, label, href], index) => (
          <Link key={label} href={localePath(href)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold ${index === 0 ? "bg-orange-50 text-orange-600" : "text-slate-700"}`}>
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
