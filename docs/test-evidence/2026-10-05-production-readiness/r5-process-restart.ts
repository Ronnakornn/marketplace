import { randomUUID } from 'node:crypto'
import { closeSync, openSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { hashPassword } from 'better-auth/crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { z } from 'zod'

const outputDirectory = 'docs/test-evidence/2026-10-05-production-readiness'
const connectionString = process.env['DATABASE_URL'] ?? ''
const connection = new URL(connectionString)
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439'
  || connection.pathname !== '/marketplace_test_readiness_base') throw new Error('Dedicated local rehearsal DB required')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
const email = `restart-${randomUUID()}@example.com`
const password = randomUUID()
const identity = await db.user.create({ data: { email, name: 'Restart rehearsal', role: 'ADMIN', status: 'ACTIVE', emailVerified: true } })
await db.account.create({ data: { userId: identity.id, accountId: identity.id, providerId: 'credential', issuer: 'local:credential', password: await hashPassword(password) } })
await db.$disconnect()

const origin = 'http://127.0.0.1:3101'
const observations = []
for (const enabled of [true, false]) {
  const output = openSync(`${outputDirectory}/r5-process-${enabled}.log`, 'w')
  const errors = openSync(`${outputDirectory}/r5-process-${enabled}-error.log`, 'w')
  const child = spawn('bun', ['run', 'server/index.ts'], {
    env: { ...process.env, API_PORT: '3101', NODE_ENV: 'production', CHECKOUT_V2_SETTLEMENT_ENABLED: String(enabled) },
    windowsHide: true, shell: false, stdio: ['ignore', output, errors] })
  const exited = new Promise<void>((resolve, reject) => {
    child.once('exit', () => resolve())
    child.once('error', reject)
  })
  try {
    let ready = false
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('API process exited before readiness')
      try { ready = (await fetch(`${origin}/api/health/ready`)).ok } catch { ready = false }
      if (ready) break
      await setTimeout(250)
    }
    if (!ready) throw new Error('API readiness timeout')
    const login = await fetch(`${origin}/api/auth/sign-in/email`, { method: 'POST',
      headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email, password }) })
    if (!login.ok) throw new Error(`Synthetic admin login failed ${login.status}`)
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const response = await fetch(`${origin}/api/admin/checkout/tax-policy`, { headers: { cookie } })
    if (!response.ok) throw new Error(`Admin tax read failed ${response.status}`)
    const capability = z.object({ settlementEnabled: z.boolean(), policy: z.object({ ratePpm: z.number() }) }).parse(await response.json())
    if (capability.settlementEnabled !== enabled || capability.policy.ratePpm !== 0) throw new Error('Unexpected startup capability or default policy')
    observations.push({ pid: child.pid, configuredFlag: enabled, readinessStatus: 200,
      authenticatedAdminStatus: response.status, settlementEnabled: capability.settlementEnabled, defaultTaxRatePpm: capability.policy.ratePpm })
  } finally {
    child.kill()
    await exited
    closeSync(output)
    closeSync(errors)
  }
}
writeFileSync(`${outputDirectory}/r5-process-restart.json`, JSON.stringify({ status: 'PASS',
  scope: 'Two sequential task-owned local production API processes on one current binary; no mixed revisions, routing, external provider, or production data',
  observedAt: new Date().toISOString(), observations, bothProcessesStopped: true }, null, 2) + '\n')
