import { AdminPageIntro, AdminPayoutsTable } from "#/features/admin";

export default function AdminPayoutsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Finance" title="Payouts & Commissions" description="Approve seller payouts and monitor commission settlement from one queue." />
      <AdminPayoutsTable />
    </div>
  );
}
