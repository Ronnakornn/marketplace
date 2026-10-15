/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatRoom } from "../api";
import { ChatInboxPage, ChatThreadPage, chatErrorKey } from "./ChatPages";
import { ApiClientError } from "#/lib/api-client";

const mocks = vi.hoisted(() => ({
  records: new Map<string, ChatMessage>(), refresh: vi.fn(), remove: vi.fn(), fetchRooms: vi.fn(), fetchRoom: vi.fn(), send: vi.fn(), read: vi.fn(), realtime: vi.fn(),
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("#/features/chat/api", async (original) => ({
  ...await original<typeof import("../api")>(), fetchChatRooms: mocks.fetchRooms, fetchChatRoom: async (...args: unknown[]) => { const value = await mocks.fetchRoom(...args); for (const item of value.messages ?? []) mocks.records.set(item.id, item); return value; },
  refreshChatMessages: mocks.refresh, deleteChatContent: mocks.remove,
  sendChatMessage: mocks.send, markChatRead: mocks.read,
}));
vi.mock("#/features/chat/realtime", () => ({ useChatRealtime: mocks.realtime }));
vi.mock("#/i18n/client", () => ({
  useFormatters: () => ({ date: (date: string) => date }), useTranslations: () => (key: string) => key,
}));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => "/th" + path }));
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: { user: { id: "buyer" } } }) }));

