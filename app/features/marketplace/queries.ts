import { queryOptions } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import type { BuyerProduct } from "#/features/product/queries";
import { api } from "#/lib/eden";

export const MARKETPLACE_HOME_STALE_TIME_MS = 60_000;

type Locale = "th" | "en";
export type DiscoveryHomeResponse = Treaty.Data<ReturnType<typeof api.api.discovery.home.get>>;

export interface MarketplaceHomeQueryInput {
  locale?: Locale;
  limit?: number;
  sessionId?: string;
}

export interface MarketplaceBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  targetUrl: string | null;
}

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
}

export interface MarketplaceProductCard {
  id: string;
  title: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  rating: number;
  soldCount: number;
  shop: {
    id: string;
    name: string;
    location: string | null;
    slug: string | null;
  };
  badges: string[];
  variantId: string | null;
  stock: number | null;
  buyerProduct: BuyerProduct;
}

export interface MarketplaceFlashSale {
  id: string;
  title: string;
  description: string | null;
  endsAt: string | null;
  items: MarketplaceProductCard[];
}

export interface MarketplaceShop {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAverage: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
}

export interface MarketplacePromotion {
  id: string;
  code: string;
  title: string;
  description: string | null;
}

export interface MarketplaceHomeData {
  banners: MarketplaceBanner[];
  categories: MarketplaceCategory[];
  flashSale: MarketplaceFlashSale | null;
  recommendedProducts: MarketplaceProductCard[];
  newArrivals: MarketplaceProductCard[];
  featuredShops: MarketplaceShop[];
  recentlyViewed: MarketplaceProductCard[];
  promotions: MarketplacePromotion[];
}

export const marketplaceQueryKeys = {
  all: ["marketplace"] as const,
  home: (input: MarketplaceHomeQueryInput = {}) => [...marketplaceQueryKeys.all, "home", cleanHomeQuery(input)] as const,
};

export function marketplaceHomeQueryOptions(input: MarketplaceHomeQueryInput = {}) {
  const query = cleanHomeQuery(input);
  return queryOptions({
    queryKey: marketplaceQueryKeys.home(input),
    queryFn: async (): Promise<DiscoveryHomeResponse> => {
      const { data, error } = await api.api.discovery.home.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: MARKETPLACE_HOME_STALE_TIME_MS,
  });
}

export function normalizeMarketplaceHome(response: DiscoveryHomeResponse): MarketplaceHomeData {
  const sections = toRecord(toRecord(response).sections);
  return {
    banners: mapRequired(readSectionArray(sections, "banners"), normalizeBanner, "banner"),
    categories: mapRequired(readSectionArray(sections, "categories"), normalizeCategory, "category"),
    flashSale: normalizeOptionalFlashSale(sections.flashSale),
    recommendedProducts: mapRequired(readSectionArray(sections, "recommendedProducts"), (item) => normalizeRecommendationProduct(item, "recommended"), "recommended product"),
    newArrivals: mapRequired(readSectionArray(sections, "newArrivals"), (item) => normalizeRecommendationProduct(item, "new"), "new arrival"),
    featuredShops: mapRequired(readSectionArray(sections, "featuredShops"), normalizeShop, "featured shop"),
    recentlyViewed: mapRequired(readSectionArray(sections, "recentlyViewed"), normalizeRecentlyViewedProduct, "recently viewed product"),
    promotions: mapRequired(readSectionArray(sections, "promotions"), normalizePromotion, "promotion"),
  };
}

function normalizeOptionalFlashSale(input: unknown): MarketplaceFlashSale | null {
  if (input === undefined || input === null) return null;
  const flashSale = normalizeFlashSale(input);
  if (!flashSale) throw new Error("Discovery API response contains a malformed flash sale");
  return flashSale;
}

function cleanHomeQuery(input: MarketplaceHomeQueryInput): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries({
      locale: input.locale,
      limit: input.limit ?? 12,
      sessionId: input.sessionId,
    }).filter(([, value]) => value !== undefined && value !== ""),
  ) as Record<string, string | number>;
}

