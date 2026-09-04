import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("#/lib/auth-server", () => ({ getServerSession: vi.fn() }));

import { canRenderMinimalAnonymousHome } from "./request-rendering.server";

describe("canRenderMinimalAnonymousHome", () => {
  it("uses the minimal server-first tree only for localized anonymous homepages", () => {
    expect(canRenderMinimalAnonymousHome("/th", false)).toBe(true);
    expect(canRenderMinimalAnonymousHome("/en/", false)).toBe(true);
    expect(canRenderMinimalAnonymousHome("/th", true)).toBe(false);
    expect(canRenderMinimalAnonymousHome("/th/products/product-1", false)).toBe(false);
    expect(canRenderMinimalAnonymousHome("/", false)).toBe(false);
  });
});
