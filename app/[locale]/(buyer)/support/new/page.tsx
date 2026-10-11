import { SupportCreatePage } from '#/features/support'
import { requireUser } from '#/lib/auth-server'

export default async function SupportCreateRoute({ searchParams }: { searchParams: Promise<{ orderId?: string; shopId?: string }> }) {
  await requireUser()
  const { orderId, shopId } = await searchParams
  return <SupportCreatePage orderId={orderId} shopId={shopId} />
}
