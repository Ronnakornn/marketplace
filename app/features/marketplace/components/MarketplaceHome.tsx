"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellIcon,
  FlameIcon,
  Grid3X3Icon,
  HeartIcon,
  HomeIcon,
  MenuIcon,
  PackageIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  StarIcon,
  TicketPercentIcon,
  UserCircleIcon,
  ZapIcon,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { useCatalogProducts, type CatalogProduct } from "#/features/catalog";

interface MarketplaceHomeProps {
  user?: {
    name?: string;
    email?: string;
  } | null;
}

interface StorefrontProduct {
  id: string;
  title: string;
  shopName: string;
  priceCents: number;
  originalPriceCents: number;
  currency: string;
  rating: number;
  sold: number;
  discountPercent: number;
  category: string;
  freeShipping: boolean;
  stock: number;
  gradient: string;
}

const categoryItems = [
  ["Fashion", "bg-rose-100 text-rose-600"],
  ["Beauty", "bg-pink-100 text-pink-600"],
  ["Gadgets", "bg-sky-100 text-sky-600"],
  ["Home", "bg-emerald-100 text-emerald-600"],
  ["Sports", "bg-orange-100 text-orange-600"],
  ["Kids", "bg-violet-100 text-violet-600"],
  ["Groceries", "bg-lime-100 text-lime-700"],
  ["Pets", "bg-amber-100 text-amber-700"],
  ["Deals", "bg-red-100 text-red-600"],
  ["More", "bg-slate-100 text-slate-600"],
] as const;

const productGradients = [
  "from-orange-100 via-rose-100 to-white",
  "from-cyan-100 via-sky-100 to-white",
  "from-emerald-100 via-lime-100 to-white",
  "from-violet-100 via-fuchsia-100 to-white",
  "from-amber-100 via-orange-100 to-white",
  "from-slate-100 via-zinc-100 to-white",
];

const fallbackProducts: StorefrontProduct[] = [
  {
    id: "mock-1",
    title: "Canvas Weekender Bag with laptop sleeve",
    shopName: "Demo Market Shop",
    priceCents: 4890,
    originalPriceCents: 6890,
    currency: "USD",
    rating: 4.8,
    sold: 2380,
    discountPercent: 29,
    category: "Fashion",
    freeShipping: true,
    stock: 24,
    gradient: productGradients[0],
  },
  {
    id: "mock-2",
    title: "Ceramic Pour Over Coffee Set",
    shopName: "Daily Brew",
    priceCents: 3590,
    originalPriceCents: 4590,
    currency: "USD",
    rating: 4.9,
    sold: 1540,
    discountPercent: 22,
    category: "Home",
    freeShipping: true,
    stock: 18,
    gradient: productGradients[1],
  },
  {
    id: "mock-3",
    title: "Modular Desk Tray Organizer",
    shopName: "Workmode",
    priceCents: 1890,
    originalPriceCents: 2490,
    currency: "USD",
    rating: 4.7,
    sold: 890,
    discountPercent: 24,
    category: "Home",
    freeShipping: false,
    stock: 35,
    gradient: productGradients[2],
  },
  {
    id: "mock-4",
    title: "Wireless Mini Speaker",
    shopName: "Sound Lab",
    priceCents: 2990,
    originalPriceCents: 3990,
    currency: "USD",
    rating: 4.6,
    sold: 3210,
    discountPercent: 25,
    category: "Gadgets",
    freeShipping: true,
    stock: 42,
    gradient: productGradients[3],
  },
  {
    id: "mock-5",
    title: "Hydrating Lip Tint Duo",
    shopName: "Glow Cart",
    priceCents: 1490,
    originalPriceCents: 2190,
    currency: "USD",
    rating: 4.8,
    sold: 4120,
    discountPercent: 32,
    category: "Beauty",
    freeShipping: true,
    stock: 60,
    gradient: productGradients[4],
  },
  {
    id: "mock-6",
    title: "Daily Training Shorts",
    shopName: "Move Goods",
    priceCents: 2290,
    originalPriceCents: 3290,
    currency: "USD",
    rating: 4.5,
    sold: 710,
    discountPercent: 30,
    category: "Sports",
    freeShipping: false,
    stock: 27,
    gradient: productGradients[5],
  },
];

