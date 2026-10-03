import assert from 'node:assert/strict'
import { Elysia, t } from 'elysia'
import { treaty, type Treaty } from '@elysiajs/eden'

const centsSchema = t.String({ pattern: '^(0|[1-9][0-9]*|-[1-9][0-9]*)$' })
const walletSchema = t.Object({ availableBalanceCents: centsSchema, sellerDebtCents: centsSchema, currency: t.Literal('THB') })

function walletDto(balance: bigint, reserved: bigint) {
  const economicBalance = balance + reserved
  return {
    availableBalanceCents: balance.toString(),
    sellerDebtCents: (economicBalance < 0n ? -economicBalance : 0n).toString(),
    currency: 'THB' as const,
  }
}

function formatMinorUnits(raw: string, locale = 'en-US') {
  assert.match(raw, /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/)
  const cents = BigInt(raw)
  const absolute = cents < 0n ? -cents : cents
  const whole = absolute / 100n
  const signedWhole = cents < 0n ? whole === 0n ? -0 : -whole : whole
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'THB', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).formatToParts(signedWhole).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}

const cases = [
  ['9007199254740990', '90,071,992,547,409.90'],
  ['9007199254740991', '90,071,992,547,409.91'],
  ['9007199254740992', '90,071,992,547,409.92'],
  ['9007199254740993', '90,071,992,547,409.93'],
  ['-9007199254740990', '-90,071,992,547,409.90'],
  ['-9007199254740991', '-90,071,992,547,409.91'],
  ['-9007199254740992', '-90,071,992,547,409.92'],
  ['-9007199254740993', '-90,071,992,547,409.93'],
  ['18014398509481981', '180,143,985,094,819.81'],
  ['-18014398509481981', '-180,143,985,094,819.81'],
  ['-1', '-0.01'],
  ['0', '0.00'],
] as const

const app = new Elysia().get('/wallet/:amount', ({ params }) => walletDto(BigInt(params.amount), 0n), { response: walletSchema })
const client = treaty(app)
const getWallet = client.wallet({ amount: '0' }).get
type WalletDto = Treaty.Data<typeof getWallet>
type IsString = WalletDto['availableBalanceCents'] extends string ? true : false
const typedString: IsString = true
assert.equal(typedString, true)

const results = []
for (const [raw, decimal] of cases) {
  const response = await app.handle(new Request(`http://localhost/wallet/${raw}`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), walletDto(BigInt(raw), 0n))
  const result = await client.wallet({ amount: raw }).get()
  assert.equal(result.error, null)
  assert.equal(result.data!.availableBalanceCents, raw)
  const formatted = formatMinorUnits(result.data!.availableBalanceCents)
  assert.equal(formatted.replace(/THB\s*/u, ''), decimal)
  results.push({ input: raw, wireType: typeof result.data!.availableBalanceCents, display: formatted })
}

assert.equal(9007199254740991n + 9007199254740991n - 1n, 18014398509481981n)
assert.equal(walletDto(-18014398509481981n, 9007199254740991n).sellerDebtCents, '9007199254740990')
for (const raw of ['01', '-0', '1e3', '1.5', '+1', ' NaN']) {
  assert.throws(() => formatMinorUnits(raw))
}

const oldSerialize = JSON.parse(JSON.stringify({ amount: 9007199254740993n }, (_key, value) => typeof value === 'bigint' ? Number(value) : value))
assert.equal(oldSerialize.amount, 9007199254740992)
const oldCacheHit = JSON.parse(JSON.stringify({ amount: 9007199254740993n }, (_key, value) => typeof value === 'bigint' ? value.toString() : value))
assert.equal(typeof oldCacheHit.amount, 'string')
const oldDisplay = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB' }).format(9007199254740991 / 100)
assert.equal(oldDisplay.replace(/THB\s*/u, ''), '90,071,992,547,409.90')

process.stdout.write(JSON.stringify({ passed: true, boundaries: results, oldSerializerAmount: oldSerialize.amount, oldCacheBigIntType: typeof oldCacheHit.amount, oldDisplayAtMaxSafe: oldDisplay, limits: ['No PostgreSQL queries', 'No Redis execution', 'No application endpoint integration', 'No browser rendering'] }, null, 2) + '\n')
