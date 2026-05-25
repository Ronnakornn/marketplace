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
import { Card, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { addCartItem, fetchCoupons, type BuyerCoupon } from "#/features/buyer/api";
import {
  normalizePublicCategories,
  normalizePublicProducts,
  publicCategoriesQueryOptions,
  publicProductListQueryOptions,
  type BuyerProduct,
} from "#/features/product/queries";
import { useFormatters, useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

interface MarketplaceHomeProps {
  user?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
}

interface StorefrontProduct {
  id: string;
  variantId: string | null;
  title: string;
  description: string | null;
  shopName: string;
  price: number;
  originalprice: number;
  currency: string;
  rating: number;
  sold: number;
  discountPercent: number;
  category: string;
  freeShipping: boolean;
  stock: number;
  gradient: string;
}

const fallbackCategoryItems = [
  ["fashion", "Fashion", "bg-rose-100 text-rose-600"],
  ["beauty", "Beauty", "bg-pink-100 text-pink-600"],
  ["gadgets", "Gadgets", "bg-slate-100 text-slate-700"],
  ["home", "Home", "bg-emerald-100 text-emerald-600"],
  ["sports", "Sports", "bg-orange-100 text-orange-600"],
  ["kids", "Kids", "bg-violet-100 text-violet-600"],
  ["groceries", "Groceries", "bg-lime-100 text-lime-700"],
  ["pets", "Pets", "bg-amber-100 text-amber-700"],
  ["deals", "Deals", "bg-red-100 text-red-600"],
  ["more", "More", "bg-slate-100 text-slate-600"],
] as const;

const categoryStyles = [
  "bg-rose-100 text-rose-600",
  "bg-pink-100 text-pink-600",
  "bg-slate-100 text-slate-700",
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-600",
  "bg-violet-100 text-violet-600",
  "bg-lime-100 text-lime-700",
  "bg-amber-100 text-amber-700",
  "bg-red-100 text-red-600",
  "bg-slate-100 text-slate-600",
];

const productGradients = [
  "from-orange-100 via-rose-100 to-white",
  "from-cyan-100 via-sky-100 to-white",
  "from-emerald-100 via-lime-100 to-white",
  "from-violet-100 via-fuchsia-100 to-white",
  "from-amber-100 via-orange-100 to-white",
  "from-slate-100 via-zinc-100 to-white",
];

function mapBuyerProduct(product: BuyerProduct, index: number): StorefrontProduct {
  const firstVariant = product.variants[0];
  const price = firstVariant?.price ?? product.price;
  const discountPercent = price > 0 ? ([18, 22, 25, 30, 35][index % 5] ?? 0) : 0;

  return {
    id: product.id,
    variantId: firstVariant?.id ?? null,
    title: product.title,
    description: product.description,
    shopName: product.shop.name,
    price,
    originalprice: discountPercent > 0 ? Math.round(price / (1 - discountPercent / 100)) : price,
    currency: firstVariant?.currency ?? "USD",
    rating: product.rating,
    sold: product.soldCount,
    discountPercent,
    category: fallbackCategoryItems[index % fallbackCategoryItems.length]?.[1] ?? "Deals",
    freeShipping: index % 3 !== 0,
    stock: firstVariant?.stock ?? product.stock,
    gradient: productGradients[index % productGradients.length] ?? productGradients[0]!,
  };
}

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
  const searchTerm = "";
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const canUseBuyerCart = user?.role === "USER";
  const productsQuery = useQuery({
    ...publicProductListQueryOptions({
      q: searchTerm || undefined,
      categoryId: activeCategory ?? undefined,
      limit: 50,
      locale,
    }),
    select: normalizePublicProducts,
  });
  const categoriesQuery = useQuery({
    ...publicCategoriesQueryOptions({ locale }),
    select: normalizePublicCategories,
  });
  const couponsQuery = useQuery({
    queryKey: ["marketplace-coupons", locale],
    queryFn: () => fetchCoupons(locale),
  });
  const addToCartMutation = useMutation({
    mutationFn: (variantId: string) => addCartItem(variantId, 1),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] });
    },
  });
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const products = useMemo(() => {
    const liveProducts = productsQuery.data ?? [];
    return liveProducts.map(mapBuyerProduct);
  }, [productsQuery.data]);

  const visibleProducts = products.slice(0, visibleCount);
  const flashProducts = products.slice(0, 8);
  const categories = useMemo(() => {
    const apiCategories = categoriesQuery.data ?? [];
    if (apiCategories.length) return apiCategories.map((category, index) => ({
      slug: category.slug,
      label: category.name,
      className: categoryStyles[index % categoryStyles.length] ?? categoryStyles.at(-1)!,
    }));
    return fallbackCategoryItems.map(([slug, label, className]) => ({ slug, label, className }));
  }, [categoriesQuery.data]);

  function handleAddToCart(product: StorefrontProduct) {
    if (!user) {
      router.push(localePath("/login"));
      return;
    }
    if (!canUseBuyerCart) return;
    if (product.variantId) addToCartMutation.mutate(product.variantId);
  }

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(products.length, current + 6));
        }
      },
      { rootMargin: "420px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [products.length]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-36 text-slate-950">
      <ClientReadyBuyerTopBar title={user?.name ? `Welcome back, ${user.name}` : "Marketplace"} />

      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-5 lg:px-8">
        <HeroPromo />
        <VoucherStrip
          coupons={couponsQuery.data ?? []}
          hasProducts={products.length > 0}
        />
        <FlashSaleSection
          products={flashProducts}
          isLoading={productsQuery.isLoading}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables}
          formatMoney={formatters.currency}
        />
        <CategoryGrid categories={categories} activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
        <ProductRecommendationGrid
          products={visibleProducts}
          isLoading={productsQuery.isLoading}
          hasMore={visibleCount < products.length}
          loadMoreRef={loadMoreRef}
          onAddToCart={handleAddToCart}
          pendingVariantId={addToCartMutation.variables}
          formatMoney={formatters.currency}
          isError={productsQuery.isError}
          onRetry={() => void productsQuery.refetch()}
        />
      </main>

      <StickyCheckoutCTA />
      <MobileBottomNav />
    </div>
  );
}

