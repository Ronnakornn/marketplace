export const FALLBACK_PRODUCT_IMAGE_PATH = "/images/fallback-product.svg";
export const FALLBACK_SHOP_IMAGE_PATH = "/images/fallback-shop.svg";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function safeUrl(value?: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function getAssetBaseUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? process.env.NEXT_PUBLIC_CDN_URL ?? "");
}

export function getCdnUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_CDN_URL ?? "");
}

export function resolvePublicAssetPath(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const assetBaseUrl = getAssetBaseUrl();
  return assetBaseUrl ? `${assetBaseUrl}${normalizedPath}` : normalizedPath;
}

export function resolveUploadedImageUrl(value?: string | null, fallbackPath = FALLBACK_PRODUCT_IMAGE_PATH): string {
  if (!value) return resolvePublicAssetPath(fallbackPath);
  const cdnUrl = getCdnUrl();
  const s3PublicBaseUrl = stripTrailingSlash(process.env.S3_PUBLIC_BASE_URL ?? "");

  if (cdnUrl && s3PublicBaseUrl && value.startsWith(`${s3PublicBaseUrl}/`)) {
    return `${cdnUrl}/${value.slice(s3PublicBaseUrl.length + 1)}`;
  }

  if (cdnUrl && value.startsWith("/uploads/")) return `${cdnUrl}${value}`;
  if (isAbsoluteUrl(value)) return value;
  return resolvePublicAssetPath(value.startsWith("/") ? value : `/${value}`);
}

export function isSecretStorageUrl(value: string): boolean {
  const url = safeUrl(value);
  if (!url) return false;
  return url.searchParams.has("X-Amz-Signature")
    || url.searchParams.has("X-Amz-Credential")
    || url.searchParams.has("X-Amz-Security-Token")
    || url.searchParams.has("AWSAccessKeyId")
    || url.searchParams.has("Signature");
}

