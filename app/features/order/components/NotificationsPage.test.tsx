/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationsPage } from "./NotificationsPage";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: () => null }));
vi.mock("./PushNotificationManager", () => ({ PushNotificationManager: () => null }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: () => "13 Oct" }) }));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => "/th" + path }));
let sessionData: { user: { id: string } } | null = { user: { id: "user-1" } };
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: sessionData }) }));
const { fetchNotifications, requestApi } = vi.hoisted(() => ({ fetchNotifications: vi.fn(), requestApi: vi.fn(async () => ({})) }));
vi.mock("#/features/buyer/api", () => ({ fetchNotifications }));
vi.mock("#/lib/api-client", () => ({ requestApi }));
const items = [
  { id: "chat", type: "chat_message", title: "New chat message", body: "Hello", data: { roomId: "room", shopId: "shop" }, createdAt: "2026-10-13T00:00:00.000Z", readAt: null },
  { id: "order", type: "order_updated", title: "Order updated", body: null, data: { orderId: "order" }, createdAt: "2026-10-13T00:00:00.000Z", readAt: null },
];
beforeEach(() => {
  sessionData = { user: { id: "user-1" } };
  fetchNotifications.mockReset();
  fetchNotifications.mockImplementation(async (_scope, options) => ({ items: options.category === "chat" ? [items[0]] : items, nextCursor: null }));
});
afterEach(cleanup);
function renderNotifications(scope: "all" | "seller" = "all") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><NotificationsPage scope={scope} /></QueryClientProvider>);
}
describe("chat notifications", () => {
  it("hydrates consistently when the browser already has a session absent from the server render", async () => {
    sessionData = null;
    const serverClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const browserClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const container = document.createElement("div");
    container.innerHTML = renderToString(<QueryClientProvider client={serverClient}><NotificationsPage showTopBar={false} scope="seller" /></QueryClientProvider>);
    document.body.append(container);
    sessionData = { user: { id: "user-1" } };
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <QueryClientProvider client={browserClient}><NotificationsPage showTopBar={false} scope="seller" /></QueryClientProvider>, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      serverClient.clear();
      browserClient.clear();
      container.remove();
    }
  });

  it("keeps chat entries in all notifications and the chat filter", async () => {
    renderNotifications();
    expect(await screen.findByText("chat.newMessage")).toBeTruthy();
    expect(screen.getByRole("link", { name: /chat.newMessage/ }).getAttribute("href")).toBe("/th/chat/room");
    fireEvent.click(screen.getByRole("button", { name: "notification.chat" }));
    expect(await screen.findByText("chat.newMessage")).toBeTruthy();
    expect(screen.queryByText("Order updated")).toBeNull();
    expect(screen.queryByText("chat_message")).toBeNull();
  });
  it("routes seller notifications to the correct shop conversation", async () => {
    renderNotifications("seller");
    const link = await screen.findByRole("link", { name: /chat.newMessage/ });
    expect(link.getAttribute("href")).toBe("/th/seller/chat/room?shopId=shop");
  });
  it("loads the next page and removes the load-more button at the end", async () => {
    fetchNotifications.mockResolvedValueOnce({ items: [items[0]], nextCursor: "chat" }).mockResolvedValueOnce({ items: [items[1]], nextCursor: null });
    renderNotifications();
    fireEvent.click(await screen.findByRole("button", { name: "notification.loadMore" }));
    expect(await screen.findByText("Order updated")).toBeTruthy();
    expect(screen.getByText("chat.newMessage")).toBeTruthy();
    expect(fetchNotifications).toHaveBeenLastCalledWith("all", { cursor: "chat", category: "all", limit: 30 });
    expect(screen.queryByRole("button", { name: "notification.loadMore" })).toBeNull();
  });

  it("keeps read-all scoped and refreshes loaded pages", async () => {
    renderNotifications("seller");
    await screen.findByText("chat.newMessage");
    fireEvent.click(screen.getByRole("button", { name: "notification.readAll" }));
    await vi.waitFor(() => expect(requestApi).toHaveBeenCalledWith("/api/notifications/read-all?scope=seller", { method: "PATCH" }));
    await vi.waitFor(() => expect(fetchNotifications.mock.calls.length).toBeGreaterThan(1));
  });

});
