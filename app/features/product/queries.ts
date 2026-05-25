"use client";

import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

export const PRODUCT_QUERY_STALE_TIME_MS = 60_000;
export const PUBLIC_PRODUCT_PAGE_SIZE = 40;
export const SELLER_PRODUCT_PAGE_SIZE = 20;
export const ADMIN_PRODUCT_PAGE_SIZE = 50;
export const AFFILIATE_TARGET_PAGE_SIZE = 10;

type Locale = "th" | "en";
type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type ProductSort = "relevance" | "newest" | "best_selling" | "price_asc" | "price_desc" | "rating" | string;

type PublicProductsResponse = Treaty.Data<ReturnType<typeof api.api.products.get>>;
type PublicProductDetailResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["get"]>>;
type PublicCategoriesResponse = Treaty.Data<ReturnType<typeof api.api.categories.get>>;
type PublicSearchProductsResponse = Treaty.Data<ReturnType<typeof api.api.search.products.get>>;
type PublicSearchSuggestionsResponse = Treaty.Data<ReturnType<typeof api.api.search.suggestions.get>>;
type SellerProductsResponse = Treaty.Data<ReturnType<typeof api.api.seller.products.get>>;
type AdminProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.products.get>>;
type AdminCatalogProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.catalog.products.get>>;
type AdminCatalogProductDetailResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.admin.catalog.products>["get"]>>;
type AffiliateTargetsResponse = Treaty.Data<ReturnType<typeof api.api.affiliate.targets.get>>;

