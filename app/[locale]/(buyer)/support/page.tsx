import { SupportListPage } from '#/features/support'
import { requireUser } from '#/lib/auth-server'

export default async function SupportRoute() {
  await requireUser()
  return <SupportListPage role="buyer" />
}
