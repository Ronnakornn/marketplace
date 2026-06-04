"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import type { ProductStatus } from "#generated/client/enums";
import { api } from "#/lib/eden";
import {
  adminCatalogProductDetailQueryOptions,
  adminCatalogProductsQueryOptions,
  invalidateProductMutationQueries,
  invalidatePublicProductQueries,
} from "#/features/product/queries";

type CatalogProductsResponse = Treaty.Data<ReturnType<typeof api.api.catalog.products.get>>;
export type CatalogProduct = CatalogProductsResponse extends { data: (infer T)[] } ? T : never;
export type CatalogVariant = CatalogProduct["variants"][number];
type AdminCategoriesResponse = Treaty.Data<ReturnType<typeof api.api.admin.categories.get>>;
export type AdminCategory = AdminCategoriesResponse extends (infer T)[] ? T : never;
type AdminCategorySpecsResponse = Treaty.Data<ReturnType<ReturnType<typeof api.api.admin.categories>["specs"]["get"]>>;
export type AdminCategorySpec = AdminCategorySpecsResponse extends (infer T)[] ? T : never;
export type CategorySpecType = AdminCategorySpec extends { valueType: infer T } ? T : "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTI_SELECT";

export interface CreateProductInput {
  shopId: string;
  title: string;
  titleTh?: string | null;
  titleEn?: string | null;
  slug?: string;
  description?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  status?: ProductStatus;
}

export interface UpdateProductInput {
  id: string;
  title?: string;
  titleTh?: string | null;
  titleEn?: string | null;
  slug?: string;
  description?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  status?: ProductStatus;
}

export interface CreateVariantInput {
  productId: string;
  sku: string;
  title: string;
  titleTh?: string | null;
  titleEn?: string | null;
  price: number;
  currency?: string;
  inventory?: {
    quantityOnHand: number;
    quantityReserved?: number;
    reorderLevel?: number;
  };
}

export interface UpdateVariantInput {
  productId: string;
  variantId: string;
  sku?: string;
  title?: string;
  titleTh?: string | null;
  titleEn?: string | null;
  price?: number;
  currency?: string;
}

export interface UpdateInventoryInput {
  variantId: string;
  quantityOnHand: number;
  quantityReserved?: number;
  reorderLevel?: number;
}

export interface UpsertAdminCategoryInput {
  id?: string;
  parentId?: string | null;
  name: string;
  nameTh?: string | null;
  nameEn?: string | null;
  slug?: string;
  sortOrder?: number;
}

export interface ReorderAdminCategoriesInput {
  parentId?: string | null;
  categories: Array<{ id: string; sortOrder: number }>;
}

export interface UpsertAdminCategorySpecInput {
  categoryId: string;
  id?: string;
  attributeKey: string;
  displayName: string;
  displayNameTh?: string | null;
  displayNameEn?: string | null;
  type: CategorySpecType;
  isRequired?: boolean;
  isFilterable?: boolean;
  unit?: string | null;
  sortOrder?: number;
}

export interface ReorderAdminCategorySpecsInput {
  categoryId: string;
  specs: Array<{ id: string; sortOrder: number }>;
}

export const adminCategoriesQueryKey = ["admin-categories"] as const;
export const adminCategorySpecsQueryKey = (categoryId: string) => ["admin-category-specs", categoryId] as const;

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function invalidateAdminCategoryQueries(queryClient: ReturnType<typeof useQueryClient>, categoryId?: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminCategoriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: ["categories"] }),
    queryClient.invalidateQueries({ queryKey: ["catalog-products"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] }),
    categoryId ? queryClient.invalidateQueries({ queryKey: adminCategorySpecsQueryKey(categoryId) }) : Promise.resolve(),
  ]);
}

export function useCatalogProducts() {
  return useQuery({
    queryKey: ["catalog-products"],
    queryFn: async () => {
      const { data, error } = await api.api.catalog.products.get();
      if (error) throw error;
      return data?.data ?? [];
    },
  });
}

export function useAdminCatalogProducts() {
  return useQuery({
    ...adminCatalogProductsQueryOptions({ limit: 50 }),
    select: (data) => data?.data ?? [],
  });
}

