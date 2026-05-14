import { AdminOrdersMonitoringTable, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Order Control" title="Orders" description="Monitor order payment and fulfillment state across vendors.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminOrdersMonitoringTable />
    </div>
  );
}
