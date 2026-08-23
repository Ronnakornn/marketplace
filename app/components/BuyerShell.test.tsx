/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import type * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuyerTopBar, MobileBottomNavigation } from "./BuyerShell";

let pathname = "/en/seller/products";
const signedInSession = {
  data: { user: { id: "user_1", role: "USER", name: "Active Seller" } },
  isPending: false,
};
let sessionState: { data: unknown; isPending: boolean } = signedInSession;

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "common.cart": "Cart",
    "common.chat": "Chat",
    "common.notifications": "Notifications",
    "common.orders": "Orders",
    "common.profile": "Profile",
    "common.searchPlaceholder": "Search products",
    "common.searchSubmit": "Search",
    "common.signIn": "Sign in",
    "common.signOut": "Sign out",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/lib/auth-client", () => ({
  signOut: vi.fn(),
  useSession: () => sessionState,
}));

vi.mock("#/features/buyer/api", () => ({
  fetchCart: vi.fn(async () => ({ shops: [{ items: [{ quantity: 2 }] }] })),
  fetchNotifications: vi.fn(async () => []),
}));

vi.mock("#/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithClient(ui: ReactNode) {
  const client = createTestClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  pathname = "/en/seller/products";
  sessionState = signedInSession;
  vi.clearAllMocks();
});

describe("buyer shell smoke", () => {
  it("keeps the server session placeholder stable while hydrating a cached session", async () => {
    sessionState = { data: null, isPending: true };
    const serverHtml = renderToString(
      <QueryClientProvider client={createTestClient()}>
        <BuyerTopBar title="Seller Products" />
      </QueryClientProvider>,
    );
    expect(serverHtml).toContain("h-10 w-[185px]");

    sessionState = signedInSession;
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <QueryClientProvider client={createTestClient()}>
            <BuyerTopBar title="Seller Products" />
          </QueryClientProvider>,
        );
      });

      expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Hydration failed");
      expect(container.querySelector('a[href="/en/chat"]')).toBeTruthy();
    } finally {
      await act(async () => root?.unmount());
      consoleError.mockRestore();
      container.remove();
    }
  });

  it("keeps buyer cart and start selling entry visible for active sellers", async () => {
    renderWithClient(<BuyerTopBar title="Seller Products" />);

    await waitFor(() => {
      expect(document.querySelector('a[href="/en/cart"]')).toBeTruthy();
    });

    expect(document.body.textContent).toContain("Cart");
    expect(document.querySelector('a[href="/en/chat"]')).toBeTruthy();
    expect(document.querySelector('a[href="/en/seller/register"]')).toBeTruthy();
  });

  it("does not offer sign in while the session is still resolving", async () => {
    sessionState = { data: null, isPending: true };

    renderWithClient(<BuyerTopBar title="Seller Products" />);

    await waitFor(() => {
      expect(document.querySelector("header")).toBeTruthy();
    });

    // A pending session is not a signed-out session — showing these would flash
    // "sign in" at buyers who are already signed in.
    expect(document.querySelector('a[href="/en/login"]')).toBeNull();
    expect(document.querySelector('a[href="/en/signup"]')).toBeNull();
  });

  it("offers sign in once the session resolves as signed out", async () => {
    sessionState = { data: null, isPending: false };

    renderWithClient(<BuyerTopBar title="Seller Products" />);

    await waitFor(() => {
      expect(document.querySelector('a[href="/en/login"]')).toBeTruthy();
    });

    expect(document.querySelector('a[href="/en/signup"]')).toBeTruthy();
  });

  it("gives the profile icon link a discernible name", () => {
    renderWithClient(<BuyerTopBar title="Seller Products" />);

    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/en/profile");
  });

  it("does not mark a marketplace mobile item active on shop routes", () => {
    pathname = "/en/shops/demo-shop";
    renderWithClient(<MobileBottomNavigation />);
    expect([...document.querySelectorAll("nav a")].every((link) => !link.className.includes("bg-orange-50"))).toBe(true);
  });
});
