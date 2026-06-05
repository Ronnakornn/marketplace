"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import {
  invalidateProductMutationQueries,
  invalidateSellerProductQueries,
  sellerProductsQueryOptions,
} from "#/features/product/queries";
import { uploadSellerFile, type SellerCompletedUpload, type SellerUploadUsage } from "#/features/seller/upload-helper";

export const SELLER_PAGE_SIZE = 20;

export type SellerDashboard = Treaty.Data<ReturnType<typeof api.api.seller.dashboard.get>>;
export type SellerProductsResponse = Treaty.Data<ReturnType<typeof api.api.seller.products.get>>;
export type SellerProduct = SellerProductsResponse extends { data: Array<infer T> } ? T : never;
export type SellerProductDetail = Treaty.Data<ReturnType<ReturnType<typeof api.api.seller.products>["get"]>>;
export type SellerInventoryResponse = Treaty.Data<ReturnType<typeof api.api.seller.inventory.get>>;
export type SellerCategory = Treaty.Data<ReturnType<typeof api.api.categories.get>> extends Array<infer T> ? T : never;
export type SellerCategorySpecsResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.categories>["specs"]["get"]>>;
export type SellerCategorySpec = SellerCategorySpecsResponse extends Array<infer T> ? T : never;
export type SellerBrand = Treaty.Data<ReturnType<typeof api.api.seller.brands.get>> extends Array<infer T> ? T : never;
export type SellerProductImage = SellerProduct extends { images: Array<infer T> } ? T : never;
export type SellerProductVideo = SellerProduct extends { video: infer T } ? NonNullable<T> : never;
export type SellerUpload = SellerCompletedUpload;
export type SellerShipment = Treaty.Data<ReturnType<typeof api.api.seller.shipments.get>> extends Array<infer T> ? T : never;
export type SellerReturn = Treaty.Data<ReturnType<typeof api.api.seller.returns.get>> extends Array<infer T> ? T : never;
export type SellerCoupon = Treaty.Data<ReturnType<typeof api.api.seller.coupons.get>> extends Array<infer T> ? T : never;
export type SellerWallet = Treaty.Data<ReturnType<typeof api.api.seller.wallet.get>>;
export type SellerTransactions = Treaty.Data<ReturnType<typeof api.api.seller.wallet.transactions.get>>;
export type SellerPayout = Treaty.Data<ReturnType<typeof api.api.seller.payouts.get>> extends Array<infer T> ? T : never;

export interface ProductFilters {
  q?: string;
  status?: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED" | "";
  categoryId?: string;
  cursor?: string;
  limit?: number;
}

export interface SellerProductInput {
  title: string;
  titleTh?: string | null;
  titleEn?: string | null;
  slug?: string;
  description?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  status?: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
  categoryId?: string | null;
  brandId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  warrantyInfo?: string | null;
  condition?: string | null;
  countryOfOrigin?: string | null;
  highlights?: Array<{ text: string; sortOrder?: number }>;
  attributes?: Array<{
    attributeKey?: string;
    displayName: string;
    value: string;
    sortOrder?: number;
    isFilterable?: boolean;
  }>;
}

export interface SellerVariantInput {
  sku: string;
  title: string;
  titleTh?: string | null;
  titleEn?: string | null;
  price: number;
  currency?: string;
  quantityOnHand?: number;
  reorderLevel?: number;
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  optionValueIds?: string[];
}

export interface SellerProductOptionInput {
  name: string;
  nameTh?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
  values: Array<{
    value: string;
    valueTh?: string | null;
    valueEn?: string | null;
    displayType?: string;
    colorHex?: string | null;
    sortOrder?: number;
  }>;
}

export interface SellerProductImageInput {
  uploadId?: string | null;
  url?: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
  width?: number | null;
  height?: number | null;
}

export interface SellerProductVideoInput {
  uploadId: string;
  sortOrder?: number;
}

