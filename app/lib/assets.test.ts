import { afterEach, describe, expect, it } from "vitest";
import {
  FALLBACK_PRODUCT_IMAGE_PATH,
  resolvePublicAssetPath,
  resolveUploadedImageUrl,
  isSecretStorageUrl,
} from "./assets";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("asset helpers", () => {
  it("uses the asset base URL for static public assets", () => {
    process.env.NEXT_PUBLIC_ASSET_BASE_URL = "https://assets.example.com/";

    expect(resolvePublicAssetPath("/logo512.png")).toBe("https://assets.example.com/logo512.png");
  });

  it("falls back to the product placeholder when an image is missing", () => {
    process.env.NEXT_PUBLIC_ASSET_BASE_URL = "";

    expect(resolveUploadedImageUrl(null)).toBe(FALLBACK_PRODUCT_IMAGE_PATH);
  });

  it("serves S3 public images through the CDN when configured", () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.example.com";
    process.env.S3_PUBLIC_BASE_URL = "https://bucket.s3.example.com";

    expect(resolveUploadedImageUrl("https://bucket.s3.example.com/uploads/product_image/item.webp"))
      .toBe("https://cdn.example.com/uploads/product_image/item.webp");
  });

  it("detects signed storage URLs so they are not treated as public image URLs", () => {
    expect(isSecretStorageUrl("https://bucket.s3.example.com/uploads/item.png?X-Amz-Signature=secret")).toBe(true);
    expect(isSecretStorageUrl("https://cdn.example.com/uploads/item.png")).toBe(false);
  });
});

