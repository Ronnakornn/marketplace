import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AdminCategorySpecsManager } from "#/features/catalog";

export default function AdminCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="admin.pages.categories.eyebrow"
        title="admin.pages.categories.title"
        description="admin.pages.categories.description"
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminCategorySpecsManager />
    </div>
  );
}
