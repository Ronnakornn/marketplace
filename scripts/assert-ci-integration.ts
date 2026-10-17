import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'

const databaseKeys = ['DATABASE_URL', 'COMMERCE_TEST_DATABASE_URL', 'CHAT_TEST_DATABASE_URL', 'QUEUE_TEST_DATABASE_URL', 'TAX_TEST_DATABASE_URL', 'ROLLOUT_TEST_DATABASE_URL', 'AUDIT_TEST_DATABASE_URL', 'REPORTING_TEST_DATABASE_URL', 'ADMIN_DIRECTORY_TEST_DATABASE_URL', 'ADMIN_OPERATIONS_TEST_DATABASE_URL', 'FULL_ADMIN_BOUNDARIES_TEST_DATABASE_URL'] as const
const redisKeys = ['CACHE_TEST_REDIS_URL', 'QUEUE_TEST_REDIS_URL'] as const

export function assertCiIntegrationEnvironment(env: NodeJS.ProcessEnv): void {
  if (env['NODE_ENV'] !== 'test') throw new Error('Integration quality gate requires NODE_ENV=test')
  if (env['REDIS_URL']?.trim()) throw new Error('Quality gate must not set global REDIS_URL: unit rate-limit tests require memory isolation')
  if (env['CHECKOUT_V2_SETTLEMENT_ENABLED'] !== 'true') throw new Error('Quality gate requires explicit CHECKOUT_V2_SETTLEMENT_ENABLED=true')
  if (env['QUEUE_TEST_ALLOW_OLD_REDIS'] !== 'false') throw new Error('Quality gate must explicitly reject old Redis')
  const databases = new Set<string>()
  for (const key of databaseKeys) {
    const value = env[key]?.trim()
    if (!value) throw new Error(`Missing mandatory integration environment: ${key}`)
    const url = new URL(value)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/marketplace_test(?:_[a-z_]+)?$/.test(url.pathname)) {
      throw new Error(`${key} must select a local disposable marketplace_test database`)
    }
    if (key === 'COMMERCE_TEST_DATABASE_URL' && url.port !== '55439') throw new Error('COMMERCE_TEST_DATABASE_URL must use port55439 required by numeric fixtures')
    if (key === 'COMMERCE_TEST_DATABASE_URL' && url.pathname !== '/marketplace_test_completion') throw new Error('COMMERCE_TEST_DATABASE_URL must select the dedicated marketplace_test_completion database required by W7 integration fixtures')
    if (key === 'CHAT_TEST_DATABASE_URL' && !url.pathname.endsWith('_test')) throw new Error('CHAT_TEST_DATABASE_URL must select an isolated *_test database')
    if (key === 'TAX_TEST_DATABASE_URL' && url.pathname !== '/marketplace_test_tax') throw new Error('TAX_TEST_DATABASE_URL must select the dedicated marketplace_test_tax database')
    if (key === 'AUDIT_TEST_DATABASE_URL' && url.pathname !== '/marketplace_test_readiness_audit') throw new Error('AUDIT_TEST_DATABASE_URL must select the dedicated marketplace_test_readiness_audit database')
    const database = `${url.port || '5432'}${url.pathname}`
    if (databases.has(database)) throw new Error(`${key} must not share a database with another integration suite`)
    databases.add(database)
  }
  const redisDatabases = new Set<string>()
  for (const key of redisKeys) {
    const value = env[key]?.trim()
    if (!value) throw new Error(`Missing mandatory integration environment: ${key}`)
    const url = new URL(value)
    if (url.protocol !== 'redis:' || !['localhost', '127.0.0.1'].includes(url.hostname) || !url.port || url.port === '6379' || !/^\/[1-9]\d*$/.test(url.pathname)) {
      throw new Error(`${key} requires dedicated local Redis on a nonstandard port and nonzero database`)
    }
    const database = `${url.port}${url.pathname}`
    if (redisDatabases.has(database)) throw new Error('Cache and queue integration suites must not share a Redis database')
    redisDatabases.add(database)
  }
}

const ReportSchema = z.object({
  success: z.literal(true), numTotalTests: z.number().int().positive(),
  numFailedTests: z.literal(0), numPendingTests: z.literal(0), numTodoTests: z.literal(0),
  testResults: z.array(z.object({
    name: z.string(), status: z.literal('passed'),
    assertionResults: z.array(z.object({ status: z.literal('passed') })).min(1),
  })).min(1),
})

export function findRequiredIntegrationFiles(root: string): string[] {
  const files: string[] = []
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile() && entry.name.endsWith('.integration.test.ts')) files.push(resolve(path))
    }
  }
  walk(join(root, 'server'))
  walk(join(root, 'scripts'))
  return files.sort()
}

export function assertCiIntegrationReport(input: unknown, requiredFiles: readonly string[]): { passedTests: number; integrationFiles: number } {
  const report = ReportSchema.parse(input)
  if (!requiredFiles.length) throw new Error('No mandatory integration files discovered')
  const executed = new Set(report.testResults.map(result => resolve(result.name)))
  for (const file of requiredFiles) {
    if (!executed.has(resolve(file))) throw new Error(`Mandatory integration file absent from test report: ${file}`)
  }
  const assertions = report.testResults.reduce((total, result) => total + result.assertionResults.length, 0)
  if (assertions !== report.numTotalTests) throw new Error('Test report assertion count does not match total; incomplete report rejected')
  return { passedTests: assertions, integrationFiles: requiredFiles.length }
}

export function runCiIntegrationGate(args: readonly string[], env = process.env, root = process.cwd()): void {
  assertCiIntegrationEnvironment(env)
  if (args.length === 1 && args[0] === 'environment') {
    process.stdout.write('CI integration environment validated; unit Redis isolation retained\n')
    return
  }
  if (args.length !== 2 || args[0] !== 'report' || !args[1]) throw new Error('Usage: bun run scripts/assert-ci-integration.ts environment | report <vitest-json>')
  const report: unknown = JSON.parse(readFileSync(resolve(root, args[1]), 'utf8'))
  const result = assertCiIntegrationReport(report, findRequiredIntegrationFiles(root))
  process.stdout.write(`${JSON.stringify({ gate: 'PASS', ...result, skippedTests: 0 })}\n`)
}

if (import.meta.main) {
  try { runCiIntegrationGate(process.argv.slice(2)) }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'CI integration gate failed'}\n`)
    process.exitCode = 1
  }
}
