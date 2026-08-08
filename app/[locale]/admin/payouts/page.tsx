import { AdminPageIntro, AdminPayoutsTable } from "#/features/admin";

export default function AdminPayoutsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.payouts.eyebrow" title="admin.pages.payouts.title" description="admin.pages.payouts.description" />
      <AdminPayoutsTable />
    </div>
  );
}
