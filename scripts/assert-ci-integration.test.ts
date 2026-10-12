import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertCiIntegrationEnvironment, assertCiIntegrationReport, findRequiredIntegrationFiles } from './assert-ci-integration.ts'

function environment(): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', CHECKOUT_V2_SETTLEMENT_ENABLED: 'true', QUEUE_TEST_ALLOW_OLD_REDIS: 'false',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:55439/marketplace_test',
    COMMERCE_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/marketplace_test_completion',
    QUEUE_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/marketplace_test_queue',
    TAX_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/marketplace_test_tax',
    ROLLOUT_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/marketplace_test_rollout',
    AUDIT_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/marketplace_test_readiness_audit',
    REPORTING_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_reporting',
    ADMIN_DIRECTORY_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_directory',
    ADMIN_OPERATIONS_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_admin_operations',
    FULL_ADMIN_BOUNDARIES_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_admin_boundaries',
    CACHE_TEST_REDIS_URL: 'redis://127.0.0.1:56379/14', QUEUE_TEST_REDIS_URL: 'redis://127.0.0.1:56379/15',
  }
}

function report() {
  return { success: true, numTotalTests: 2, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    testResults: [
      { name: resolve('server/lib/money.integration.test.ts'), status: 'passed', assertionResults: [{ status: 'passed' }] },
      { name: resolve('server/modules/checkout/tax-sale.integration.test.ts'), status: 'passed', assertionResults: [{ status: 'passed' }] },
    ],
  }
}

const required = [resolve('server/lib/money.integration.test.ts'), resolve('server/modules/checkout/tax-sale.integration.test.ts')]

describe('mandatory CI integration environment', () => {
  it('accepts isolated actual database and cache/queue opt-ins without global unit Redis', () => {
    expect(() => assertCiIntegrationEnvironment(environment())).not.toThrow()
  })

  it.each(['DATABASE_URL', 'COMMERCE_TEST_DATABASE_URL', 'QUEUE_TEST_DATABASE_URL', 'TAX_TEST_DATABASE_URL', 'ROLLOUT_TEST_DATABASE_URL', 'AUDIT_TEST_DATABASE_URL', 'REPORTING_TEST_DATABASE_URL', 'ADMIN_DIRECTORY_TEST_DATABASE_URL', 'ADMIN_OPERATIONS_TEST_DATABASE_URL', 'FULL_ADMIN_BOUNDARIES_TEST_DATABASE_URL', 'CACHE_TEST_REDIS_URL', 'QUEUE_TEST_REDIS_URL'])('rejects missing %s instead of allowing suite skips', key => {
    const env = environment()
    delete env[key]
    expect(() => assertCiIntegrationEnvironment(env)).toThrow(key)
  })

  it('rejects global Redis that contaminates memory-based unit tests', () => {
    expect(() => assertCiIntegrationEnvironment({ ...environment(), REDIS_URL: 'redis://127.0.0.1:56379/0' })).toThrow('global REDIS_URL')
  })

  it('rejects a commerce database that the W7 integration guard refuses', () => {
    const env = environment()
    env['COMMERCE_TEST_DATABASE_URL'] = 'postgresql://postgres@127.0.0.1:55439/marketplace_test_commerce'
    expect(() => assertCiIntegrationEnvironment(env)).toThrow('marketplace_test_completion')
  })

  it.each([
    { NODE_ENV: 'production' }, { CHECKOUT_V2_SETTLEMENT_ENABLED: 'false' }, { QUEUE_TEST_ALLOW_OLD_REDIS: 'true' },
    { COMMERCE_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/marketplace_test_completion' },
    { TAX_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_commerce' },
    { AUDIT_TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_test_other' },
    { ROLLOUT_TEST_DATABASE_URL: 'postgresql://postgres@localhost:55439/marketplace_test_completion' },
    { QUEUE_TEST_REDIS_URL: 'redis://localhost:56379/14' }, { QUEUE_TEST_REDIS_URL: 'redis://127.0.0.1:6379/15' },
    { CACHE_TEST_REDIS_URL: 'redis://127.0.0.1:56379/0' },
    { DATABASE_URL: 'postgresql://postgres@db.example.com:55439/marketplace_test' },
    { DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/marketplace_production' },
  ])('rejects unsafe or incompatible integration configuration %j', invalid => {
    const env = environment()
    Object.assign(env, invalid)
    expect(() => assertCiIntegrationEnvironment(env)).toThrow()
  })
})

describe('mandatory CI executed integration report', () => {
  it('accepts only a complete passing execution report', () => {
    expect(assertCiIntegrationReport(report(), required)).toEqual({ passedTests: 2, integrationFiles: 2 })
  })

  it('rejects a green filtered run that omitted the tax file', () => {
    const input = report()
    input.testResults.pop()
    input.numTotalTests = 1
    expect(() => assertCiIntegrationReport(input, required)).toThrow('Mandatory integration file absent')
  })

  it.each(['pending', 'skipped', 'todo', 'failed'])('rejects an integration assertion with status %s despite a green report summary', status => {
    const input = report()
    input.testResults[0]!.assertionResults[0]!.status = status
    expect(() => assertCiIntegrationReport(input, required)).toThrow()
  })

  it('rejects an empty integration suite disguised as passed', () => {
    const input = report()
    input.testResults[0]!.assertionResults = []
    expect(() => assertCiIntegrationReport(input, required)).toThrow()
  })

  it.each([{ success: false }, { numFailedTests: 1 }, { numPendingTests: 1 }, { numTodoTests: 1 }, { numTotalTests: 3 }])('rejects incomplete or failed report totals %j', invalid => {
    expect(() => assertCiIntegrationReport({ ...report(), ...invalid }, required)).toThrow()
  })

  it('discovers source integration files instead of allowing a stale hardcoded list', () => {
    const files = findRequiredIntegrationFiles(process.cwd())
    expect(files).toEqual(expect.arrayContaining(required))
    expect(files).toContain(resolve('scripts/reconcile-external-finance.integration.test.ts'))
    expect(files).toContain(resolve('server/modules/jobs/queue-expiry.integration.test.ts'))
    expect(files.every(file => file.endsWith('.integration.test.ts'))).toBe(true)
    expect(() => assertCiIntegrationReport(report(), [])).toThrow('No mandatory integration files discovered')
  })
})
