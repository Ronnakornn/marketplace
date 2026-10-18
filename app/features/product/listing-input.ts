import type { Locale } from "#/i18n/config";
import type { PublicProductListInput } from "./queries";

export const PUBLIC_PRODUCT_PAGE_SIZE = 40;

export type ProductListingFilters = {
  query?: string;
  categoryId?: string;
  brandId?: string;
  attributeFilters?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  rating?: string;
  inStock?: string;
};

export function productListingInput(filters: ProductListingFilters, locale: Locale, page = 1): PublicProductListInput {
  const rating = filters.rating ? Number(filters.rating) : undefined;
  return {
    q: filters.query ?? "",
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    attributeFilters: filters.attributeFilters,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sort ?? "relevance",
    rating: rating !== undefined && Number.isFinite(rating) ? rating : undefined,
    inStock: filters.inStock === "true" ? true : undefined,
    limit: PUBLIC_PRODUCT_PAGE_SIZE,
    page,
    locale,
  };
}

export function cleanSearchProductInput(input: PublicProductListInput = {}) {
  const values = {
    locale: input.locale,
    q: input.q,
    categoryId: input.categoryId,
    shopId: input.shopId,
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    inStock: input.inStock,
    sort: input.sort === "relevance" ? "newest" : input.sort,
    page: input.page,
    limit: input.limit ?? PUBLIC_PRODUCT_PAGE_SIZE,
  };
  return Object.fromEntries(Object.entries(values).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== "" && entry[1] !== false,
  ));
}
