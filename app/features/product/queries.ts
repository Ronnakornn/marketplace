"use client";

import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { defaultCurrency } from "#/i18n/config";
import { isSecretStorageUrl } from "#/lib/assets";
import { api } from "#/lib/eden";

export const PRODUCT_QUERY_STALE_TIME_MS = 60_000;
export const PUBLIC_PRODUCT_PAGE_SIZE = 40;
export const SELLER_PRODUCT_PAGE_SIZE = 20;
export const ADMIN_PRODUCT_PAGE_SIZE = 50;
export const AFFILIATE_TARGET_PAGE_SIZE = 10;

type Locale = "th" | "en";
type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
type ProductSort = "relevance" | "newest" | "best_selling" | "price_asc" | "price_desc" | "rating" | string;

type PublicProductsResponse = Treaty.Data<ReturnType<typeof api.api.products.get>>;
type PublicProductDetailResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["get"]>>;
type PublicRelatedProductsResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["related"]["get"]>>;
type PublicProductReviewsResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["reviews"]["get"]>>;
type PublicProductRatingSummaryResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["rating-summary"]["get"]>>;
type PublicProductQuestionsResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["questions"]["get"]>>;
type PublicProductQuestionResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products>["questions"]["post"]>>;
type ProductQuestionAnswerResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.products.questions>["answers"]["post"]>>;
type PublicCategoriesResponse = Treaty.Data<ReturnType<typeof api.api.categories.get>>;
type PublicSearchProductsResponse = Treaty.Data<ReturnType<typeof api.api.search.products.get>>;
type PublicSearchSuggestionsResponse = Treaty.Data<ReturnType<typeof api.api.search.suggestions.get>>;
type SellerProductsResponse = Treaty.Data<ReturnType<typeof api.api.seller.products.get>>;
type AdminProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.products.get>>;
type AdminCatalogProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.catalog.products.get>>;
type AdminCatalogProductDetailResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.admin.catalog.products>["get"]>>;
type AffiliateTargetsResponse = Treaty.Data<ReturnType<typeof api.api.affiliate.targets.get>>;
type PublicBrandsResponse = Treaty.Data<ReturnType<typeof api.api.brands.get>>;

export interface PublicProductListInput {
  locale?: Locale;
  q?: string;
  keyword?: string;
  categoryId?: string;
  shopId?: string;
  brandId?: string;
  attributeFilters?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  rating?: number | string;
  inStock?: boolean | string;
  freeShipping?: boolean | string;
  onSale?: boolean | string;
  sort?: ProductSort;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface PublicProductDetailInput {
  productId: string;
  locale?: Locale;
}

export interface PublicRelatedProductsInput extends PublicProductDetailInput {
  limit?: number;
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
  brandId?: string;
  attributeFilters?: string;
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

type QueryValue = string | number | boolean | undefined;
type CleanQuery = Record<string, string | number | boolean>;

export interface BuyerProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  minPrice: number;
  maxPrice: number;
  currency: string;
  rating: number;
  soldCount: number;
  stock: number;
  originalPrice: number | null;
  discountPercent: number | null;
  badges: string[];
  shop: {
    id: string;
    name: string;
    location: string;
  };
  brand: {
    id: string;
    name: string;
    slug: string;
  } | null;
  metaTitle: string | null;
  metaDescription: string | null;
  warrantyInfo: string | null;
  condition: string | null;
  countryOfOrigin: string | null;
  highlights: string[];
  attributes: Array<{
    key: string;
    name: string;
    value: string;
    isFilterable: boolean;
  }>;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    price: number;
    currency: string;
    stock: number;
    optionValues: Array<{
      optionId: string;
      optionName: string;
      valueId: string;
      value: string;
      colorHex: string | null;
    }>;
  }>;
  images: string[];
  video: {
    url: string;
    contentType: string;
    fileName: string;
  } | null;
  options: Array<{
    id: string;
    name: string;
    values: Array<{
      id: string;
      value: string;
      colorHex: string | null;
    }>;
  }>;
}

