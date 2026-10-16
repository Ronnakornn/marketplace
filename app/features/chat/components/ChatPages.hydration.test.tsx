/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatAudience, ChatMessage, ChatRoom } from "../api";
import { timelineFromRoom } from "../timeline";
import { chatRoomKeys } from "../queries";
import { ChatInboxPage, ChatThreadPage } from "./ChatPages";

const mocks = vi.hoisted(() => {
  const session: { data: { user: { id: string } } | null } = { data: null };
  return { session, fetchRooms: vi.fn(), fetchRoom: vi.fn(), send: vi.fn(), read: vi.fn() };
});
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("#/features/chat/api", async (original) => ({
  ...await original<typeof import("../api")>(), fetchChatRooms: mocks.fetchRooms, fetchChatRoom: mocks.fetchRoom,
  fetchChatUnreadCount: async () => ({ unreadCount: 0 }),
  refreshChatMessages: async () => ({ contentRevision: "0", messages: [message] }),
  sendChatMessage: mocks.send, markChatRead: mocks.read,
}));
vi.mock("#/i18n/client", () => ({
  useFormatters: () => ({ date: (date: string) => date }), useTranslations: () => (key: string) => key,
}));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => "/en" + path }));
vi.mock("#/lib/auth-client", () => ({ useSession: () => mocks.session }));

const message: ChatMessage = {
  id: "message", sender: { id: "buyer", name: "Buyer", email: "buyer@example.com", role: "USER" },
  contentVersion: 0, deleted: false, reply: null, messageType: "text", body: "Private chat message", attachments: [], files: [], createdAt: "2026-10-13T01:00:00.000Z", product: null, order: null,
};
const room: ChatRoom = {
  contentRevision: "0", roomId: "room", shop: { id: "shop", name: "Shop", slug: "shop", ownerId: "seller" },
  buyer: message.sender, lastMessage: message, unreadCount: 0, canSend: true, chatEnabled: true,
  readBoundary: null, otherReadBoundary: null, messages: [message],
  pagination: { page: 1, limit: 30, total: 1, totalPages: 1, hasMore: false, beforeCursor: message.id, afterCursor: message.id },
};

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
}

beforeEach(() => {
  mocks.session.data = null;
  mocks.fetchRooms.mockResolvedValue({ items: [room], pagination: { limit: 30, hasMore: false, nextCursor: null } });
  mocks.fetchRoom.mockImplementation((_id: string, query: { after?: string }) => Promise.resolve(query?.after ? { ...room, messages: [] } : room));
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  vi.stubGlobal("WebSocket", class extends EventTarget {
    send() {}
    close() {}
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const cases: { page: "inbox" | "thread"; audience: ChatAudience; cached: boolean }[] = [
  { page: "inbox", audience: "buyer", cached: false }, { page: "inbox", audience: "buyer", cached: true },
  { page: "inbox", audience: "seller", cached: false }, { page: "inbox", audience: "seller", cached: true },
  { page: "thread", audience: "buyer", cached: false }, { page: "thread", audience: "buyer", cached: true },
  { page: "thread", audience: "seller", cached: false }, { page: "thread", audience: "seller", cached: true },
];

describe("chat hydration", () => {
  it.each(cases)("hydrates $audience $page with a cached session and query cache $cached", async ({ page: pageType, audience, cached }) => {
    const shopId = audience === "seller" ? "shop" : undefined;
    const userId = audience;
    const serverClient = createClient();
    const client = createClient();
    const page = pageType === "inbox" ? <ChatInboxPage audience={audience} shopId={shopId} />
      : <ChatThreadPage roomId="room" audience={audience} shopId={shopId} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(<QueryClientProvider client={serverClient}>{page}</QueryClientProvider>);
    expect(container.textContent).toContain("chat.connection.offline");
    expect(container.textContent).not.toContain(message.body);
    expect(mocks.fetchRooms).not.toHaveBeenCalled();
    expect(mocks.fetchRoom).not.toHaveBeenCalled();
    if (cached) {
      if (pageType === "inbox") client.setQueryData(chatRoomKeys.list(audience, userId, shopId), { pages: [{ items: [room], pagination: { limit: 30, hasMore: false, nextCursor: null } }], pageParams: [undefined] });
      else client.setQueryData(["chat-room", "room", audience, shopId ?? "", userId], timelineFromRoom(room));
    }
    mocks.session.data = { user: { id: userId } };
    document.body.append(container);
    const serverMain = container.querySelector("main");
    const recoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <QueryClientProvider client={client}>{page}</QueryClientProvider>, { onRecoverableError: recoverableError });
      });
      await waitFor(() => expect(container.textContent).toContain(message.body));
      expect(recoverableError.mock.calls).toEqual([]);
      expect(consoleError.mock.calls).toEqual([]);
      expect(container.textContent).toContain("chat.connection.connecting");
      if (pageType === "inbox") {
        expect(container.querySelector("main")).toBe(serverMain);
        expect(client.getQueryData(chatRoomKeys.list(audience, userId, shopId))).toMatchObject({ pages: [{ items: [room] }] });
      } else expect(container.querySelector("textarea")).toBeTruthy();
    } finally {
      await act(async () => root?.unmount());
      serverClient.clear(); client.clear(); container.remove();
    }
  });
});
