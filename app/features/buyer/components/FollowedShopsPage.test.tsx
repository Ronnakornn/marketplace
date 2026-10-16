/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FollowedShopsPage } from "./FollowedShopsPage";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: () => null }));
vi.mock("#/features/buyer/api", () => ({ fetchFollowedShops: mocks.fetch, formatMoney: (value: string) => value }));
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: { user: { id: "buyer-1", role: "USER" } } }) }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => `/en${path}` }));
afterEach(cleanup);

it("loads followed shops by authenticated pages and retains previous cards", async () => {
  const shop = (id: string) => ({ id, shopId: id, name: id, slug: id, followerCount: 2, productCount: 1,
    products: [{ id: `${id}-product`, title: `${id} product`, price: "100", currency: "THB" }] });
  mocks.fetch.mockResolvedValueOnce({ items: [shop("shop-one"), shop("shop-two")], page: 1, hasMore: true })
    .mockResolvedValueOnce({ items: [shop("shop-three")], page: 2, hasMore: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><FollowedShopsPage /></QueryClientProvider>);
  await screen.findByText("shop-one");
  expect(screen.getByText("shop-one product")).toBeTruthy();
  expect(screen.getByText("shop-two product")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "common.loadMore" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "common.loadMore" }));
  await screen.findByText("shop-three");
  expect(screen.getByText("shop-one")).toBeTruthy();
  expect(screen.getByText("shop-two")).toBeTruthy();
  expect(mocks.fetch.mock.calls.map(([page]) => page)).toEqual([1, 2]);
  await waitFor(() => expect(screen.queryByRole("button", { name: "common.loadMore" })).toBeNull());
  expect(client.getQueryData(["buyer-followed-shops", "buyer-1"])).toBeTruthy();
});
