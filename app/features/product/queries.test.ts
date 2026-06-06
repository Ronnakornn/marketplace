import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  cleanAdminProductListInput,
  cleanPublicProductListApiInput,
  cleanPublicProductListInput,
  cleanSellerProductListInput,
  invalidateAffiliateProductTargetQueries,
  invalidateAdminProductQueries,
  invalidateProductMutationQueries,
  invalidatePublicProductQueries,
  invalidateSellerProductQueries,
  normalizePublicProducts,
  normalizePublicProduct,
  normalizePublicProductRatingSummary,
  normalizePublicProductReviews,
  normalizeAffiliateProductTargets,
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
      inStock: true,
      freeShipping: true,
      onSale: true,
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
        inStock: true,
        freeShipping: true,
        onSale: true,
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

  it("keeps client-only listing filters out of the catalog API query", () => {
    expect(cleanPublicProductListApiInput({
      locale: "th",
      q: "shirt",
      categoryId: "fashion",
      shopId: "shop-1",
      minPrice: "100",
      maxPrice: "900",
      rating: 4,
      inStock: true,
      freeShipping: true,
      onSale: true,
      sort: "price_asc",
      cursor: "cursor-1",
      page: 2,
      limit: 24,
    })).toEqual({
      locale: "th",
      q: "shirt",
      categoryId: "fashion",
      shopId: "shop-1",
      minPrice: "100",
      maxPrice: "900",
      cursor: "cursor-1",
      limit: 24,
    });
  });

  it("includes protected product list inputs without sharing namespaces", () => {
    expect(productQueryKeys.seller.list({ q: "bag", status: "ACTIVE", cursor: "next", limit: 12 })).toEqual([
      "product",
      "seller",
      "lists",
      { q: "bag", status: "ACTIVE", cursor: "next", limit: 12 },
    ]);
    expect(productQueryKeys.admin.list({ q: "bag", status: "DRAFT", page: 3, limit: 25 })).toEqual([
      "product",
      "admin",
      "lists",
      { q: "bag", status: "DRAFT", page: 3, limit: 25 },
    ]);
    expect(productQueryKeys.affiliate.productTargets({ q: "bag", limit: 8 })).toEqual([
      "product",
      "affiliate",
      "product-targets",
      { q: "bag", limit: 8 },
    ]);
  });

  it("uses separate public list, search, detail, category, and shop product keys", () => {
    expect(productQueryKeys.public.list({ locale: "en" }).slice(0, 3)).toEqual(["product", "public", "lists"]);
    expect(productQueryKeys.public.search({ locale: "en", q: "bag" }).slice(0, 3)).toEqual(["product", "public", "searches"]);
    expect(productQueryKeys.public.detail({ locale: "en", productId: "product-1" }).slice(0, 3)).toEqual(["product", "public", "details"]);
    expect(productQueryKeys.public.categories({ locale: "en" }).slice(0, 3)).toEqual(["product", "public", "categories"]);
    expect(productQueryKeys.public.shopProducts({ locale: "en", shopId: "shop-1" }).slice(0, 3)).toEqual(["product", "public", "shop-products"]);
  });

  it("keys public review resources by product", () => {
    expect(productQueryKeys.public.reviews("product-1")).toEqual(["product", "public", "reviews", "product-1"]);
    expect(productQueryKeys.public.ratingSummary("product-1")).toEqual(["product", "public", "rating-summary", "product-1"]);
  });

  it("keys public search by the normalized search endpoint input", () => {
    expect(productQueryKeys.public.search({
      locale: "th",
      q: "camera",
      categoryId: "electronics",
      shopId: "shop-1",
      minPrice: 100,
      maxPrice: 900,
      rating: 4,
      inStock: true,
      freeShipping: true,
      onSale: true,
      sort: "relevance",
      cursor: "ignored-by-search",
      page: 3,
    })).toEqual([
      "product",
      "public",
      "searches",
      {
        locale: "th",
        q: "camera",
        categoryId: "electronics",
        shopId: "shop-1",
        minPrice: 100,
        maxPrice: 900,
        rating: 4,
        inStock: true,
        freeShipping: true,
        onSale: true,
        sort: "newest",
        page: 3,
        limit: 40,
      },
    ]);
  });
});

