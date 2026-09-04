import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({ default: () => ({ className: "test-font", variable: "test-font-variable" }) }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers({ "x-pathname": "/th" })) }));
vi.mock("#/providers", () => ({ Providers: ({ children }: { children: ReactNode }) => children }));

import { Providers } from "#/providers";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("keeps application providers mounted for anonymous homepage navigations", async () => {
    const result = await RootLayout({ children: <div>page</div> });
    const body = result.props.children;

    expect(body.props.children.type).toBe(Providers);
  });
});
