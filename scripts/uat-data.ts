import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { config } from "dotenv";
import sharp from "sharp";
import { z } from "zod";
import type { Prisma } from "#generated/client/client.ts";

export const UAT_PASSWORD = "UatPass123!";
export const UAT_SHIPPING = 4000n;
export const UAT_COMMISSION_BPS = 1000;
export const UAT_ACCOUNTS = [
  { email: "uat-admin@example.test", name: "UAT ผู้ดูแลระบบ", role: "ADMIN" },
  { email: "uat-finance@example.test", name: "UAT ผู้ตรวจสอบการเงิน", role: "ADMIN" },
  { email: "uat-buyer@example.test", name: "UAT ผู้ซื้อ", role: "USER" },
  { email: "uat-return@example.test", name: "UAT ผู้ซื้อคืนสินค้า", role: "USER" },
  { email: "uat-fashion@example.test", name: "UAT ผู้ขายแฟชั่น", role: "USER" },
  { email: "uat-gadget@example.test", name: "UAT ผู้ขายแกดเจ็ต", role: "USER" },
  { email: "uat-home@example.test", name: "UAT ผู้ขายบ้าน", role: "USER" },
  { email: "uat-beauty@example.test", name: "UAT ผู้ขายความงาม", role: "USER" },
] as const satisfies ReadonlyArray<Required<Pick<Prisma.UserCreateManyInput, "email" | "name" | "role">>>;

export const UAT_SHOPS = [
  { slug: "uat-fashion", nameEn: "UAT Fashion", nameTh: "ยูเอที แฟชั่น", ownerEmail: "uat-fashion@example.test" },
  { slug: "uat-gadget", nameEn: "UAT Gadget", nameTh: "ยูเอที แกดเจ็ต", ownerEmail: "uat-gadget@example.test" },
  { slug: "uat-home", nameEn: "UAT Home", nameTh: "ยูเอที บ้านและครัว", ownerEmail: "uat-home@example.test" },
  { slug: "uat-beauty", nameEn: "UAT Beauty", nameTh: "ยูเอที ความงาม", ownerEmail: "uat-beauty@example.test" },
] as const;

export const UAT_CATEGORIES = [
  { slug: "fashion", nameEn: "Fashion", nameTh: "แฟชั่น" },
  { slug: "electronics", nameEn: "Electronics", nameTh: "อิเล็กทรอนิกส์" },
  { slug: "gadgets", nameEn: "Gadgets", nameTh: "แกดเจ็ต" },
  { slug: "home", nameEn: "Home", nameTh: "บ้าน" },
  { slug: "beauty", nameEn: "Beauty", nameTh: "ความงาม" },
] as const;

const minorUnitSchema = z.string().regex(/^(0|[1-9][0-9]*)$/, "Money must be canonical integer satang text")
  .refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), "UAT checkout money exceeds the safe provider limit");
const positiveInt = z.number().int().positive().max(2_147_483_647);
const quantity = z.number().int().nonnegative().max(2_147_483_647);
const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const catalogSchema = z.array(z.object({
  sourceId: positiveInt,
  slug,
  titleEn: text,
  titleTh: text,
  descriptionEn: text,
  descriptionTh: text,
  shopSlug: slug,
  categorySlug: slug,
  brandSlug: slug,
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
  variants: z.array(z.object({ sku: text, titleEn: text, titleTh: text, priceMinor: minorUnitSchema, quantityOnHand: quantity, reorderLevel: quantity })).min(1),
  images: z.array(z.object({ url: text, sourceUrl: z.url(), width: positiveInt, height: positiveInt })).min(1),
})).min(1).max(100);
export type UatProduct = z.infer<typeof catalogSchema>[number];

