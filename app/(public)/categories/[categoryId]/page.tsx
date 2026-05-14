import { ProductListingPage } from "#/features/product";

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  return <ProductListingPage mode="category" categoryId={categoryId} />;
}
