import { Elysia, t } from 'elysia'
import { CategoryAttributeDefinitionPlainInputCreate, CategoryAttributeDefinitionPlainInputUpdate } from '#generated/prismabox/CategoryAttributeDefinition.ts'
import { ProductPlainInputCreate, ProductPlainInputUpdate } from '#generated/prismabox/Product.ts'
import { ProductVariantPlainInputCreate, ProductVariantPlainInputUpdate } from '#generated/prismabox/ProductVariant.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/lib/auth-plugin.ts'
import { CatalogServiceError } from './catalog.errors.ts'

const ProductStatusSchema = t.Union([
  t.Literal('DRAFT'),
  t.Literal('PENDING_REVIEW'),
  t.Literal('ACTIVE'),
  t.Literal('REJECTED'),
  t.Literal('SUSPENDED'),
  t.Literal('ARCHIVED'),
])

const CategoryResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
  nameTh: t.Optional(t.Nullable(t.String())),
  nameEn: t.Optional(t.Nullable(t.String())),
  slug: t.String(),
  sortOrder: t.Number(),
})

const AdminCategoryResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  parentId: t.Nullable(t.String({ format: 'uuid' })),
  name: t.String(),
  nameTh: t.Nullable(t.String()),
  nameEn: t.Nullable(t.String()),
  slug: t.String(),
  sortOrder: t.Number(),
  isActive: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

const CategorySpecTypeSchema = t.Union([
  t.Literal('TEXT'),
  t.Literal('NUMBER'),
  t.Literal('BOOLEAN'),
  t.Literal('SELECT'),
  t.Literal('MULTI_SELECT'),
])

const CategorySpecResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  categoryId: t.String({ format: 'uuid' }),
  attributeKey: t.String(),
  displayName: t.String(),
  displayNameTh: t.Nullable(t.String()),
  displayNameEn: t.Nullable(t.String()),
  valueType: CategorySpecTypeSchema,
  isRequired: t.Boolean(),
  isFilterable: t.Boolean(),
  unit: t.Nullable(t.String()),
  allowedValues: t.Nullable(t.Any()),
  sortOrder: t.Number(),
  isActive: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

const BrandResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
  slug: t.String(),
  code: t.Nullable(t.String()),
  isActive: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

const IdParamsSchema = t.Object({
  productId: t.String({ minLength: 1 }),
})

const ShopProductsParamsSchema = t.Object({
  shopId: t.String({ format: 'uuid' }),
})

const ProductParamsSchema = t.Object({
  productId: t.String({ format: 'uuid' }),
})

const CategoryParamsSchema = t.Object({
  categoryId: t.String({ format: 'uuid' }),
})

const CategorySpecParamsSchema = t.Object({
  categoryId: t.String({ format: 'uuid' }),
  specId: t.String({ format: 'uuid' }),
})

const ProductVariantParamsSchema = t.Object({
  productId: t.String({ format: 'uuid' }),
  variantId: t.String({ format: 'uuid' }),
})

const ProductImageParamsSchema = t.Object({
  productId: t.String({ format: 'uuid' }),
  imageId: t.String({ format: 'uuid' }),
})

