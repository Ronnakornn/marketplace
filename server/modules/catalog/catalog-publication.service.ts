import type { Prisma } from '#generated/client/client.ts'

export async function touchProductContent(
  tx: Prisma.TransactionClient,
  productId: string,
  publicationApprovalRequired?: () => Promise<boolean>,
) {
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { status: true, updatedAt: true },
  })
  const requiresReview =
    product.status === 'ACTIVE' && (await publicationApprovalRequired?.())
  const updatedAt = new Date(
    Math.max(Date.now(), product.updatedAt.getTime() + 1),
  )
  await tx.product.update({
    where: { id: productId },
    data: {
      updatedAt,
      ...(requiresReview ? { status: 'PENDING_REVIEW' } : {}),
    },
  })
  return updatedAt
}
