import { SupportListPage } from '#/features/support'
import { requireAdmin } from '#/lib/auth-server'

export default async function AdminSupportRoute() {
  await requireAdmin()
  return <SupportListPage role="admin" />
}
