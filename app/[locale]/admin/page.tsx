import { requireAdmin } from "#/lib/auth-server";
import { AdminDashboardOverview } from "#/features/admin/components/AdminDashboardOverview";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <AdminDashboardOverview
      userName={session.user.name}
    />
  );
}
