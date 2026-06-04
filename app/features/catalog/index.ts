"use client";

export { AdminCatalogManager } from "./components/AdminCatalogManager";
export { AdminCatalogEditPage } from "./components/AdminCatalogEditPage";
export { AdminCategorySpecsManager } from "./components/AdminCategorySpecsManager";
export {
  useAdminCatalogProductDetail,
  useAdminCatalogProducts,
  useAdminCategories,
  useAdminCategorySpecs,
  useCreateAdminCategory,
  useCreateAdminCategorySpec,
  useCreateAdminCatalogVariant,
  useCatalogProducts,
  useCatalogProductDetail,
  useCreateCatalogProduct,
  useCreateCatalogVariant,
  useDeleteAdminCatalogVariant,
  useReorderAdminCategories,
  useReorderAdminCategorySpecs,
  useSetAdminCategoryActive,
  useSetAdminCategorySpecActive,
  useUpdateAdminCategory,
  useUpdateAdminCategorySpec,
  useUpdateAdminCatalogProduct,
  useUpdateAdminCatalogVariant,
  useUpdateCatalogInventory,
  useUpdateCatalogProduct,
} from "./hooks/useCatalog";
export type { AdminCategory, AdminCategorySpec, CatalogProduct, CatalogVariant, CategorySpecType } from "./hooks/useCatalog";