function mapCatalogProduct(product: CatalogProduct, index: number): StorefrontProduct {
  const firstVariant = product.variants[0];
  const priceCents = firstVariant?.priceCents ?? 1990 + index * 320;
  const discountPercent = [18, 22, 25, 30, 35][index % 5];

  return {
    id: product.id,
    title: product.title,
    shopName: product.shop.name,
    priceCents,
    originalPriceCents: Math.round(priceCents / (1 - discountPercent / 100)),
    currency: firstVariant?.currency ?? "USD",
    rating: Number((4.5 + (index % 5) * 0.08).toFixed(1)),
    sold: 420 + index * 317,
    discountPercent,
    category: categoryItems[index % categoryItems.length][0],
    freeShipping: index % 3 !== 0,
    stock: firstVariant?.inventory?.quantityOnHand ?? 20 + index * 3,
    gradient: productGradients[index % productGradients.length],
  };
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function duplicateForFeed(products: StorefrontProduct[]) {
  if (products.length >= 18) return products;
  return Array.from({ length: 4 }).flatMap((_, round) =>
    products.map((product, index) => ({
      ...product,
      id: `${product.id}-${round}`,
      sold: product.sold + round * 137,
      rating: Number(Math.min(4.9, product.rating + round * 0.03).toFixed(1)),
      gradient: productGradients[(index + round) % productGradients.length],
    })),
  );
}

export function MarketplaceHome({ user = null }: MarketplaceHomeProps) {
  const { data: catalogProducts = [], isLoading, error } = useCatalogProducts();
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const products = useMemo(() => {
    const mapped = catalogProducts.length
      ? catalogProducts.map(mapCatalogProduct)
      : fallbackProducts;

    return duplicateForFeed(mapped);
  }, [catalogProducts]);

  const visibleProducts = products.slice(0, visibleCount);
  const flashProducts = products.slice(0, 8);

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
      <MobileCommerceHeader userName={user?.name} />

      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-5 lg:px-8">
        <HeroPromo />
        <VoucherStrip hasFallback={Boolean(error) || catalogProducts.length === 0} />
        <FlashSaleSection products={flashProducts} isLoading={isLoading} />
        <CategoryGrid />
        <ProductRecommendationGrid
          products={visibleProducts}
          isLoading={isLoading}
          hasMore={visibleCount < products.length}
          loadMoreRef={loadMoreRef}
        />
      </main>

      <StickyCheckoutCTA />
      <MobileBottomNav />
    </div>
  );
}

function MobileCommerceHeader({ userName }: { userName?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 ring-1 ring-slate-200">
          <SearchIcon className="size-4 text-slate-500" />
          <span className="truncate text-sm text-slate-500">
            Search deals, brands, and shops
          </span>
        </div>
        <Button size="icon-sm" variant="ghost" className="rounded-full">
          <BellIcon className="size-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button size="icon-sm" variant="ghost" className="rounded-full">
          <ShoppingCartIcon className="size-5" />
          <span className="sr-only">Cart</span>
        </Button>
      </div>
      {userName ? (
        <p className="mx-auto mt-1 max-w-6xl truncate px-1 text-xs text-slate-500">
          Welcome back, {userName}
        </p>
      ) : null}
    </header>
  );
}

