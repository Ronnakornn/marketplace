import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";
import { AdminUsersTable } from "#/features/admin/components/AdminOperationsTables";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="admin.pages.users.eyebrow"
        title="admin.pages.users.title"
        description="admin.pages.users.description"
      >
        <AdminSpaceCat mode="users" />
      </AdminPageIntro>
      <AdminUsersTable />
    </div>
  );
}
