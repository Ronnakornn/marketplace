import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#generated/client/client.ts";
import type { ProductImage } from "#generated/client/client.ts";
import { PinoLogger } from "#server/infrastructure/logging/pino-logger.ts";
import { CacheInvalidation } from "#server/modules/cache/cache.invalidation.ts";
import { CacheService } from "#server/modules/cache/cache.service.ts";
import { createRedisCacheClient, getCacheConfigFromEnv } from "#server/modules/cache/cache.client.ts";
import { assertUatDatabase, loadUatEnvironment } from "./uat-data.ts";

const imageSchema = z.object({ url: z.string().regex(/^\/(?:uat|seed|product-images)\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg|svg)$/), altText: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive() });
const gallerySchema = z.array(imageSchema).min(1).superRefine((images, ctx) => { if (new Set(images.map(image => image.url)).size !== images.length) ctx.addIssue({ code: "custom", message: "Duplicate gallery URL" }); });
export const productImageCatalogSchema = z.object({ products: z.record(z.string(), gallerySchema), categories: z.record(z.string(), gallerySchema), default: gallerySchema });
export type ProductImageCatalog = z.infer<typeof productImageCatalogSchema>;
type Image = z.infer<typeof imageSchema>;
type ExistingImage = Pick<ProductImage, "id" | "url" | "altText" | "width" | "height" | "isPrimary" | "sortOrder">;
type PlannedImage = ExistingImage;
const appContext = { logger: new PinoLogger({ environment: "production" }), config: { environment: "seed" } };

export function isDemoPlaceholder(url: string): boolean {
  try { const parsed = new URL(url); return parsed.hostname === "example.com" && parsed.pathname.startsWith("/demo/products/"); } catch { return false; }
}
function imageId(productId: string, url: string): string {
  const hash = createHash("sha256").update(`product-image:${productId}:${url}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export function planProductImages({ productId, existing, gallery, managedUrls }: { productId: string; existing: ExistingImage[]; gallery: Image[]; managedUrls: ReadonlySet<string> }): PlannedImage[] {
  const genuine = existing.filter(image => !isDemoPlaceholder(image.url));
  const custom = genuine.some(image => !managedUrls.has(image.url));
  const result: PlannedImage[] = [...genuine].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const placeholders = existing.filter(image => isDemoPlaceholder(image.url));
  for (const [index, placeholder] of placeholders.entries()) {
    const replacement = gallery.find(image => !result.some(row => row.url === image.url)) ?? gallery[index % gallery.length];
    if (!replacement) throw new Error("Product image gallery must not be empty");
    result.push({ ...replacement, id: placeholder.id, sortOrder: result.length, isPrimary: false });
  }
  if (!custom) for (const image of gallery) {
    if (result.some(row => row.url === image.url)) continue;
    result.push({ ...image, id: imageId(productId, image.url), sortOrder: result.length, isPrimary: false });
  }
  const primary = result.find(image => image.isPrimary)?.id ?? result[0]?.id;
  return result.map((image, index) => ({ ...image, sortOrder: index, isPrimary: image.id === primary }));
}
export async function loadProductImageCatalog(projectRoot = process.cwd()): Promise<ProductImageCatalog> {
  const catalog = productImageCatalogSchema.parse(JSON.parse(await readFile(resolve(projectRoot, "scripts/product-image-catalog.json"), "utf8")));
  const images = new Map([...Object.values(catalog.products).flat(), ...Object.values(catalog.categories).flat(), ...catalog.default].map(image => [image.url, image]));
  for (const image of images.values()) {
    const metadata = await sharp(resolve(projectRoot, "public", image.url.slice(1))).metadata();
    if (metadata.width !== image.width || metadata.height !== image.height) throw new Error(`Incorrect product image dimensions: ${image.url}`);
  }
  return catalog;
}
export async function seedProductImages(db: PrismaClient, catalog?: ProductImageCatalog) {
  const source = catalog ?? await loadProductImageCatalog();
  const managedUrls = new Set([...Object.values(source.products).flat(), ...Object.values(source.categories).flat(), ...source.default].map(image => image.url));
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1935761713, 2)`;
    const products = await tx.product.findMany({ include: { category: { select: { slug: true } }, images: true } });
    const touched: string[] = [];
    for (const product of products) {
      const gallery = source.products[product.slug] ?? source.categories[product.category?.slug ?? ""] ?? source.default;
      const plan = planProductImages({ productId: product.id, existing: product.images, gallery, managedUrls });
      let changed = false;
      for (const image of plan) {
        const current = product.images.find(row => row.id === image.id);
        const { id, ...data } = image;
        if (!current) { await tx.productImage.create({ data: { id, productId: product.id, ...data } }); changed = true; }
        else if (current.url !== data.url || current.isPrimary !== data.isPrimary || current.sortOrder !== data.sortOrder || current.altText !== data.altText || current.width !== data.width || current.height !== data.height) {
          await tx.productImage.update({ where: { id }, data }); changed = true;
        }
      }
      if (changed) touched.push(product.id);
    }
    return { products: products.length, touched };
  }, { timeout: 120000 });
  if (result.touched.length) {
    const config = getCacheConfigFromEnv();
    const client = createRedisCacheClient(config);
    if (client) try {
      const invalidation = new CacheInvalidation(new CacheService(appContext, config, client));
      await invalidation.invalidateCatalogDiscoveryAndSearch();
      for (const id of result.touched) await invalidation.invalidateProduct(id);
    } finally { await client.quit?.().catch(() => appContext.logger.warn("Product image cache connection did not close cleanly")); }
  }
  return { products: result.products, updatedProducts: result.touched.length };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--validate", "--check", "--allow-remote", "--allow-production"].includes(arg))) throw new Error("Unknown product image seed argument");
  loadUatEnvironment();
  const catalog = await loadProductImageCatalog();
  if (args.includes("--validate")) { appContext.logger.info("Product image catalog and files are valid"); return; }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertUatDatabase(process.env, args) }) });
  try {
    if (args.includes("--check")) {
      const products = await db.product.findMany({ include: { images: true, category: { select: { slug: true } } } });
      const managedUrls = new Set([...Object.values(catalog.products).flat(), ...Object.values(catalog.categories).flat(), ...catalog.default].map(image => image.url));
      const incomplete = products.filter(product => {
        const expected = planProductImages({ productId: product.id, existing: product.images, gallery: catalog.products[product.slug] ?? catalog.categories[product.category?.slug ?? ""] ?? catalog.default, managedUrls });
        return !product.images.length || expected.length !== product.images.length || expected.some(image => !product.images.some(row => row.id === image.id && row.url === image.url && row.isPrimary === image.isPrimary && row.sortOrder === image.sortOrder));
      });
      if (incomplete.length) throw new Error(`Product image coverage incomplete: ${incomplete.map(product => product.slug).join(", ")}`);
      appContext.logger.info("Every product has a complete gallery and one primary image", { products: products.length });
    } else appContext.logger.info("Product image seed complete", await seedProductImages(db, catalog));
  } finally { await db.$disconnect(); }
}
if (import.meta.main) main().catch((error: unknown) => { appContext.logger.error("Product image seed failed", { error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]") : "Unknown error" }); process.exitCode = 1; });

