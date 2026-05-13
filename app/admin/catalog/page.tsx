import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AdminCatalogManager } from "#/features/catalog";

export default function AdminCatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Catalog"
        title="Manage marketplace catalog"
        description="Create products, maintain variants, and update inventory without entering checkout workflows."
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminCatalogManager />
    </div>
  );
}
