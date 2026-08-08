import { AdminPageIntro, AdminSellerApplicationsTable, AdminShopsTable, AdminSpaceCat } from "#/features/admin";

export default function AdminShopsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.shops.eyebrow" title="admin.pages.shops.title" description="admin.pages.shops.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminSellerApplicationsTable />
      <AdminShopsTable />
    </div>
  );
}
