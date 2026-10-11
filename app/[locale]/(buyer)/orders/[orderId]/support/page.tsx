import { OrderSupportPage } from '#/features/support'
import { requireUser } from '#/lib/auth-server'

export default async function OrderSupportRoute({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser()
  const { orderId } = await params
  return <OrderSupportPage orderId={orderId} />
}
