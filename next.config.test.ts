import { afterEach, describe, expect, it } from "vitest";
import config, { imageRemotePatterns } from "./next.config.mjs";

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

  it("sets no-store headers for private API and checkout surfaces", async () => {
    const headers = await config.headers!();

    expect(headers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      }),
      expect.objectContaining({
        source: "/checkout",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      }),
    ]));
  });
});