function normalizeBanner(input: unknown): MarketplaceBanner | null {
  const record = toRecord(input);
  const id = readString(record.id);
  const title = readString(record.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    subtitle: optionalString(record.subtitle),
    imageUrl: optionalString(record.imageUrl),
    mobileImageUrl: optionalString(record.mobileImageUrl),
    targetUrl: optionalString(record.targetUrl),
  };
}

function normalizeCategory(input: unknown): MarketplaceCategory | null {
  const record = toRecord(input);
  const id = readString(record.id);
  const slug = readString(record.slug);
  const name = readString(record.name);
  if (!id || !slug || !name) return null;
  return {
    id,
    slug,
    name,
  };
}

function normalizeFlashSale(input: unknown): MarketplaceFlashSale | null {
  const record = toRecord(input);
  const id = readString(record.id);
  const title = readString(record.title);
  if (!id || !title) return null;
  if (!Array.isArray(record.items)) throw new Error("Discovery API response flash sale items must be an array");
  const items = mapRequired(record.items, normalizeFlashSaleItem, "flash sale item");
  return {
    id,
    title,
    description: optionalString(record.description),
    endsAt: optionalString(record.endsAt),
    items,
  };
}

function normalizeFlashSaleItem(input: unknown): MarketplaceProductCard | null {
  const record = toRecord(input);
  const product = toRecord(record.product);
  const variant = toRecord(record.variant);
  const salePrice = readRequiredNumber(record.salePrice, "flash sale price", 1);
  const originalPrice = readRequiredNumber(record.originalPrice, "flash sale original price", 1);
  const availableStock = readRequiredNumber(record.availableStock, "flash sale available stock", 0);
  const shop = toRecord(product.shop);
  const id = readString(product.id, readString(record.productId));
  const title = readString(product.title);
  const currency = readString(variant.currency);
  const shopId = readString(shop.id);
  const shopName = readString(shop.name);
  const variantId = optionalString(variant.id);
  if (!id || !title || !currency || !shopId || !shopName || !variantId) return null;
  const normalized = {
    id,
    title,
    imageUrl: optionalString(product.coverImage),
    price: salePrice,
    originalPrice: originalPrice > salePrice ? originalPrice : null,
    currency,
    rating: readNumber(record.rating),
    soldCount: readNumber(record.soldCount),
    shop: {
      id: shopId,
      name: shopName,
      location: null,
      slug: optionalString(shop.slug),
    },
    badges: ["Flash Sale"],
    variantId,
    stock: availableStock,
  };
  return withBuyerProduct(normalized, {
    variants: normalized.variantId ? [{
      id: normalized.variantId,
      title: readString(variant.title),
      sku: readString(variant.sku),
      price: normalized.price,
      currency: normalized.currency,
      stock: normalized.stock ?? 0,
      optionValues: [],
    }] : [],
    options: [],
  });
}

function normalizeRecommendationProduct(input: unknown, badge: string): MarketplaceProductCard | null {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const minPrice = readRequiredNumber(record.minPrice ?? record.price, "recommendation price", 1);
  const maxPrice = readNumber(record.maxPrice, minPrice);
  const id = readString(record.productId, readString(record.id));
  const title = readString(record.title);
  const shopId = readString(shop.id);
  const shopName = readString(shop.name);
  const currency = readString(record.currency);
  if (!id || !title || !shopId || !shopName || !currency) return null;
  const normalized = {
    id,
    title,
    imageUrl: optionalString(record.coverImage),
    price: minPrice,
    originalPrice: maxPrice > minPrice ? maxPrice : null,
    currency,
    rating: readNumber(record.rating),
    soldCount: readNumber(record.soldCount),
    shop: {
      id: shopId,
      name: shopName,
      location: optionalString(shop.location),
      slug: optionalString(shop.slug),
    },
    badges: badge === "new" ? ["New"] : [],
    variantId: optionalString(record.variantId),
    stock: readNumber(record.stock),
  };
  return withBuyerProduct(normalized, {
    variants: normalized.variantId ? [{
      id: normalized.variantId,
      title: readString(record.variantTitle),
      sku: readString(record.sku),
      price: normalized.price,
      currency: normalized.currency,
      stock: normalized.stock ?? 0,
      optionValues: [],
    }] : [],
    options: [],
  });
}

