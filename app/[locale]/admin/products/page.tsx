import { AdminPageIntro, AdminProductsModerationTable, AdminSpaceCat } from "#/features/admin";

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
