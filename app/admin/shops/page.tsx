import { AdminPageIntro, AdminShopsTable, AdminSpaceCat } from "#/features/admin";

export default function AdminShopsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Marketplace Operations" title="Shops" description="Review seller storefront status and ownership signals.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminShopsTable />
    </div>
  );
}
