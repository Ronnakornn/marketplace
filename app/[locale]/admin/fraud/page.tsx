import { AdminFraudCasesTable } from "#/features/admin/components/AdminBackofficeTables";
import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";

export default function AdminFraudPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.fraud.eyebrow" title="admin.pages.fraud.title" description="admin.pages.fraud.description" />
      <AdminFraudCasesTable />
    </div>
  );
}
