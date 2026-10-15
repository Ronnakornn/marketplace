/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "./NotificationsPage";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: () => null }));
vi.mock("./PushNotificationManager", () => ({ PushNotificationManager: () => null }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: () => "13 Oct" }) }));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => "/th" + path }));
vi.mock("#/features/buyer/api", () => ({ fetchNotifications: vi.fn(async () => [
  { id: "chat", type: "chat_message", title: "New chat message", body: "Hello", data: { roomId: "room", shopId: "shop" }, createdAt: "2026-10-13T00:00:00.000Z", readAt: null },
  { id: "order", type: "order_updated", title: "Order updated", body: null, data: { orderId: "order" }, createdAt: "2026-10-13T00:00:00.000Z", readAt: null },
]) }));
afterEach(cleanup);
function renderNotifications(scope: "all" | "seller" = "all") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><NotificationsPage scope={scope} /></QueryClientProvider>);
}
describe("chat notifications", () => {
  it("keeps chat entries in all notifications and the chat filter", async () => {
    renderNotifications();
    expect(await screen.findByText("chat.newMessage")).toBeTruthy();
    expect(screen.getByRole("link", { name: /chat.newMessage/ }).getAttribute("href")).toBe("/th/chat/room");
    fireEvent.click(screen.getByRole("button", { name: "notification.chat" }));
    expect(screen.getByText("chat.newMessage")).toBeTruthy();
    expect(screen.queryByText("Order updated")).toBeNull();
    expect(screen.queryByText("chat_message")).toBeNull();
  });
  it("routes seller notifications to the correct shop conversation", async () => {
    renderNotifications("seller");
    const link = await screen.findByRole("link", { name: /chat.newMessage/ });
    expect(link.getAttribute("href")).toBe("/th/seller/chat/room?shopId=shop");
  });
});
