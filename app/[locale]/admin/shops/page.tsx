import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminSellerApplicationsTable } from "#/features/admin/components/AdminSellerApplicationsTable";
import { AdminShopsTable } from "#/features/admin/components/AdminOperationsTables";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";

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
