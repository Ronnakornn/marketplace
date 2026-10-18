import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("#/components/AppChrome", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("#/i18n/client", () => ({ I18nProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("#/i18n/server", () => ({ getClientMessages: vi.fn().mockResolvedValue({}) }));

import { I18nProvider } from "#/i18n/client";
import { getClientMessages } from "#/i18n/server";
import LocaleLayout from "./layout";

describe("LocaleLayout", () => {
  it("keeps I18nProvider mounted for anonymous homepage navigations", async () => {
    const result = await LocaleLayout({ children: <div>page</div>, params: Promise.resolve({ locale: "th" }) });

    expect(result.type).toBe(I18nProvider);
    expect(getClientMessages).toHaveBeenCalledWith("th");
    expect(result.props.fallbackMessages).toBeUndefined();
  });
});
