import { AdminCommissionsTable } from "#/features/admin/components/AdminConfigurationTables";
import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";

export default function AdminCommissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.commissions.eyebrow" title="admin.pages.commissions.title" description="admin.pages.commissions.description" />
      <AdminCommissionsTable />
    </div>
  );
}
