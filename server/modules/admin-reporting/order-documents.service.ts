import { z } from 'zod'
import type { PrismaClient } from '#generated/client/client.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { ReportingError } from './reporting.errors.ts'

const amount = z.string().regex(/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/)
const documentSnapshot = z.object({
  orderNumber: z.string(),
  purchasedAt: z.string(),
  currency: z.string(),
  paymentStatus: z.string(),
  shipping: z.object({
    name: z.string(),
    phone: z.string().nullable(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    region: z.string().nullable(),
    postalCode: z.string(),
    country: z.string(),
  }),
  totals: z.object({
    subtotal: amount,
    discount: amount,
    shipping: amount,
    addedTax: amount,
    includedTax: amount,
    reportedTax: amount,
    total: amount,
  }),
  items: z.array(
    z.object({
      shop: z.string(),
      product: z.string(),
      variant: z.string(),
      sku: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: amount,
      lineTotal: amount,
    }),
  ),
})
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  )
export function displayDocumentMoney(value: string): string {
  const integer = BigInt(value),
    sign = integer < 0n ? '-' : '',
    positive = integer < 0n ? -integer : integer
  return `${sign}${(positive / 100n).toString()}.${(positive % 100n).toString().padStart(2, '0')}`
}
export function renderOrderDocument(document: {
  number: string
  kind: string
  locale: string
  issuedAt: Date
  snapshot: unknown
}): string {
  const snapshot = documentSnapshot.parse(document.snapshot)
  const thai = document.locale === 'th',
    title =
      document.kind === 'RECEIPT'
        ? thai
          ? 'ใบเสร็จการซื้อสินค้า'
          : 'Purchase receipt'
        : thai
          ? 'ใบแจ้งรายการซื้อสินค้า'
          : 'Purchase invoice'
  const labels = thai
    ? {
        order: 'คำสั่งซื้อ',
        issued: 'วันที่ออกเอกสาร',
        buyer: 'ข้อมูลจัดส่ง ณ วันที่ซื้อ',
        item: 'รายการ',
        qty: 'จำนวน',
        unit: 'ราคาต่อหน่วย',
        total: 'ยอดรวม',
        subtotal: 'ค่าสินค้า',
        discount: 'ส่วนลด',
        shipping: 'ค่าจัดส่ง',
        tax: 'ภาษีเพิ่ม',
        included: 'ภาษีรวมในราคา',
        note: 'เอกสารสรุปรายการซื้อสินค้า ไม่ใช่ใบกำกับภาษีตามกฎหมาย รายการและที่อยู่เป็นข้อมูล ณ วันที่ซื้อ',
      }
    : {
        order: 'Order',
        issued: 'Issued',
        buyer: 'Shipping details at purchase',
        item: 'Item',
        qty: 'Quantity',
        unit: 'Unit price',
        total: 'Total',
        subtotal: 'Merchandise',
        discount: 'Discount',
        shipping: 'Shipping',
        tax: 'Added tax',
        included: 'Included tax',
        note: 'This purchase document is not a legal tax invoice. Items and address reflect the original purchase.',
      }
  const money = (value: string) =>
    `${escape(snapshot.currency)} ${displayDocumentMoney(value)}`
  return `<!doctype html><html lang="${thai ? 'th' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} ${escape(document.number)}</title><style>body{font:15px system-ui,sans-serif;margin:40px;color:#172033}h1{font-size:26px}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ccd2da;text-align:left}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:340px}.note{font-size:12px;color:#465266}@media print{body{margin:15mm}}</style></head><body><h1>${escape(title)}</h1><p>${escape(document.number)}<br>${labels.order}: ${escape(snapshot.orderNumber)}<br>${labels.issued}: ${escape(document.issuedAt.toISOString())}</p><h2>${labels.buyer}</h2><p>${[
    snapshot.shipping.name,
    snapshot.shipping.line1,
    snapshot.shipping.line2,
    snapshot.shipping.city,
    snapshot.shipping.region,
    snapshot.shipping.postalCode,
    snapshot.shipping.country,
  ]
    .filter(Boolean)
    .map((value) => escape(value!))
    .join(
      '<br>',
    )}</p><table><thead><tr><th>${labels.item}</th><th>${labels.qty}</th><th>${labels.unit}</th><th>${labels.total}</th></tr></thead><tbody>${snapshot.items.map((item) => `<tr><td>${escape(item.product)}<br>${escape(item.variant)} · ${escape(item.sku)}<br>${escape(item.shop)}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`).join('')}</tbody></table><table class="totals"><tbody>${[
    [labels.subtotal, snapshot.totals.subtotal],
    [labels.discount, snapshot.totals.discount],
    [labels.shipping, snapshot.totals.shipping],
    [labels.tax, snapshot.totals.addedTax],
    [labels.included, snapshot.totals.includedTax],
    [labels.total, snapshot.totals.total],
  ]
    .map(
      ([label, value]) => `<tr><th>${label}</th><td>${money(value!)}</td></tr>`,
    )
    .join('')}</tbody></table><p class="note">${labels.note}</p></body></html>`
}

