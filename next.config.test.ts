import { afterEach, describe, expect, it } from "vitest";
import config, { allowedDevOrigins, imageRemotePatterns } from "./next.config.mjs";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Next CDN and cache config", () => {
  it("allows configured CDN and S3 public image domains", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.example.com";
    process.env.S3_PUBLIC_BASE_URL = "https://bucket.storage.example.com";

    expect(imageRemotePatterns()).toEqual(expect.arrayContaining([
      expect.objectContaining({ protocol: "https", hostname: "cdn.example.com", pathname: "/**" }),
      expect.objectContaining({ protocol: "https", hostname: "bucket.storage.example.com", pathname: "/**" }),
    ]));
  });

  it("allows Next dev origins from env", () => {
    process.env.NEXT_ALLOWED_DEV_ORIGINS = "178.128.25.91, localhost:3000";

    expect(allowedDevOrigins()).toEqual(["178.128.25.91", "localhost:3000"]);
  });

  it("defaults Next dev origins to local hosts", () => {
    delete process.env.NEXT_ALLOWED_DEV_ORIGINS;

    expect(allowedDevOrigins()).toEqual(["localhost:3000", "127.0.0.1:3000"]);
  });

  it("sets no-store headers for private API and checkout surfaces", async () => {
    const headers = await config.headers!();

    expect(headers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      }),
      expect.objectContaining({
        source: "/:locale(en|th)/checkout",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      }),
    ]));
  });

  it("lets Next own dev chunk cache headers", async () => {
    const headers = await config.headers!();

    expect(headers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/_next/static/:path*" }),
    ]));
  });

  it("prevents service worker caching", async () => {
    const headers = await config.headers!();

    expect(headers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "/sw.js",
        headers: expect.arrayContaining([
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ]),
      }),
    ]));
  });
});