export interface SellerVariantStockInput {
  variantId: string;
  productId?: string;
  quantityOnHand?: number;
  reorderLevel?: number;
}

export interface SellerCouponInput {
  code: string;
  titleTh?: string | null;
  titleEn?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  discountType: "fixed" | "percent";
  discountValueCents?: number | null;
  discountPercentBps?: number | null;
  minOrderCents?: number | null;
  maxDiscountCents?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
}

function sellerKey(resource: string, params?: unknown) {
  return params ? ["seller", resource, params] as const : ["seller", resource] as const;
}

function cleanProductFilters(filters: ProductFilters = {}) {
  return Object.fromEntries(
    Object.entries({
      q: filters.q || undefined,
      status: filters.status || undefined,
      categoryId: filters.categoryId || undefined,
      cursor: filters.cursor || undefined,
      limit: filters.limit ?? SELLER_PAGE_SIZE,
    }).filter(([, value]) => value !== undefined),
  );
}

export function useSellerDashboard() {
  return useQuery({
    queryKey: sellerKey("dashboard"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.dashboard.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerProducts(filters: ProductFilters = {}) {
  return useQuery(sellerProductsQueryOptions(cleanProductFilters(filters)));
}

export function useSellerProduct(productId?: string) {
  return useQuery({
    queryKey: productId ? ["product", "seller", "details", productId] : ["product", "seller", "details", "missing"],
    queryFn: async (): Promise<SellerProductDetail> => {
      if (!productId) throw new Error("Product id is required.");
      const { data, error } = await api.api.seller.products({ productId }).get();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(productId),
  });
}

export function useSellerInventory() {
  return useQuery({
    queryKey: sellerKey("inventory"),
    queryFn: async (): Promise<SellerInventoryResponse> => {
      const { data, error } = await api.api.seller.inventory.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerCategories() {
  return useQuery({
    queryKey: ["seller", "categories"],
    queryFn: async () => {
      const { data, error } = await api.api.categories.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerCategorySpecs(categoryId?: string | null) {
  return useQuery({
    queryKey: ["seller", "category-specs", categoryId ?? ""],
    enabled: Boolean(categoryId),
    queryFn: async (): Promise<SellerCategorySpecsResponse> => {
      if (!categoryId) return [];
      const { data, error } = await api.api.categories({ categoryId }).specs.get();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSellerBrands() {
  return useQuery({
    queryKey: sellerKey("brands"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.brands.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerShipments() {
  return useQuery({
    queryKey: sellerKey("shipments"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.shipments.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerReturns() {
  return useQuery({
    queryKey: sellerKey("returns"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.returns.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerCoupons() {
  return useQuery({
    queryKey: sellerKey("coupons"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.coupons.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerWallet() {
  return useQuery({
    queryKey: sellerKey("wallet"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.wallet.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerTransactions() {
  return useQuery({
    queryKey: sellerKey("transactions"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.wallet.transactions.get({ query: { page: 1, limit: SELLER_PAGE_SIZE } });
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerPayouts() {
  return useQuery({
    queryKey: sellerKey("payouts"),
    queryFn: async () => {
      const { data, error } = await api.api.seller.payouts.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSellerProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SellerProductInput) => {
      const { data, error } = await api.api.seller.products.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        affectsPublic: variables.status === "ACTIVE",
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useUpdateSellerProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, ...input }: SellerProductInput & { productId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useArchiveSellerProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await api.api.seller.products({ productId }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, productId) => {
      await invalidateProductMutationQueries(queryClient, {
        productId,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useCreateSellerVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, quantityOnHand: _quantityOnHand, reorderLevel: _reorderLevel, ...input }: SellerVariantInput & { productId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).variants.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUpdateSellerVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, variantId, quantityOnHand: _quantityOnHand, reorderLevel: _reorderLevel, ...input }: Partial<SellerVariantInput> & { productId: string; variantId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).variants({ variantId }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useDeleteSellerVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).variants({ variantId }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useCreateSellerProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, ...input }: SellerProductImageInput & { productId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).images.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUploadSellerMedia() {
  return useMutation({
    mutationFn: (input: { file: File; usage: SellerUploadUsage }) => uploadSellerFile(input),
  });
}

export function useUploadAndCreateSellerProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, file, ...input }: Omit<SellerProductImageInput, "uploadId" | "url"> & { productId: string; file: File }) => {
      const upload = await uploadSellerFile({ file, usage: "product_image" });
      const { data, error } = await api.api.seller.products({ productId }).images.post({
        ...input,
        uploadId: upload.id,
      });
      if (error) throw error;
      return { image: data, upload };
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUpdateSellerProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, imageId, ...input }: Partial<SellerProductImageInput> & { productId: string; imageId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).images({ imageId }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useDeleteSellerProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, imageId }: { productId: string; imageId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).images({ imageId }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUpdateSellerProductImagesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, images, primaryImageId }: { productId: string; images: Array<{ id: string; sortOrder?: number }>; primaryImageId?: string | null }) => {
      const { data, error } = await api.api.seller.products({ productId }).images.order.put({ images, primaryImageId });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUpsertSellerProductVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, ...input }: SellerProductVideoInput & { productId: string }) => {
      const { data, error } = await api.api.seller.products({ productId }).video.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUploadAndUpsertSellerProductVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, file, sortOrder }: { productId: string; file: File; sortOrder?: number }) => {
      const upload = await uploadSellerFile({ file, usage: "product_video" });
      const { data, error } = await api.api.seller.products({ productId }).video.post({
        uploadId: upload.id,
        sortOrder,
      });
      if (error) throw error;
      return { video: data, upload };
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useDeleteSellerProductVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await api.api.seller.products({ productId }).video.delete();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, productId) => {
      await invalidateProductMutationQueries(queryClient, {
        productId,
        affectsPublic: true,
      });
    },
  });
}

export function useUpdateSellerProductOptions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, options }: { productId: string; options: SellerProductOptionInput[] }) => {
      const { data, error } = await api.api.seller.products({ productId }).options.put({ options });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.productId,
        affectsPublic: true,
      });
    },
  });
}

export function useSubmitSellerProductReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await api.api.seller.products({ productId })["submit-review"].post();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, productId) => {
      await invalidateProductMutationQueries(queryClient, {
        productId,
        affectsPublic: false,
      });
    },
  });
}

export function useUpdateSellerVariantStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, quantityOnHand, reorderLevel }: SellerVariantStockInput) => {
      const { data, error } = await api.api.seller.variants({ variantId }).inventory.patch({ quantityOnHand, reorderLevel, reason: "seller stock update" });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidateSellerProductQueries(queryClient, { productId: variables.productId });
    },
  });
}

export const useUpdateSellerInventory = useUpdateSellerVariantStock;

export function usePackShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const { data, error } = await api.api.seller.shipments({ shipmentId }).pack.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useShipShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, carrier, trackingNo }: { shipmentId: string; carrier: string; trackingNo: string }) => {
      const { data, error } = await api.api.seller.shipments({ shipmentId }).ship.patch({ carrier, trackingNo });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useDeliverShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const { data, error } = await api.api.seller.shipments({ shipmentId }).deliver.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useApproveReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (returnId: string) => {
      const { data, error } = await api.api.seller.returns({ returnId }).approve.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useRejectReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (returnId: string) => {
      const { data, error } = await api.api.seller.returns({ returnId }).reject.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useCreateSellerCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SellerCouponInput) => {
      const { data, error } = await api.api.seller.coupons.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useUpdateSellerCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ couponId, ...input }: Partial<SellerCouponInput> & { couponId: string }) => {
      const { data, error } = await api.api.seller.coupons({ couponId }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useDeleteSellerCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (couponId: string) => {
      const { data, error } = await api.api.seller.coupons({ couponId }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}

export function useCreateSellerPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await api.api.seller.payouts.post({ amount });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller"] }),
  });
}
