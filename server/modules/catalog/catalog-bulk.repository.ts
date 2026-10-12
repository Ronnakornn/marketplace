import { touchProductContent } from './catalog-publication.service.ts'
import type { Prisma } from '#generated/client/client.ts'

// The importer passes its transaction to the catalog owner so catalog and stock
// changes share the import's atomic commit.
export class CatalogBulkRepository {
  constructor(private publicationApprovalRequired?: () => Promise<boolean>) {}
  async updatePrice(
    tx: Prisma.TransactionClient,
    variantId: string,
    price: bigint,
  ) {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { productId: true },
    })
    await touchProductContent(
      tx,
      variant.productId,
      this.publicationApprovalRequired,
    )
    return tx.productVariant.update({
      where: { id: variantId },
      data: { price },
    })
  }
  async updateContent(
    tx: Prisma.TransactionClient,
    productId: string,
    data: {
      title: string
      description: string | null
      categoryId: string | null
    },
  ) {
    const updatedAt = await touchProductContent(
      tx,
      productId,
      this.publicationApprovalRequired,
    )
    return tx.product.update({
      where: { id: productId },
      data: { ...data, updatedAt },
    })
  }
  archive(tx: Prisma.TransactionClient, productId: string) {
    return tx.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    })
  }
  async createDraft(
    tx: Prisma.TransactionClient,
    data: {
      shopId: string
      title: string
      slug: string
      description: string | null
      categoryId: string | null
      sku: string
      variantTitle: string
      price: bigint
      currency: string
    },
  ) {
    const { sku, variantTitle, price, currency, ...product } = data
    return tx.product.create({
      data: {
        ...product,
        status: 'DRAFT',
        variants: { create: { sku, title: variantTitle, price, currency } },
      },
      include: { variants: true },
    })
  }
}