export function message(id = "m1", sender = "seller", body = "Hello"): ChatMessage {
  return { id, sender: { id: sender, name: sender, email: sender + "@example.com", role: "USER" }, contentVersion: 0, deleted: false, reply: null, messageType: "text",
    body, attachments: [], files: [], createdAt: `2026-10-13T01:00:${id.replace(/\D/g, "").padStart(2, "0")}.000Z`, product: null, order: null };
}
export function room(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return { contentRevision: "0", roomId: "room", shop: { id: "shop", name: "Shop", slug: "shop", ownerId: "seller" },
    buyer: { id: "buyer", name: "Buyer", email: "buyer@example.com", role: "USER" },
    lastMessage: message(), unreadCount: 1, canSend: true, chatEnabled: true,
    readBoundary: null, otherReadBoundary: null, messages: [message()],
    pagination: { page: 1, limit: 30, total: 1, totalPages: 1, hasMore: false, beforeCursor: "m1", afterCursor: "m1" }, ...overrides };
}
function renderPage(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  mocks.records.clear();
  mocks.refresh.mockImplementation(async (_room: string, ids: string[]) => ({ contentRevision: "0", messages: ids.flatMap((id) => mocks.records.has(id) ? [mocks.records.get(id)] : []) }));
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  mocks.realtime.mockReturnValue("live");
  mocks.fetchRooms.mockResolvedValue([room()]);
  mocks.fetchRoom.mockImplementation((_id: string, query: { after?: string }) => Promise.resolve(query?.after ? room({ messages: [] }) : room()));
  mocks.read.mockImplementation((_id: string, _scope: string, id: string) => Promise.resolve(room({ readBoundary: { messageId: id, createdAt: message(id).createdAt }, unreadCount: 0 })));
  mocks.send.mockImplementation((_id: string, input: { clientMessageId: string; body: string }) =>
    Promise.resolve(room({ sentMessage: { ...message("m2", "buyer", input.body), id: input.clientMessageId } })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("chat inbox", () => {
  it("scopes seller links and supports search and unread filters", async () => {
    mocks.fetchRooms.mockResolvedValue([room(), room({ roomId: "elsewhere", shop: { ...room().shop, id: "other" } })]);
    renderPage(<ChatInboxPage audience="seller" shopId="shop" />);
    const link = await screen.findByRole("link", { name: /Buyer/ });
    expect(link.getAttribute("href")).toBe("/th/seller/chat/room?shopId=shop");
    expect(screen.queryByRole("link", { name: /elsewhere/ })).toBeNull();
    expect(mocks.realtime).toHaveBeenCalledWith(["seller:shop:chats"], expect.any(Function));
    fireEvent.change(screen.getByRole("textbox", { name: "chat.search" }), { target: { value: "unmatched" } });
    expect(screen.getByText("chat.noResults")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "chat.search" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.unreadOnly" }));
    expect(screen.getByRole("link", { name: /Buyer/ })).toBeTruthy();
  });

  it("subscribes buyer inbox and represents legacy image without fetching an attachment", async () => {
    mocks.fetchRooms.mockResolvedValue([room({ lastMessage: { ...message(), messageType: "image", attachments: ["https://untrusted.example/image.jpg"] } })]);
    const { container } = renderPage(<ChatInboxPage audience="buyer" />);
    expect(await screen.findByText("chat.legacyImage")).toBeTruthy();
    expect(mocks.realtime).toHaveBeenCalledWith(["user:buyer:chats"], expect.any(Function));
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("chat thread", () => {
  it('refreshes a late older page even after the deletion revision was already reconciled', async () => {
    const newest = message('m3', 'seller', 'Newest');
    const stale = message('m1', 'seller', 'Removed private history');
    let release: ((value: ChatRoom) => void) | undefined;
    const older = new Promise<ChatRoom>((resolve) => { release = resolve; });
    mocks.fetchRoom.mockImplementation((_id: string, query: { before?: string; after?: string }) => query.before ? older : Promise.resolve(room({ messages: query.after ? [] : [newest], contentRevision: '1', pagination: { ...room().pagination!, beforeCursor: newest.id, afterCursor: newest.id, hasMore: !query.after } })));
    mocks.refresh.mockImplementation(async (_room: string, ids: string[]) => ({ contentRevision: '1', messages: ids.map((id) => id === stale.id ? { ...stale, contentVersion: 1, deleted: true, body: null } : newest) }));
    const { client } = renderPage(<ChatThreadPage audience="buyer" roomId="room" />);
    await screen.findByText('Newest');
    await waitFor(() => expect(client.getQueryData<{ reconciledRevision: string }>(['chat-room', 'room', 'buyer', '', 'buyer'])?.reconciledRevision).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: 'chat.loadOlder' }));
    await act(async () => { release?.(room({ contentRevision: '0', messages: [stale] })); });
    await screen.findByText('chat.messageDeleted');
    expect(screen.queryByText('Removed private history')).toBeNull();
    expect(mocks.refresh).toHaveBeenCalledWith('room', ['m1'], 'buyer', undefined);
  });
  it("sends a file-only selection, supports removal and keeps file identity", async () => {
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const picker = await screen.findByLabelText("chat.attachFiles");
    const first = new File(["one"], "one.txt", { type: "text/plain" });
    const second = new File(["two"], "two.txt", { type: "text/plain" });
    fireEvent.change(picker, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole("button", { name: "chat.removeFile one.txt" }));
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ body: "", files: [second], messageType: "text" });
    expect(mocks.send.mock.calls[0][1].files[0]).toBe(second);
    await waitFor(() => expect(screen.queryByRole("button", { name: "chat.removeFile two.txt" })).toBeNull());
  });

  it("retries the frozen files while preserving a newer selection and context", async () => {
    mocks.send.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(room({ sentMessage: message("m2", "buyer", "") }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" productId="product" />);
    const picker = await screen.findByLabelText("chat.attachFiles");
    const first = new File(["original"], "original.txt", { type: "text/plain" });
    fireEvent.change(picker, { target: { files: [first] } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await screen.findByRole("button", { name: "chat.retrySend" });
    const original = mocks.send.mock.calls[0][1];
    fireEvent.click(screen.getByRole("button", { name: "chat.removeFile original.txt" }));
    const newer = new File(["new"], "new.txt", { type: "text/plain" });
    fireEvent.change(picker, { target: { files: [newer] } });
    fireEvent.click(screen.getByRole("button", { name: "chat.retrySend" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[1][1]).toBe(original);
    expect(mocks.send.mock.calls[1][1].files[0]).toBe(first);
    await waitFor(() => expect(screen.queryByRole("button", { name: "chat.retrySend" })).toBeNull());
    expect(screen.getByRole("button", { name: "chat.removeFile new.txt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "chat.removeContext" })).toBeTruthy();
  });

  it("preserves a pending attachment draft after remove and reselect of the original file", async () => {
    let resolveSend: ((value: ChatRoom) => void) | undefined;
    mocks.send.mockImplementation(() => new Promise<ChatRoom>((resolve) => { resolveSend = resolve; }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const picker = await screen.findByLabelText("chat.attachFiles");
    const file = new File(["same"], "same.txt", { type: "text/plain" });
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "chat.removeFile same.txt" }));
    fireEvent.change(picker, { target: { files: [file] } });
    await act(async () => { resolveSend?.(room({ sentMessage: message("m2", "buyer", "") })); });
    expect(screen.getByRole("button", { name: "chat.removeFile same.txt" })).toBeTruthy();
  });

  it("preserves a newer draft and blocks duplicate submission in the same turn", async () => {
    let resolveSend: ((value: ChatRoom) => void) | undefined;
    mocks.send.mockImplementation(() => new Promise<ChatRoom>((resolve) => { resolveSend = resolve; }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" productId="product" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "First draft" } });
    const form = composer.closest("form");
    if (!form) throw new Error("Composer form missing");
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ body: "First draft", productId: "product", scope: "buyer", messageType: "text" });
    expect(mocks.send.mock.calls[0][1].clientMessageId).toMatch(/^[\da-f-]{36}$/i);
    fireEvent.change(composer, { target: { value: "Second draft" } });
    await act(async () => { resolveSend?.(room({ sentMessage: message("m2", "buyer", "First draft") })); });
    expect((composer as HTMLTextAreaElement).value).toBe("Second draft");
    expect(await screen.findByText("First draft")).toBeTruthy();
  });

  it("keeps a failed draft and retries the same logical send id", async () => {
    mocks.send.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(room({ sentMessage: message("m2", "buyer", "Retry me") }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "Retry me" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    expect(await screen.findByRole("button", { name: "chat.retrySend" })).toBeTruthy();
    expect((composer as HTMLTextAreaElement).value).toBe("Retry me");
    const initial = mocks.send.mock.calls[0][1];
    fireEvent.click(screen.getByRole("button", { name: "chat.retrySend" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[1][1]).toEqual(initial);
  });

  it("does not submit composition or Shift+Enter", async () => {
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "ข้อความ" } });
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true });
    fireEvent.keyDown(composer, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
  });

  it("creates a new logical send after failed context is removed from the same text", async () => {
    mocks.send.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(room({ sentMessage: message("m2", "buyer", "Same text") }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" productId="product" orderId="order" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "Same text" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await screen.findByRole("button", { name: "chat.retrySend" });
    const original = mocks.send.mock.calls[0][1];
    expect(original).toMatchObject({ productId: "product", orderId: "order", body: "Same text" });
    fireEvent.click(screen.getByRole("button", { name: "chat.removeContext" }));
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    const updated = mocks.send.mock.calls[1][1];
    expect(updated.body).toBe("Same text");
    expect(updated.productId).toBeUndefined();
    expect(updated.orderId).toBeUndefined();
    expect(updated.clientMessageId).not.toBe(original.clientMessageId);
  });

  it("explicit retry retains original context and UUID without erasing a different contextual draft", async () => {
    mocks.send.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(room({ sentMessage: message("m2", "buyer", "Retry context") }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" productId="product" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "Retry context" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await screen.findByRole("button", { name: "chat.retrySend" });
    const original = mocks.send.mock.calls[0][1];
    fireEvent.click(screen.getByRole("button", { name: "chat.removeContext" }));
    fireEvent.click(screen.getByRole("button", { name: "chat.retrySend" }));
    await screen.findByText("Retry context", { selector: "p" });
    expect(mocks.send.mock.calls[1][1]).toEqual(original);
    expect(composer).toHaveProperty("value", "Retry context");
  });

  it.each([["", "Original"], ["Edited", "Original"]])("preserves an edited draft restored to the submitted text (%s)", async (firstEdit, restored) => {
    let resolveSend: ((value: ChatRoom) => void) | undefined;
    mocks.send.mockImplementation(() => new Promise<ChatRoom>((resolve) => { resolveSend = resolve; }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "Original" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await waitFor(() => expect(resolveSend).toBeDefined());
    fireEvent.change(composer, { target: { value: firstEdit } });
    fireEvent.change(composer, { target: { value: restored } });
    await act(async () => resolveSend?.(room({ sentMessage: message("m2", "buyer", "Original") })));
    expect(composer).toHaveProperty("value", "Original");
  });

  it("preserves draft text after removing context while its send is pending", async () => {
    let resolveSend: ((value: ChatRoom) => void) | undefined;
    mocks.send.mockImplementation(() => new Promise<ChatRoom>((resolve) => { resolveSend = resolve; }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" productId="product" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "Context draft" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await waitFor(() => expect(resolveSend).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "chat.removeContext" }));
    await act(async () => resolveSend?.(room({ sentMessage: message("m2", "buyer", "Context draft") })));
    expect(composer).toHaveProperty("value", "Context draft");
    expect(screen.queryByRole("button", { name: "chat.removeContext" })).toBeNull();
  });

  it("acknowledges later incoming messages repeatedly and stops while viewing older history", async () => {
    const { client } = renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    await screen.findByText("Hello");
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("room", "buyer", "m1"));
    const log = screen.getByRole("log");
    Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 } });
    log.scrollTop = 100; fireEvent.scroll(log);
    const key = ["chat-room", "room", "buyer", "", "buyer"];
    await act(async () => {
      client.setQueryData(key, { room: room(), messages: [message(), message("m2", "seller", "Later")], contiguousCursor: "m2", beforeCursor: "m1", hasOlder: false });
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(log.scrollTop).toBe(100);
    fireEvent.click(screen.getByRole("button", { name: "chat.latestMessages" }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("room", "buyer", "m2"));
  });

  it("does not acknowledge hidden conversations", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    await screen.findByText("Hello");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("keeps own send outside the contiguous boundary until missing incoming messages are recovered", async () => {
    const seenRoom = room({ unreadCount: 0, readBoundary: { messageId: "m1", createdAt: message().createdAt } });
    let sending = false;
    let resolveGap: ((value: ChatRoom) => void) | undefined;
    mocks.fetchRoom.mockImplementation((_id: string, query: { after?: string }) => {
      if (query.after && sending) return new Promise<ChatRoom>((resolve) => { resolveGap = resolve; });
      return Promise.resolve(query.after ? { ...seenRoom, messages: [] } : seenRoom);
    });
    mocks.send.mockImplementation(async () => { sending = true; return { ...seenRoom, sentMessage: message("m3", "buyer", "My reply") }; });
    const { client } = renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    const composer = await screen.findByRole("textbox", { name: "chat.typeMessage" });
    fireEvent.change(composer, { target: { value: "My reply" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    await screen.findByText("My reply");
    await waitFor(() => expect(resolveGap).toBeDefined());
    const timeline = client.getQueryData<{ contiguousCursor: string }>(["chat-room", "room", "buyer", "", "buyer"]);
    expect(timeline?.contiguousCursor).toBe("m1");
    expect(mocks.read).not.toHaveBeenCalled();
    await act(async () => resolveGap?.({ ...seenRoom, messages: [message("m2", "seller", "Recovered incoming"), message("m3", "buyer", "My reply")],
      pagination: { page: 1, limit: 30, total: 3, totalPages: 1, hasMore: false, beforeCursor: "m2", afterCursor: "m3" } }));
    await screen.findByText("Recovered incoming");
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("room", "buyer", "m3"));
  });

  it("honors a legacy timestamp read boundary without repeatedly acknowledging tied messages", async () => {
    mocks.fetchRoom.mockResolvedValue(room({ readBoundary: { messageId: null, createdAt: message().createdAt },
      otherReadBoundary: { messageId: null, createdAt: message().createdAt },
      messages: [message(), { ...message("m2", "buyer", "My read message"), createdAt: message().createdAt }] }));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    await screen.findByText("My read message");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(mocks.read).not.toHaveBeenCalled();
    expect(screen.getByText("chat.read")).toBeTruthy();
  });

  it("preserves the scroll anchor while prepending older messages", async () => {
    mocks.fetchRoom.mockImplementation((_id: string, query: { after?: string; before?: string }) =>
      Promise.resolve(query?.before ? room({ messages: [message("m0", "seller", "Earlier")], pagination: { ...room().pagination!, hasMore: false, beforeCursor: "m0" } })
        : query?.after ? room({ messages: [] }) : room({ pagination: { ...room().pagination!, hasMore: true } })));
    renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    await screen.findByText("Hello");
    const log = screen.getByRole("log");
    Object.defineProperties(log, { scrollHeight: { configurable: true, get: () => log.querySelector('[data-message-id="m0"]') ? 700 : 500 }, clientHeight: { configurable: true, value: 200 } });
    log.scrollTop = 100; fireEvent.scroll(log);
    fireEvent.click(screen.getByRole("button", { name: "chat.loadOlder" }));
    await screen.findByText("Earlier");
    expect(log.scrollTop).toBe(300);
  });

  it("shows disabled chat state and safely renders legacy image history", async () => {
    mocks.fetchRoom.mockResolvedValue(room({ canSend: false, chatEnabled: false, messages: [{ ...message(), messageType: "image", attachments: ["https://untrusted.example/a.png"] }] }));
    const { container } = renderPage(<ChatThreadPage roomId="room" audience="buyer" />);
    expect(await screen.findByText("chat.disabled")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "chat.typeMessage" })).toBeNull();
    expect(screen.getByText("chat.legacyImage")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("chat error translation", () => {
  it("represents disabled chat and unsupported attachments before broad access status", () => {
    expect(chatErrorKey(new ApiClientError("disabled", 403, "SHOP_CHAT_DISABLED"))).toBe("chat.disabled");
    expect(chatErrorKey(new ApiClientError("unsupported", 403, "CHAT_ATTACHMENT_UNSUPPORTED"))).toBe("chat.attachmentUnsupported");
  });
});
