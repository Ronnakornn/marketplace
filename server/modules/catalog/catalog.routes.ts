import { Elysia, t } from 'elysia'
import { ProductPlainInputCreate, ProductPlainInputUpdate } from '#generated/prismabox/Product.ts'
import { ProductVariantPlainInputCreate, ProductVariantPlainInputUpdate } from '#generated/prismabox/ProductVariant.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/lib/auth-plugin.ts'
import { CatalogServiceError } from './catalog.errors.ts'

const ProductStatusSchema = t.Union([t.Literal('DRAFT'), t.Literal('ACTIVE'), t.Literal('ARCHIVED')])

const CategoryResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
  nameTh: t.Optional(t.Nullable(t.String())),
  nameEn: t.Optional(t.Nullable(t.String())),
  slug: t.String(),
  sortOrder: t.Number(),
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
])

const UpdateVariantBodySchema = t.Partial(t.Composite([
  t.Pick(ProductVariantPlainInputUpdate, ['sku', 'title', 'price', 'currency']),
  LocalizedVariantFieldsSchema,
  VariantShippingFieldsSchema,
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

  return app
    .get('/api/categories', ({ query }: any) => container.catalogService.listCategories(query.locale), {
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
      response: t.Array(CategoryResponseSchema),
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