export interface BuyerCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface BuyerBrand {
  id: string;
  slug: string;
  name: string;
}

export interface BuyerListingMeta {
  totalCount: number | null;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  query: {
    q?: string;
    categoryId?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  };
}

export interface BuyerListingFacets {
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    count: number;
    active: boolean;
  }>;
  brands: Array<{
    id: string;
    name: string;
    slug?: string;
    count: number;
    active: boolean;
  }>;
  price: {
    min: number | null;
    max: number | null;
    currency: string;
  };
}

export interface BuyerProductListing {
  products: BuyerProduct[];
  meta: BuyerListingMeta;
  facets: BuyerListingFacets;
}

export interface BuyerReviewMedia {
  id: string;
  type: "IMAGE";
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface BuyerProductReview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  media: BuyerReviewMedia[];
  createdAt: string;
  snapshot: {
    productTitle: string;
    variantTitle: string;
    variantSku: string;
    shopName: string;
  } | null;
}

export interface BuyerProductRatingSummary {
  averageRating: number;
  totalReviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface BuyerProductQuestionAnswer {
  id: string;
  answer: string;
  status: "PUBLISHED" | string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

export interface BuyerProductQuestion {
  id: string;
  productId: string;
  shopId: string;
  question: string;
  status: "PUBLISHED" | string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  answers: BuyerProductQuestionAnswer[];
}

export interface AffiliateProductTargetOption {
  id: string;
  label: string;
  description: string | null;
  type: "product";
}

export const productQueryKeys = {
  all: ["product"] as const,
  public: {
    all: () => [...productQueryKeys.all, "public"] as const,
    lists: () => [...productQueryKeys.public.all(), "lists"] as const,
    list: (input: PublicProductListInput = {}) =>
      [...productQueryKeys.public.lists(), cleanPublicProductListInput(input)] as const,
    searches: () => [...productQueryKeys.public.all(), "searches"] as const,
    search: (input: PublicProductListInput = {}) =>
      [...productQueryKeys.public.searches(), cleanSearchProductInput(input)] as const,
    suggestions: (input: Pick<PublicProductListInput, "locale" | "q" | "limit"> = {}) =>
      [...productQueryKeys.public.all(), "suggestions", cleanSearchSuggestionInput(input)] as const,
    details: () => [...productQueryKeys.public.all(), "details"] as const,
    detail: (input: PublicProductDetailInput) =>
      [...productQueryKeys.public.details(), cleanPublicProductDetailInput(input)] as const,
    related: (input: PublicRelatedProductsInput) =>
      [...productQueryKeys.public.all(), "related", cleanPublicRelatedProductsInput(input)] as const,
    reviews: (productId: string) => [...productQueryKeys.public.all(), "reviews", productId] as const,
    ratingSummary: (productId: string) => [...productQueryKeys.public.all(), "rating-summary", productId] as const,
    questions: (productId: string) => [...productQueryKeys.public.all(), "questions", productId] as const,
    categories: (input: PublicCategoryListInput = {}) =>
      [...productQueryKeys.public.all(), "categories", cleanCategoryInput(input)] as const,
    brands: () => [...productQueryKeys.public.all(), "brands"] as const,
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
  const query = cleanPublicProductListApiInput(input);
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

export function publicRelatedProductsQueryOptions(input: PublicRelatedProductsInput) {
  const query = cleanPublicRelatedProductsApiInput(input);
  return queryOptions({
    queryKey: productQueryKeys.public.related(input),
    queryFn: async (): Promise<PublicRelatedProductsResponse> => {
      const { data, error } = await api.api.products({ productId: input.productId }).related.get({ query });
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicProductReviewsQueryOptions(productId: string) {
  return queryOptions({
    queryKey: productQueryKeys.public.reviews(productId),
    queryFn: async (): Promise<PublicProductReviewsResponse> => {
      const { data, error } = await api.api.products({ productId }).reviews.get();
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicProductRatingSummaryQueryOptions(productId: string) {
  return queryOptions({
    queryKey: productQueryKeys.public.ratingSummary(productId),
    queryFn: async (): Promise<PublicProductRatingSummaryResponse> => {
      const { data, error } = await api.api.products({ productId })["rating-summary"].get();
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicProductQuestionsQueryOptions(productId: string) {
  return queryOptions({
    queryKey: productQueryKeys.public.questions(productId),
    queryFn: async (): Promise<PublicProductQuestionsResponse> => {
      const { data, error } = await api.api.products({ productId }).questions.get();
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

export function publicBrandsQueryOptions() {
  return queryOptions({
    queryKey: productQueryKeys.public.brands(),
    queryFn: async (): Promise<PublicBrandsResponse> => {
      const { data, error } = await api.api.brands.get();
      if (error) throw error;
      return data;
    },
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export function publicShopProductsQueryOptions(input: PublicProductListInput & { shopId: string }) {
  const query = cleanPublicProductListApiInput(input);
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
  return queryOptions({
    queryKey: productQueryKeys.affiliate.productTargets(input),
    queryFn: () => fetchAffiliateProductTargets(input),
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
  });
}

export async function fetchAffiliateProductTargets(input: AffiliateProductTargetInput = {}): Promise<AffiliateTargetsResponse> {
  const query = cleanAffiliateTargetInput(input);
  const { data, error } = await api.api.affiliate.targets.get({
    query: { targetType: "product", ...query },
  });
  if (error) throw error;
  return data;
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

export function usePublicRelatedProducts(input: PublicRelatedProductsInput) {
  return useQuery(publicRelatedProductsQueryOptions(input));
}

export function usePublicProductReviews(productId: string) {
  return useQuery(publicProductReviewsQueryOptions(productId));
}

export function usePublicProductRatingSummary(productId: string) {
  return useQuery(publicProductRatingSummaryQueryOptions(productId));
}

export function usePublicProductQuestions(productId: string) {
  return useQuery(publicProductQuestionsQueryOptions(productId));
}

export function usePublicCategories(input: PublicCategoryListInput = {}) {
  return useQuery(publicCategoriesQueryOptions(input));
}

export function usePublicBrands() {
  return useQuery(publicBrandsQueryOptions());
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
  const productScopedInvalidations = input.productId
    ? [
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.public.detail({ productId: input.productId, locale: input.locale }),
        }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.public.related({ productId: input.productId, locale: input.locale }),
        }),
        queryClient.invalidateQueries({ queryKey: productQueryKeys.public.reviews(input.productId) }),
        queryClient.invalidateQueries({ queryKey: productQueryKeys.public.ratingSummary(input.productId) }),
        queryClient.invalidateQueries({ queryKey: productQueryKeys.public.questions(input.productId) }),
      ]
    : [
        queryClient.invalidateQueries({ queryKey: productQueryKeys.public.details() }),
      ];

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productQueryKeys.public.lists() }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.public.searches() }),
    ...productScopedInvalidations,
  ]);
}

export async function createProductQuestion(productId: string, question: string): Promise<PublicProductQuestionResponse> {
  const { data, error } = await api.api.products({ productId }).questions.post({ question });
  if (error) throw error;
  return data;
}

export async function answerProductQuestion(questionId: string, answer: string): Promise<ProductQuestionAnswerResponse> {
  const { data, error } = await api.api.products.questions({ questionId }).answers.post({ answer });
  if (error) throw error;
  return data;
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

export function normalizeAffiliateProductTargets(response: AffiliateTargetsResponse): AffiliateProductTargetOption[] {
  return readArray(toRecord(response).items).map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      label: readString(record.label, "Untitled"),
      description: optionalString(record.description),
      type: "product",
    };
  });
}

export function cleanPublicProductListInput(input: PublicProductListInput = {}): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    q: input.q,
    keyword: input.keyword,
    categoryId: input.categoryId,
    shopId: input.shopId,
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    inStock: input.inStock,
    freeShipping: input.freeShipping,
    onSale: input.onSale,
    sort: input.sort,
    cursor: input.cursor,
    page: input.page,
    limit: input.limit ?? PUBLIC_PRODUCT_PAGE_SIZE,
  });
}

export function cleanPublicProductListApiInput(input: PublicProductListInput = {}): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    q: input.q,
    keyword: input.keyword,
    categoryId: input.categoryId,
    shopId: input.shopId,
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
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
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
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
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
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

function cleanPublicRelatedProductsInput(input: PublicRelatedProductsInput): CleanQuery {
  return cleanQuery({
    productId: input.productId,
    locale: input.locale,
    limit: input.limit ?? 8,
  });
}

function cleanPublicRelatedProductsApiInput(input: PublicRelatedProductsInput): CleanQuery {
  return cleanQuery({
    locale: input.locale,
    limit: input.limit ?? 8,
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
    brandId: input.brandId,
    attributeFilters: input.attributeFilters,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    inStock: input.inStock,
    freeShipping: input.freeShipping,
    onSale: input.onSale,
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
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "" && value !== false),
  ) as CleanQuery;
}

export function normalizePublicProducts(response: PublicProductsResponse | PublicSearchProductsResponse | PublicRelatedProductsResponse): BuyerProduct[] {
  const record = toRecord(response);
  const rawItems = Array.isArray(response)
    ? response
    : readArray(record.data).length
      ? readArray(record.data)
      : readArray(record.items);
  return rawItems.map(normalizePublicProduct);
}

export function normalizePublicProductListing(
  response: PublicProductsResponse | PublicSearchProductsResponse | PublicRelatedProductsResponse,
): BuyerProductListing {
  const record = toRecord(response);
  const rawItems = Array.isArray(response)
    ? response
    : readArray(record.data).length
      ? readArray(record.data)
      : readArray(record.items);

  return {
    products: rawItems.map(normalizePublicProduct),
    meta: normalizeListingMeta(record.meta, rawItems.length),
    facets: normalizeListingFacets(record.facets),
  };
}

function normalizeListingMeta(metaInput: unknown, itemCount: number): BuyerListingMeta {
  const meta = toRecord(metaInput);
  const page = Math.max(1, readNumber(meta.page, 1));
  const pageSize = Math.max(1, readNumber(meta.pageSize, readNumber(meta.limit, itemCount || PUBLIC_PRODUCT_PAGE_SIZE)));
  const totalCount = optionalNumber(meta.totalCount);
  const hasNextPage = typeof meta.hasNextPage === "boolean"
    ? meta.hasNextPage
    : totalCount !== null
      ? page * pageSize < totalCount
      : false;
  const query = toRecord(meta.query);

  return {
    totalCount,
    page,
    pageSize,
    hasNextPage,
    query: {
      q: optionalString(query.q) ?? optionalString(query.keyword) ?? undefined,
      categoryId: optionalString(query.categoryId) ?? undefined,
      brandId: optionalString(query.brandId) ?? undefined,
      minPrice: optionalNumber(query.minPrice) ?? undefined,
      maxPrice: optionalNumber(query.maxPrice) ?? undefined,
      sort: optionalString(query.sort) ?? undefined,
    },
  };
}

function normalizeListingFacets(facetsInput: unknown): BuyerListingFacets {
  const facets = toRecord(facetsInput);
  const price = toRecord(facets.price);

  return {
    categories: readArray(facets.categories).map((item) => {
      const category = toRecord(item);
      return {
        id: readString(category.id, readString(category.slug)),
        slug: readString(category.slug),
        name: readString(category.name, "Category"),
        count: readNumber(category.count),
        active: category.active === true,
      };
    }).filter((category) => category.id && category.slug),
    brands: readArray(facets.brands).map((item) => {
      const brand = toRecord(item);
      const slug = optionalString(brand.slug) ?? undefined;
      return {
        id: readString(brand.id, slug ?? readString(brand.name)),
        name: readString(brand.name, "Brand"),
        ...(slug ? { slug } : {}),
        count: readNumber(brand.count),
        active: brand.active === true,
      };
    }).filter((brand) => brand.id),
    price: {
      min: optionalNumber(price.min),
      max: optionalNumber(price.max),
      currency: readString(price.currency, defaultCurrency),
    },
  };
}

export function normalizePublicProduct(input: PublicProductDetailResponse | unknown, index = 0): BuyerProduct {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const brand = toRecord(record.brand);
  const variants = readArray(record.variants).map((variantInput, variantIndex) => {
    const variant = toRecord(variantInput);
    const inventory = toRecord(variant.inventory);
    const stock = Math.max(0, readNumber(inventory.quantityOnHand, readNumber(variant.stock, 0)) - readNumber(inventory.quantityReserved, 0));
    return {
      id: readString(variant.id, `${readString(record.id)}-variant-${variantIndex}`),
      title: readString(variant.title, "Default"),
      sku: readString(variant.sku),
      price: readNumber(variant.price, readNumber(record.price, 0)),
      currency: readString(variant.currency, readString(record.currency, defaultCurrency)),
      stock,
      optionValues: normalizeVariantOptionValues(variant.optionValues),
    };
  });
  const firstVariant = variants[0];
  const ratingSummary = toRecord(record.ratingSummary);
  const variantPrices = variants.map((variant) => variant.price).filter((price) => price > 0);
  const minPrice = readNumber(record.minPrice, variantPrices.length ? Math.min(...variantPrices) : readNumber(record.price));
  const maxPrice = readNumber(record.maxPrice, variantPrices.length ? Math.max(...variantPrices) : minPrice);
  const stock = variants.length ? variants.reduce((total, variant) => total + variant.stock, 0) : readNumber(record.stock);
  const originalPrice = optionalNumber(record.originalPrice) ?? optionalNumber(record.compareAtPrice) ?? optionalNumber(record.listPrice);
  const discountPercent = optionalNumber(record.discountPercent) ?? calculateDiscountPercent(originalPrice, minPrice);

  return {
    id: readString(record.id, readString(record.productId, `product-${index}`)),
    title: readString(record.title, "Untitled product"),
    description: optionalString(record.description),
    price: firstVariant?.price ?? minPrice,
    minPrice,
    maxPrice,
    currency: firstVariant?.currency ?? readString(record.currency, defaultCurrency),
    rating: readNumber(record.rating, readNumber(ratingSummary.averageRating, 4.7)),
    soldCount: readNumber(record.soldCount, readNumber(record.sold, 0)),
    stock,
    originalPrice,
    discountPercent,
    badges: normalizeProductBadges(record, stock, discountPercent),
    shop: {
      id: readString(shop.id),
      name: readString(shop.name, "Marketplace shop"),
      location: readString(shop.location, readString(shop.city, "Local")),
    },
    brand: readString(brand.id) ? {
      id: readString(brand.id),
      name: readString(brand.name, "Brand"),
      slug: readString(brand.slug),
    } : null,
    metaTitle: optionalString(record.metaTitle),
    metaDescription: optionalString(record.metaDescription),
    warrantyInfo: optionalString(record.warrantyInfo),
    condition: optionalString(record.condition),
    countryOfOrigin: optionalString(record.countryOfOrigin),
    highlights: readArray(record.highlights).map((item) => readString(toRecord(item).text, readString(item))).filter(Boolean),
    attributes: readArray(record.attributes).map((item) => {
      const attribute = toRecord(item);
      return {
        key: readString(attribute.attributeKey, readString(attribute.key)),
        name: readString(attribute.displayName, "Specification"),
        value: readString(attribute.value),
        isFilterable: attribute.isFilterable === true,
      };
    }).filter((attribute) => attribute.name && attribute.value),
    variants,
    images: normalizeProductImages(record.images, record.coverImage),
    video: normalizeProductVideo(record.video),
    options: normalizeProductOptions(record.options),
  };
}

function normalizeProductOptions(optionsInput: unknown): BuyerProduct["options"] {
  return readArray(optionsInput).map((item) => {
    const option = toRecord(item);
    return {
      id: readString(option.id),
      name: readString(option.name, "Option"),
      values: readArray(option.values).map((valueInput) => {
        const value = toRecord(valueInput);
        return {
          id: readString(value.id),
          value: readString(value.value, "Option"),
          colorHex: optionalString(value.colorHex),
        };
      }).filter((value) => value.id && value.value),
    };
  }).filter((option) => option.id && option.values.length).slice(0, 2);
}

function normalizeVariantOptionValues(optionValuesInput: unknown): BuyerProduct["variants"][number]["optionValues"] {
  return readArray(optionValuesInput).map((item) => {
    const link = toRecord(item);
    const optionValue = toRecord(link.optionValue);
    const option = toRecord(optionValue.option);
    return {
      optionId: readString(option.id),
      optionName: readString(option.name, "Option"),
      valueId: readString(optionValue.id, readString(link.optionValueId)),
      value: readString(optionValue.value, "Option"),
      colorHex: optionalString(optionValue.colorHex),
    };
  }).filter((item) => item.optionId && item.valueId);
}

function normalizeProductVideo(videoInput: unknown): BuyerProduct["video"] {
  const video = toRecord(videoInput);
  const url = readString(video.url);
  if (!url || isSecretStorageUrl(url)) return null;
  return {
    url,
    contentType: readString(video.contentType, "video/mp4"),
    fileName: readString(video.fileName, "Product video"),
  };
}

function normalizeProductImages(imagesInput: unknown, coverImageInput: unknown): string[] {
  const images = readArray(imagesInput)
    .map((image) => {
      if (typeof image === "string") return image;
      const imageRecord = toRecord(image);
      return readString(imageRecord.url);
    })
    .filter((image) => Boolean(image) && !isSecretStorageUrl(image));

  if (images.length) return images;

  const coverImage = optionalString(coverImageInput);
  return coverImage && !isSecretStorageUrl(coverImage) ? [coverImage] : [];
}

export function normalizePublicBrands(response: PublicBrandsResponse): BuyerBrand[] {
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      slug: readString(record.slug),
      name: readString(record.name, "Brand"),
    };
  }).filter((brand) => brand.id);
}

export function normalizePublicCategories(response: PublicCategoriesResponse): BuyerCategory[] {
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id, readString(record.slug)),
      slug: readString(record.slug),
      name: readString(record.name, "Category"),
      sortOrder: readNumber(record.sortOrder),
    };
  }).filter((category) => category.slug);
}

export function normalizePublicSearchSuggestions(response: PublicSearchSuggestionsResponse): string[] {
  const record = toRecord(response);
  const rawItems = readArray(record.items).length
    ? readArray(record.items)
    : readArray(record.suggestions).length
      ? readArray(record.suggestions)
      : readArray(record.productTitles);
  return rawItems.map((item) => readString(typeof item === "string" ? item : toRecord(item).value)).filter(Boolean);
}

export function normalizePublicProductReviews(response: PublicProductReviewsResponse | unknown): BuyerProductReview[] {
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    const snapshot = toRecord(record.snapshot);
    return {
      id: readString(record.id),
      reviewerName: readString(record.userName, "Marketplace buyer"),
      rating: Math.min(5, Math.max(1, readNumber(record.rating, 5))),
      comment: optionalString(record.comment),
      media: normalizeReviewMedia(record.media),
      createdAt: readDateString(record.createdAt),
      snapshot: readString(snapshot.productTitle) || readString(snapshot.variantTitle) ? {
        productTitle: readString(snapshot.productTitle),
        variantTitle: readString(snapshot.variantTitle),
        variantSku: readString(snapshot.variantSku),
        shopName: readString(snapshot.shopName),
      } : null,
    };
  }).filter((review) => review.id);
}

export function normalizePublicProductRatingSummary(response: PublicProductRatingSummaryResponse | unknown): BuyerProductRatingSummary {
  const record = toRecord(response);
  const distributionRecord = toRecord(record.distribution);
  const distribution = {
    1: readNumber(distributionRecord[1], readNumber(distributionRecord["1"])),
    2: readNumber(distributionRecord[2], readNumber(distributionRecord["2"])),
    3: readNumber(distributionRecord[3], readNumber(distributionRecord["3"])),
    4: readNumber(distributionRecord[4], readNumber(distributionRecord["4"])),
    5: readNumber(distributionRecord[5], readNumber(distributionRecord["5"])),
  } as Record<1 | 2 | 3 | 4 | 5, number>;
  const totalReviewCount = readNumber(record.totalReviewCount, Object.values(distribution).reduce((total, count) => total + count, 0));
  const fallbackAverage = totalReviewCount
    ? Object.entries(distribution).reduce((total, [rating, count]) => total + Number(rating) * count, 0) / totalReviewCount
    : 0;
  return {
    averageRating: readNumber(record.averageRating, Number(fallbackAverage.toFixed(2))),
    totalReviewCount,
    distribution,
  };
}

export function normalizePublicProductQuestions(response: PublicProductQuestionsResponse | unknown): BuyerProductQuestion[] {
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      productId: readString(record.productId),
      shopId: readString(record.shopId),
      question: readString(record.question),
      status: readString(record.status, "PUBLISHED"),
      createdAt: readDateString(record.createdAt),
      user: normalizeQuestionUser(record.user),
      answers: readArray(record.answers).map((answerInput) => {
        const answer = toRecord(answerInput);
        return {
          id: readString(answer.id),
          answer: readString(answer.answer),
          status: readString(answer.status, "PUBLISHED"),
          createdAt: readDateString(answer.createdAt),
          user: normalizeQuestionUser(answer.user),
        };
      }).filter((answer) => answer.id && answer.answer),
    };
  }).filter((question) => question.id && question.question);
}