type ScenarioState = Pick<Prisma.OrderCreateManyInput, "status" | "paymentStatus"> & {
  checkoutStatus: Prisma.CheckoutCreateManyInput["status"];
  reservationStatus: Prisma.InventoryReservationCreateManyInput["status"];
  fulfillmentStatus: Prisma.OrderItemCreateManyInput["fulfillmentStatus"];
  shipmentStatus: Prisma.ShipmentCreateManyInput["status"] | null;
};
const lifecycle = {
  pending: { status: "PENDING_PAYMENT", paymentStatus: "PENDING", checkoutStatus: "PAYMENT_PENDING", reservationStatus: "ACTIVE", fulfillmentStatus: "PENDING", shipmentStatus: null },
  paid: { status: "PAID", paymentStatus: "SUCCEEDED", checkoutStatus: "COMPLETED", reservationStatus: "COMMITTED", fulfillmentStatus: "PENDING", shipmentStatus: "PENDING_PACK" },
  shipped: { status: "SHIPPED", paymentStatus: "SUCCEEDED", checkoutStatus: "COMPLETED", reservationStatus: "COMMITTED", fulfillmentStatus: "SHIPPED", shipmentStatus: "SHIPPED" },
  delivered: { status: "DELIVERED", paymentStatus: "SUCCEEDED", checkoutStatus: "COMPLETED", reservationStatus: "COMMITTED", fulfillmentStatus: "DELIVERED", shipmentStatus: "DELIVERED" },
  failed: { status: "CANCELED", paymentStatus: "FAILED", checkoutStatus: "CANCELED", reservationStatus: "RELEASED", fulfillmentStatus: "CANCELED", shipmentStatus: null },
} as const satisfies Record<string, ScenarioState>;

export const UAT_SCENARIOS = [
  { orderNumber: "UAT-PENDING-1001", stage: "pending", buyerEmail: "uat-buyer@example.test", lines: [{ sku: "UAT-83-1", quantity: 1 }, { sku: "UAT-100-1", quantity: 1 }] },
  { orderNumber: "UAT-PAID-1002", stage: "paid", buyerEmail: "uat-buyer@example.test", lines: [{ sku: "UAT-83-1", quantity: 1 }, { sku: "UAT-100-1", quantity: 1 }] },
  { orderNumber: "UAT-SHIPPED-1003", stage: "shipped", buyerEmail: "uat-buyer@example.test", lines: [{ sku: "UAT-83-1", quantity: 1 }, { sku: "UAT-100-1", quantity: 1 }] },
  { orderNumber: "UAT-DELIVERED-1004", stage: "delivered", buyerEmail: "uat-return@example.test", lines: [{ sku: "UAT-43-1", quantity: 3 }, { sku: "UAT-1-1", quantity: 2 }] },
  { orderNumber: "UAT-FAILED-1005", stage: "failed", buyerEmail: "uat-buyer@example.test", lines: [{ sku: "UAT-83-1", quantity: 1 }] },
] as const;
export type UatScenario = typeof UAT_SCENARIOS[number];
export function scenarioState(scenario: UatScenario) { return lifecycle[scenario.stage]; }