const PublicListQuerySchema = t.Object({
  keyword: t.Optional(t.String({ minLength: 1 })),
  q: t.Optional(t.String({ minLength: 1 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  brandId: t.Optional(t.String({ format: 'uuid' })),
  attributeFilters: t.Optional(t.String()),
  minPrice: t.Optional(t.Number({ minimum: 0 })),
  maxPrice: t.Optional(t.Number({ minimum: 0 })),
  cursor: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  categoryId: t.Optional(t.String()),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

const RelatedProductsQuerySchema = t.Object({
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 12 })),
})

const SellerListQuerySchema = t.Composite([
  PublicListQuerySchema,
  t.Object({
    status: t.Optional(ProductStatusSchema),
  }),
])

const LocalizedProductFieldsSchema = t.Object({
  titleTh: t.Optional(t.Nullable(t.String())),
  titleEn: t.Optional(t.Nullable(t.String())),
  descriptionTh: t.Optional(t.Nullable(t.String())),
  descriptionEn: t.Optional(t.Nullable(t.String())),
})

const ProductHighlightBodySchema = t.Object({
  text: t.String({ minLength: 1 }),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
})

const ProductAttributeBodySchema = t.Object({
  attributeKey: t.Optional(t.String({ minLength: 1 })),
  displayName: t.String({ minLength: 1 }),
  displayNameTh: t.Optional(t.Nullable(t.String())),
  displayNameEn: t.Optional(t.Nullable(t.String())),
  value: t.String({ minLength: 1 }),
  valueTh: t.Optional(t.Nullable(t.String())),
  valueEn: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
  isFilterable: t.Optional(t.Boolean()),
})

const ProductEnrichmentFieldsSchema = t.Object({
  metaTitle: t.Optional(t.Nullable(t.String())),
  metaDescription: t.Optional(t.Nullable(t.String())),
  warrantyInfo: t.Optional(t.Nullable(t.String())),
  condition: t.Optional(t.Nullable(t.String())),
  countryOfOrigin: t.Optional(t.Nullable(t.String())),
  highlights: t.Optional(t.Array(ProductHighlightBodySchema)),
  attributes: t.Optional(t.Array(ProductAttributeBodySchema)),
})

const LocalizedVariantFieldsSchema = t.Object({
  titleTh: t.Optional(t.Nullable(t.String())),
  titleEn: t.Optional(t.Nullable(t.String())),
})

const CreateProductBodySchema = t.Composite([
  t.Pick(ProductPlainInputCreate, ['title', 'description', 'status']),
  LocalizedProductFieldsSchema,
  ProductEnrichmentFieldsSchema,
  t.Object({
    shopId: t.Optional(t.String({ format: 'uuid' })),
    categoryId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
    brandId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
    slug: t.Optional(t.String({ minLength: 1 })),
  }),
])

const UpdateProductBodySchema = t.Partial(t.Composite([
  t.Pick(ProductPlainInputUpdate, ['title', 'slug', 'description', 'status']),
  LocalizedProductFieldsSchema,
  ProductEnrichmentFieldsSchema,
  t.Object({
    categoryId: t.Nullable(t.String({ format: 'uuid' })),
    brandId: t.Nullable(t.String({ format: 'uuid' })),
  }),
]))

const CategoryBodySchema = t.Object({
  parentId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  name: t.String({ minLength: 1 }),
  nameTh: t.Optional(t.Nullable(t.String())),
  nameEn: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.String({ minLength: 1 })),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
  isActive: t.Optional(t.Boolean()),
})

const UpdateCategoryBodySchema = t.Partial(CategoryBodySchema)

const ReorderCategoriesBodySchema = t.Object({
  parentId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  categories: t.Array(t.Object({
    id: t.String({ format: 'uuid' }),
    sortOrder: t.Optional(t.Number({ minimum: 0 })),
  }), { minItems: 1 }),
})

const CategorySpecBodySchema = t.Composite([
  t.Omit(CategoryAttributeDefinitionPlainInputCreate, ['valueType', 'allowedValues']),
  t.Object({
    type: CategorySpecTypeSchema,
  }),
])

const UpdateCategorySpecBodySchema = t.Composite([
  t.Omit(CategoryAttributeDefinitionPlainInputUpdate, ['valueType', 'allowedValues']),
  t.Object({
    type: t.Optional(CategorySpecTypeSchema),
  }),
])

const ReorderCategorySpecsBodySchema = t.Object({
  specs: t.Array(t.Object({
    id: t.String({ format: 'uuid' }),
    sortOrder: t.Optional(t.Number({ minimum: 0 })),
  }), { minItems: 1 }),
})

const ProductImageBodySchema = t.Object({
  uploadId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  url: t.Optional(t.String({ minLength: 1 })),
  altText: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
  isPrimary: t.Optional(t.Boolean()),
  width: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  height: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
})

const UpdateProductImageBodySchema = t.Partial(ProductImageBodySchema)

const ProductVideoBodySchema = t.Object({
  uploadId: t.String({ format: 'uuid' }),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
})

const ProductOptionValueBodySchema = t.Object({
  value: t.String({ minLength: 1 }),
  valueTh: t.Optional(t.Nullable(t.String())),
  valueEn: t.Optional(t.Nullable(t.String())),
  displayType: t.Optional(t.String({ minLength: 1 })),
  colorHex: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
})

const ProductOptionBodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  nameTh: t.Optional(t.Nullable(t.String())),
  nameEn: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
  values: t.Array(ProductOptionValueBodySchema, { minItems: 1 }),
})