export function useAdminCatalogProductDetail(id: string | null) {
  return useQuery({
    ...adminCatalogProductDetailQueryOptions(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: adminCategoriesQueryKey,
    queryFn: async () => {
      const { data, error } = await api.api.admin.categories.get();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminCategorySpecs(categoryId: string | null) {
  return useQuery({
    queryKey: adminCategorySpecsQueryKey(categoryId ?? ""),
    enabled: Boolean(categoryId),
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await api.api.admin.categories({ categoryId }).specs.get();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertAdminCategoryInput) => {
      const { id: _id, ...body } = input;
      const { data, error } = await api.api.admin.categories.post({
        ...body,
        parentId: nullableText(body.parentId),
        nameTh: nullableText(body.nameTh),
        nameEn: nullableText(body.nameEn),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.id);
    },
  });
}

export function useUpdateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpsertAdminCategoryInput & { id: string }) => {
      const { data, error } = await api.api.admin.categories({ categoryId: id }).patch({
        ...body,
        parentId: nullableText(body.parentId),
        nameTh: nullableText(body.nameTh),
        nameEn: nullableText(body.nameEn),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.id);
    },
  });
}

export function useSetAdminCategoryActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? api.api.admin.categories({ categoryId: id }).reactivate : api.api.admin.categories({ categoryId: id }).deactivate;
      const { data, error } = await endpoint.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.id);
    },
  });
}

export function useReorderAdminCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ReorderAdminCategoriesInput) => {
      const { data, error } = await api.api.admin.categories.reorder.put(body);
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: async (_data, variables) => {
      await invalidateAdminCategoryQueries(queryClient, variables.parentId);
    },
  });
}

export function useCreateAdminCategorySpec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, id: _id, ...body }: UpsertAdminCategorySpecInput) => {
      const { data, error } = await api.api.admin.categories({ categoryId }).specs.post({
        ...body,
        displayNameTh: nullableText(body.displayNameTh),
        displayNameEn: nullableText(body.displayNameEn),
        unit: nullableText(body.unit),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.categoryId);
    },
  });
}

export function useUpdateAdminCategorySpec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, id, ...body }: UpsertAdminCategorySpecInput & { id: string }) => {
      const { data, error } = await api.api.admin.categories({ categoryId }).specs({ specId: id }).patch({
        ...body,
        displayNameTh: nullableText(body.displayNameTh),
        displayNameEn: nullableText(body.displayNameEn),
        unit: nullableText(body.unit),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.categoryId);
    },
  });
}

export function useSetAdminCategorySpecActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, id, isActive }: { categoryId: string; id: string; isActive: boolean }) => {
      const endpoint = isActive
        ? api.api.admin.categories({ categoryId }).specs({ specId: id }).reactivate
        : api.api.admin.categories({ categoryId }).specs({ specId: id }).deactivate;
      const { data, error } = await endpoint.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateAdminCategoryQueries(queryClient, data.categoryId);
    },
  });
}

export function useReorderAdminCategorySpecs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, specs }: ReorderAdminCategorySpecsInput) => {
      const { data, error } = await api.api.admin.categories({ categoryId }).specs.reorder.put({ specs });
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: async (_data, variables) => {
      await invalidateAdminCategoryQueries(queryClient, variables.categoryId);
    },
  });
}

export function useUpdateAdminCatalogProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateProductInput) => {
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).patch(body);
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: data.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useCreateAdminCatalogVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, inventory: _inventory, ...body }: CreateVariantInput) => {
      const { data, error } = await api.api.admin.catalog.products({ productId }).variants.post(body);
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

export function useUpdateAdminCatalogVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, variantId, ...body }: UpdateVariantInput) => {
      const { data, error } = await api.api.admin.catalog.products({ productId }).variants({ variantId }).patch(body);
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

export function useDeleteAdminCatalogVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const { data, error } = await api.api.admin.catalog.products({ productId }).variants({ variantId }).delete();
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

export function useCatalogProductDetail(id: string | null) {
  return useQuery({
    queryKey: ["catalog-product", id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Product id is required");
      const { data, error } = await api.api.catalog.products({ productId: id }).get();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCatalogProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateProductInput) => {
      const { data, error } = await api.api.seller.products.post(body);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidatePublicProductQueries(queryClient);
    },
  });
}

export function useUpdateCatalogProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateProductInput) => {
      const { data, error } = await api.api.seller.products({ productId: id }).patch(body);
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: data.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useCreateCatalogVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, ...body }: CreateVariantInput) => {
      const { inventory: _inventory, ...variantBody } = body;
      const { data, error } = await api.api.seller.products({ productId }).variants.post(variantBody);
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

export function useUpdateCatalogInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_body: UpdateInventoryInput) => {
      throw new Error("Inventory management is not implemented in Catalog task");
    },
    onSuccess: async () => {
      await invalidatePublicProductQueries(queryClient);
    },
  });
}
