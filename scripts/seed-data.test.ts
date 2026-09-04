import { describe, expect, it } from "vitest";
import { bootstrapBrands, bootstrapCategories, validateBootstrapMasterSeedData } from "./seed-bootstrap-master.ts";
import { demoCatalogSellers, validateDemoCatalogSeedData } from "./seed-demo-catalog.ts";
import { buildDemoNotificationSeeds } from "./seed-notification-data.ts";

describe("seed data definitions", () => {
  it("keeps bootstrap master data stable and valid", () => {
    expect(() => validateBootstrapMasterSeedData()).not.toThrow();
    expect(bootstrapCategories.length).toBeGreaterThanOrEqual(10);
    expect(bootstrapBrands.every((brand) => brand.logoUrl && brand.countryCode && brand.code)).toBe(true);
  });

  it("covers enriched demo catalog data for buyer brand and spec surfaces", () => {
    expect(() => validateDemoCatalogSeedData()).not.toThrow();

    const products = demoCatalogSellers.flatMap((seller) => seller.products);
    expect(products.length).toBeGreaterThanOrEqual(4);
    expect(products.every((product) => product.brandSlug && product.images.length > 0)).toBe(true);
    expect(products.every((product) => product.highlights.length > 0 && product.attributes.length > 0)).toBe(true);
    expect(products.some((product) => product.attributes.some((attribute) => attribute.isFilterable))).toBe(true);
    expect(products.every((product) => product.variants.length > 0)).toBe(true);
  });

  it("keeps seeded order notifications actionable", () => {
    const notifications = buildDemoNotificationSeeds({
      sellerEmail: "seller@example.com",
      paidOrder: { id: "paid-order", orderNumber: "DEMO-PAID" },
      deliveredOrder: { id: "delivered-order", orderNumber: "DEMO-DELIVERED" },
    });

    expect(notifications.every(([, , , data]) => "orderId" in data || "targetPath" in data)).toBe(true);
  });
});
