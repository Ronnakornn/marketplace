import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminRefundsTable } from "#/features/admin/components/AdminOperationsTables";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";

export default function AdminRefundsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.refunds.eyebrow" title="admin.pages.refunds.title" description="admin.pages.refunds.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminRefundsTable />
    </div>
  );
}
