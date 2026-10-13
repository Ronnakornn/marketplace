/**
 * @vitest-environment jsdom
 */
import type { MouseEventHandler, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerPageHeader, SellerShell } from "./SellerShell";

const push = vi.fn();
let pathname = "/en/seller";
let params = new URLSearchParams();

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, onClick, ...props }: { href: string; children: ReactNode; prefetch?: boolean; onClick?: MouseEventHandler<HTMLAnchorElement> }) => (
    <a href={href} {...props} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>{children}</a>
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

vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "seller.nav.dashboard": "Dashboard",
    "seller.nav.products": "Products",
    "seller.nav.productAnalytics": "Product Analytics",
    "seller.nav.inventory": "Inventory",
    "seller.nav.orders": "Orders",
    "seller.nav.returns": "Returns",
    "seller.nav.promotions": "Promotions",
    "seller.nav.finance": "Finance",
    "seller.nav.chat": "Chat",
    "seller.nav.notifications": "Notifications",
    "seller.nav.activeShop": "Active shop",
    "seller.nav.manage": "Seller manage",
    "seller.nav.viewShop": "View my shop",
    "seller.nav.toggleSidebar": "Toggle seller navigation",
    "seller.ui.workspace": "Seller workspace",
    "seller.ui.currentShop": "Current shop",
    "seller.ui.breadcrumb": "Current page",
    "seller.ui.navigation.work": "Shop operations",
    "seller.ui.navigation.business": "Business",
    "seller.ui.navigation.account": "Shop and account",
  }[key] ?? key),
}));

describe("SellerShell", () => {
  beforeEach(() => {
    pathname = "/en/seller";
    params = new URLSearchParams();
    push.mockReset();
    vi.stubGlobal("innerWidth", 1024);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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

    const orderLinks = screen.getAllByRole("link", { name: "Orders" });
    expect(orderLinks.length).toBeGreaterThan(0);
    expect(orderLinks.some((link) => link.getAttribute("href") === "/en/seller/orders?shopId=shop-2")).toBe(true);
  });

  it("shows the selected shop in the topbar and links to its storefront", () => {
    pathname = "/en/seller/products/item-1";
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

    expect(within(screen.getByRole("navigation", { name: "Current page" })).getByText("Shop Two")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View my shop" }).getAttribute("href")).toBe("/en/shops/shop-two");
    expect(screen.getByRole("link", { name: "Products" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("hides operational navigation on onboarding routes", () => {
    pathname = "/en/seller/register";

    render(
      <SellerShell activeShop={null} activeShops={[]} user={{ name: "Seller", email: "seller@example.com" }}>
        <div>Application form</div>
      </SellerShell>,
    );

    expect(screen.getByText("Application form")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle seller navigation" })).toBeNull();
  });

  it("preserves the current selected shop when changing language after navigation", () => {
    params = new URLSearchParams("shopId=shop-1");
    const shopOne = { id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" };
    const shopTwo = { id: "shop-2", name: "Shop Two", slug: "shop-two", status: "ACTIVE" };
    const shell = <SellerShell activeShop={shopOne} activeShops={[shopOne, shopTwo]} user={{ name: "Seller", email: "seller@example.com" }}>content</SellerShell>;
    const view = render(shell);
    expect(screen.getByRole("link", { name: "ไทย" }).getAttribute("href")).toBe("/th/seller?shopId=shop-1");

    params = new URLSearchParams("shopId=shop-2");
    view.rerender(<SellerShell activeShop={shopOne} activeShops={[shopOne, shopTwo]} user={{ name: "Seller", email: "seller@example.com" }}>content</SellerShell>);
    expect(screen.getByRole("link", { name: "ไทย" }).getAttribute("href")).toBe("/th/seller?shopId=shop-2");
  });

  it("closes the mobile sidebar after a navigation link is selected", async () => {
    vi.stubGlobal("innerWidth", 390);

    render(
      <SellerShell
        activeShop={{ id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" }}
        activeShops={[{ id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" }]}
        user={{ name: "Seller", email: "seller@example.com" }}
      >
        <div>content</div>
      </SellerShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle seller navigation" }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Shop One")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("link", { name: "Orders" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a page title and its primary action together", () => {
    const createProduct = vi.fn();
    render(<SellerPageHeader title="Products" description="Manage your catalog" actions={<button onClick={createProduct}>Create product</button>} />);

    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    expect(createProduct).toHaveBeenCalledOnce();
  });
});
