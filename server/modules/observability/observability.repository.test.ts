import { readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { PrismaHealthCheckRepository } from './observability.repository.ts'

const bundledMigrations = readdirSync(new URL('../../../prisma/migrations/', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()

function repository(applied: string[], schemaReady = true) {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() }
  const query = vi.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('')
    if (sql.includes('schemaReady')) return Promise.resolve([{ schemaReady, migrationsReady: true }])
    if (sql.includes('AS ready')) return Promise.resolve([{ ready: applied.includes('20260904161000_add_buyer_coin_debt_balance') }])
    return Promise.resolve(applied.map((name) => ({ name })))
  })
  return { repo: new PrismaHealthCheckRepository({ logger } as never, { $queryRaw: query } as never), query }
}

describe('database schema readiness', () => {
  it('accepts every completed migration shipped with this release', async () => {
    const { repo } = repository(bundledMigrations)
    await expect(repo.checkDatabaseSchema(1_000)).resolves.toBe(true)
  })

  it('rejects the prior September schema even when its historical readiness marker exists', async () => {
    const { repo } = repository(bundledMigrations.filter((name) => name < '202610'))
    await expect(repo.checkDatabaseSchema(1_000)).resolves.toBe(false)
  })

  it.each(bundledMigrations.filter((name) => name.startsWith('202610')))('rejects missing or unfinished release migration %s', async (missing) => {
    const { repo } = repository(bundledMigrations.filter((name) => name !== missing))
    await expect(repo.checkDatabaseSchema(1_000)).resolves.toBe(false)
  })

  it('rejects missing core tables before querying migration history', async () => {
    const { repo, query } = repository(bundledMigrations, false)
    await expect(repo.checkDatabaseSchema(1_000)).resolves.toBe(false)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the database query fails', async () => {
    const { repo, query } = repository(bundledMigrations)
    query.mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(repo.checkDatabaseSchema(1_000)).resolves.toBe(false)
  })
})
