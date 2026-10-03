import { Elysia } from 'elysia'
import { describe, expect, it, vi } from 'vitest'
import { createRefundRoutes } from './refund.routes.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

const id = '88888888-8888-4888-8888-888888888888'
function setup(processingById = 'admin-2') {
  const user = { id: 'admin-1', role: 'ADMIN', status: 'ACTIVE', emailVerified: true }
  vi.mocked(getAuthContext).mockResolvedValue({ user } as any)
  const refund = { id, orderId: 'order-1', order: { shopOrders: [] }, status: 'PROCESSING', processingById }
  const repository = { findRefundById: vi.fn(async () => refund), updateRefundStatus: vi.fn() }
  const refundRepository = { completeRefundSuccess: vi.fn(async () => ({ ...refund, status: 'SUCCESS' })) }
  const adminService = new AdminService({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, repository as any, undefined, refundRepository as any)
  const refundService = { getAdminRefund: vi.fn(async () => ({ id, status: 'success' })) }
  const app = new Elysia().use(createRefundRoutes({ adminService, refundService } as any))
  const request = (body: unknown) => app.handle(new Request(`http://localhost/api/admin/refunds/${id}/process`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))
  return { request, refundRepository }
}

describe('legacy refund process endpoint', () => {
  it('rejects success without an external reference', async () => {
    const { request, refundRepository } = setup()
    expect((await request({ status: 'success' })).status).toBe(400)
    expect(refundRepository.completeRefundSuccess).not.toHaveBeenCalled()
  })

  it('rejects completion by the processing administrator', async () => {
    const { request, refundRepository } = setup('admin-1')
    expect((await request({ status: 'success', externalReference: 'REF-1' })).status).toBe(409)
    expect(refundRepository.completeRefundSuccess).not.toHaveBeenCalled()
  })

  it('uses the shared completion path and preserves the lowercase response', async () => {
    const { request, refundRepository } = setup()
    const response = await request({ status: 'success', externalReference: 'REF-1' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'success' })
    expect(refundRepository.completeRefundSuccess).toHaveBeenCalledWith(id, 'PROCESSING', expect.objectContaining({ completedById: 'admin-1', externalReference: 'REF-1' }))
  })
})
