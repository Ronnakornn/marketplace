"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

type CatalogProductsResponse = Treaty.Data<ReturnType<typeof api.api.catalog.products.get>>;
export type CatalogProduct = CatalogProductsResponse extends { data: (infer T)[] } ? T : never;
export type CatalogVariant = CatalogProduct["variants"][number];

export interface CreateProductInput {
  shopId: string;
  title: string;
  titleTh?: string | null;
  titleEn?: string | null;
  slug?: string;
  description?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
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
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
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
    queryKey: ["admin-catalog-products"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.catalog.products.get({
        query: { limit: 50 },
      });
      if (error) throw error;
      return data?.data ?? [];
    },
  });
}

export function useAdminCatalogProductDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin-catalog-product", id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Product id is required");
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).get();
      if (error) throw error;
      return data;
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
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", data.id] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-product", data.id] });
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
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", variables.productId] });
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
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", variables.productId] });
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
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", variables.productId] });
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
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
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
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-product", data.id] });
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
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-product", variables.productId] });
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
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
    },
  });
}
