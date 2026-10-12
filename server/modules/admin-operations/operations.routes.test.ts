import { Elysia, status } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAdminOperationsRoutes,
  adminOperationsPermissions,
} from './operations.routes.ts'

const authState = vi.hoisted(() => ({ role: 'ADMIN' }))
vi.mock('#server/modules/auth', async () => {
  const { Elysia } = await import('elysia')
  return {
    authPlugin: new Elysia().macro({
      withRole: (role: string) => ({
        resolve: () =>
          authState.role !== role
            ? status(403)
            : {
                authContext: {
                  user: {
                    id: '11111111-1111-4111-8111-111111111111',
                    role: 'ADMIN',
                  },
                },
              },
      }),
    }),
  }
})
const createEvidence = vi.fn(async (_actor: unknown, body: unknown) => body)
const savePolicy = vi.fn(
  async (_actor: unknown, _id: string, body: unknown) => body,
)
const app = () =>
  new Elysia().use(
    createAdminOperationsRoutes({
      adminOperationsService: { createEvidence, savePolicy } as never,
    }),
  )
const post = (path: string, body: unknown, method = 'POST') =>
  app().handle(
    new Request(`http://localhost/api/admin/operations/${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
const row = {
  kind: 'BANK_STATEMENT',
  sourceKey: 'line-1',
  amount: '9007199254740993',
  currency: 'THB',
  externalReference: 'bank-ref',
  occurredAt: null,
  reason: 'Bank statement',
}

describe('operations HTTP boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = 'ADMIN'
  })
  it('accepts generated-composed schemas and preserves exact minor-unit text', async () => {
    const response = await post('finance/reconciliation', row)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ amount: '9007199254740993' })
  })
  it.each([1, '1.25', '01', '-0'])(
    'rejects noncanonical money %s before calling the service',
    async (amount) => {
      expect(
        (await post('finance/reconciliation', { ...row, amount })).status,
      ).toBe(422)
      expect(createEvidence).not.toHaveBeenCalled()
    },
  )
  it('requires the administrator role at the route boundary', async () => {
    authState.role = 'USER'
    expect((await post('finance/reconciliation', row)).status).toBe(403)
    expect(createEvidence).not.toHaveBeenCalled()
  })
  it('accepts a versioned nullable commission policy using composed Prisma validation', async () => {
    expect(
      (
        await post(
          'shop-policies/11111111-1111-4111-8111-111111111111',
          {
            commissionBps: null,
            dispatchSlaHours: 72,
            deliverySlaHours: 168,
            shippingRatesEnabled: false,
            payoutCadence: 'MANUAL',
            payoutMinimum: '0',
            expectedVersion: 0,
            reason: 'Initial policy',
          },
          'PATCH',
        )
      ).status,
    ).toBe(200)
  })
  it('registers unique exact method and path permission entries', () => {
    const pairs = adminOperationsPermissions.map(
      (row) => `${row.method}:${row.path}`,
    )
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(
      adminOperationsPermissions.find((row) =>
        row.path.endsWith('/finance/statements/file-import'),
      )?.permission,
    ).toBe('finance.reconcile')
  })
})
