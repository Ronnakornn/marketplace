import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  cleanAdminProductListInput,
  cleanPublicProductListInput,
  cleanSellerProductListInput,
  invalidateProductMutationQueries,
  invalidatePublicProductQueries,
  productQueryKeys,
} from "./queries";

describe("product query keys", () => {
  it("includes public product discovery inputs that change results", () => {
    expect(productQueryKeys.public.list({
      locale: "th",
      q: "shirt",
      categoryId: "fashion",
      shopId: "shop-1",
      minPrice: "100",
      maxPrice: "900",
      rating: 4,
      sort: "price_asc",
      cursor: "cursor-1",
      page: 2,
      limit: 24,
    })).toEqual([
      "product",
      "public",
      "lists",
      {
        locale: "th",
        q: "shirt",
        categoryId: "fashion",
        shopId: "shop-1",
        minPrice: "100",
        maxPrice: "900",
        rating: 4,
        sort: "price_asc",
        cursor: "cursor-1",
        page: 2,
        limit: 24,
      },
    ]);
  });

  it("keeps public, seller, admin, and affiliate keys in separate namespaces", () => {
    const sharedFilter = { q: "shirt", limit: 20 };

    expect(productQueryKeys.public.list(sharedFilter)[1]).toBe("public");
    expect(productQueryKeys.seller.list(sharedFilter)[1]).toBe("seller");
    expect(productQueryKeys.admin.list(sharedFilter)[1]).toBe("admin");
    expect(productQueryKeys.affiliate.productTargets(sharedFilter)[1]).toBe("affiliate");
    expect(productQueryKeys.public.list(sharedFilter)).not.toEqual(productQueryKeys.seller.list(sharedFilter));
    expect(productQueryKeys.seller.list(sharedFilter)).not.toEqual(productQueryKeys.admin.list(sharedFilter));
  });

  it("normalizes empty values and applies audience-specific page sizes", () => {
    expect(cleanPublicProductListInput({ q: "", locale: "en" })).toEqual({ locale: "en", limit: 40 });
    expect(cleanSellerProductListInput({ status: "", categoryId: "cat-1" })).toEqual({ categoryId: "cat-1", limit: 20 });
    expect(cleanAdminProductListInput({ q: "hat" })).toEqual({ q: "hat", limit: 50 });
  });

  it("uses separate public list, search, detail, category, and shop product keys", () => {
    expect(productQueryKeys.public.list({ locale: "en" }).slice(0, 3)).toEqual(["product", "public", "lists"]);
    expect(productQueryKeys.public.search({ locale: "en", q: "bag" }).slice(0, 3)).toEqual(["product", "public", "searches"]);
    expect(productQueryKeys.public.detail({ locale: "en", productId: "product-1" }).slice(0, 3)).toEqual(["product", "public", "details"]);
    expect(productQueryKeys.public.categories({ locale: "en" }).slice(0, 3)).toEqual(["product", "public", "categories"]);
    expect(productQueryKeys.public.shopProducts({ locale: "en", shopId: "shop-1" }).slice(0, 3)).toEqual(["product", "public", "shop-products"]);
  });
});

describe("product query invalidation helpers", () => {
  it("invalidates public product lists, searches, and the targeted detail key", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    await invalidatePublicProductQueries(queryClient, { productId: "product-1", locale: "th" });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: productQueryKeys.public.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: productQueryKeys.public.searches() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: productQueryKeys.public.detail({ productId: "product-1", locale: "th" }),
    });
  });

  it("does not invalidate public keys for private-only product mutations", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    await invalidateProductMutationQueries(queryClient, { productId: "product-1" });

    const invalidatedKeys = invalidateQueries.mock.calls.map(([input]) => input?.queryKey);
    expect(invalidatedKeys).toContainEqual(productQueryKeys.seller.lists());
    expect(invalidatedKeys).toContainEqual(productQueryKeys.admin.lists());
    expect(invalidatedKeys).not.toContainEqual(productQueryKeys.public.lists());
  });
});