describe("public product review normalization", () => {
  it("normalizes review cards and keeps only returned public media URLs", () => {
    const reviews = normalizePublicProductReviews([{
      id: "review-1",
      userName: "Jane Buyer",
      rating: 5,
      comment: "Great fit",
      createdAt: "2026-01-02T03:04:05.000Z",
      media: [
        { id: "media-1", type: "IMAGE", url: "/uploads/review_image/review-1/a.jpg", altText: "front", sortOrder: 1 },
        { id: "media-2", type: "IMAGE", url: "https://storage.example/review-1/b.jpg?X-Amz-Signature=secret", altText: "private", sortOrder: 2 },
      ],
      snapshot: {
        productTitle: "Variant Product",
        variantTitle: "Red / M",
        variantSku: "RED-M",
        shopName: "Demo Shop",
      },
    }]);

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      reviewerName: "Jane Buyer",
      rating: 5,
      comment: "Great fit",
      createdAt: "2026-01-02T03:04:05.000Z",
      snapshot: {
        productTitle: "Variant Product",
        variantTitle: "Red / M",
        variantSku: "RED-M",
        shopName: "Demo Shop",
      },
    });
    expect(reviews[0]?.media).toEqual([{
      id: "media-1",
      type: "IMAGE",
      url: "/uploads/review_image/review-1/a.jpg",
      altText: "front",
      sortOrder: 1,
    }]);
  });

  it("normalizes rating summaries and derives totals when needed", () => {
    expect(normalizePublicProductRatingSummary({
      averageRating: "4.25",
      totalReviewCount: "8",
      distribution: { 5: 4, 4: 2, 3: 1, 2: 1, 1: 0 },
    })).toEqual({
      averageRating: 4.25,
      totalReviewCount: 8,
      distribution: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 4 },
    });
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

  it("invalidates named seller, admin, and affiliate product keys", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    await invalidateSellerProductQueries(queryClient, { productId: "product-1" });
    await invalidateAdminProductQueries(queryClient, { productId: "product-1" });
    await invalidateAffiliateProductTargetQueries(queryClient);

    const invalidatedKeys = invalidateQueries.mock.calls.map(([input]) => input?.queryKey);
    expect(invalidatedKeys).toContainEqual(productQueryKeys.seller.detail("product-1"));
    expect(invalidatedKeys).toContainEqual(productQueryKeys.admin.detail("product-1"));
    expect(invalidatedKeys).toContainEqual(productQueryKeys.admin.catalogDetail("product-1"));
    expect(invalidatedKeys).toContainEqual(productQueryKeys.affiliate.all());
  });
});

describe("affiliate product target normalization", () => {
  it("normalizes affiliate product targets from the shared product target response", () => {
    expect(normalizeAffiliateProductTargets({
      items: [
        { id: "product-1", label: "Camera", description: "Mirrorless", type: "product" },
        { id: "product-2", label: "", description: "", type: "product" },
      ],
    })).toEqual([
      { id: "product-1", label: "Camera", description: "Mirrorless", type: "product" },
      { id: "product-2", label: "Untitled", description: null, type: "product" },
    ]);
  });
});

describe("public product normalization", () => {
  it("extracts image URLs from API product image records", () => {
    const products = normalizePublicProducts({
      data: [{
        id: "product-1",
        title: "Image-backed product",
        shop: { id: "shop-1", name: "Image Shop" },
        variants: [],
        images: [
          { id: "image-1", url: "/uploads/product_image/product-1/main.avif", isPrimary: true },
          { id: "image-2", url: "https://example.com/side.jpg", isPrimary: false },
        ],
      }],
    } as unknown as Parameters<typeof normalizePublicProducts>[0]);

    expect(products[0]?.images).toEqual([
      "/uploads/product_image/product-1/main.avif",
      "https://example.com/side.jpg",
    ]);
  });

  it("normalizes video, option axes, variant option values, price range, and available stock", () => {
    const product = normalizePublicProduct({
      id: "product-1",
      title: "Variant-ready product",
      minPrice: "1200",
      maxPrice: "1500",
      shop: { id: "shop-1", name: "Shop" },
      originalPrice: "2000",
      freeShipping: true,
      video: { url: "/uploads/product_video/product-1/demo.mp4", contentType: "video/mp4", fileName: "demo.mp4" },
      options: [{
        id: "option-color",
        name: "Color",
        values: [{ id: "value-red", value: "Red", colorHex: "#ff0000" }],
      }],
      variants: [{
        id: "variant-1",
        title: "Red",
        sku: "RED-1",
        price: "1200",
        currency: "THB",
        inventory: { quantityOnHand: 4, quantityReserved: 1 },
        optionValues: [{
          optionValueId: "value-red",
          optionValue: {
            id: "value-red",
            value: "Red",
            colorHex: "#ff0000",
            option: { id: "option-color", name: "Color" },
          },
        }],
      }],
    } as unknown as Parameters<typeof normalizePublicProduct>[0]);

    expect(product.minPrice).toBe(1200);
    expect(product.maxPrice).toBe(1500);
    expect(product.stock).toBe(3);
    expect(product.originalPrice).toBe(2000);
    expect(product.discountPercent).toBe(40);
    expect(product.badges).toContain("Free Shipping");
    expect(product.video?.url).toBe("/uploads/product_video/product-1/demo.mp4");
    expect(product.options[0]?.values[0]?.value).toBe("Red");
    expect(product.variants[0]?.optionValues[0]).toMatchObject({
      optionId: "option-color",
      valueId: "value-red",
      value: "Red",
    });
  });
});
