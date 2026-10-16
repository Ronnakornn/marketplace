import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";
import { AdminProductModerationDetail } from "#/features/admin/components/AdminProductModerationDetail";

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
        eyebrow="admin.pages.productReview.eyebrow"
        title="admin.pages.productReview.title"
        description="admin.pages.productReview.description"
      />
      <AdminProductModerationDetail productId={productId} />
    </div>
  );
}
