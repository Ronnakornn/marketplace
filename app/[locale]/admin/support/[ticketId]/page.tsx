import { SupportDetailPage } from '#/features/support'
import { requireAdmin } from '#/lib/auth-server'

export default async function AdminSupportDetailRoute({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireAdmin()
  const { ticketId } = await params
  return <SupportDetailPage role="admin" ticketId={ticketId} />
}
