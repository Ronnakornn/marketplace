import { AdminContentModerationQueues, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminContentModerationPage() {
  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="admin.pages.contentModeration.eyebrow"
        title="admin.pages.contentModeration.title"
        description="admin.pages.contentModeration.description"
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminContentModerationQueues />
    </div>
  );
}
