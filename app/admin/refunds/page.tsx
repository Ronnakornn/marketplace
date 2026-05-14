import { AdminPageIntro, AdminRefundsTable, AdminSpaceCat } from "#/features/admin";

export default function AdminRefundsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Payments" title="Refunds" description="Review refund status and move requests through the supported workflow.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminRefundsTable />
    </div>
  );
}
