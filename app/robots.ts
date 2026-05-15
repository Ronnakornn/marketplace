import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "#/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/seller/",
        "/private/",
        "/api/",
        "/cart",
        "/checkout",
        "/orders/",
        "/profile",
        "/notifications",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
