import { describe, expect, it } from "vitest";
import { getSiteName } from "#/lib/seo";
import manifest from "./manifest";

describe("manifest", () => {
  it("describes one installable marketplace app", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      name: getSiteName(),
      short_name: getSiteName(),
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#FFFFFF",
      theme_color: "#EE4D2D",
      icons: [
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
        expect.objectContaining({
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ],
    });
  });
});