const ProductOptionsBodySchema = t.Object({
  options: t.Array(ProductOptionBodySchema),
})

const ProductImageOrderBodySchema = t.Object({
  images: t.Array(t.Object({
    id: t.String({ format: 'uuid' }),
    sortOrder: t.Optional(t.Number({ minimum: 0 })),
  }), { minItems: 1 }),
  primaryImageId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
})

const ModerationReasonBodySchema = t.Object({
  reason: t.String({ minLength: 1 }),
})

const VariantShippingFieldsSchema = t.Object({
  weightGrams: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  lengthMm: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  widthMm: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  heightMm: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
})

const CreateVariantBodySchema = t.Composite([
  t.Pick(ProductVariantPlainInputCreate, ['sku', 'title', 'price', 'currency']),
  LocalizedVariantFieldsSchema,
  VariantShippingFieldsSchema,
  t.Object({
    optionValueIds: t.Optional(t.Array(t.String({ format: 'uuid' }))),
  }),
])

const UpdateVariantBodySchema = t.Partial(t.Composite([
  t.Pick(ProductVariantPlainInputUpdate, ['sku', 'title', 'price', 'currency']),
  LocalizedVariantFieldsSchema,
  VariantShippingFieldsSchema,
  t.Object({
    optionValueIds: t.Optional(t.Array(t.String({ format: 'uuid' }))),
  }),
]))

