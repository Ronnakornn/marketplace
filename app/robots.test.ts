import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("excludes admin, seller, private, and buyer-only paths", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    expect(rules?.disallow).toEqual(expect.arrayContaining([
      "/admin/",
      "/seller/",
      "/private/",
      "/cart",
      "/checkout",
      "/orders/",
      "/profile",
      "/notifications",
    ]));
    expect(config.sitemap).toContain("/sitemap.xml");
  });
});
