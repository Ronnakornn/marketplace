import { ProductListingPage } from "#/features/product";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    keyword?: string;
    categoryId?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    rating?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <ProductListingPage
      mode="search"
      query={params.q ?? params.keyword ?? ""}
      categoryId={params.categoryId}
      minPrice={params.minPrice}
      maxPrice={params.maxPrice}
      sort={params.sort}
      rating={params.rating}
    />
  );
}
