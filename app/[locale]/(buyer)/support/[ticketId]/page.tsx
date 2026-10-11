import { SupportDetailPage } from '#/features/support'
import { requireUser } from '#/lib/auth-server'

export default async function SupportDetailRoute({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireUser()
  const { ticketId } = await params
  return <SupportDetailPage role="buyer" ticketId={ticketId} />
}
