/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerShell } from "./SellerShell";

const push = vi.fn();
let pathname = "/en/seller";
let params = new URLSearchParams();

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (nextPath: string) => `/en${nextPath}`,
}));

describe("SellerShell", () => {
  beforeEach(() => {
    pathname = "/en/seller";
    params = new URLSearchParams();
    push.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates shopId query param when selecting another active shop", () => {
    render(
      <SellerShell
        activeShop={{ id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" }}
        activeShops={[
          { id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" },
          { id: "shop-2", name: "Shop Two", slug: "shop-two", status: "ACTIVE" },
        ]}
        user={{ name: "Seller", email: "seller@example.com" }}
      >
        <div>content</div>
      </SellerShell>,
    );

    fireEvent.change(screen.getByLabelText("Active shop"), {
      target: { value: "shop-2" },
    });

    expect(push).toHaveBeenCalledWith("/en/seller?shopId=shop-2");
  });

  it("preserves selected shopId in seller navigation links", () => {
    params = new URLSearchParams("shopId=shop-2");

    render(
      <SellerShell
        activeShop={{ id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" }}
        activeShops={[
          { id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" },
          { id: "shop-2", name: "Shop Two", slug: "shop-two", status: "ACTIVE" },
        ]}
        user={{ name: "Seller", email: "seller@example.com" }}
      >
        <div>content</div>
      </SellerShell>,
    );

    const orderLinks = screen.getAllByRole("link", { name: "Orders" }) as HTMLAnchorElement[];
    expect(orderLinks.length).toBeGreaterThan(0);
    expect(orderLinks.some((link) => link.getAttribute("href") === "/en/seller/orders?shopId=shop-2")).toBe(true);
  });
});
