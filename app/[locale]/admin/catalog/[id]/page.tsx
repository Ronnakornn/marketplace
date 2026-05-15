import { AdminCatalogEditPage } from "#/features/catalog";

interface AdminCatalogEditRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminCatalogEditRoute({ params }: AdminCatalogEditRouteProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <AdminCatalogEditPage productId={id} />
    </div>
  );
}
