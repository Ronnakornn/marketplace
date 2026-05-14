import { AdminPageIntro, AdminProductsModerationTable, AdminSpaceCat } from "#/features/admin";

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Moderation" title="Products" description="Moderate product visibility across all marketplace shops.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminProductsModerationTable />
    </div>
  );
}
