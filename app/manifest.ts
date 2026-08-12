import type { MetadataRoute } from "next";
import { getSiteName } from "#/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  const siteName = getSiteName();

  return {
    id: "/",
    name: siteName,
    short_name: siteName,
    description: "Shop active products from trusted marketplace sellers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#EE4D2D",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
