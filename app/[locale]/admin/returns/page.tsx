import { AdminPageIntro, AdminReturnsTable } from "#/features/admin";

export default function AdminReturnsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.returns.eyebrow" title="admin.pages.returns.title" description="admin.pages.returns.description" />
      <AdminReturnsTable />
    </div>
  );
}
