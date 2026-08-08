import { AdminPageIntro, AdminReportsOverview } from "#/features/admin";

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.reports.eyebrow" title="admin.pages.reports.title" description="admin.pages.reports.description" />
      <AdminReportsOverview />
    </div>
  );
}
