import { AdminShopDetail } from '#/features/admin/directory/AdminShopDetail'
export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  return <AdminShopDetail shopId={shopId} />
}
