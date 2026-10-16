import { AdminTaxPolicyEditor } from "#/features/admin/components/AdminTaxPolicyEditor";
import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminSettingsManager } from "#/features/admin/components/AdminConfigurationTables";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.settings.eyebrow" title="admin.pages.settings.title" description="admin.pages.settings.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminTaxPolicyEditor />
      <AdminSettingsManager />
    </div>
  );
}
