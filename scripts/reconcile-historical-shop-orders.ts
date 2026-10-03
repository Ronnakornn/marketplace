import { readFile } from 'node:fs/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client.ts'
import { createLogger } from '../server/infrastructure/logging/index.ts'
import { HistoricalReconciliationRepository } from '../server/modules/order/historical-reconciliation.repository.ts'
import { HistoricalReconciliationService } from '../server/modules/order/historical-reconciliation.service.ts'

const databaseUrl = process.env.DATABASE_URL
const manifestPath = process.argv[2]
const actorId = process.env.RECONCILIATION_ADMIN_ID
if (!databaseUrl || !manifestPath || !actorId) throw new Error('Require DATABASE_URL, RECONCILIATION_ADMIN_ID and an original-facts manifest path')
const url = new URL(databaseUrl)
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/marketplace_(test|e2e)_/.test(url.pathname)) {
  throw new Error('This reconciliation runner requires a disposable local marketplace test database')
}
if (process.argv.slice(3).some((argument) => argument !== '--apply')) throw new Error('Only explicit --apply is accepted')
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
try {
  const service = new HistoricalReconciliationService({ logger: createLogger(), config: { environment: 'reconciliation' } }, new HistoricalReconciliationRepository(client))
  const result = await service.reconcile(actorId, JSON.parse(await readFile(manifestPath, 'utf8')), process.argv.includes('--apply'))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await client.$disconnect()
}
