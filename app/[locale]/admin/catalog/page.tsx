import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AdminCatalogManager } from "#/features/catalog";

export default function AdminCatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Catalog"
        title="Catalog operations"
        description="Review product visibility, pricing coverage, and shop ownership from a production-ready catalog console."
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminCatalogManager />
    </div>
  );
}
