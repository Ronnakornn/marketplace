import { AdminOrdersMonitoringTable, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.orders.eyebrow" title="admin.pages.orders.title" description="admin.pages.orders.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminOrdersMonitoringTable />
    </div>
  );
}
