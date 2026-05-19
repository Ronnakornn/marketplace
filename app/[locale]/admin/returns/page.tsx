import { AdminPageIntro, AdminReturnsTable } from "#/features/admin";

export default function AdminReturnsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Escalations" title="Returns" description="Review buyer return requests and keep refund decisions aligned with order state." />
      <AdminReturnsTable />
    </div>
  );
}
