import { requireAdmin } from "#/lib/auth-server";
import { AdminDashboardOverview, AdminSpaceCat } from "#/features/admin";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <AdminDashboardOverview
      userName={session.user.name}
      heroVisual={<AdminSpaceCat mode="dashboard" />}
    />
  );
}
