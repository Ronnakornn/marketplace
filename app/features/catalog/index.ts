"use client";

export { AdminCatalogManager } from "./components/AdminCatalogManager";
export {
  useCatalogProducts,
  useCatalogProductDetail,
  useCreateCatalogProduct,
  useCreateCatalogVariant,
  useUpdateCatalogInventory,
  useUpdateCatalogProduct,
} from "./hooks/useCatalog";
export type { CatalogProduct, CatalogVariant } from "./hooks/useCatalog";
