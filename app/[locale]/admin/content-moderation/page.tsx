import { AdminContentModerationQueues, AdminPageIntro, AdminSpaceCat } from "#/features/admin";

export default function AdminContentModerationPage() {
  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Moderation"
        title="Content Moderation"
        description="Review customer reviews, review reports, product questions, and answers before they affect public marketplace trust."
      >
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AdminContentModerationQueues />
    </div>
  );
}
