import Image from "next/image";
import Link from "next/link";
import {
  BellIcon,
  FlameIcon,
  Grid3X3Icon,
  HeartIcon,
  HomeIcon,
  MapPinIcon,
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
import { Input } from "#/components/ui/input";
import type { BuyerProduct } from "#/features/product/queries";
import {
  normalizeMarketplaceHome,
  type DiscoveryHomeResponse,
  type MarketplaceBanner,
  type MarketplaceHomeData,
  type MarketplaceProductCard,
  type MarketplacePromotion,
  type MarketplaceShop,
} from "#/features/marketplace/queries";
import { type Locale, locales, withLocale } from "#/i18n/config";
import { createTranslator } from "#/i18n/server";
import { resolveUploadedImageUrl } from "#/lib/assets";

type Translator = ReturnType<typeof createTranslator>;

const categoryStyles = [
  "bg-rose-100 text-rose-600",
  "bg-pink-100 text-pink-600",
  "bg-slate-100 text-slate-900",
  "bg-emerald-100 text-emerald-900",
  "bg-orange-100 text-orange-700",
  "bg-violet-100 text-violet-600",
  "bg-lime-100 text-emerald-900",
  "bg-amber-100 text-amber-700",
  "bg-red-100 text-red-600",
  "bg-slate-100 text-slate-900",
];

const productGradients = [
  "from-orange-100 via-rose-100 to-white",
  "from-cyan-100 via-sky-100 to-white",
  "from-emerald-100 via-lime-100 to-white",
  "from-violet-100 via-fuchsia-100 to-white",
  "from-amber-100 via-orange-100 to-white",
  "from-slate-100 via-zinc-100 to-white",
];

export function MarketplaceGuestHome({ initialHome, locale }: { initialHome: DiscoveryHomeResponse; locale: Locale }) {
  const t = createTranslator(locale);
  const home = normalizeMarketplaceHome(initialHome);
  const localePath = (pathname: string) => withLocale(pathname, locale);
  const formatMoney = (cents: number, currency = "THB") => new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  const categories = home.categories.map((category, index) => ({
    id: category.id,
    slug: category.slug,
    label: category.name,
    className: categoryStyles[index % categoryStyles.length] ?? categoryStyles.at(-1)!,
  }));

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-36 text-slate-950">
      <GuestTopBar locale={locale} t={t} />
      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-5 lg:px-8">
        <HeroPromo banners={home.banners} localePath={localePath} t={t} />
        <VoucherStrip promotions={home.promotions} localePath={localePath} />
        <FlashSaleSection flashSale={home.flashSale} loginHref={localePath("/login")} formatMoney={formatMoney} t={t} />
        <CategoryGrid categories={categories} localePath={localePath} t={t} />
        <ProductRail
          title={t("home.recommendedTitle")}
          subtitle={t("home.recommendedSubtitle")}
          products={home.recommendedProducts.slice(0, 8)}
          emptyTitle={t("home.recommendedEmptyTitle")}
          emptyDescription={t("home.recommendedEmptyDescription")}
          formatMoney={formatMoney}
          t={t}
        />
        <ProductRail
          title={t("home.newArrivalsTitle")}
          subtitle={t("home.newArrivalsSubtitle")}
          products={home.newArrivals}
          emptyTitle={t("home.newArrivalsEmptyTitle")}
          emptyDescription={t("home.newArrivalsEmptyDescription")}
          formatMoney={formatMoney}
          t={t}
        />
        <FeaturedShopsSection shops={home.featuredShops} localePath={localePath} t={t} />
        <ProductRail
          title={t("home.recentlyViewedTitle")}
          subtitle={t("home.recentlyViewedSubtitle")}
          products={home.recentlyViewed}
          emptyTitle={t("home.recentlyViewedEmptyTitle")}
          emptyDescription={t("home.recentlyViewedEmptyDescription")}
          formatMoney={formatMoney}
          t={t}
        />
      </main>
      <GuestMobileNavigation locale={locale} t={t} />
    </div>
  );
}

