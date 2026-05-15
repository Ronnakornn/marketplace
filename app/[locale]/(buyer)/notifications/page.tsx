import { NotificationsPage } from "#/features/order";
import { requireUser } from "#/lib/auth-server";

export default async function NotificationsRoutePage() {
  await requireUser();

  return <NotificationsPage />;
}
