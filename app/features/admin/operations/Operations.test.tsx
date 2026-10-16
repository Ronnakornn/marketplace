import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicContentBody } from "./PublicContent";
import { dateInput, toDateInput } from "./shared";
import en from "../../../../messages/en.json";
import th from "../../../../messages/th.json";

it("renders published content and titles as safe plain text", () => {
  const html = renderToStaticMarkup(
    <PublicContentBody
      title={"<img onerror=alert(1)>"}
      body={"<script>alert(1)</script>\nPolicy terms"}
    />,
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).toContain("Policy terms");
});

it("preserves explicit UTC schedule inputs", () => {
  expect(dateInput("2026-10-13T08:30")).toBe("2026-10-13T08:30:00.000Z");
  expect(toDateInput("2026-10-13T08:30:00.000Z")).toBe("2026-10-13T08:30");
});

function keys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}
describe("operations locales", () => {
  it("covers the same keys in Thai and English", () => {
    expect(keys(th.admin.operations)).toEqual(keys(en.admin.operations));
  });
});
