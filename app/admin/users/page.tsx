import { AdminUserTable } from "#/features/user";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Crew Access"
        title="Manage user accounts"
        description="Create accounts, adjust roles, and remove access without leaving the control deck."
      >
        <AdminSpaceCat mode="users" />
      </AdminPageIntro>
      <div className="admin-users-scope">
        <AdminUserTable currentUserId={session.user.id} />
      </div>
    </div>
  );
}