function HeroPromo() {
  const t = useTranslations();
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-[0_18px_48px_rgba(244,63,94,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge className="mb-3 border-white/20 bg-white/20 text-white">
            <ZapIcon className="size-3" />
            {t("home.heroKicker")}
          </Badge>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-full bg-white text-rose-600 hover:bg-white/95">
              {t("home.shopNow")}
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

function VoucherStrip({ coupons, hasProducts }: { coupons: BuyerCoupon[]; hasProducts: boolean }) {
  const t = useTranslations();
  const liveVouchers = coupons.slice(0, 3).map((coupon) => [
    coupon.title,
    coupon.description ?? coupon.code,
  ]);
  const vouchers = liveVouchers.length
    ? liveVouchers
    : [
        [t("home.freeShipping"), "THB 500"],
        ["15% OFF", "Selected shops"],
        ["Coins Cashback", t("home.upToCashback")],
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
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function FlashSaleSection({
  products,
  isLoading,
  onAddToCart,
  pendingVariantId,
  formatMoney,
}: {
  products: StorefrontProduct[];
  isLoading: boolean;
  onAddToCart: (product: StorefrontProduct) => void;
  pendingVariantId?: string;
  formatMoney: (cents: number, currency?: string) => string;
}) {
  const t = useTranslations();
  const localePath = useLocalePath();
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600">
            <FlameIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">{t("home.flashSale")}</h2>
            <p className="text-xs text-slate-500">Ends in 02:18:44</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700">
          {t("home.seeAll")}
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-52 min-w-[132px] rounded-2xl" />
        )) : products.map((product) => (
          <article key={product.id} className="min-w-[132px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <Link href={localePath(`/products/${product.id}`)}>
              <ProductVisual product={product} compact />
            </Link>
            <div className="p-2">
              <p className="line-clamp-2 min-h-9 text-xs font-semibold text-slate-800">{product.title}</p>
              <p className="mt-1 text-base font-extrabold text-orange-600">{formatMoney(product.price, product.currency)}</p>
              <div className="mt-2 h-2 rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(92, 42 + product.discountPercent)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{product.sold.toLocaleString()} {t("product.sold")}</p>
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
        ))}
      </div>
    </section>
  );
}

function CategoryGrid({
  categories,
  activeCategory,
  onSelectCategory,
}: {
  categories: Array<{ slug: string; label: string; className: string }>;
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}) {
  const t = useTranslations();
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-950">{t("common.categories")}</h2>
        <Grid3X3Icon className="size-5 text-slate-400" />
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {categories.map(({ slug, label, className }) => (
          <button
            key={slug}
            type="button"
            onClick={() => onSelectCategory(activeCategory === slug ? null : slug)}
            className={`group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 transition hover:bg-slate-50 ${activeCategory === slug ? "bg-orange-50 ring-1 ring-orange-200" : ""}`}
          >
            <span className={`flex size-11 items-center justify-center rounded-2xl ${className}`}>
              <PackageIcon className="size-5" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold text-slate-700">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductRecommendationGrid(props: {
  products: StorefrontProduct[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  onAddToCart: (product: StorefrontProduct) => void;
  pendingVariantId?: string;
  formatMoney: (cents: number, currency?: string) => string;
  onRetry: () => void;
}) {
  const t = useTranslations();
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">{t("home.recommendedTitle")}</h2>
          <p className="text-xs text-slate-500">{t("home.recommendedSubtitle")}</p>
        </div>
        <SparklesIcon className="size-5 text-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {props.products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={props.onAddToCart}
            isAdding={props.pendingVariantId === product.variantId}
            formatMoney={props.formatMoney}
          />
        ))}
        {props.isLoading ? Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl" />
        )) : null}
      </div>
      {props.isError ? (
        <div className="mt-3 rounded-3xl border border-red-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Request failed</p>
          <Button className="mt-3 rounded-full" variant="outline" onClick={props.onRetry}>{t("state.retry")}</Button>
        </div>
      ) : null}
      {!props.isLoading && !props.isError && props.products.length === 0 ? (
        <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-950">{t("product.noProductsFound")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("product.noProductsDescription")}</p>
        </div>
      ) : null}
      <div ref={props.loadMoreRef} className="py-6 text-center text-xs text-slate-500">
        {props.hasMore ? t("home.loadingMore") : t("home.youAreCaughtUp")}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  onAddToCart,
  isAdding,
  formatMoney,
}: {
  product: StorefrontProduct;
  onAddToCart: (product: StorefrontProduct) => void;
  isAdding: boolean;
  formatMoney: (cents: number, currency?: string) => string;
}) {
  const t = useTranslations();
  const localePath = useLocalePath();
  return (
    <Card className="group overflow-hidden rounded-3xl border-slate-200 bg-white py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={localePath(`/products/${product.id}`)}>
        <ProductVisual product={product} />
      </Link>
      <CardContent className="p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {product.freeShipping ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700">
              {t("product.freeShip")}
            </Badge>
          ) : null}
          <Badge variant="outline" className="border-orange-200 bg-orange-50 px-1.5 text-[10px] text-orange-700">
            -{product.discountPercent}%
          </Badge>
        </div>
        <Link href={localePath(`/products/${product.id}`)}>
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-slate-900">
            {product.title}
          </h3>
        </Link>
        <p className="mt-1 truncate text-xs text-slate-500">{product.shopName}</p>
        <div className="mt-2 flex items-end gap-1">
          <p className="text-lg font-extrabold text-orange-600">{formatMoney(product.price, product.currency)}</p>
          <p className="mb-0.5 text-xs text-slate-400 line-through">{formatMoney(product.originalprice, product.currency)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {product.rating}
          </span>
          <span>{product.sold.toLocaleString()} {t("product.sold")}</span>
        </div>
        <Button
          className="mt-3 h-9 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
          disabled={!product.variantId || isAdding}
          onClick={() => onAddToCart(product)}
        >
          {isAdding ? t("product.adding") : product.stock > 0 ? t("product.addToCart") : t("product.outOfStock")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductVisual({ product, compact = false }: { product: StorefrontProduct; compact?: boolean }) {
  const t = useTranslations();
  return (
    <div className={`relative bg-gradient-to-br ${product.gradient} ${compact ? "h-28" : "aspect-square"}`}>
      <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-orange-600 shadow-sm">
        -{product.discountPercent}%
      </div>
      <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 text-slate-500 shadow-sm">
        <HeartIcon className="size-4" />
        <span className="sr-only">{t("product.saveProduct")}</span>
      </span>
      <div className="absolute inset-0 flex items-center justify-center">
        <ShoppingBagIcon className={`${compact ? "size-12" : "size-20"} text-slate-400/45`} />
      </div>
    </div>
  );
}

function StickyCheckoutCTA() {
  const t = useTranslations();
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white/95 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="min-w-0 pl-2">
          <p className="truncate text-sm font-extrabold text-slate-950">{t("home.extraOff")}</p>
          <p className="text-xs text-slate-500">{t("home.voucherAutoApplies")}</p>
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
          <Link key={label} href={localePath(href)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold ${index === 0 ? "bg-orange-50 text-orange-600" : "text-slate-500"}`}>
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