function normalizeRecentlyViewedProduct(input: unknown): MarketplaceProductCard | null {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const id = readString(record.productId, readString(record.id));
  const title = readString(record.title);
  const currency = readString(record.currency);
  const shopId = readString(shop.id);
  const shopName = readString(shop.name);
  if (!id || !title || !currency || !shopId || !shopName) return null;
  const normalized = {
    id,
    title,
    imageUrl: optionalString(record.coverImage),
    price: readNumber(record.minPrice),
    originalPrice: null,
    currency,
    rating: readNumber(record.rating),
    soldCount: readNumber(record.soldCount),
    shop: {
      id: shopId,
      name: shopName,
      location: null,
      slug: optionalString(shop.slug),
    },
    badges: [],
    variantId: null,
    stock: null,
  };
  return withBuyerProduct(normalized, { variants: [], options: [] });
}

function withBuyerProduct(
  product: Omit<MarketplaceProductCard, "buyerProduct">,
  purchaseData: Pick<BuyerProduct, "variants" | "options">,
): MarketplaceProductCard {
  const stock = Math.max(0, product.stock ?? purchaseData.variants.reduce((total, variant) => total + variant.stock, 0));
  const discountPercent = product.originalPrice && product.originalPrice > product.price && product.price > 0
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  return {
    ...product,
    buyerProduct: {
      id: product.id,
      title: product.title,
      description: null,
      price: product.price,
      minPrice: product.price,
      maxPrice: product.originalPrice && product.originalPrice > product.price ? product.originalPrice : product.price,
      currency: product.currency,
      rating: product.rating,
      soldCount: product.soldCount,
      stock,
      originalPrice: product.originalPrice,
      discountPercent,
      badges: product.badges,
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        location: product.shop.location ?? "",
      },
      brand: null,
      metaTitle: null,
      metaDescription: null,
      warrantyInfo: null,
      condition: null,
      countryOfOrigin: null,
      highlights: [],
      attributes: [],
      variants: purchaseData.variants,
      images: product.imageUrl ? [product.imageUrl] : [],
      video: null,
      options: purchaseData.options,
    },
  };
}

function normalizeShop(input: unknown): MarketplaceShop | null {
  const record = toRecord(input);
  const id = readString(record.id);
  const name = readString(record.name);
  const slug = readString(record.slug);
  if (!id || !name || !slug) return null;
  return {
    id,
    name,
    slug,
    logoUrl: optionalString(record.logoUrl),
    coverUrl: optionalString(record.coverUrl),
    ratingAverage: readNumber(record.ratingAverage),
    ratingCount: readNumber(record.ratingCount),
    followerCount: readNumber(record.followerCount),
    productCount: readNumber(record.productCount),
  };
}

function normalizePromotion(input: unknown): MarketplacePromotion | null {
  const record = toRecord(input);
  const id = readString(record.id);
  const code = readString(record.code);
  const title = readString(record.title);
  if (!id || !code || !title) return null;
  return {
    id,
    code,
    title,
    description: optionalString(record.description),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readSectionArray(sections: Record<string, unknown>, key: string): unknown[] {
  const value = sections[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Discovery API response section ${key} must be an array`);
  return value;
}

function mapRequired<T>(items: unknown[], normalize: (item: unknown) => T | null, label: string): T[] {
  return items.map((item) => {
    const normalized = normalize(item);
    if (!normalized) throw new Error(`Discovery API response contains a malformed ${label}`);
    return normalized;
  });
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readRequiredNumber(value: unknown, label: string, minimum: number): number {
  const number = typeof value === "bigint" ? Number(value) : typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number) || number < minimum) {
    throw new Error(`Discovery API response contains an invalid ${label}`);
  }
  return number;
}
