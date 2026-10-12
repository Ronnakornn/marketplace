import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Brand, PrismaClient, Product, Shop, User } from "#generated/client/client.ts";
import { assertUatDatabase, assetPath, calculateUatTotals, uatId, UAT_ACCOUNTS, UAT_SHOPS, validateCatalog } from "./uat-data.ts";
import type { UatProduct } from "./uat-data.ts";
import { seedUat } from "./seed-uat.ts";
import { assertPolicyOneArithmetic } from "./verify-uat.ts";
import type { PolicyOneArithmetic } from "./verify-uat.ts";

function catalog() { return JSON.parse(readFileSync(resolve(process.cwd(), "scripts/uat/catalog.json"), "utf8")); }
function validate(raw: unknown) { return validateCatalog(raw, process.cwd(), () => true); }

function existingUatDatabase(products: UatProduct[]) {
  const users = new Map<string, Pick<User, "id" | "email">>(UAT_ACCOUNTS.map((fixture) => [fixture.email, { id: uatId(`user:${fixture.email}`), ...fixture }]));
  const shops = new Map<string, Pick<Shop, "id" | "slug" | "name" | "ownerId" | "sellerProfileId">>(UAT_SHOPS.map((fixture) => {
    const id = uatId(`shop:${fixture.slug}`);
    return [id, { id, slug: `edited-${fixture.slug}`, name: "Tester shop", ownerId: uatId(`user:${fixture.ownerEmail}`), sellerProfileId: uatId(`seller:${fixture.slug}`) }];
  }));
  const brands = new Map<string, Pick<Brand, "id" | "slug" | "name">>(UAT_SHOPS.map((fixture) => {
    const id = uatId(`brand:${fixture.slug}`);
    return [id, { id, slug: `edited-${fixture.slug}`, name: "Tester brand" }];
  }));
  const listings = new Map<string, Pick<Product, "id" | "slug" | "title" | "shopId" | "sellerProfileId">>(products.map((fixture) => {
    const id = uatId(`product:${fixture.slug}`);
    return [id, { id, slug: `edited-${fixture.slug}`, title: "Tester product", shopId: uatId(`shop:${fixture.shopSlug}`), sellerProfileId: uatId(`seller:${fixture.shopSlug}`) }];
  }));
  function create<T extends { id: string }>(rows: Map<string, T>, data: T) {
    if (rows.has(data.id)) throw new Error("Duplicate fixture ID");
    rows.set(data.id, data);
    return data;
  }
  const tx = {
    $executeRaw: async () => 0,
    user: { findUnique: async ({ where }: { where: { email: string } }) => users.get(where.email) ?? null },
    account: { findUnique: async () => ({ id: "existing-credential" }) },
    sellerProfile: { upsert: async () => ({}) },
    shop: {
      findUnique: async ({ where }: { where: { id: string } }) => shops.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { slug: string } }) => [...shops.values()].find((row) => row.slug === where.slug) ?? null,
      create: async ({ data }: { data: Pick<Shop, "id" | "slug" | "name" | "ownerId" | "sellerProfileId"> }) => create(shops, data),
    },
    category: { upsert: async ({ create }: { create: { id: string; nameTh: string; nameEn: string } }) => create },
    brand: {
      findUnique: async ({ where }: { where: { id?: string; slug?: string } }) => where.id ? brands.get(where.id) ?? null : [...brands.values()].find((row) => row.slug === where.slug) ?? null,
      create: async ({ data }: { data: Pick<Brand, "id" | "slug" | "name"> }) => create(brands, data),
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => listings.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { shopId: string; slug: string } }) => [...listings.values()].find((row) => row.shopId === where.shopId && row.slug === where.slug) ?? null,
      create: async ({ data }: { data: Pick<Product, "id" | "slug" | "title" | "shopId" | "sellerProfileId"> }) => create(listings, data),
    },
    coupon: { upsert: async ({ create }: { create: { id: string } }) => create },
    order: { findUnique: async ({ where }: { where: { orderNumber: string } }) => ({ id: uatId(`order:${where.orderNumber}`) }) },
  };
  const db = { $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
  return { db, shops, brands, listings };
}

