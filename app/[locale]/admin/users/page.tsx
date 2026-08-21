import { AdminPageIntro, AdminSpaceCat, AdminUsersTable } from "#/features/admin";

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
