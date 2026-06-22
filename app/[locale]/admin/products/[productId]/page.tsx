import { AdminPageIntro, AdminProductModerationDetail } from "#/features/admin";

interface AdminProductModerationRouteProps {
  params: Promise<{
    productId: string;
  }>;
}

export default async function AdminProductModerationRoute({ params }: AdminProductModerationRouteProps) {
  const { productId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Moderation"
        title="Product review"
        description="Inspect product readiness, shop context, inventory, and moderation history before taking action."
      />
      <AdminProductModerationDetail productId={productId} />
    </div>
  );
}