describe("UAT reruns after tester catalog edits", () => {
  it("preserves edited shop, brand and product slugs and fields", async () => {
    const products = validate(catalog());
    const state = existingUatDatabase(products);
    expect(await seedUat(state.db, products)).toEqual({ createdScenarios: [], accounts: 8, products: 20 });
    expect({ shops: state.shops.size, brands: state.brands.size, products: state.listings.size }).toEqual({ shops: 4, brands: 4, products: 20 });
    expect([...state.shops.values()][0]).toMatchObject({ slug: "edited-uat-fashion", name: "Tester shop" });
    expect([...state.brands.values()][0]).toMatchObject({ slug: "edited-uat-fashion", name: "Tester brand" });
    expect([...state.listings.values()][0]).toMatchObject({ slug: `edited-${products[0]!.slug}`, title: "Tester product" });
  });

  it.each(["shop", "brand", "product"])("rejects an unrelated %s claiming a missing fixture's slug", async (entity) => {
    const products = validate(catalog());
    const state = existingUatDatabase(products);
    if (entity === "shop") {
      const id = uatId("shop:uat-fashion");
      const row = state.shops.get(id)!;
      state.shops.delete(id);
      state.shops.set("unrelated-shop", { ...row, id: "unrelated-shop", slug: "uat-fashion" });
    } else if (entity === "brand") {
      state.brands.delete(uatId("brand:uat-fashion"));
      state.brands.set("unrelated-brand", { id: "unrelated-brand", slug: "uat-fashion", name: "Unrelated brand" });
    } else {
      const id = uatId(`product:${products[0]!.slug}`);
      const row = state.listings.get(id)!;
      state.listings.delete(id);
      state.listings.set("unrelated-product", { ...row, id: "unrelated-product", slug: products[0]!.slug });
    }
    await expect(seedUat(state.db, products)).rejects.toThrow(`UAT ${entity} slug`);
  });

  it.each(["shop owner", "shop profile", "product shop", "product profile"])("rejects inconsistent %s on the stable fixture ID", async (relationship) => {
    const products = validate(catalog());
    const state = existingUatDatabase(products);
    const shop = state.shops.get(uatId("shop:uat-fashion"))!;
    const product = state.listings.get(uatId(`product:${products[0]!.slug}`))!;
    if (relationship === "shop owner") shop.ownerId = "unrelated-user";
    if (relationship === "shop profile") shop.sellerProfileId = "unrelated-profile";
    if (relationship === "product shop") product.shopId = "unrelated-shop";
    if (relationship === "product profile") product.sellerProfileId = "unrelated-profile";
    await expect(seedUat(state.db, products)).rejects.toThrow(`UAT ${relationship.startsWith("shop") ? "shop" : "product"} ownership is inconsistent`);
  });
});

describe("UAT fixture boundary", () => {
  it("accepts the actual complete bilingual catalog", () => {
    expect(validate(catalog())).toHaveLength(20);
  });

  it.each(["79.00", "-79000", "079000", "7.9e4", "9007199254740992"])("rejects malformed or unsafe money %s", (money) => {
    const raw = catalog();
    raw[0].variants[0].priceMinor = money;
    expect(() => validate(raw)).toThrow();
  });

  it("rejects missing local images before seeding", () => {
    expect(() => validateCatalog(catalog(), process.cwd(), () => false)).toThrow("Missing asset");
  });

  it.each(["/uat/products/../secret.png", "https://example.test/image.webp", "/uat/products/83-1.webp?x=1", "/uat/products/83-1%2fsecret.webp"])("rejects unsafe asset path %s", (url) => {
    expect(() => assetPath(url)).toThrow("Invalid local UAT asset path");
  });

  it("rejects unknown catalog owners and duplicate SKUs", () => {
    const owner = catalog();
    owner[0].shopSlug = "other-shop";
    expect(() => validate(owner)).toThrow("Unknown shop");
    const duplicates = catalog();
    duplicates[1].variants[0].sku = duplicates[0].variants[0].sku;
    expect(() => validate(duplicates)).toThrow("Duplicate SKU");
  });

  it("rejects inactive scenario products and insufficient reserved stock", () => {
    const inactive = catalog();
    inactive[0].status = "DRAFT";
    expect(() => validate(inactive)).toThrow("needs active SKU");
    const insufficient = catalog();
    insufficient[0].variants[0].quantityOnHand = 2;
    expect(() => validate(insufficient)).toThrow("Insufficient fixture stock");
  });

  it("requires an explicit local database and rejects remote/production by default", () => {
    expect(() => assertUatDatabase({})).toThrow("DATABASE_URL is required");
    expect(() => assertUatDatabase({ DATABASE_URL: "postgresql://user:password@example.test/uat" })).toThrow("localhost");
    expect(() => assertUatDatabase({ DATABASE_URL: "postgresql://user:password@localhost/marketplace_prod" })).toThrow("production");
    expect(assertUatDatabase({ DATABASE_URL: "postgresql://user:password@localhost/sming" })).toBe("postgresql://user:password@localhost/sming");
    expect(assertUatDatabase({ DATABASE_URL: "postgresql://user:password@[::1]/sming" })).toContain("[::1]");
  });

  it("requires separate explicit opt-ins for remote and production", () => {
    const env = { DATABASE_URL: "postgresql://user:password@example.test/marketplace_prod" };
    expect(() => assertUatDatabase(env, ["--allow-remote"])).toThrow("production");
    expect(assertUatDatabase(env, ["--allow-remote", "--allow-production"])).toBe(env.DATABASE_URL);
  });

  it("uses stable distinct IDs across retries", () => {
    expect(uatId("order:UAT-PENDING-1001")).toBe("71e5e7f7-e069-5c62-8db7-66bb4eaad01f");
    expect(uatId("order:UAT-PAID-1002")).not.toBe(uatId("order:UAT-PENDING-1001"));
  });
});

