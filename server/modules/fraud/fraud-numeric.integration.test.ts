import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Elysia } from 'elysia'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaFraudRepository } from './fraud.repository.ts'
import { getFraudRuleConfigFromEnv } from './fraud.rules.ts'
import { createFraudRoutes } from './fraud.routes.ts'
import { FraudService } from './fraud.service.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('fraud numeric thresholds on PostgreSQL', () => {
  let db: PrismaClient
  let service: FraudService
  beforeAll(() => {
    db = thresholdDatabase()
    service = new FraudService(thresholdContext, new PrismaFraudRepository(thresholdContext, db), getFraudRuleConfigFromEnv({}))
  })
  afterAll(async () => { await db?.$disconnect() })

  it.each([[60499, 15], [60500, 0]])('rounds actual checkout duration %sms to score%s', async (milliseconds, score) => {
    const f = await numericThresholdFixture(db)
    const sale = await thresholdSale(db, f, { checkoutCreatedAt: new Date('2026-10-04T00:00:00.000Z'), createdAt: new Date(milliseconds === 60499 ? '2026-10-04T00:01:00.499Z' : '2026-10-04T00:01:00.500Z') })
    const result = await service.evaluateOrderRisk(sale.order.id)
    expect(result).toMatchObject({ riskScore: score, riskLevel: 'low', case: null, reasons: score === 15 ? ['suspicious_rapid_checkout'] : [] })
    expect(await db.fraudCase.count({ where: { entityType: 'ORDER', entityId: sale.order.id } })).toBe(0)
  })

  it('persists capped runtime order score once and exposes the same numeric case through the admin route', async () => {
    const f = await numericThresholdFixture(db)
    for (let index = 0; index < 3; index += 1) await thresholdSale(db, f, { status: 'CANCELED', paymentStatus: 'FAILED', paymentState: 'FAILED' })
    const sale = await thresholdSale(db, f, { amount: 100000n, checkoutCreatedAt: new Date('2026-10-04T00:00:00.000Z'), createdAt: new Date('2026-10-04T00:01:00.000Z') })
    const evaluations = await Promise.all([service.evaluateOrderRisk(sale.order.id), service.evaluateOrderRisk(sale.order.id)])
    const reasons = ['many_failed_payments', 'abnormal_order_amount', 'suspicious_rapid_checkout', 'repeated_cancelled_orders']
    for (const result of evaluations) expect(result).toMatchObject({ riskScore: 100, riskLevel: 'critical', reasons, blocked: false, case: { riskScore: 100, riskLevel: 'critical', reasons } })
    const rows = await db.fraudCase.findMany({ where: { entityType: 'ORDER', entityId: sale.order.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ riskScore: 100, riskLevel: 'critical', reasons })
    const admin = await db.user.update({ where: { id: f.owner.id }, data: { role: 'ADMIN', emailVerified: true } })
    vi.mocked(getAuthContext).mockResolvedValue({ user: admin, session: { id: `test-session-${admin.id}` } })
    const app = new Elysia().use(createFraudRoutes({ fraudService: service } as unknown as ServiceContainer))
    const response = await app.handle(new Request(`http://localhost/api/admin/fraud/cases/${rows[0]!.id}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: rows[0]!.id, riskScore: 100, riskLevel: 'critical', reasons })
  })

  it('uses refund row count including pending/failed, with 3/6 equal and 3/7 below the threshold', async () => {
    const f = await numericThresholdFixture(db)
    const sales = []
    for (let index = 0; index < 6; index += 1) sales.push(await thresholdSale(db, f))
    const refunds = []
    for (const [index, status] of ['PENDING', 'FAILED', 'SUCCESS'].entries()) refunds.push(await db.refund.create({ data: { orderId: sales[index]!.order.id, paymentId: sales[index]!.payment.id, status: status as 'PENDING' | 'FAILED' | 'SUCCESS', amount: 1n } }))
    const target = refunds[0]!
    expect(await service.evaluateRefundRisk(target.id)).toMatchObject({ riskScore: 75, riskLevel: 'high', reasons: ['high_refund_rate'], case: { riskScore: 75 } })
    expect(await service.evaluateRefundRisk(target.id)).toMatchObject({ riskScore: 75, case: { riskScore: 75 } })
    expect(await db.fraudCase.count({ where: { entityType: 'REFUND', entityId: target.id } })).toBe(1)
    await thresholdSale(db, f)
    expect(await service.evaluateRefundRisk(target.id)).toMatchObject({ riskScore: 0, riskLevel: 'low', reasons: [], case: null })
    expect(await db.refund.count({ where: { order: { userId: f.buyer.id } } })).toBe(3)
    expect(await db.order.count({ where: { userId: f.buyer.id } })).toBe(7)
    expect(await db.fraudCase.findFirstOrThrow({ where: { entityType: 'REFUND', entityId: target.id } })).toMatchObject({ riskScore: 75, status: 'OPEN' })
  })
})
