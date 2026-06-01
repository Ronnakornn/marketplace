import { describe, expect, it } from "vitest";
import { resolveNextPath, resolveOptionalNextPath } from "./redirect";

describe("auth redirect sanitization", () => {
  it("allows same-origin relative paths", () => {
    expect(resolveNextPath("/buyer/orders")).toBe("/buyer/orders");
    expect(resolveNextPath("/checkout?cart=123")).toBe("/checkout?cart=123");
  });

  it("falls back for missing, protocol-relative, and absolute URLs", () => {
    expect(resolveNextPath(null)).toBe("/");
    expect(resolveNextPath(undefined)).toBe("/");
    expect(resolveNextPath("https://evil.example/path")).toBe("/");
    expect(resolveNextPath("http://evil.example/path")).toBe("/");
    expect(resolveNextPath("//evil.example/path")).toBe("/");
  });

  it("returns null for invalid server-side next values", () => {
    expect(resolveOptionalNextPath("https://evil.example/path")).toBeNull();
    expect(resolveOptionalNextPath("//evil.example/path")).toBeNull();
    expect(resolveOptionalNextPath("not-a-path")).toBeNull();
    expect(resolveOptionalNextPath("/admin")).toBe("/admin");
  });
});
