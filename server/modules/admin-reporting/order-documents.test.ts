import { describe, it, expect } from 'vitest'
import {
  displayDocumentMoney,
  renderOrderDocument,
} from './order-documents.service.ts'
const snapshot = {
  orderNumber: 'ORD-1',
  purchasedAt: '2026-10-01T00:00:00Z',
  currency: 'THB',
  paymentStatus: 'SUCCEEDED',
  shipping: {
    name: '<script>buyer</script>',
    phone: null,
    line1: 'Frozen address',
    line2: null,
    city: 'Bangkok',
    region: null,
    postalCode: '10100',
    country: 'TH',
  },
  totals: {
    subtotal: '9007199254740993123',
    discount: '0',
    shipping: '123',
    addedTax: '0',
    includedTax: '0',
    reportedTax: '0',
    total: '9007199254740993246',
  },
  items: [
    {
      shop: 'Original shop',
      product: 'Original product',
      variant: 'Original variant',
      sku: 'SKU',
      quantity: 1,
      unitPrice: '9007199254740993123',
      lineTotal: '9007199254740993123',
    },
  ],
}
describe('frozen purchase documents', () => {
  it('renders the saved facts, escapes markup and preserves large totals', () => {
    const html = renderOrderDocument({
      number: 'PUR-1',
      kind: 'INVOICE',
      locale: 'en',
      issuedAt: new Date('2026-10-02'),
      snapshot,
    })
    expect(html).toContain('Original product')
    expect(html).toContain('Frozen address')
    expect(html).toContain('&lt;script&gt;buyer&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('90071992547409932.46')
    expect(html).toContain('not a legal tax invoice')
  })
  it('formats signed exact minor units without floating point', () => {
    expect(displayDocumentMoney('-9007199254740993123')).toBe(
      '-90071992547409931.23',
    )
    expect(displayDocumentMoney('1')).toBe('0.01')
  })
})
