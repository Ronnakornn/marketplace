import { AdminBuyerDetail } from '#/features/admin/directory/AdminBuyerDetail'
export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return <AdminBuyerDetail userId={userId} />
}
