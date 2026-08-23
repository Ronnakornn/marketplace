import Link from "next/link";
import styles from "./HomeGuestSection.module.css";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";
import { type Locale, withLocale } from "#/i18n/config";
import { createTranslator } from "#/i18n/server";

export function HomeGuestSection({ initialHome, locale }: { initialHome?: DiscoveryHomeResponse; locale: Locale }) {
  const t = createTranslator(locale);
  const sections = toRecord(toRecord(initialHome).sections);
  const banners = readArray(sections.banners);
  const banner = toRecord(banners[0]);
  const categories = readArray(sections.categories).slice(0, 10).map(toRecord);
  const promotions = readArray(sections.promotions).slice(0, 3).map(toRecord);
  const flashSale = toRecord(sections.flashSale);
  const products = [
    ...readArray(flashSale.items),
    ...readArray(sections.recommendedProducts),
    ...readArray(sections.newArrivals),
  ].slice(0, 12).map(normalizeProduct);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={withLocale("/", locale)} prefetch={false} className={styles.brand}>{t("common.marketplace")}</Link>
          <form action={withLocale("/search", locale)} className={styles.searchForm}>
            <input name="q" aria-label={t("home.searchPlaceholder")} placeholder={t("home.searchPlaceholder")} className={styles.searchInput} />
          </form>
          <Link href={withLocale("/login", locale)} prefetch={false} className={styles.login}>{t("common.login")}</Link>
          <Link href={withLocale("/signup", locale)} prefetch={false} className={styles.signup}>{t("common.signup")}</Link>
        </div>
        <div className={styles.localeRow}>
          <Link href="/th" prefetch={false} hrefLang="th" className={styles.localeLink}>ไทย</Link>
          <Link href="/en" prefetch={false} hrefLang="en" className={styles.localeLink}>EN</Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.kicker}>⚡ {t("home.heroKicker")}</span>
          <h1 className={styles.heroTitle}>{readString(banner.title, t("home.heroTitle"))}</h1>
          <p className={styles.heroSubtitle}>{readString(banner.subtitle, t("home.heroSubtitle"))}</p>
          <div className={styles.actions}>
            <Link href={safeHref(banner.targetUrl, withLocale("/search?q=deals", locale))} prefetch={false} className={styles.primaryAction}>{t("home.shopNow")}</Link>
            <Link href={withLocale("/vouchers", locale)} prefetch={false} className={styles.secondaryAction}>{t("home.claimVoucher")}</Link>
          </div>
        </section>

        {promotions.length ? <section className={styles.promoStrip}>{promotions.map((promotion, index) => <Link key={readString(promotion.id, String(index))} href={withLocale("/vouchers", locale)} prefetch={false} className={styles.promo}><p className={styles.promoTitle}>{readString(promotion.title)}</p><p className={styles.promoDescription}>{readString(promotion.description, readString(promotion.code))}</p></Link>)}</section> : null}

        {categories.length ? <section className={styles.section}><h2 className={styles.sectionTitle}>{t("common.categories")}</h2><div className={styles.categoryGrid}>{categories.map((category, index) => <Link key={readString(category.id, String(index))} href={withLocale(`/categories/${readString(category.slug, readString(category.id))}`, locale)} prefetch={false} className={styles.category}>{readString(category.name, t("common.categories"))}</Link>)}</div></section> : null}

        {products.length ? <section className={styles.section}><h2 className={styles.sectionTitle}>{t("home.recommendedTitle")}</h2><div className={styles.productGrid}>{products.map((product, index) => <Link key={product.id || String(index)} href={withLocale(`/products/${product.id}`, locale)} prefetch={false} className={styles.product}><div className={styles.productImage}/><h3 className={styles.productTitle}>{product.title}</h3>{product.price !== null ? <p className={styles.price}>{new Intl.NumberFormat(locale, { style: "currency", currency: product.currency }).format(product.price / 100)}</p> : null}</Link>)}</div></section> : null}
      </main>

      <nav className={styles.mobileNav}><div className={styles.mobileNavInner}><Link href={withLocale("/", locale)} prefetch={false}>{t("nav.home")}</Link><Link href={withLocale("/search", locale)} prefetch={false}>{t("nav.search")}</Link><Link href={withLocale("/login", locale)} prefetch={false}>{t("common.login")}</Link></div></nav>
    </div>
  );
}

function normalizeProduct(value: unknown) {
  const record = toRecord(value);
  const product = Object.keys(toRecord(record.product)).length ? toRecord(record.product) : record;
  const variant = toRecord(record.variant);
  return {
    id: readString(product.id, readString(record.productId)),
    title: readString(product.title, "Product"),
    price: readNumber(record.salePrice) ?? readNumber(variant.price) ?? readNumber(product.price),
    currency: readString(product.currency, "THB"),
  };
}
function toRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function readArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function readString(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function readNumber(value: unknown): number | null { const number = typeof value === "number" ? value : Number(value); return Number.isFinite(number) ? number : null; }
function safeHref(value: unknown, fallback: string): string { const href = readString(value); return href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://") ? href : fallback; }