function normalizeQuestionUser(input: unknown): BuyerProductQuestion["user"] {
  const user = toRecord(input);
  return {
    id: readString(user.id),
    name: readString(user.name, "Marketplace user"),
  };
}

function normalizeReviewMedia(mediaInput: unknown): BuyerReviewMedia[] {
  return readArray(mediaInput).map((item, index) => {
    const media = toRecord(item);
    const url = readString(media.url);
    return {
      id: readString(media.id, `${url}-${index}`),
      type: "IMAGE" as const,
      url,
      altText: optionalString(media.altText),
      sortOrder: readNumber(media.sortOrder, index),
    };
  }).filter((media) => media.url && media.type === "IMAGE" && !isSecretStorageUrl(media.url))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function readDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return readString(value);
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

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function calculateDiscountPercent(originalPrice: number | null, currentPrice: number): number | null {
  if (!originalPrice || originalPrice <= currentPrice || currentPrice < 1) return null;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

function normalizeProductBadges(record: Record<string, unknown>, stock: number, discountPercent: number | null): string[] {
  const rawBadges = readArray(record.badges).map((badge) => readString(badge)).filter(Boolean);
  const badges = new Set(rawBadges);
  if (Boolean(record.isFlashSale) || Boolean(record.flashSale)) badges.add("Flash Sale");
  if (Boolean(record.freeShipping) || Boolean(record.hasFreeShipping)) badges.add("Free Shipping");
  if (Boolean(record.verifiedShop) || Boolean(toRecord(record.shop).verified)) badges.add("Verified Shop");
  if (Boolean(record.preferredShop) || Boolean(toRecord(record.shop).preferred)) badges.add("Preferred Shop");
  if (stock > 0 && stock <= 5) badges.add("Low Stock");
  if (Boolean(record.isNew) || Boolean(record.newArrival)) badges.add("New");
  if (discountPercent) badges.add(`${discountPercent}% off`);
  return [...badges].slice(0, 4);
}
