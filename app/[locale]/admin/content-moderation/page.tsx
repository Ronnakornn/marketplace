import { AdminContentModerationQueues } from "#/features/admin/components/AdminContentModerationQueues";
import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminSpaceCat } from "#/features/admin/components/AdminSpaceCat";

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
