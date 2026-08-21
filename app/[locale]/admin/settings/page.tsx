import { AdminPageIntro, AdminSettingsManager, AdminSpaceCat } from "#/features/admin";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.settings.eyebrow" title="admin.pages.settings.title" description="admin.pages.settings.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminSettingsManager />
    </div>
  );
}