function HeroPromo() {
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-[0_18px_48px_rgba(244,63,94,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge className="mb-3 border-white/20 bg-white/20 text-white">
            <ZapIcon className="size-3" />
            5.5 Mega Deals
          </Badge>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Shop fast. Checkout faster.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
            Flash deals, free shipping picks, and marketplace favorites curated for quick buying.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-full bg-white text-rose-600 hover:bg-white/95">
              Shop now
            </Button>
            <Button variant="outline" className="rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              Claim voucher
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

function VoucherStrip({ hasFallback }: { hasFallback: boolean }) {
  return (
    <section className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[
        ["Free Shipping", "Min. spend $15"],
        ["15% OFF", "Selected shops"],
        ["Coins Cashback", "Up to 20%"],
        [hasFallback ? "Demo Feed" : "Live Catalog", hasFallback ? "Fallback ready" : "Synced from API"],
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

function FlashSaleSection({ products, isLoading }: { products: StorefrontProduct[]; isLoading: boolean }) {
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600">
            <FlameIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Flash Sale</h2>
            <p className="text-xs text-slate-500">Ends in 02:18:44</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700">
          See all
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-52 min-w-[132px] rounded-2xl" />
        )) : products.map((product) => (
          <article key={product.id} className="min-w-[132px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ProductVisual product={product} compact />
            <div className="p-2">
              <p className="line-clamp-2 min-h-9 text-xs font-semibold text-slate-800">{product.title}</p>
              <p className="mt-1 text-base font-extrabold text-orange-600">{formatMoney(product.priceCents, product.currency)}</p>
              <div className="mt-2 h-2 rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(92, 42 + product.discountPercent)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{product.sold.toLocaleString()} sold</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CategoryGrid() {
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-950">Categories</h2>
        <Grid3X3Icon className="size-5 text-slate-400" />
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {categoryItems.map(([label, className]) => (
          <button key={label} type="button" className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 transition hover:bg-slate-50">
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
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">Recommended for you</h2>
          <p className="text-xs text-slate-500">Fresh picks based on deals and shop momentum</p>
        </div>
        <SparklesIcon className="size-5 text-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {props.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {props.isLoading ? Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl" />
        )) : null}
      </div>
      <div ref={props.loadMoreRef} className="py-6 text-center text-xs text-slate-500">
        {props.hasMore ? "Loading more deals..." : "You're all caught up"}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <Card className="group overflow-hidden rounded-3xl border-slate-200 bg-white py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <ProductVisual product={product} />
      <CardContent className="p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {product.freeShipping ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700">
              Free ship
            </Badge>
          ) : null}
          <Badge variant="outline" className="border-orange-200 bg-orange-50 px-1.5 text-[10px] text-orange-700">
            -{product.discountPercent}%
          </Badge>
        </div>
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-slate-900">
          {product.title}
        </h3>
        <p className="mt-1 truncate text-xs text-slate-500">{product.shopName}</p>
        <div className="mt-2 flex items-end gap-1">
          <p className="text-lg font-extrabold text-orange-600">{formatMoney(product.priceCents, product.currency)}</p>
          <p className="mb-0.5 text-xs text-slate-400 line-through">{formatMoney(product.originalPriceCents, product.currency)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {product.rating}
          </span>
          <span>{product.sold.toLocaleString()} sold</span>
        </div>
        <Button className="mt-3 h-9 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800">
          Add
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductVisual({ product, compact = false }: { product: StorefrontProduct; compact?: boolean }) {
  return (
    <div className={`relative bg-gradient-to-br ${product.gradient} ${compact ? "h-28" : "aspect-square"}`}>
      <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-orange-600 shadow-sm">
        -{product.discountPercent}%
      </div>
      <button type="button" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 text-slate-500 shadow-sm">
        <HeartIcon className="size-4" />
        <span className="sr-only">Save product</span>
      </button>
      <div className="absolute inset-0 flex items-center justify-center">
        <ShoppingBagIcon className={`${compact ? "size-12" : "size-20"} text-slate-400/45`} />
      </div>
    </div>
  );
}

function StickyCheckoutCTA() {
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white/95 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="min-w-0 pl-2">
          <p className="truncate text-sm font-extrabold text-slate-950">Extra 15% off today</p>
          <p className="text-xs text-slate-500">Voucher auto-applies at cart</p>
        </div>
        <Button className="rounded-xl bg-orange-600 px-4 text-white hover:bg-orange-700">
          Buy now
        </Button>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  const items = [
    [HomeIcon, "Home"],
    [MenuIcon, "Categories"],
    [FlameIcon, "Deals"],
    [ShoppingCartIcon, "Cart"],
    [UserCircleIcon, "Account"],
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(([Icon, label], index) => (
          <button key={label} type="button" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold ${index === 0 ? "text-orange-600" : "text-slate-500"}`}>
            <Icon className="size-5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
