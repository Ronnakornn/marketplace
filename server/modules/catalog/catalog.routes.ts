import { Elysia, t } from 'elysia'
import { ProductPlainInputCreate, ProductPlainInputUpdate } from '#generated/prismabox/Product.ts'
import { ProductVariantPlainInputCreate, ProductVariantPlainInputUpdate } from '#generated/prismabox/ProductVariant.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/lib/auth-plugin.ts'
import { CatalogServiceError } from './catalog.errors.ts'

const ProductStatusSchema = t.Union([t.Literal('DRAFT'), t.Literal('ACTIVE'), t.Literal('ARCHIVED')])

const IdParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
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

const PublicListQuerySchema = t.Object({
  keyword: t.Optional(t.String({ minLength: 1 })),
  q: t.Optional(t.String({ minLength: 1 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  minPrice: t.Optional(t.Number({ minimum: 0 })),
  maxPrice: t.Optional(t.Number({ minimum: 0 })),
  minPriceCents: t.Optional(t.Number({ minimum: 0 })),
  maxPriceCents: t.Optional(t.Number({ minimum: 0 })),
  cursor: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  categoryId: t.Optional(t.String()),
})

const SellerListQuerySchema = t.Composite([
  PublicListQuerySchema,
  t.Object({
    status: t.Optional(ProductStatusSchema),
  }),
])

const CreateProductBodySchema = t.Composite([
  t.Pick(ProductPlainInputCreate, ['title', 'description', 'status']),
  t.Object({
    shopId: t.Optional(t.String({ format: 'uuid' })),
    slug: t.Optional(t.String({ minLength: 1 })),
  }),
])

const UpdateProductBodySchema = t.Partial(t.Pick(ProductPlainInputUpdate, ['title', 'slug', 'description', 'status']))

const CreateVariantBodySchema = t.Pick(ProductVariantPlainInputCreate, ['sku', 'title', 'priceCents', 'currency'])

const UpdateVariantBodySchema = t.Partial(t.Pick(ProductVariantPlainInputUpdate, ['sku', 'title', 'priceCents', 'currency']))

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
      shopId: query.shopId,
      minPriceCents: query.minPriceCents ?? query.minPrice,
      maxPriceCents: query.maxPriceCents ?? query.maxPrice,
      cursor: query.cursor,
      limit: query.limit,
    })

  const getPublicProductDetail = ({ params }: any) =>
    container.catalogService.getPublicProductDetail(params.id)

  return app
    .get('/api/products', listPublicProducts, {
      query: PublicListQuerySchema,
    })
    .get('/api/products/:id', getPublicProductDetail, {
      params: IdParamsSchema,
    })
    .get('/api/shops/:shopId/products', ({ params, query }) =>
      container.catalogService.listPublicShopProducts(params.shopId, {
        keyword: query.keyword ?? query.q,
        minPriceCents: query.minPriceCents ?? query.minPrice,
        maxPriceCents: query.maxPriceCents ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      params: ShopProductsParamsSchema,
      query: PublicListQuerySchema,
    })
    .get('/api/catalog/products', listPublicProducts, {
      query: PublicListQuerySchema,
    })
    .get('/api/catalog/products/:id', getPublicProductDetail, {
      params: IdParamsSchema,
    })
    .get('/api/seller/products', ({ authContext, query }: any) =>
      container.catalogService.listSellerProducts(authContext.user, {
        keyword: query.keyword ?? query.q,
        shopId: query.shopId,
        status: query.status,
        minPriceCents: query.minPriceCents ?? query.minPrice,
        maxPriceCents: query.maxPriceCents ?? query.maxPrice,
        cursor: query.cursor,
        limit: query.limit,
      }), {
      withRole: 'SELLER',
      query: SellerListQuerySchema,
    })
    .post('/api/seller/products', ({ authContext, body }: any) =>
      container.catalogService.createProduct(authContext.user, body), {
      withRole: 'SELLER',
      body: CreateProductBodySchema,
    })
    .patch('/api/seller/products/:productId', ({ authContext, params, body }: any) =>
      container.catalogService.updateProduct(authContext.user, params.productId, body), {
      withRole: 'SELLER',
      params: ProductParamsSchema,
      body: UpdateProductBodySchema,
    })
    .delete('/api/seller/products/:productId', ({ authContext, params }: any) =>
      container.catalogService.archiveProduct(authContext.user, params.productId), {
      withRole: 'SELLER',
      params: ProductParamsSchema,
    })
    .post('/api/seller/products/:productId/variants', ({ authContext, params, body }: any) =>
      container.catalogService.createVariant(authContext.user, params.productId, body), {
      withRole: 'SELLER',
      params: ProductParamsSchema,
      body: CreateVariantBodySchema,
    })
    .patch('/api/seller/products/:productId/variants/:variantId', ({ authContext, params, body }: any) =>
      container.catalogService.updateVariant(authContext.user, params.productId, params.variantId, body), {
      withRole: 'SELLER',
      params: ProductVariantParamsSchema,
      body: UpdateVariantBodySchema,
    })
    .delete('/api/seller/products/:productId/variants/:variantId', ({ authContext, params }: any) =>
      container.catalogService.deleteVariant(authContext.user, params.productId, params.variantId), {
      withRole: 'SELLER',
      params: ProductVariantParamsSchema,
    })
}
