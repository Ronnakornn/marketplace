import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AdminCategorySpecsManager } from "#/features/catalog";

export default function AdminCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Catalog"
        title="Categories & specs"
        description="Review active category structure and prepare product spec definitions for seller publish readiness."
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminCategorySpecsManager />
    </div>
  );
}
