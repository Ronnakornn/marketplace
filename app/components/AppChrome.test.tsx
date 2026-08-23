/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import AppChrome from "./AppChrome";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("#/components/Header", () => ({ default: () => <div data-testid="site-header" /> }));
vi.mock("#/components/Footer", () => ({ default: () => <div data-testid="site-footer" /> }));

afterEach(() => cleanup());

async function renderPath(pathname: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-pathname": pathname }) as never);
  render(await AppChrome({ children: <div>Auth content</div> }));
}

describe("AppChrome auth routes", () => {
  it.each(["/th/forgot-password", "/th/verify-email"])(
    "keeps %s inside the standalone auth theme",
    async (pathname) => {
      await renderPath(pathname);

      expect(screen.getByText("Auth content")).toBeTruthy();
      expect(screen.queryByTestId("site-header")).toBeNull();
      expect(screen.queryByTestId("site-footer")).toBeNull();
    },
  );
});
