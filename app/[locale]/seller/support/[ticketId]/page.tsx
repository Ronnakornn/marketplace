import { SupportDetailPage } from '#/features/support'
import { enforceSellerRoute } from '#/lib/seller-route-guard'

export default async function SellerSupportDetailRoute({ params }: { params: Promise<{ locale: string; ticketId: string }> }) {
  const { locale, ticketId } = await params
  await enforceSellerRoute('/seller/support', locale)
  return <SupportDetailPage role="seller" ticketId={ticketId} />
}
