import { allocateRefundAmount, calculateRefundDebits } from '../../../server/modules/refund/refund-amount.service.ts'

let states = 0, orderPlans = 0, feasibleIdealPlans = 0, fullRefundPlans = 0, targetedPlans = 0
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
  const caps = [BigInt(a), BigInt(b), BigInt(c)]
  for (let x = 0; x <= a; x++) for (let y = 0; y <= b; y++) for (let z = 0; z <= c; z++) {
    const actual = [BigInt(x), BigInt(y), BigInt(z)]
    const shops = caps.map((grandTotal, index) => ({ shopId: String(index), grandTotal, refundedAmount: actual[index]! }))
    const used = actual.reduce((sum, amount) => sum + amount, 0n)
    const remaining = caps.reduce((sum, amount) => sum + amount, 0n) - used
    states++
    for (let amount = 0n; amount <= remaining; amount++) {
      const plan = calculateRefundDebits({ amount, scope: { kind: 'order' }, shops }).map((debit) => debit.amount)
      if (plan.reduce((sum, debit) => sum + debit, 0n) !== amount
        || plan.some((debit, index) => debit < 0n || debit > caps[index]! - actual[index]!)) {
        throw new Error('Nonnegative debit, conservation, or remaining cap violated')
      }
      const ideal = allocateRefundAmount(used + amount, caps)
      if (ideal.every((target, index) => target >= actual[index]!)) {
        feasibleIdealPlans++
        if (plan.some((debit, index) => debit !== ideal[index]! - actual[index]!)) throw new Error('Feasible cumulative ideal changed')
      }
      if (amount === remaining) {
        fullRefundPlans++
        if (plan.some((debit, index) => debit !== caps[index]! - actual[index]!)) throw new Error('Full refund did not exhaust each cap')
      }
      orderPlans++
    }
    for (let index = 0; index < 3; index++) for (let amount = 0n; amount <= caps[index]! - actual[index]!; amount++) {
      const plan = calculateRefundDebits({ amount, scope: { kind: 'shop', shopId: String(index) }, shops })
      if (plan.some((debit, position) => debit.amount !== (position === index ? amount : 0n))) throw new Error('Targeted refund changed another shop')
      targetedPlans++
    }
  }
}
process.stdout.write(JSON.stringify({
  evidence: 'pure finite-state arithmetic',
  source: 'server/modules/refund/refund-amount.service.ts',
  scope: { shops: 3, minimumCap: 0, maximumCap: 5, ui: false, database: false, provider: false, arbitraryPartialPartitionIndependence: false },
  states, orderPlans, feasibleIdealPlans, fullRefundPlans, targetedPlans, failures: 0,
}, null, 2) + '\n')
