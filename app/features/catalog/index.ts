"use client";

export { AdminCatalogManager } from "./components/AdminCatalogManager";
export { AdminCatalogEditPage } from "./components/AdminCatalogEditPage";
export {
  useAdminCatalogProductDetail,
  useAdminCatalogProducts,
  useCreateAdminCatalogVariant,
  useCatalogProducts,
  useCatalogProductDetail,
  useCreateCatalogProduct,
  useCreateCatalogVariant,
  useDeleteAdminCatalogVariant,
  useUpdateAdminCatalogProduct,
  useUpdateAdminCatalogVariant,
  useUpdateCatalogInventory,
  useUpdateCatalogProduct,
} from "./hooks/useCatalog";
export type { CatalogProduct, CatalogVariant } from "./hooks/useCatalog";