function GuestTopBar({ locale, t }: { locale: Locale; t: Translator }) {
  const localePath = (pathname: string) => withLocale(pathname, locale);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <Link aria-label={t("common.marketplace")} href={localePath("/")} prefetch={false} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-700 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-800">
          <ShoppingBagIcon className="size-4 text-white" />
          <span className="hidden text-white sm:inline">{t("common.marketplace")}</span>
        </Link>
        <form action={localePath("/search")} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-orange-200 md:max-w-[520px] lg:max-w-[640px]">
          <SearchIcon className="size-4 shrink-0 text-slate-900" />
          <Input name="q" placeholder={t("home.searchPlaceholder")} className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
        </form>
        <Link href={localePath("/notifications")} prefetch={false} className="relative flex size-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
          <BellIcon className="size-5" />
          <span className="sr-only">{t("common.notifications")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={localePath("/login")} prefetch={false} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 no-underline transition hover:bg-slate-50">{t("common.login")}</Link>
          <Link href={localePath("/signup")} prefetch={false} className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]">{t("common.signup")}</Link>
        </div>
      </div>
      <div className="mx-auto mt-1 flex max-w-6xl items-center justify-between gap-2 px-1">
        <p className="min-w-0 truncate text-xs font-semibold text-orange-700">{t("common.marketplace")}</p>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1" aria-label={t("common.language")}>
          {locales.map((targetLocale) => (
            <Link
              key={targetLocale}
              href={`/${targetLocale}`}
              prefetch={false}
              hrefLang={targetLocale}
              className={`rounded-full px-2 py-1 text-xs font-bold no-underline transition ${locale === targetLocale ? "bg-white !text-slate-950 shadow-sm" : "text-slate-700 hover:text-slate-950"}`}
            >
              {targetLocale === "th" ? "ไทย" : "EN"}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function HeroPromo({ banners, localePath, t }: { banners: MarketplaceBanner[]; localePath: (path: string) => string; t: Translator }) {
  const banner = banners[0];
  const href = normalizeHomepageHref(banner?.targetUrl, localePath("/search?q=deals"));
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-[0_18px_48px_rgba(244,63,94,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge className="mb-3 border-white/20 bg-white/20 text-white"><ZapIcon className="size-3" />{t("home.heroKicker")}</Badge>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{banner?.title ?? t("home.heroTitle")}</h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">{banner?.subtitle ?? t("home.heroSubtitle")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-white text-rose-600 hover:bg-white/95"><Link href={href} prefetch={false}>{t("home.shopNow")}</Link></Button>
            <Button asChild variant="outline" className="rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link href={localePath("/vouchers")} prefetch={false}>{t("home.claimVoucher")}</Link></Button>
          </div>
        </div>
        <div className="hidden aspect-square w-40 shrink-0 rounded-[2rem] bg-white/15 p-4 sm:block"><div className="flex h-full items-center justify-center rounded-[1.5rem] bg-white/15"><ShoppingBagIcon className="size-20 text-white" /></div></div>
      </div>
    </section>
  );
}

function VoucherStrip({ promotions, localePath }: { promotions: MarketplacePromotion[]; localePath: (path: string) => string }) {
  if (!promotions.length) return null;
  return (
    <section className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {promotions.slice(0, 3).map((promotion) => (
        <Link key={promotion.id} href={localePath("/vouchers")} prefetch={false} className="flex min-w-[154px] items-center gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-2 shadow-sm transition hover:border-orange-200 hover:bg-orange-50">
          <div className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-700"><TicketPercentIcon className="size-4" /></div>
          <div><p className="text-sm font-bold text-slate-950">{promotion.title}</p><p className="text-xs text-slate-900">{promotion.description ?? promotion.code}</p></div>
        </Link>
      ))}
    </section>
  );
}

function FlashSaleSection({ flashSale, loginHref, formatMoney, t }: { flashSale: MarketplaceHomeData["flashSale"]; loginHref: string; formatMoney: (cents: number, currency?: string) => string; t: Translator }) {
  const products = flashSale?.items ?? [];
  return (
    <section className="mt-5 min-h-[286px] rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600"><FlameIcon className="size-5" /></div><div><h2 className="text-lg font-extrabold text-slate-950">{flashSale?.title ?? t("home.flashSale")}</h2><p className="text-xs text-slate-900">{flashSale?.description ?? (flashSale?.endsAt ? t("home.endsAt").replace("{time}", new Date(flashSale.endsAt).toLocaleDateString()) : t("home.limitedTimeDeals"))}</p></div></div></div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.length ? products.map((product) => (
          <article key={product.id} className="min-w-[132px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <Link href={`/products/${product.id}`} prefetch={false}><ProductVisual product={product} compact t={t} /></Link>
            <div className="p-2"><p className="line-clamp-2 min-h-9 text-xs font-semibold text-slate-800">{product.title}</p><p className="mt-1 text-base font-extrabold text-orange-700">{formatMoney(product.price, product.currency)}</p><div className="mt-2 h-2 rounded-full bg-orange-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(92, 42 + product.soldCount * 4)}%` }} /></div><p className="mt-1 text-[11px] text-slate-900">{product.soldCount.toLocaleString()} {t("product.sold")}</p><Button asChild size="sm" className="mt-2 h-8 w-full rounded-full bg-orange-700 text-white hover:bg-orange-800"><Link href={loginHref} prefetch={false}>{t("product.add")}</Link></Button></div>
          </article>
        )) : <SectionEmptyState title={t("home.noFlashSaleTitle")} description={t("home.noFlashSaleDescription")} />}
      </div>
    </section>
  );
}

function CategoryGrid({ categories, localePath, t }: { categories: Array<{ id: string; slug: string; label: string; className: string }>; localePath: (path: string) => string; t: Translator }) {
  return (
    <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-950">{t("common.categories")}</h2><Grid3X3Icon className="size-5 text-slate-900" /></div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{categories.map(({ slug, label, className }) => <Link key={slug} href={localePath(`/categories/${slug}`)} prefetch={false} className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 transition hover:bg-slate-50"><span className={`flex size-11 items-center justify-center rounded-2xl ${className}`}><PackageIcon className="size-5" /></span><span className="w-full truncate text-center text-[11px] font-semibold text-slate-900">{label}</span></Link>)}</div>
    </section>
  );
}

function ProductRail({ title, subtitle, products, emptyTitle, emptyDescription, formatMoney, t }: { title: string; subtitle: string; products: MarketplaceProductCard[]; emptyTitle: string; emptyDescription: string; formatMoney: (cents: number, currency?: string) => string; t: Translator }) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-lg font-extrabold text-slate-950">{title}</h2><p className="text-xs text-slate-900">{subtitle}</p></div><SparklesIcon className="size-5 text-orange-500" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{products.map((product, index) => <div key={`${product.id}-${index}`}><GuestProductCard product={product.buyerProduct} formatMoney={formatMoney} t={t} /></div>)}</div>
      {!products.length ? <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm"><p className="text-sm font-bold text-slate-950">{emptyTitle}</p><p className="mt-1 text-xs text-slate-900">{emptyDescription}</p></div> : null}
      <div className="py-6 text-center text-xs text-slate-900">{t("home.youAreCaughtUp")}</div>
    </section>
  );
}

function GuestProductCard({ product, formatMoney, t }: { product: BuyerProduct; formatMoney: (cents: number, currency?: string) => string; t: Translator }) {
  const image = resolveUploadedImageUrl(product.images[0]);
  const hasPriceRange = product.maxPrice > product.minPrice;
  const quickAddVariant = product.options.length === 0 && product.variants.filter((variant) => variant.stock > 0).length === 1 && product.variants[0]?.optionValues.length === 0 ? product.variants[0] : null;
  const isOutOfStock = product.stock <= 0;
  const priceLabel = hasPriceRange ? `${formatMoney(product.minPrice, product.currency)} - ${formatMoney(product.maxPrice, product.currency)}` : formatMoney(product.price, product.currency);
  const cardBadges = product.badges.length ? product.badges : isOutOfStock ? [t("product.outOfStock")] : [];
  const discountLabel = product.discountPercent && product.discountPercent > 0 ? t("product.discountPercentOff").replace("{percent}", String(product.discountPercent)) : null;
  const quickAddLabel = quickAddVariant ? t("product.quickAddToCart").replace("{title}", product.title) : t("product.openProductDetails").replace("{title}", product.title);
  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2">
      <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
        <Link href={`/products/${product.id}`} prefetch={false} className="block size-full focus-visible:outline-none" aria-label={t("product.viewProduct").replace("{title}", product.title)}><div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white"><Image src={image} alt={product.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" /></div></Link>
        <div className="absolute left-2 top-2 flex min-h-5 max-w-[calc(100%-3.5rem)] flex-wrap gap-1">{cardBadges.slice(0, 2).map((badge) => <Badge key={badge} className="rounded-md bg-orange-700 px-1.5 py-0.5 text-[10px] leading-none text-white">{badge}</Badge>)}</div>
        {discountLabel ? <Badge className="absolute bottom-2 left-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] leading-none text-white">{discountLabel}</Badge> : null}
        <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 size-9 rounded-full bg-white/90 shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500" aria-label={t("product.signInBuyerWishlist")} title={t("product.signInBuyerWishlist")} disabled><HeartIcon className="size-4 text-slate-700" /></Button>
        {isOutOfStock ? <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1 text-center text-xs font-semibold text-white">{t("product.outOfStock")}</div> : null}
      </div>
      <div className="space-y-2 p-3">
        <Link href={`/products/${product.id}`} prefetch={false} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-slate-900">{product.title}</h3></Link>
        {product.brand ? <p className="truncate text-xs font-medium text-slate-500">{product.brand.name}</p> : null}
        <div className="flex min-h-12 items-end justify-between gap-2"><div className="min-w-0 flex-1"><p className="truncate text-base font-bold text-orange-700" title={priceLabel}>{priceLabel}</p>{product.originalPrice && product.originalPrice > product.minPrice ? <p className="truncate text-xs text-slate-600 line-through" title={formatMoney(product.originalPrice, product.currency)}>{formatMoney(product.originalPrice, product.currency)}</p> : null}</div><span className="shrink-0 text-xs text-slate-500">{isOutOfStock ? t("common.unavailable") : t("product.soldCount").replace("{count}", String(product.soldCount))}</span></div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span className="flex items-center gap-1"><StarIcon className="size-3.5 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span><span className="flex min-w-0 items-center gap-1"><MapPinIcon className="size-3.5 shrink-0" /><span className="truncate">{product.shop.location}</span></span></div>
        <div className="flex min-h-9 items-center justify-between gap-2"><Badge variant="outline" className="min-w-0 max-w-full truncate rounded-full border-orange-200 bg-orange-50 font-normal text-orange-700">{product.shop.name}</Badge>{quickAddVariant ? <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500" aria-label={quickAddLabel} title={quickAddLabel} disabled><ShoppingCartIcon className="size-4" /></Button> : <Link href={`/products/${product.id}`} prefetch={false} className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" aria-label={quickAddLabel}>{t("common.details")}</Link>}</div>
        <p className="min-h-4 truncate text-[11px] leading-4 text-orange-700" aria-live="polite">{quickAddVariant ? t("product.loginToAddToCart") : "\u00a0"}</p>
      </div>
    </article>
  );
}

function ProductVisual({ product, compact = false, t }: { product: MarketplaceProductCard; compact?: boolean; t: Translator }) {
  const imageUrl = resolveUploadedImageUrl(product.imageUrl);
  return <div className={`relative overflow-hidden bg-gradient-to-br ${productGradients[Math.abs(hashString(product.id)) % productGradients.length]} ${compact ? "h-28" : "aspect-square"}`}>{imageUrl ? <img src={imageUrl} alt={product.title} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" /> : null}{imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 via-transparent to-transparent" /> : null}{product.originalPrice && product.originalPrice > product.price ? <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-orange-700 shadow-sm">{t("home.saleBadge")}</div> : null}<span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-sm"><HeartIcon className="size-4" /><span className="sr-only">{t("product.saveProduct")}</span></span><div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? "hidden" : ""}`}><ShoppingBagIcon className={`${compact ? "size-12" : "size-20"} text-slate-900/60`} /></div></div>;
}

function FeaturedShopsSection({ shops, localePath, t }: { shops: MarketplaceShop[]; localePath: (path: string) => string; t: Translator }) {
  if (!shops.length) return <SectionEmptyState title={t("home.featuredShopsEmptyTitle")} description={t("home.featuredShopsEmptyDescription")} />;
  return <section className="mt-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-950">{t("home.featuredShopsTitle")}</h2><ShoppingBagIcon className="size-5 text-orange-500" /></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{shops.map((shop) => <Link key={shop.id} href={localePath(`/shops/${shop.slug || shop.id}`)} prefetch={false} className="min-w-0 rounded-2xl border border-slate-100 p-3 transition hover:bg-slate-50"><p className="truncate text-sm font-extrabold text-slate-950">{shop.name}</p><p className="mt-1 text-xs text-slate-900">{t("buyer.productsCount").replace("{count}", shop.productCount.toLocaleString())} · {t("buyer.followersCount").replace("{count}", shop.followerCount.toLocaleString())}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><StarIcon className="size-3 fill-amber-400 text-amber-400" /> {shop.ratingAverage.toFixed(1)} ({shop.ratingCount})</p></Link>)}</div></section>;
}

function GuestMobileNavigation({ locale, t }: { locale: Locale; t: Translator }) {
  const items = [
    ["/", "nav.home", HomeIcon],
    ["/search", "nav.search", SearchIcon],
    ["/deals", "common.deals", FlameIcon],
    ["/cart", "nav.cart", ShoppingCartIcon],
    ["/orders", "nav.orders", PackageIcon],
    ["/profile", "nav.profile", UserCircleIcon],
  ] as const;
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"><div className="mx-auto grid max-w-md grid-cols-6">{items.map(([href, label, Icon]) => <Link key={href} href={withLocale(href, locale)} prefetch={false} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold ${href === "/" ? "bg-orange-50 text-orange-700" : "text-slate-900"}`}><Icon className="size-5" /><span>{t(label)}</span></Link>)}</div></nav>;
}

function SectionEmptyState({ title, description }: { title: string; description: string }) {
  return <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"><p className="text-sm font-bold text-slate-950">{title}</p><p className="mt-1 text-xs text-slate-900">{description}</p></div>;
}

function normalizeHomepageHref(href: string | null | undefined, fallback: string) {
  return href && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/")) ? href : fallback;
}

function hashString(value: string) {
  return [...value].reduce((hash, char) => hash + char.charCodeAt(0), 0);
}
