import { AdminUserTable } from "#/features/user";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="admin.pages.users.eyebrow"
        title="admin.pages.users.title"
        description="admin.pages.users.description"
      >
        <AdminSpaceCat mode="users" />
      </AdminPageIntro>
      <div className="admin-users-scope">
        <AdminUserTable currentUserId={session.user.id} />
      </div>
    </div>
  );
}
