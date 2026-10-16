/** @vitest-environment jsdom */
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchChatRooms, fetchChatUnreadCount } from "./api";
import { chatRoomKeys, chatRoomsQueryOptions, chatUnreadQueryOptions } from "./queries";
vi.mock("./api", () => ({ fetchChatRooms: vi.fn().mockResolvedValue({ items: [], pagination: { limit: 30, hasMore: false, nextCursor: null } }), fetchChatUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 75 }) }));

describe("shared chat room queries", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it("gives only the header a periodic whole-inbox summary request when inbox mounts later", async () => {
    const intervals = new Map<NonNullable<Parameters<typeof clearInterval>[0]>, () => void>();
    const originalSet = globalThis.setInterval;
    const originalClear = globalThis.clearInterval;
    const setSpy = vi.spyOn(globalThis, "setInterval").mockImplementation((callback, delay) => {
      const handle = originalSet(callback, delay);
      if (delay === 30_000 && typeof callback === "function") intervals.set(handle, callback);
      return handle;
    });
    const clearSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(handle => {
      if (handle !== undefined) intervals.delete(handle);
      originalClear(handle);
    });
    const client = new QueryClient();
    const header = new QueryObserver(client, {
      ...chatUnreadQueryOptions("buyer", "user"), refetchInterval: 30_000,
    });
    const stopHeader = header.subscribe(() => {});
    await client.fetchQuery(chatUnreadQueryOptions("buyer", "user"));
    const inbox = new QueryObserver(client, chatUnreadQueryOptions("buyer", "user"));
    const stopInbox = inbox.subscribe(() => {});
    try {
      expect(intervals.size).toBe(1);
      for (const tick of [...intervals.values()]) {
        tick();
        await client.fetchQuery(chatUnreadQueryOptions("buyer", "user"));
      }
      expect(fetchChatUnreadCount).toHaveBeenCalledTimes(2);
      expect(fetchChatRooms).not.toHaveBeenCalled();
    } finally {
      stopHeader(); stopInbox(); client.clear(); setSpy.mockRestore(); clearSpy.mockRestore();
    }
  });

  it("shares a fresh header request with a subsequently mounted inbox observer", async () => {
    const client = new QueryClient();
    await client.fetchQuery(chatUnreadQueryOptions("buyer", "user"));
    const inbox = new QueryObserver(client, chatUnreadQueryOptions("buyer", "user"));
    const unsubscribe = inbox.subscribe(() => {});
    expect(fetchChatUnreadCount).toHaveBeenCalledTimes(1);
    expect(inbox.getCurrentResult().data).toEqual({ unreadCount: 75 });
    unsubscribe(); client.clear();
  });

  it("isolates audience, shop and user while retaining prefix invalidation", async () => {
    const client = new QueryClient();
    const keys = [chatRoomKeys.list("buyer", "one"), chatRoomKeys.unread("buyer", "two"),
      chatRoomKeys.list("seller", "one", "shop-a"), chatRoomKeys.list("seller", "one", "shop-b")];
    for (const key of keys) client.setQueryData(key, []);
    await client.invalidateQueries({ queryKey: ["chat-rooms", "buyer"] });
    expect(keys.map(key => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, false, false]);
    expect(chatRoomsQueryOptions("seller", "one").enabled).toBe(false);
    expect(chatRoomsQueryOptions("buyer", "").enabled).toBe(false);
    expect(chatUnreadQueryOptions("buyer", "").enabled).toBe(false);
    client.clear();
  });

  it("loads only the requested first page and keys server filters independently", async () => {
    const client = new QueryClient();
    await client.fetchInfiniteQuery(chatRoomsQueryOptions("buyer", "one", undefined, { q: " buyer ", unreadOnly: true }));
    expect(fetchChatRooms).toHaveBeenCalledTimes(1);
    expect(fetchChatRooms).toHaveBeenCalledWith({ scope: "buyer", shopId: undefined, q: "buyer", unreadOnly: true, limit: 30, cursor: undefined });
    expect(chatRoomKeys.list("buyer", "one", undefined, { q: "Buyer" })).not.toEqual(chatRoomKeys.list("buyer", "one"));
    client.clear();
  });
});