export interface PublicProductListInput {
  locale?: Locale;
  q?: string;
  keyword?: string;
  categoryId?: string;
  shopId?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  rating?: number | string;
  sort?: ProductSort;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface PublicProductDetailInput {
  productId: string;
  locale?: Locale;
}

export interface PublicCategoryListInput {
  locale?: Locale;
}

export interface SellerProductListInput {
  q?: string;
  keyword?: string;
  status?: ProductStatus | "";
  categoryId?: string;
  shopId?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  cursor?: string;
  limit?: number;
}

export interface AdminProductListInput extends SellerProductListInput {
  page?: number;
}

export interface AffiliateProductTargetInput {
  q?: string;
  limit?: number;
}

type QueryValue = string | number | undefined;
type CleanQuery = Record<string, string | number>;

export const productQueryKeys = {
  all: ["product"] as const,
  public: {
    all: () => [...productQueryKeys.all, "public"] as const,
    lists: () => [...productQueryKeys.public.all(), "lists"] as const,
    list: (input: PublicProductListInput = {}) =>
      [...productQueryKeys.public.lists(), cleanPublicProductListInput(input)] as const,
    searches: () => [...productQueryKeys.public.all(), "searches"] as const,
    search: (input: PublicProductListInput = {}) =>
      [...productQueryKeys.public.searches(), cleanPublicProductListInput(input)] as const,
    suggestions: (input: Pick<PublicProductListInput, "locale" | "q" | "limit"> = {}) =>
      [...productQueryKeys.public.all(), "suggestions", cleanSearchSuggestionInput(input)] as const,
    details: () => [...productQueryKeys.public.all(), "details"] as const,
    detail: (input: PublicProductDetailInput) =>
      [...productQueryKeys.public.details(), cleanPublicProductDetailInput(input)] as const,
    categories: (input: PublicCategoryListInput = {}) =>
      [...productQueryKeys.public.all(), "categories", cleanCategoryInput(input)] as const,
    shopProducts: (input: PublicProductListInput & { shopId: string }) =>
      [...productQueryKeys.public.all(), "shop-products", cleanPublicProductListInput(input)] as const,
  },
  seller: {
    all: () => [...productQueryKeys.all, "seller"] as const,
    lists: () => [...productQueryKeys.seller.all(), "lists"] as const,
    list: (input: SellerProductListInput = {}) =>
      [...productQueryKeys.seller.lists(), cleanSellerProductListInput(input)] as const,
    details: () => [...productQueryKeys.seller.all(), "details"] as const,
    detail: (productId: string) => [...productQueryKeys.seller.details(), productId] as const,
  },
  admin: {
    all: () => [...productQueryKeys.all, "admin"] as const,
    lists: () => [...productQueryKeys.admin.all(), "lists"] as const,
    list: (input: AdminProductListInput = {}) =>
      [...productQueryKeys.admin.lists(), cleanAdminProductListInput(input)] as const,
    catalogLists: () => [...productQueryKeys.admin.all(), "catalog-lists"] as const,
    catalogList: (input: AdminProductListInput = {}) =>
      [...productQueryKeys.admin.catalogLists(), cleanAdminProductListInput(input)] as const,
    details: () => [...productQueryKeys.admin.all(), "details"] as const,
    detail: (productId: string) => [...productQueryKeys.admin.details(), productId] as const,
    catalogDetail: (productId: string) => [...productQueryKeys.admin.all(), "catalog-details", productId] as const,
  },
  affiliate: {
    all: () => [...productQueryKeys.all, "affiliate"] as const,
    productTargets: (input: AffiliateProductTargetInput = {}) =>
      [...productQueryKeys.affiliate.all(), "product-targets", cleanAffiliateTargetInput(input)] as const,
  },
};

export function publicProductListQueryOptions(input: PublicProductListInput = {}) {
  const query = cleanPublicProductListInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.list(input),
    queryFn: async (): Promise<PublicProductsResponse> => {
      const { data, error } = await api.api.products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicProductSearchQueryOptions(input: PublicProductListInput = {}) {
  const query = cleanSearchProductInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.search(input),
    queryFn: async (): Promise<PublicSearchProductsResponse> => {
      const { data, error } = await api.api.search.products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicProductDetailQueryOptions(input: PublicProductDetailInput) {
  const query = cleanCategoryInput({ locale: input.locale });
  return queryOptions({
    queryKey: productQueryKeys.public.detail(input),
    queryFn: async (): Promise<PublicProductDetailResponse> => {
      const { data, error } = await api.api.products({ productId: input.productId }).get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicCategoriesQueryOptions(input: PublicCategoryListInput = {}) {
  const query = cleanCategoryInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.categories(input),
    queryFn: async (): Promise<PublicCategoriesResponse> => {
      const { data, error } = await api.api.categories.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicShopProductsQueryOptions(input: PublicProductListInput & { shopId: string }) {
  const query = cleanPublicProductListInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.shopProducts(input),
    queryFn: async (): Promise<PublicProductsResponse> => {
      const { data, error } = await api.api.shops({ shopId: input.shopId }).products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicSearchSuggestionsQueryOptions(input: Pick<PublicProductListInput, "locale" | "q" | "limit"> = {}) {
  const query = cleanSearchSuggestionInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.suggestions(input),
    queryFn: async (): Promise<PublicSearchSuggestionsResponse> => {
      const { data, error } = await api.api.search.suggestions.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function sellerProductsQueryOptions(input: SellerProductListInput = {}) {
  const query = cleanSellerProductListInput(input);
  return queryOptions({
    queryKey: productQueryKeys.seller.list(input),
    queryFn: async (): Promise<SellerProductsResponse> => {
      const { data, error } = await api.api.seller.products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function adminProductsQueryOptions(input: AdminProductListInput = {}) {
  const query = cleanAdminProductListInput(input);
  return queryOptions({
    queryKey: productQueryKeys.admin.list(input),
    queryFn: async (): Promise<AdminProductsResponse> => {
      const { data, error } = await api.api.admin.products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function adminCatalogProductsQueryOptions(input: AdminProductListInput = {}) {
  const query = cleanAdminProductListInput(input);
  return queryOptions({
    queryKey: productQueryKeys.admin.catalogList(input),
    queryFn: async (): Promise<AdminCatalogProductsResponse> => {
      const { data, error } = await api.api.admin.catalog.products.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function adminCatalogProductDetailQueryOptions(productId: string) {
  return queryOptions({
    queryKey: productQueryKeys.admin.catalogDetail(productId),
    queryFn: async (): Promise<AdminCatalogProductDetailResponse> => {
      const { data, error } = await api.api.admin.catalog.products({ productId }).get();
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function affiliateProductTargetsQueryOptions(input: AffiliateProductTargetInput = {}) {
  const query = cleanAffiliateTargetInput(input);
  return queryOptions({
    queryKey: productQueryKeys.affiliate.productTargets(input),
    queryFn: async (): Promise<AffiliateTargetsResponse> => {
      const { data, error } = await api.api.affiliate.targets.get({
        query: { targetType: "product", ...query },
      });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function usePublicProductList(input: PublicProductListInput = {}) {
  return useQuery(publicProductListQueryOptions(input));
}

export function usePublicProductSearch(input: PublicProductListInput = {}) {
  return useQuery(publicProductSearchQueryOptions(input));
}

export function usePublicProductDetail(input: PublicProductDetailInput) {
  return useQuery(publicProductDetailQueryOptions(input));
}

export function usePublicCategories(input: PublicCategoryListInput = {}) {
  return useQuery(publicCategoriesQueryOptions(input));
}

export function usePublicShopProducts(input: PublicProductListInput & { shopId: string }) {
  return useQuery(publicShopProductsQueryOptions(input));
}

export function usePublicSearchSuggestions(input: Pick<PublicProductListInput, "locale" | "q" | "limit"> = {}) {
  return useQuery(publicSearchSuggestionsQueryOptions(input));
}

export function useSellerProductList(input: SellerProductListInput = {}) {
  return useQuery(sellerProductsQueryOptions(input));
}

export function useAdminProductList(input: AdminProductListInput = {}) {
  return useQuery(adminProductsQueryOptions(input));
}

export function useAdminCatalogProductList(input: AdminProductListInput = {}) {
  return useQuery(adminCatalogProductsQueryOptions(input));
}

export function useAdminCatalogProductDetail(productId: string) {
  return useQuery(adminCatalogProductDetailQueryOptions(productId));
}

export function useAffiliateProductTargets(input: AffiliateProductTargetInput = {}) {
  return useQuery(affiliateProductTargetsQueryOptions(input));
}

export async function invalidatePublicProductQueries(queryClient: QueryClient, input: { productId?: string; locale?: Locale } = {}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productQueryKeys.public.lists() }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.public.searches() }),
    input.productId
      ? queryClient.invalidateQueries({
          queryKey: productQueryKeys.public.detail({ productId: input.productId, locale: input.locale }),
        })
      : queryClient.invalidateQueries({ queryKey: productQueryKeys.public.details() }),
  ]);
}

export async function invalidateSellerProductQueries(queryClient: QueryClient, input: { productId?: string } = {}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productQueryKeys.seller.lists() }),
    input.productId
      ? queryClient.invalidateQueries({ queryKey: productQueryKeys.seller.detail(input.productId) })
      : queryClient.invalidateQueries({ queryKey: productQueryKeys.seller.details() }),
  ]);
}

export async function invalidateAdminProductQueries(queryClient: QueryClient, input: { productId?: string } = {}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productQueryKeys.admin.lists() }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.admin.catalogLists() }),
    input.productId
      ? Promise.all([
          queryClient.invalidateQueries({ queryKey: productQueryKeys.admin.detail(input.productId) }),
          queryClient.invalidateQueries({ queryKey: productQueryKeys.admin.catalogDetail(input.productId) }),
        ])
      : queryClient.invalidateQueries({ queryKey: productQueryKeys.admin.details() }),
  ]);
}

export async function invalidateAffiliateProductTargetQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.affiliate.all() });
}

export async function invalidateProductMutationQueries(
  queryClient: QueryClient,
  input: { productId?: string; locale?: Locale; affectsPublic?: boolean; affectsAffiliateTargets?: boolean } = {},
) {
  await Promise.all([
    invalidateSellerProductQueries(queryClient, input),
    invalidateAdminProductQueries(queryClient, input),
    input.affectsPublic ? invalidatePublicProductQueries(queryClient, input) : Promise.resolve(),
    input.affectsAffiliateTargets ? invalidateAffiliateProductTargetQueries(queryClient) : Promise.resolve(),
  ]);
}

export function cleanPublicProductListInput(input: PublicProductListInput = {}): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    q: input.q,
    keyword: input.keyword,
    categoryId: input.categoryId,
    shopId: input.shopId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    sort: input.sort,
    cursor: input.cursor,
    page: input.page,
    limit: input.limit ?? PUBLIC_PRODUCT_PAGE_SIZE,
  });
}

export function cleanSellerProductListInput(input: SellerProductListInput = {}): CleanQuery {
  return cleanQuery({
    q: input.q,
    keyword: input.keyword,
    status: input.status,
    categoryId: input.categoryId,
    shopId: input.shopId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    cursor: input.cursor,
    limit: input.limit ?? SELLER_PRODUCT_PAGE_SIZE,
  });
}

export function cleanAdminProductListInput(input: AdminProductListInput = {}): CleanQuery {
  return cleanQuery({
    q: input.q,
    keyword: input.keyword,
    status: input.status,
    categoryId: input.categoryId,
    shopId: input.shopId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    cursor: input.cursor,
    page: input.page,
    limit: input.limit ?? ADMIN_PRODUCT_PAGE_SIZE,
  });
}

function cleanPublicProductDetailInput(input: PublicProductDetailInput): CleanQuery {
  return cleanQuery({
    productId: input.productId,
    locale: input.locale,
  });
}

function cleanCategoryInput(input: PublicCategoryListInput = {}): CleanQuery {
  return cleanQuery({ locale: input.locale });
}

function cleanSearchProductInput(input: PublicProductListInput = {}): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    q: input.q,
    categoryId: input.categoryId,
    shopId: input.shopId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    sort: input.sort === "relevance" ? "newest" : input.sort,
    page: input.page,
    limit: input.limit ?? PUBLIC_PRODUCT_PAGE_SIZE,
  });
}

function cleanSearchSuggestionInput(input: Pick<PublicProductListInput, "locale" | "q" | "limit"> = {}): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    q: input.q,
    limit: input.limit ?? 8,
  });
}

function cleanAffiliateTargetInput(input: AffiliateProductTargetInput = {}): CleanQuery {
  return cleanQuery({
    q: input.q,
    limit: input.limit ?? AFFILIATE_TARGET_PAGE_SIZE,
  });
}

function cleanQuery(input: Record<string, QueryValue>): CleanQuery {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  ) as CleanQuery;
}
