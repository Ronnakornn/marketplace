import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminProductsModerationTable } from "#/features/admin/components/AdminOperationsTables";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.products.eyebrow" title="admin.pages.products.title" description="admin.pages.products.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminProductsModerationTable />
    </div>
  );
}