export function uatId(label: string): string {
  const bytes = createHash("sha256").update(`marketplace:uat:v1:${label}`).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function assetPath(url: string, projectRoot = process.cwd()): string {
  if (!/^\/uat\/(products|shops|brands|reviews)\/[a-z0-9-]+\.(webp|png|svg)$/.test(url)) {
    throw new Error(`Invalid local UAT asset path ${url}`);
  }
  const publicRoot = resolve(projectRoot, "public");
  const target = resolve(publicRoot, url.slice(1));
  if (!target.startsWith(`${publicRoot}${sep}`)) throw new Error("UAT asset must stay inside public");
  return target;
}

export const UAT_REVIEW_ASSETS = ["/uat/reviews/review-home.webp", "/uat/reviews/review-beauty.webp"] as const;
export function validateCatalog(raw: unknown, projectRoot = process.cwd(), fileExists: (path: string) => boolean = existsSync): UatProduct[] {
  const products = catalogSchema.parse(raw);
  const productKeys = new Set<string>();
  const sourceIds = new Set<number>();
  const skus = new Set<string>();
  const imageUrls = new Set<string>();
  for (const product of products) {
    if (!UAT_SHOPS.some((shop) => shop.slug === product.shopSlug)) throw new Error(`Unknown shop ${product.shopSlug}`);
    if (!UAT_SHOPS.some((shop) => shop.slug === product.brandSlug)) throw new Error(`Unknown brand ${product.brandSlug}`);
    if (!UAT_CATEGORIES.some((category) => category.slug === product.categorySlug)) throw new Error(`Unknown category ${product.categorySlug}`);
    if (productKeys.has(product.slug) || sourceIds.has(product.sourceId)) throw new Error(`Duplicate product ${product.slug}`);
    productKeys.add(product.slug);
    sourceIds.add(product.sourceId);
    for (const variant of product.variants) {
      if (skus.has(variant.sku)) throw new Error(`Duplicate SKU ${variant.sku}`);
      skus.add(variant.sku);
    }
    for (const image of product.images) {
      if (!image.url.startsWith(`/uat/products/${product.sourceId}-`)) throw new Error(`Image does not match source product ${product.sourceId}`);
      if (imageUrls.has(image.url)) throw new Error(`Duplicate image ${image.url}`);
      imageUrls.add(image.url);
      if (!fileExists(assetPath(image.url, projectRoot))) throw new Error(`Missing asset ${image.url}; run bun run uat:assets`);
    }
  }
  for (const scenario of UAT_SCENARIOS) for (const line of scenario.lines) {
    const product = products.find((candidate) => candidate.variants.some((variant) => variant.sku === line.sku));
    if (!product || product.status !== "ACTIVE") throw new Error(`Scenario ${scenario.orderNumber} needs active SKU ${line.sku}`);
    const variant = product.variants.find((candidate) => candidate.sku === line.sku)!;
    const needed = UAT_SCENARIOS.reduce((sum, fixture) => sum + fixture.lines.filter((item) => item.sku === line.sku && fixture.stage !== "failed").reduce((quantity, item) => quantity + item.quantity, 0), 0);
    if (variant.quantityOnHand < needed) throw new Error(`Insufficient fixture stock ${line.sku}`);
  }
  return products;
}

export async function loadUatData(projectRoot = process.cwd()): Promise<UatProduct[]> {
  const manifest = resolve(projectRoot, "scripts/uat/catalog.json");
  if (!existsSync(manifest)) throw new Error("Missing scripts/uat/catalog.json; run bun run uat:assets");
  const products = validateCatalog(JSON.parse(readFileSync(manifest, "utf8")), projectRoot);
  const images = products.flatMap((product) => product.images);
  for (const image of images) {
    const metadata = await sharp(assetPath(image.url, projectRoot)).metadata();
    if (metadata.width !== image.width || metadata.height !== image.height) throw new Error(`Image dimensions mismatch ${image.url}`);
    if (metadata.format !== "webp" && metadata.format !== "png") throw new Error(`Invalid image format ${image.url}`);
  }
  for (const url of UAT_REVIEW_ASSETS) {
    const metadata = await sharp(assetPath(url, projectRoot)).metadata();
    if (!metadata.width || !metadata.height || metadata.format !== "webp") throw new Error(`Invalid review image ${url}`);
  }
  for (const shop of UAT_SHOPS) for (const url of [`/uat/shops/${shop.slug}-logo.svg`, `/uat/shops/${shop.slug}-cover.svg`, `/uat/brands/${shop.slug}.svg`]) {
    const path = assetPath(url, projectRoot);
    if (!existsSync(path) || statSync(path).size === 0 || !readFileSync(path, "utf8").includes("<svg")) throw new Error(`Missing or invalid SVG ${url}`);
  }
  return products;
}

export function loadUatEnvironment(projectRoot = process.cwd()): void {
  config({ path: [resolve(projectRoot, ".env.local"), resolve(projectRoot, ".env")], quiet: true, override: false });
}

export function assertUatDatabase(env: Record<string, string | undefined>, args: readonly string[] = []): string {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for UAT; configure the local project database");
  let url: URL;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error("DATABASE_URL is invalid"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || url.pathname === "/" || !url.pathname) throw new Error("UAT requires a named PostgreSQL database");
  const remoteAllowed = args.includes("--allow-remote") || env.SEED_UAT_ALLOW_REMOTE === "true";
  const productionAllowed = args.includes("--allow-production") || env.SEED_UAT_ALLOW_PRODUCTION === "true";
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) && !remoteAllowed) throw new Error("UAT only writes to localhost by default; --allow-remote is required for another host");
  if ((env.NODE_ENV === "production" || /(?:^|[_-])(prod|production)(?:$|[_-])/i.test(url.pathname.slice(1))) && !productionAllowed) throw new Error("UAT fixture writes to production require --allow-production");
  return env.DATABASE_URL;
}

export function calculateUatTotals(lines: readonly { unitPrice: bigint; quantity: number; shopId: string }[], shippingPerShop = UAT_SHIPPING) {
  if (!lines.length || shippingPerShop < 0n) throw new Error("UAT totals require items and nonnegative shipping");
  for (const line of lines) if (line.unitPrice < 0n || !Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > 2_147_483_647) throw new Error("Invalid UAT order line");
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * BigInt(line.quantity), 0n);
  const shippingTotal = BigInt(new Set(lines.map((line) => line.shopId)).size) * shippingPerShop;
  const grandTotal = subtotal + shippingTotal;
  if (grandTotal > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("UAT payment exceeds the safe provider limit");
  return { subtotal, discountTotal: 0n, shippingTotal, taxTotal: 0n, includedTaxTotal: 0n, reportedTaxTotal: 0n, grandTotal, currency: "THB" };
}
