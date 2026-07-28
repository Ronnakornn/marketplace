import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBuyerMockPaymentEvent, fetchBuyerMockPayment } from './api.ts'

const edenMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('#/lib/eden', () => ({
  api: {
    api: {
      payments: {
        mock: () => ({
          get: edenMocks.get,
          events: { post: edenMocks.post },
        }),
      },
    },
  },
}))

const paymentDetail = {
  id: 'cac7b7ba-e151-4214-86a9-6cf2f4b4977a',
  orderId: 'ef1daae1-2db9-4326-8f0c-04e84d0c2ede',
  orderNo: 'ORD-MS4JJDWD-414B368D',
  amountCents: 850,
  currency: 'THB',
  status: 'PENDING',
} as const

describe('payment API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the direct Eden data shape from the payment detail route', async () => {
    edenMocks.get.mockResolvedValue({ data: paymentDetail, error: null })

    await expect(fetchBuyerMockPayment(paymentDetail.id)).resolves.toEqual(paymentDetail)
  })

  it('normalizes a structured Eden Error value into a useful message', async () => {
    const error = Object.assign(new Error('[object Object]'), {
      value: {
        error: {
          code: 'INVALID_WEBHOOK_EVENT',
          message: 'Only mock payments are available here',
          details: {},
        },
      },
    })
    edenMocks.get.mockResolvedValue({ data: null, error })

    await expect(fetchBuyerMockPayment(paymentDetail.id)).rejects.toThrow('Only mock payments are available here')
  })

  it('uses a stable fallback instead of rendering object strings', async () => {
    edenMocks.post.mockResolvedValue({ data: null, error: { value: { error: {} } } })

    await expect(createBuyerMockPaymentEvent(paymentDetail.id, 'payment.failed')).rejects.toThrow(
      'Payment request failed',
    )
  })
})