describe("UAT exact money", () => {
  it("charges shipping once for each shop and preserves integer minor units", () => {
    expect(calculateUatTotals([
      { shopId: "a", unitPrice: 101n, quantity: 3 },
      { shopId: "a", unitPrice: 197n, quantity: 1 },
      { shopId: "b", unitPrice: 29000n, quantity: 2 },
    ])).toEqual({ subtotal: 58500n, discountTotal: 0n, shippingTotal: 8000n, taxTotal: 0n, includedTaxTotal: 0n, reportedTaxTotal: 0n, grandTotal: 66500n, currency: "THB" });
  });

  it("rejects invalid quantities and provider overflow", () => {
    expect(() => calculateUatTotals([{ shopId: "a", unitPrice: 100n, quantity: 0 }])).toThrow("Invalid UAT order line");
    expect(() => calculateUatTotals([{ shopId: "a", unitPrice: BigInt(Number.MAX_SAFE_INTEGER), quantity: 2 }])).toThrow("safe provider limit");
  });

  function sale(): PolicyOneArithmetic {
    const totals = { subtotal: 303n, discountTotal: 0n, shippingTotal: 4000n, taxTotal: 0n, includedTaxTotal: 0n, reportedTaxTotal: 0n, grandTotal: 4303n, currency: "THB" };
    return { order: { ...totals }, shops: [{
      shop: { id: "shop-order", shopId: "shop", ...totals },
      sale: { shopOrderId: "shop-order", policyVersion: 1, currency: "THB", commissionBase: 303n, commissionBps: 1000, originalCommission: 30n, originalShipping: 4000n, buyerShipping: 4000n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n },
      items: [{ item: { id: "item", shopId: "shop", quantity: 3, unitPrice: 101n, lineTotal: 303n, currency: "THB" }, sale: { orderItemId: "item", shopOrderId: "shop-order", originalQuantity: 3, grossMerchandise: 303n, sellerCouponDiscount: 0n, platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: 303n } }],
    }] };
  }

  it("accepts exact zero-tax snapshots and floors commission", () => {
    expect(() => assertPolicyOneArithmetic(sale())).not.toThrow();
  });

  it("rejects broken original funding, quantity, commission and shop ownership", () => {
    const funding = sale();
    funding.shops[0]!.items[0]!.sale.buyerMerchandise = 302n;
    expect(() => assertPolicyOneArithmetic(funding)).toThrow("funding");
    const quantity = sale();
    quantity.shops[0]!.items[0]!.sale.originalQuantity = 2;
    expect(() => assertPolicyOneArithmetic(quantity)).toThrow("original quantity");
    const fee = sale();
    fee.shops[0]!.sale.originalCommission = 31n;
    expect(() => assertPolicyOneArithmetic(fee)).toThrow("original commission");
    const owner = sale();
    owner.shops[0]!.items[0]!.item.shopId = "other-shop";
    expect(() => assertPolicyOneArithmetic(owner)).toThrow("ownership");
  });
});
