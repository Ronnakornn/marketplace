import { AdminAffiliatesTable, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminAffiliatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Creator Network"
        title="Manage affiliate accounts"
        description="Review creator tracking activity and disable accounts that should not generate new attribution."
      >
        <AdminSpaceCat mode="users" />
      </AdminPageIntro>
      <AdminAffiliatesTable />
    </div>
  );
}
