import { AdminPageIntro, AdminReportsOverview } from "#/features/admin";

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Metrics" title="Reports" description="Operational marketplace metrics derived from orders, refunds, payouts, and commissions." />
      <AdminReportsOverview />
    </div>
  );
}
