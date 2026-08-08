import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AdminCatalogManager } from "#/features/catalog";

export default function AdminCatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="admin.pages.catalog.eyebrow"
        title="admin.pages.catalog.title"
        description="admin.pages.catalog.description"
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminCatalogManager />
    </div>
  );
}