export function createCatalogRoutes(container: ServiceContainer) {
  const app = new Elysia()
    .use(authPlugin)
    .onError(({ error, status }) => {
      if (error instanceof CatalogServiceError) {
        return status(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })

  const listPublicProducts = ({ query }: any) =>
    container.catalogService.listPublicProducts({
      keyword: query.keyword ?? query.q,
      categoryId: query.categoryId,
      brandId: query.brandId,
      attributes: parseAttributeFilters(query.attributeFilters),
      locale: query.locale,
      shopId: query.shopId,
      minPrice: query.minPrice ?? query.minPrice,
      maxPrice: query.maxPrice ?? query.maxPrice,
      cursor: query.cursor,
      limit: query.limit,
    })

  const getPublicProductDetail = ({ params, query }: any) =>
    container.catalogService.getPublicProductDetail(params.productId, query.locale)

  const listRelatedProducts = ({ params, query }: any) =>
    container.catalogService.listRelatedProducts(params.productId, {
      locale: query.locale,
      limit: query.limit,
    })

  return app
    .get('/api/categories', ({ query }: any) => container.catalogService.listCategories(query.locale), {
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
      response: t.Array(CategoryResponseSchema),
    })
    .get('/api/admin/categories', () => container.catalogService.listAdminCategories(), {
      withRole: 'ADMIN',
      response: t.Array(AdminCategoryResponseSchema),
    })
    .post('/api/admin/categories', ({ body }: any) =>
      container.catalogService.createAdminCategory(body), {
      withRole: 'ADMIN',
      body: CategoryBodySchema,
      response: AdminCategoryResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId', ({ params, body }: any) =>
      container.catalogService.updateAdminCategory(params.categoryId, body), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      body: UpdateCategoryBodySchema,
      response: AdminCategoryResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId/deactivate', ({ params }: any) =>
      container.catalogService.deactivateAdminCategory(params.categoryId), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      response: AdminCategoryResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId/reactivate', ({ params }: any) =>
      container.catalogService.reactivateAdminCategory(params.categoryId), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      response: AdminCategoryResponseSchema,
    })
    .put('/api/admin/categories/reorder', ({ body }: any) =>
      container.catalogService.reorderAdminCategories(body), {
      withRole: 'ADMIN',
      body: ReorderCategoriesBodySchema,
      response: t.Array(AdminCategoryResponseSchema),
    })
    .get('/api/categories/:categoryId/specs', ({ params }: any) =>
      container.catalogService.listCategorySpecs(params.categoryId), {
      params: CategoryParamsSchema,
      response: t.Array(CategorySpecResponseSchema),
    })
    .get('/api/admin/categories/:categoryId/specs', ({ params }: any) =>
      container.catalogService.listAdminCategorySpecs(params.categoryId), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      response: t.Array(CategorySpecResponseSchema),
    })
    .post('/api/admin/categories/:categoryId/specs', ({ params, body }: any) =>
      container.catalogService.createAdminCategorySpec(params.categoryId, body), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      body: CategorySpecBodySchema,
      response: CategorySpecResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId/specs/:specId', ({ params, body }: any) =>
      container.catalogService.updateAdminCategorySpec(params.categoryId, params.specId, body), {
      withRole: 'ADMIN',
      params: CategorySpecParamsSchema,
      body: UpdateCategorySpecBodySchema,
      response: CategorySpecResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId/specs/:specId/deactivate', ({ params }: any) =>
      container.catalogService.deactivateAdminCategorySpec(params.categoryId, params.specId), {
      withRole: 'ADMIN',
      params: CategorySpecParamsSchema,
      response: CategorySpecResponseSchema,
    })
    .patch('/api/admin/categories/:categoryId/specs/:specId/reactivate', ({ params }: any) =>
      container.catalogService.reactivateAdminCategorySpec(params.categoryId, params.specId), {
      withRole: 'ADMIN',
      params: CategorySpecParamsSchema,
      response: CategorySpecResponseSchema,
    })
    .put('/api/admin/categories/:categoryId/specs/reorder', ({ params, body }: any) =>
      container.catalogService.reorderAdminCategorySpecs(params.categoryId, body), {
      withRole: 'ADMIN',
      params: CategoryParamsSchema,
      body: ReorderCategorySpecsBodySchema,
      response: t.Array(CategorySpecResponseSchema),
    })
    .get('/api/brands', () => container.catalogService.listActiveBrands(), {
      response: t.Array(BrandResponseSchema),
    })
    .get('/api/seller/brands', () => container.catalogService.listActiveBrands(), {
      withAuth: true,
      response: t.Array(BrandResponseSchema),
    })
    .get('/api/products', listPublicProducts, {
      query: PublicListQuerySchema,
    })
    .get('/api/categories/:categoryId/products', ({ params, query }: any) =>
      container.catalogService.listPublicProducts({
        keyword: query.keyword ?? query.q,
        categoryId: params.categoryId,
        brandId: query.brandId,
        attributes: parseAttributeFilters(query.attributeFilters),
        locale: query.locale,
        shopId: query.shopId,
        minPrice: query.minPrice ?? query.minPrice,
        maxPrice: query.maxPrice ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      params: CategoryParamsSchema,
      query: PublicListQuerySchema,
    })
    .get('/api/products/:productId/related', listRelatedProducts, {
      params: IdParamsSchema,
      query: RelatedProductsQuerySchema,
    })
    .get('/api/products/:productId', getPublicProductDetail, {
      params: IdParamsSchema,
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .get('/api/shops/:shopId/products', ({ params, query }) =>
      container.catalogService.listPublicShopProducts(params.shopId, {
        keyword: query.keyword ?? query.q,
        categoryId: query.categoryId,
        brandId: query.brandId,
        attributes: parseAttributeFilters(query.attributeFilters),
        locale: query.locale,
        minPrice: query.minPrice ?? query.minPrice,
        maxPrice: query.maxPrice ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      params: ShopProductsParamsSchema,
      query: PublicListQuerySchema,
    })
    .get('/api/catalog/products', listPublicProducts, {
      query: PublicListQuerySchema,
    })
    .get('/api/catalog/products/:productId/related', listRelatedProducts, {
      params: IdParamsSchema,
      query: RelatedProductsQuerySchema,
    })
    .get('/api/catalog/products/:productId', getPublicProductDetail, {
      params: IdParamsSchema,
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .get('/api/seller/products', ({ authContext, query }: any) =>
      container.catalogService.listSellerProducts(authContext.user, {
        keyword: query.keyword ?? query.q,
        categoryId: query.categoryId,
        brandId: query.brandId,
        attributes: parseAttributeFilters(query.attributeFilters),
        shopId: query.shopId,
        status: query.status,
        minPrice: query.minPrice ?? query.minPrice,
        maxPrice: query.maxPrice ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      withAuth: true,
      query: SellerListQuerySchema,
    })
    .get('/api/seller/products/:productId', ({ authContext, params }: any) =>
      container.catalogService.getSellerProductDetail(authContext.user, params.productId), {
      withAuth: true,
      params: ProductParamsSchema,
    })
    .post('/api/seller/products/:productId/submit-review', ({ authContext, params }: any) =>
      container.catalogService.submitProductReview(authContext.user, params.productId), {
      withAuth: true,
      params: ProductParamsSchema,
    })
    .get('/api/admin/catalog/products', ({ query }: any) =>
      container.catalogService.listAdminProducts({
        keyword: query.keyword ?? query.q,
        categoryId: query.categoryId,
        brandId: query.brandId,
        attributes: parseAttributeFilters(query.attributeFilters),
        shopId: query.shopId,
        status: query.status,
        minPrice: query.minPrice ?? query.minPrice,
        maxPrice: query.maxPrice ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      withRole: 'ADMIN',
      query: SellerListQuerySchema,
    })
    .get('/api/admin/catalog/products/moderation', ({ query }: any) =>
      container.catalogService.listModerationProducts({
        keyword: query.keyword ?? query.q,
        categoryId: query.categoryId,
        brandId: query.brandId,
        attributes: parseAttributeFilters(query.attributeFilters),
        shopId: query.shopId,
        status: query.status,
        minPrice: query.minPrice ?? query.minPrice,
        maxPrice: query.maxPrice ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      withRole: 'ADMIN',
      query: SellerListQuerySchema,
    })
    .get('/api/admin/catalog/products/:productId', ({ params }: any) =>
      container.catalogService.getAdminProductDetail(params.productId), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
    })
    .patch('/api/admin/catalog/products/:productId', ({ params, body }: any) =>
      container.catalogService.updateAdminProduct(params.productId, body), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
      body: UpdateProductBodySchema,
    })
    .post('/api/admin/catalog/products/:productId/variants', ({ params, body }: any) =>
      container.catalogService.createAdminVariant(params.productId, body), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
      body: CreateVariantBodySchema,
    })
    .patch('/api/admin/catalog/products/:productId/variants/:variantId', ({ params, body }: any) =>
      container.catalogService.updateAdminVariant(params.productId, params.variantId, body), {
      withRole: 'ADMIN',
      params: ProductVariantParamsSchema,
      body: UpdateVariantBodySchema,
    })
    .delete('/api/admin/catalog/products/:productId/variants/:variantId', ({ params }: any) =>
      container.catalogService.deleteAdminVariant(params.productId, params.variantId), {
      withRole: 'ADMIN',
      params: ProductVariantParamsSchema,
    })
    .patch('/api/admin/catalog/products/:productId/approve', ({ authContext, params }: any) =>
      container.catalogService.approveProduct(authContext.user, params.productId), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
    })
    .patch('/api/admin/catalog/products/:productId/reject', ({ authContext, params, body }: any) =>
      container.catalogService.rejectProduct(authContext.user, params.productId, body), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
      body: ModerationReasonBodySchema,
    })
    .patch('/api/admin/catalog/products/:productId/suspend', ({ authContext, params, body }: any) =>
      container.catalogService.suspendProduct(authContext.user, params.productId, body), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
      body: ModerationReasonBodySchema,
    })
    .patch('/api/admin/catalog/products/:productId/restore', ({ authContext, params }: any) =>
      container.catalogService.restoreProduct(authContext.user, params.productId), {
      withRole: 'ADMIN',
      params: ProductParamsSchema,
    })
    .post('/api/seller/products', ({ authContext, body }: any) =>
      container.catalogService.createProduct(authContext.user, body), {
      withAuth: true,
      body: CreateProductBodySchema,
    })
    .patch('/api/seller/products/:productId', ({ authContext, params, body }: any) =>
      container.catalogService.updateProduct(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: UpdateProductBodySchema,
    })
    .delete('/api/seller/products/:productId', ({ authContext, params }: any) =>
      container.catalogService.archiveProduct(authContext.user, params.productId), {
      withAuth: true,
      params: ProductParamsSchema,
    })
    .post('/api/seller/products/:productId/images', ({ authContext, params, body }: any) =>
      container.catalogService.createProductImage(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: ProductImageBodySchema,
    })
    .patch('/api/seller/products/:productId/images/:imageId', ({ authContext, params, body }: any) =>
      container.catalogService.updateProductImage(authContext.user, params.productId, params.imageId, body), {
      withAuth: true,
      params: ProductImageParamsSchema,
      body: UpdateProductImageBodySchema,
    })
    .delete('/api/seller/products/:productId/images/:imageId', ({ authContext, params }: any) =>
      container.catalogService.deleteProductImage(authContext.user, params.productId, params.imageId), {
      withAuth: true,
      params: ProductImageParamsSchema,
    })
    .put('/api/seller/products/:productId/images/order', ({ authContext, params, body }: any) =>
      container.catalogService.updateProductImagesOrder(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: ProductImageOrderBodySchema,
    })
    .post('/api/seller/products/:productId/video', ({ authContext, params, body }: any) =>
      container.catalogService.upsertProductVideo(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: ProductVideoBodySchema,
    })
    .delete('/api/seller/products/:productId/video', ({ authContext, params }: any) =>
      container.catalogService.deleteProductVideo(authContext.user, params.productId), {
      withAuth: true,
      params: ProductParamsSchema,
    })
    .put('/api/seller/products/:productId/options', ({ authContext, params, body }: any) =>
      container.catalogService.updateProductOptions(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: ProductOptionsBodySchema,
    })
    .post('/api/seller/products/:productId/variants', ({ authContext, params, body }: any) =>
      container.catalogService.createVariant(authContext.user, params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: CreateVariantBodySchema,
    })
    .patch('/api/seller/products/:productId/variants/:variantId', ({ authContext, params, body }: any) =>
      container.catalogService.updateVariant(authContext.user, params.productId, params.variantId, body), {
      withAuth: true,
      params: ProductVariantParamsSchema,
      body: UpdateVariantBodySchema,
    })
    .delete('/api/seller/products/:productId/variants/:variantId', ({ authContext, params }: any) =>
      container.catalogService.deleteVariant(authContext.user, params.productId, params.variantId), {
      withAuth: true,
      params: ProductVariantParamsSchema,
    })
}

function parseAttributeFilters(input: string | undefined) {
  if (!input?.trim()) return undefined
  return input
    .split(',')
    .map((part) => {
      const [key, ...valueParts] = part.split(':')
      return { key: key?.trim() ?? '', value: valueParts.join(':').trim() }
    })
    .filter((pair) => pair.key && pair.value)
}