export class OrderDocumentsService {
  constructor(
    private prisma: PrismaClient,
    private authorizer: AdminAuthorizer,
  ) {}
  async download(
    actor: AdminActor,
    orderId: string,
    kind: 'INVOICE' | 'RECEIPT',
    locale: 'en' | 'th',
    ownerOnly = false,
  ) {
    if (!ownerOnly) await this.authorizer.require(actor, 'orders.read')
    const document = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { id: 'asc' } },
          payments: {
            where: { status: { in: ['SUCCEEDED', 'REFUNDED'] } },
            select: { amount: true, currency: true },
          },
        },
      })
      if (!order || (ownerOnly && order.userId !== actor.id))
        throw new ReportingError('Order not found', 404, 'ORDER_NOT_FOUND')
      if (
        kind === 'RECEIPT' &&
        (!['SUCCEEDED', 'REFUNDED'].includes(order.paymentStatus) ||
          !order.payments.some(
            (payment) =>
              payment.amount === order.grandTotal &&
              payment.currency === order.currency,
          ))
      )
        throw new ReportingError(
          'A receipt requires trusted successful payment matching the purchase amount and currency',
          409,
          'ORDER_NOT_PAID',
        )
      const existing = await tx.orderDocument.findUnique({
        where: { orderId_kind_locale: { orderId, kind, locale } },
      })
      if (existing) return existing
      const snapshot = {
        orderNumber: order.orderNumber,
        purchasedAt: order.createdAt.toISOString(),
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        shipping: {
          name: order.shippingName,
          phone: order.shippingPhone,
          line1: order.shippingLine1,
          line2: order.shippingLine2,
          city: order.shippingCity,
          region: order.shippingRegion,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
        },
        totals: {
          subtotal: order.subtotal.toString(),
          discount: order.discountTotal.toString(),
          shipping: order.shippingTotal.toString(),
          addedTax: order.taxTotal.toString(),
          includedTax: order.includedTaxTotal.toString(),
          reportedTax: order.reportedTaxTotal.toString(),
          total: order.grandTotal.toString(),
        },
        items: order.items.map((item) => ({
          shop: item.shopName,
          product: item.productTitle,
          variant: item.variantTitle,
          sku: item.variantSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
        })),
      }
      const created = await tx.orderDocument.create({
        data: {
          orderId,
          kind,
          locale,
          number: `${kind === 'RECEIPT' ? 'RCP' : 'PUR'}-${order.orderNumber}-${locale}`,
          createdById: actor.id,
          snapshot,
        },
      })
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          action: 'ADMIN_CONFIG_CHANGED',
          entityType: 'OrderDocument',
          entityId: created.id,
          after: { number: created.number, orderId, kind, locale },
        },
      })
      return created
    })
    return { html: renderOrderDocument(document), number: document.number }
  }
}
