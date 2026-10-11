import { SupportListPage } from '#/features/support'
import { enforceSellerRoute } from '#/lib/seller-route-guard'

export default async function SellerSupportRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await enforceSellerRoute('/seller/support', locale)
  return <SupportListPage role="seller" />
}
