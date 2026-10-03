import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaUserRepository } from './user.repository.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
describe.skipIf(!url)('password reset transaction on PostgreSQL', () => {
  let prisma: PrismaClient
  let repo: PrismaUserRepository
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) throw new Error('Use a local disposable marketplace_test_* database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    repo = new PrismaUserRepository(context, prisma)
  })
  afterAll(async () => { await prisma?.$disconnect() })
  async function fixture() {
    const user = await prisma.user.create({ data: { name: 'Reset test', email: `${randomUUID()}@example.test` } })
    const account = await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', issuer: 'local:credential', password: 'old-hash' } })
    const verification = await prisma.verification.create({ data: { identifier: `PASSWORD_RESET:${user.email}`, value: 'otp-hash', expiresAt: new Date(Date.now() + 60000) } })
    await prisma.session.createMany({ data: [1, 2].map(() => ({ userId: user.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60000) })) })
    return { userId: user.id, accountId: account.id, verificationId: verification.id, identifier: verification.identifier, value: verification.value, passwordHash: 'new-hash' }
  }
  it('accepts an OTP only once concurrently and revokes every session with the password change', async () => {
    const data = await fixture()
    const outcomes = await Promise.all([repo.completePasswordReset(data), repo.completePasswordReset({ ...data, passwordHash: 'competing-hash' })])
    expect(outcomes.filter(Boolean)).toHaveLength(1)
    expect((await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } })).password).toBe(outcomes[0] ? 'new-hash' : 'competing-hash')
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(0)
    expect(await prisma.verification.count({ where: { identifier: data.identifier } })).toBe(0)
    expect(await repo.completePasswordReset(data)).toBe(false)
  })
  it('rolls back OTP consumption and preserves sessions when credential update fails', async () => {
    const data = await fixture()
    await expect(repo.completePasswordReset({ ...data, accountId: randomUUID() })).rejects.toThrow()
    expect((await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } })).password).toBe('old-hash')
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(2)
    expect(await prisma.verification.count({ where: { id: data.verificationId } })).toBe(1)
  })
  it('rejects an OTP that expired after the service precheck without changing credentials or sessions', async () => {
    const data = await fixture()
    await prisma.verification.update({ where: { id: data.verificationId }, data: { expiresAt: new Date(0) } })
    expect(await repo.completePasswordReset(data)).toBe(false)
    expect((await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } })).password).toBe('old-hash')
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(2)
  })
})
