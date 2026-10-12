import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { AdminAccessRepository } from '#server/modules/admin-access/admin-access.repository.ts'
import { AdminAccessService } from '#server/modules/admin-access/admin-access.service.ts'
import type { AdminActor } from '#server/modules/admin-access/admin-access.contract.ts'
import { PayoutService } from '#server/modules/payout/payout.service.ts'
import { PrismaPayoutRepository } from '#server/modules/payout/payout.repository.ts'
import { AdminOperationsService } from './operations.service.ts'
import { PrismaAdminOperationsRepository } from './operations.repository.ts'
import type { EvidenceInput } from './operations.schemas.ts'

const url = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL ?? process.env.COMMERCE_TEST_DATABASE_URL
const context = {
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe.skipIf(!url)('admin operations on PostgreSQL', () => {
  let db: PrismaClient
  let service: AdminOperationsService
  let payouts: PayoutService
  let admin: AdminActor
  let reviewer: AdminActor
  let sellerId: string
  let profileId: string
  let paymentId: string
  let reference: string
  beforeAll(async () => {
    const database = new URL(url!)
    if (
      !['127.0.0.1', 'localhost'].includes(database.hostname) ||
      !/(^|_)(test)(_|$)/.test(database.pathname)
    )
      throw new Error('Use a local disposable test database')
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    })
    const tag = randomUUID()
    reference = `payment-${tag}`
    const first = await db.user.create({
      data: {
        name: 'Admin operations',
        email: `admin-${tag}@example.test`,
        role: 'ADMIN',
        emailVerified: true,
        adminTeamMember: {
          create: { label: 'Owner', isOwner: true, isActive: true },
        },
      },
    })
    const second = await db.user.create({
      data: {
        name: 'Second reviewer',
        email: `reviewer-${tag}@example.test`,
        role: 'ADMIN',
        emailVerified: true,
        adminTeamMember: {
          create: { label: 'Owner', isOwner: true, isActive: true },
        },
      },
    })
    admin = { id: first.id, role: first.role }
    reviewer = { id: second.id, role: second.role }
    const seller = await db.user.create({
      data: {
        name: 'Seller',
        email: `seller-${tag}@example.test`,
        sellerProfile: { create: {} },
      },
      include: { sellerProfile: true },
    })
    sellerId = seller.id
    profileId = seller.sellerProfile!.id
    const cart = await db.cart.create({ data: { userId: sellerId } })
    const checkout = await db.checkout.create({
      data: {
        userId: sellerId,
        cartId: cart.id,
        expiresAt: new Date(Date.now() + 60000),
      },
    })
    const order = await db.order.create({
      data: {
        userId: sellerId,
        checkoutId: checkout.id,
        orderNumber: tag,
        grandTotal: 9007199254740993n,
        shippingName: 'Buyer',
        shippingLine1: '1 Road',
        shippingCity: 'Bangkok',
        shippingPostalCode: '10110',
        shippingCountry: 'TH',
      },
    })
    paymentId = (
      await db.payment.create({
        data: {
          orderId: order.id,
          provider: 'bridge',
          providerIntentId: reference,
          amount: 9007199254740993n,
          currency: 'THB',
        },
      })
    ).id
    const access = new AdminAccessService(new AdminAccessRepository(db))
    payouts = new PayoutService(
      context,
      new PrismaPayoutRepository(context, db),
      undefined,
      undefined,
      undefined,
      access,
    )
    service = new AdminOperationsService(
      context,
      new PrismaAdminOperationsRepository(context, db),
      access,
      payouts,
    )
  })
  afterAll(async () => {
    await db?.$disconnect()
  })
  async function fundedShop(
    balance = 10000n,
    cadence = 'DAILY',
    requestedById = admin.id,
  ) {
    const tag = randomUUID()
    const result = await db.shop.create({
      data: {
        ownerId: sellerId,
        sellerProfileId: profileId,
        name: tag,
        slug: tag,
        contactEmail: `${tag}@example.test`,
        contactPhone: '0800000000',
        status: 'ACTIVE',
        wallet: { create: {} },
        operationPolicy: {
          create: {
            updatedById: requestedById,
            payoutCadence: cadence,
            payoutMinimum: 100n,
          },
        },
      },
      include: { wallet: true, operationPolicy: true },
    })
    await db.walletLedgerEntry.create({
      data: {
        walletId: result.wallet!.id,
        shopId: result.id,
        type: 'manual_adjustment',
        amount: balance,
        currency: 'THB',
      },
    })
    return result
  }
  function statement(sourceKey = randomUUID()): EvidenceInput {
    return {
      kind: 'BANK_STATEMENT',
      sourceKey,
      amount: '9007199254740993',
      currency: 'THB',
      externalReference: reference,
      occurredAt: null,
      paymentId,
      reason: 'Statement review',
    }
  }

  it('rejects stale concurrent shop-policy saves and audits the committed version', async () => {
    const target = await fundedShop(0n, 'MANUAL')
    const input = {
      expectedVersion: 1,
      commissionBps: 1250,
      dispatchSlaHours: 48,
      deliverySlaHours: 120,
      payoutCadence: 'MANUAL' as const,
      payoutMinimum: '9007199254740993',
      shippingRatesEnabled: false,
      reason: 'Update policy',
    }
    const results = await Promise.allSettled([
      service.savePolicy(admin, target.id, input),
      service.savePolicy(admin, target.id, { ...input, commissionBps: 500 }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      (
        await db.shopOperationPolicy.findUniqueOrThrow({
          where: { shopId: target.id },
        })
      ).version,
    ).toBe(2)
    expect(
      await db.auditLog.count({
        where: { entityType: 'shop-operation-policy', entityId: target.id },
      }),
    ).toBe(1)
  })
  it('enforces provider ownership and keeps stored credentials out of lists', async () => {
    const first = await fundedShop(0n, 'MANUAL')
    const second = await fundedShop(0n, 'MANUAL')
    const provider = await db.shippingProvider.create({
      data: {
        shopId: first.id,
        code: randomUUID(),
        name: 'Carrier',
        apiConfig: { secret: 'hidden-provider-token' },
      },
    })
    await expect(
      service.saveRate(admin, null, {
        providerId: provider.id,
        shopId: second.id,
        name: 'Foreign shop',
        country: 'TH',
        postalPrefixes: [],
        regions: [],
        minWeightGrams: 0,
        maxWeightGrams: null,
        maxLengthMm: null,
        maxWidthMm: null,
        maxHeightMm: null,
        volumetricDivisor: 5000,
        baseFee: '100',
        perKgFee: '0',
        priority: 0,
        isActive: true,
        reason: 'New rate',
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(
      JSON.stringify(await service.listProviders(admin, { shopId: first.id })),
    ).not.toContain('hidden-provider-token')
  })
  it('freezes published title and body across safe draft edits', async () => {
    const slug = `policy-${randomUUID()}`
    const page = await service.saveContent(admin, null, {
      slug,
      locale: 'en',
      title: 'Published title',
      draftBody: '<script>alert(1)</script>',
      reason: 'Create policy',
    })
    await service.publishContent(admin, page.id, {
      expectedVersion: page.version,
      reason: 'Publish policy',
    })
    await service.saveContent(admin, page.id, {
      slug,
      locale: 'en',
      title: 'Draft title',
      draftBody: 'Draft text',
      expectedVersion: 2,
      reason: 'Draft update',
    })
    expect(await service.publishedContent(slug, 'en')).toMatchObject({
      publishedTitle: 'Published title',
      publishedBody: '<script>alert(1)</script>',
    })
    await expect(
      service.publishContent(admin, page.id, {
        expectedVersion: 2,
        reason: 'Stale publish',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('matches exact statements without settling payments and rejects amount/reference mismatches', async () => {
    await expect(
      service.createEvidence(admin, {
        ...statement(),
        amount: '9007199254740992',
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      service.createEvidence(admin, {
        ...statement(),
        externalReference: 'wrong',
      }),
    ).rejects.toMatchObject({ status: 409 })
    const row = await service.createEvidence(admin, statement())
    await service.matchEvidence(reviewer, row.id, {
      expectedVersion: row.version,
      reason: 'Exact bank match',
    })
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
    ).toBe('PENDING')
    expect(
      (
        await db.financeReconciliation.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe('MATCHED')
  })
  it('deduplicates concurrent statement sources in the database', async () => {
    const row = statement()
    const result = await Promise.allSettled([
      service.importStatement(admin, [row]),
      service.importStatement(admin, [row]),
    ])
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(
      await db.financeReconciliation.count({
        where: { sourceKey: row.sourceKey },
      }),
    ).toBe(1)
  })
  it('requires two administrators for expense verification without customer settlement targets', async () => {
    const expense = await service.createEvidence(admin, {
      kind: 'OPERATING_EXPENSE',
      sourceKey: randomUUID(),
      amount: '1500',
      currency: 'THB',
      externalReference: 'invoice-expense',
      occurredAt: '2026-10-12T00:00:00Z',
      reason: 'Hosting invoice',
    })
    await expect(
      service.matchEvidence(admin, expense.id, {
        expectedVersion: 1,
        reason: 'Self review',
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(
      await service.matchEvidence(reviewer, expense.id, {
        expectedVersion: 1,
        reason: 'Verified expense invoice',
      }),
    ).toMatchObject({ status: 'MATCHED' })
  })
  it('prepares a shop cycle once under concurrent wallet reservations and replay', async () => {
    const target = await fundedShop(9007199254740993n)
    const now = new Date('2026-10-13T08:00:00Z')
    const results = await Promise.all([
      payouts.prepareAdminCycle(admin, target.id, now),
      payouts.prepareAdminCycle(admin, target.id, now),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([
      'EXISTING',
      'REQUESTED',
    ])
    const rows = await db.sellerPayout.findMany({
      where: { shopId: target.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount).toBe(9007199254740993n)
    expect(
      await db.walletLedgerEntry.count({
        where: { shopId: target.id, type: 'payout_reserved' },
      }),
    ).toBe(1)
    await db.walletLedgerEntry.create({
      data: {
        walletId: target.wallet!.id,
        shopId: target.id,
        type: 'refund_adjustment',
        amount: -1n,
        currency: 'THB',
      },
    })
    await expect(
      payouts.approveAdminPayout(admin, rows[0]!.id),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })
  it('records an exact private payout slip atomically and retains the two-person gate', async () => {
    const target = await fundedShop(5000n)
    const prepared = await payouts.prepareAdminCycle(
      admin,
      target.id,
      new Date('2026-10-13T08:00:00Z'),
    )
    expect(prepared.payoutId).not.toBeNull()
    const id = prepared.payoutId!
    await payouts.approveAdminPayout(admin, id)
    const upload = await db.upload.create({
      data: {
        userId: reviewer.id,
        usage: 'FINANCE_EVIDENCE',
        status: 'COMPLETED',
        fileName: 'slip.pdf',
        contentType: 'application/pdf',
        fileSize: 100,
        key: `private/finance/${randomUUID()}`,
        completedAt: new Date(),
      },
    })
    const evidence = await service.createEvidence(reviewer, {
      kind: 'PAYOUT_EVIDENCE',
      sourceKey: randomUUID(),
      amount: '5000',
      currency: 'THB',
      externalReference: 'BANK-123',
      occurredAt: null,
      uploadId: upload.id,
      payoutId: id,
      reason: 'Transfer slip',
    })
    await expect(
      payouts.markAdminPayoutPaid(admin, id, {
        externalReference: 'BANK-123',
        evidenceId: evidence.id,
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      payouts.markAdminPayoutPaid(reviewer, id, {
        externalReference: 'WRONG',
        evidenceId: evidence.id,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(
      await payouts.markAdminPayoutPaid(reviewer, id, {
        externalReference: 'BANK-123',
        evidenceId: evidence.id,
      }),
    ).toMatchObject({ status: 'paid', amount: 5000n })
    expect(
      (await db.sellerPayout.findUniqueOrThrow({ where: { id } }))
        .evidenceUploadId,
    ).toBe(upload.id)
    expect(
      (
        await db.financeReconciliation.findUniqueOrThrow({
          where: { id: evidence.id },
        })
      ).status,
    ).toBe('MATCHED')
    await expect(
      payouts.markAdminPayoutPaid(reviewer, id, {
        externalReference: 'BANK-123',
        evidenceId: evidence.id,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('skips scheduled policies whose stored requester has lost membership', async () => {
    const tag = randomUUID()
    const requester = await db.user.create({
      data: {
        name: tag,
        email: `${tag}@example.test`,
        role: 'ADMIN',
        emailVerified: true,
        adminTeamMember: {
          create: { label: tag, isOwner: true, isActive: false },
        },
      },
    })
    const target = await fundedShop(1000n, 'DAILY', requester.id)
    const result = await payouts.prepareDuePayouts(
      new Date('2026-10-14T08:00:00Z'),
    )
    expect(result.results.find((row) => row.shopId === target.id)?.status).toBe(
      'REQUESTER_FORBIDDEN',
    )
    expect(await db.sellerPayout.count({ where: { shopId: target.id } })).toBe(
      0,
    )
  })
  it('denies service calls without active administrator membership', async () => {
    await expect(
      service.listReconciliation({ id: sellerId, role: 'USER' }, {}),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rechecks permission after the grant lock when a requester is revoked concurrently', async () => {
    const tag = randomUUID()
    const requester = await db.user.create({
      data: {
        name: tag,
        email: `${tag}@example.test`,
        role: 'ADMIN',
        emailVerified: true,
        adminTeamMember: {
          create: { label: tag, isOwner: true, isActive: true },
        },
      },
    })
    const actor: AdminActor = { id: requester.id, role: requester.role }
    const target = await fundedShop(0n, 'MANUAL')
    function signal() {
      let notify = () => {}
      const promise = new Promise<void>((resolve) => {
        notify = resolve
      })
      return { promise, notify: () => notify() }
    }
    const locked = signal(),
      checked = signal(),
      release = signal()
    const access = new AdminAccessService(new AdminAccessRepository(db))
    let checks = 0
    const guarded = new AdminOperationsService(
      context,
      new PrismaAdminOperationsRepository(context, db),
      {
        require: async (identity, permission) => {
          await access.require(identity, permission)
          if (++checks === 1) checked.notify()
        },
      },
    )
    const revocation = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(719362804)`
      locked.notify()
      await release.promise
      await tx.adminTeamMember.update({
        where: { userId: actor.id },
        data: { isActive: false, version: { increment: 1 } },
      })
    })
    await locked.promise
    const mutation = guarded.savePolicy(actor, target.id, {
      expectedVersion: 1,
      commissionBps: 2000,
      dispatchSlaHours: 72,
      deliverySlaHours: 168,
      payoutCadence: 'MANUAL',
      payoutMinimum: '0',
      shippingRatesEnabled: false,
      reason: 'Concurrent policy edit',
    })
    await checked.promise
    release.notify()
    await revocation
    await expect(mutation).rejects.toMatchObject({ status: 403 })
    expect(
      (
        await db.shopOperationPolicy.findUniqueOrThrow({
          where: { shopId: target.id },
        })
      ).version,
    ).toBe(1)
  })
})
