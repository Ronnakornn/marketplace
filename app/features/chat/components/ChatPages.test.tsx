/**
 * @vitest-environment jsdom
 */
import { type ReactNode, type TextareaHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRoom } from "#/features/chat/api";
import { ChatInboxPage } from "./ChatPages";

const chatMocks = vi.hoisted(() => ({
  fetchChatRooms: vi.fn(),
  useChatRealtime: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerEmptyState: ({ title, description }: { title: string; description: string }) => <section><h2>{title}</h2><p>{description}</p></section>,
  BuyerErrorState: ({ message }: { message: string }) => <p>{message}</p>,
  BuyerLoadingList: () => <p>Loading</p>,
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("#/features/chat/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("#/features/chat/api")>(),
  fetchChatRooms: chatMocks.fetchChatRooms,
}));

vi.mock("#/features/chat/realtime", () => ({
  useChatRealtime: chatMocks.useChatRealtime,
}));

vi.mock("#/i18n/client", () => ({
  useFormatters: () => ({ date: () => "Jun 1, 2026" }),
  useTranslations: () => (key: string) => ({
    "chat.emptyInbox": "No chats yet",
    "chat.emptyInboxDescription": "Conversations appear here.",
    "chat.emptyThread": "No messages yet",
    "chat.inbox": "Chat inbox",
    "chat.messages": "Messages",
    "chat.noMessages": "No messages",
    "chat.sellerInbox": "Seller chat inbox",
    "chat.unread": "unread",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/th${path}`,
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "seller-1" } } }),
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  chatMocks.fetchChatRooms.mockResolvedValue([
    createRoom({ roomId: "room-selected", shopId: "shop-selected", shopName: "Selected Shop", buyerName: "Nok" }),
    createRoom({ roomId: "room-other", shopId: "shop-other", shopName: "Other Shop", buyerName: "Mali" }),
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatInboxPage seller audience", () => {
  it("filters rooms to the selected shop and keeps seller URLs scoped to that shop", async () => {
    renderWithClient(<ChatInboxPage audience="seller" shopId="shop-selected" />);

    expect(await screen.findByRole("heading", { name: "Seller chat inbox" })).toBeTruthy();
    expect(await screen.findByText("Nok")).toBeTruthy();
    expect(screen.queryByText("Mali")).toBeNull();
    expect(screen.getByRole("link", { name: /Nok/ }).getAttribute("href"))
      .toBe("/th/seller/chat/room-selected?shopId=shop-selected");
    expect(chatMocks.useChatRealtime).toHaveBeenCalledWith(["seller:shop-selected:chats"]);
  });
});

function createRoom(input: {
  roomId: string;
  shopId: string;
  shopName: string;
  buyerName: string;
}): ChatRoom {
  return {
    roomId: input.roomId,
    shop: { id: input.shopId, name: input.shopName, slug: input.shopId, ownerId: "seller-1" },
    buyer: { id: `buyer-${input.roomId}`, name: input.buyerName, email: "buyer@example.com", role: "USER" },
    lastMessage: null,
    unreadCount: 0,
  };
}
