import { describe, expect, it } from "vitest";
import { isDemoPlaceholder, planProductImages, productImageCatalogSchema } from "./seed-product-images.ts";
const gallery = [{ url: "/seed/products/shirt-front.svg", altText: "Shirt front", width: 800, height: 800 }, { url: "/seed/products/shirt-back.svg", altText: "Shirt back", width: 800, height: 800 }];
const managedUrls = new Set(gallery.map(image => image.url));
const row = (id: string, url: string, isPrimary = false, sortOrder = 0) => ({ id, url, isPrimary, sortOrder, altText: "Existing", width: 800, height: 800 });
const plan = (existing: Parameters<typeof planProductImages>[0]["existing"]) => planProductImages({ productId: "product-1", existing, gallery, managedUrls });
describe("product image backfill", () => {
  it("fills the complete gallery with exactly one primary and deterministic ids", () => {
    const actual = plan([]);
    expect(actual.map(image => [image.url, image.sortOrder, image.isPrimary])).toEqual([[gallery[0].url, 0, true], [gallery[1].url, 1, false]]);
    expect(plan(actual)).toEqual(actual);
  });
  it("repairs a missing managed gallery image without replacing its existing picture", () => {
    const existing = row("original", gallery[0].url, true);
    expect(plan([existing]).map(image => image.id)).toEqual(["original", plan([])[1].id]);
  });
  it("replaces known demo placeholders in place", () => {
    const result = plan([row("placeholder", "https://example.com/demo/products/shirt.jpg", true)]);
    expect(result[0]).toMatchObject({ id: "placeholder", url: gallery[0].url, isPrimary: true });
    expect(result).toHaveLength(2);
  });
  it("preserves genuine custom photos and does not append unrelated defaults", () => {
    const existing = row("custom", "https://shop.example.test/my-photo.jpg", true);
    expect(plan([existing])).toEqual([existing]);
  });
  it("repairs every placeholder in place while preserving the custom photo", () => {
    const result = plan([row("placeholder", "https://example.com/demo/products/demo.jpg", true), row("custom", "/uploads/my-photo.webp")]);
    expect(result).toEqual([row("custom", "/uploads/my-photo.webp", true), { ...gallery[0], id: "placeholder", sortOrder: 1, isPrimary: false }]);
    expect(plan(result)).toEqual(result);
  });
  it("retains surplus placeholder ids without growing duplicate galleries on rerun", () => {
    const result = plan([row("a", "https://example.com/demo/products/a.jpg"), row("b", "https://example.com/demo/products/b.jpg"), row("c", "https://example.com/demo/products/c.jpg")]);
    expect(result.map(image => image.id)).toEqual(["a", "b", "c"]);
    expect(result.map(image => image.url)).toEqual([gallery[0].url, gallery[1].url, gallery[0].url]);
    expect(plan(result)).toEqual(result);
  });
  it("normalizes multiple primary flags to one without losing custom pictures", () => {
    const result = plan([row("b", "/uploads/b.webp", true, 2), row("a", "/uploads/a.webp", true, 1)]);
    expect(result.map(image => [image.id, image.isPrimary, image.sortOrder])).toEqual([["a", true, 0], ["b", false, 1]]);
  });
  it("does not treat unrelated or deceptive hosts as demo placeholders", () => {
    expect(isDemoPlaceholder("https://example.com/demo/products/a.jpg")).toBe(true);
    expect(isDemoPlaceholder("https://example.com/my-photo.jpg")).toBe(false);
    expect(isDemoPlaceholder("https://example.com.evil.test/demo/products/a.jpg")).toBe(false);
  });
  it("rejects empty galleries, duplicate URLs, path traversal and invalid dimensions", () => {
    const parse = (images: unknown[]) => productImageCatalogSchema.safeParse({ products: {}, categories: {}, default: images }).success;
    expect(parse([])).toBe(false);
    expect(parse([gallery[0], gallery[0]])).toBe(false);
    expect(parse([{ ...gallery[0], url: "/seed/../secret.svg" }])).toBe(false);
    expect(parse([{ ...gallery[0], width: 0 }])).toBe(false);
    expect(parse(gallery)).toBe(true);
  });
});

