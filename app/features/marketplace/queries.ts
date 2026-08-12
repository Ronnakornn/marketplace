"use client";

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
    banners: readArray(sections.banners).map(normalizeBanner).filter((item) => item.id),
    categories: readArray(sections.categories).map(normalizeCategory).filter((item) => item.slug),
    flashSale: normalizeFlashSale(sections.flashSale),
    recommendedProducts: readArray(sections.recommendedProducts).map((item, index) => normalizeRecommendationProduct(item, index, "recommended")).filter((item) => item.id),
    newArrivals: readArray(sections.newArrivals).map((item, index) => normalizeRecommendationProduct(item, index, "new")).filter((item) => item.id),
    featuredShops: readArray(sections.featuredShops).map(normalizeShop).filter((item) => item.id),
    recentlyViewed: readArray(sections.recentlyViewed).map((item, index) => normalizeRecentlyViewedProduct(item, index)).filter((item) => item.id),
    promotions: readArray(sections.promotions).map(normalizePromotion).filter((item) => item.id),
  };
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

function normalizeBanner(input: unknown): MarketplaceBanner {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    title: readString(record.title, "Featured deal"),
    subtitle: optionalString(record.subtitle),
    imageUrl: optionalString(record.imageUrl),
    mobileImageUrl: optionalString(record.mobileImageUrl),
    targetUrl: optionalString(record.targetUrl),
  };
}

function normalizeCategory(input: unknown): MarketplaceCategory {
  const record = toRecord(input);
  return {
    id: readString(record.id, readString(record.slug)),
    slug: readString(record.slug),
    name: readString(record.name, "Category"),
  };
}

function normalizeFlashSale(input: unknown): MarketplaceFlashSale | null {
  const record = toRecord(input);
  const items = readArray(record.items).map((item, index) => normalizeFlashSaleItem(item, index)).filter((item) => item.id);
  if (!readString(record.id) && items.length === 0) return null;
  return {
    id: readString(record.id, "flash-sale"),
    title: readString(record.title, "Flash Sale"),
    description: optionalString(record.description),
    endsAt: optionalString(record.endsAt),
    items,
  };
}

function normalizeFlashSaleItem(input: unknown, index: number): MarketplaceProductCard {
  const record = toRecord(input);
  const product = toRecord(record.product);
  const variant = toRecord(record.variant);
  const salePrice = readNumber(record.salePrice);
  const originalPrice = readNumber(record.originalPrice);
  const shop = toRecord(product.shop);
  const normalized = {
    id: readString(product.id, readString(record.productId, `flash-product-${index}`)),
    title: readString(product.title, "Untitled product"),
    imageUrl: optionalString(product.coverImage),
    price: salePrice,
    originalPrice: originalPrice > salePrice ? originalPrice : null,
    currency: readString(variant.currency, "THB"),
    rating: 0,
    soldCount: readNumber(record.soldCount),
    shop: {
      id: readString(shop.id),
      name: readString(shop.name, "Marketplace shop"),
      location: null,
      slug: optionalString(shop.slug),
    },
    badges: ["Flash Sale"],
    variantId: optionalString(variant.id),
    stock: readNumber(record.stockLimit),
  };
  return withBuyerProduct(normalized, {
    variants: normalized.variantId ? [{
      id: normalized.variantId,
      title: readString(variant.title, "Default"),
      sku: readString(variant.sku),
      price: normalized.price,
      currency: normalized.currency,
      stock: normalized.stock ?? 0,
      optionValues: [],
    }] : [],
    options: [],
  });
}

function normalizeRecommendationProduct(input: unknown, index: number, badge: string): MarketplaceProductCard {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const minPrice = readNumber(record.minPrice, readNumber(record.price));
  const maxPrice = readNumber(record.maxPrice, minPrice);
  const normalized = {
    id: readString(record.productId, readString(record.id, `product-${index}`)),
    title: readString(record.title, "Untitled product"),
    imageUrl: optionalString(record.coverImage),
    price: minPrice,
    originalPrice: maxPrice > minPrice ? maxPrice : null,
    currency: readString(record.currency, "THB"),
    rating: readNumber(record.rating),
    soldCount: readNumber(record.soldCount),
    shop: {
      id: readString(shop.id),
      name: readString(shop.name, "Marketplace shop"),
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
      title: readString(record.variantTitle, "Default"),
      sku: readString(record.sku),
      price: normalized.price,
      currency: normalized.currency,
      stock: normalized.stock ?? 0,
      optionValues: [],
    }] : [],
    options: [],
  });
}

function normalizeRecentlyViewedProduct(input: unknown, index: number): MarketplaceProductCard {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const normalized = {
    id: readString(record.productId, readString(record.id, `recent-product-${index}`)),
    title: readString(record.title, "Untitled product"),
    imageUrl: optionalString(record.coverImage),
    price: readNumber(record.minPrice),
    originalPrice: null,
    currency: readString(record.currency, "THB"),
    rating: 0,
    soldCount: 0,
    shop: {
      id: readString(shop.id),
      name: readString(shop.name, "Marketplace shop"),
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
        location: product.shop.location ?? "Local",
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

function normalizeShop(input: unknown): MarketplaceShop {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    name: readString(record.name, "Shop"),
    slug: readString(record.slug),
    logoUrl: optionalString(record.logoUrl),
    coverUrl: optionalString(record.coverUrl),
    ratingAverage: readNumber(record.ratingAverage),
    ratingCount: readNumber(record.ratingCount),
    followerCount: readNumber(record.followerCount),
    productCount: readNumber(record.productCount),
  };
}

function normalizePromotion(input: unknown): MarketplacePromotion {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    code: readString(record.code),
    title: readString(record.title, readString(record.code, "Voucher")),
    description: optionalString(record.description),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
