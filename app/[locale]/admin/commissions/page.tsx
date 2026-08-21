import { AdminCommissionsTable, AdminPageIntro } from "#/features/admin";

export default function AdminCommissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.commissions.eyebrow" title="admin.pages.commissions.title" description="admin.pages.commissions.description" />
      <AdminCommissionsTable />
    </div>
  );
}
