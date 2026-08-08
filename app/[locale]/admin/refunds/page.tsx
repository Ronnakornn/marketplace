import { AdminPageIntro, AdminRefundsTable, AdminSpaceCat } from "#/features/admin";

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
