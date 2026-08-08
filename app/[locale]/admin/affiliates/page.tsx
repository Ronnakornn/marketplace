import { AdminAffiliatesTable, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminAffiliatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="admin.pages.affiliates.eyebrow"
        title="admin.pages.affiliates.title"
        description="admin.pages.affiliates.description"
      >
        <AdminSpaceCat mode="users" />
      </AdminPageIntro>
      <AdminAffiliatesTable />
    </div>
  );
}
