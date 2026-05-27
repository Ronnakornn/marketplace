/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { updateProfile } from "#/features/buyer/api";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  BuyerLoadingList: () => <div>Loading</div>,
}));

vi.mock("#/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => ({
    "buyer.profile": "Profile",
    "buyer.buyerShortcuts": "Buyer shortcuts",
    "buyer.myOrders": "My orders",
    "buyer.addresses": "Addresses",
    "buyer.wishlist": "Wishlist",
    "buyer.vouchers": "Vouchers",
    "buyer.affiliates": "Affiliates",
    "buyer.followedShops": "Followed shops",
    "buyer.notifications": "Notifications",
    "buyer.shippingAddress": "Shipping address",
    "buyer.noSavedAddress": "No saved address",
    "buyer.loadingSavedAddresses": "Loading saved addresses",
    "buyer.savedAddressCount": "{count} saved addresses",
    "buyer.manage": "Manage",
    "common.add": "Add",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => path,
}));

vi.mock("#/features/buyer/api", () => ({
  fetchAddresses: vi.fn(async () => []),
  fetchProfile: vi.fn(async () => ({
    id: "user-1",
    name: "Buyer One",
    email: "buyer@example.com",
    role: "USER",
    status: "ACTIVE",
    emailVerified: false,
    phone: "+66810000000",
    phoneVerified: false,
    image: null,
  })),
  fetchSellerApplicationSummary: vi.fn(async () => ({ application: null, shop: null })),
  updateProfile: vi.fn(),
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => cleanup());

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves phone input and shows update errors", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error("Phone is already in use"));
    renderWithClient(<ProfilePage />);

    const phoneInput = await screen.findByLabelText("Phone");
    fireEvent.change(phoneInput, { target: { value: "+66812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Phone is already in use")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toHaveProperty("value", "+66812345678");
  });
});
