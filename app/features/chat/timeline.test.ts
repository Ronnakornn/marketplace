import { describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatRoom } from "./api";
import { createChatMessageId, mergeMessages, recoverChatGap, timelineFromRoom } from "./timeline";

function message(index: number): ChatMessage {
  return { id: `m${index.toString().padStart(3, "0")}`, sender: { id: "seller", name: "Seller", email: "seller@example.com", role: "SELLER" },
    messageType: "text", body: `Message ${index}`, attachments: [], files: [], product: null, order: null,
    createdAt: new Date(Date.UTC(2026, 9, 13, 0, 0, index)).toISOString() };
}
function page(items: ChatMessage[], hasMore = false): ChatRoom {
  return { roomId: "room", shop: { id: "shop", name: "Shop", slug: "shop", ownerId: "seller" }, buyer: { id: "buyer", name: "Buyer", email: "buyer@example.com", role: "USER" },
    lastMessage: items.at(-1) ?? null, unreadCount: items.length, chatEnabled: true, canSend: true, readBoundary: null, otherReadBoundary: null, messages: items,
    pagination: { page: 1, limit: 30, total: 75, totalPages: 3, hasMore, beforeCursor: items[0]?.id ?? null, afterCursor: items.at(-1)?.id ?? null } };
}
describe("contiguous chat recovery", () => {
  it("generates a valid send UUID on the supported HTTP deployment", () => {
    const randomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
    try {
      expect(createChatMessageId()).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    } finally { Object.defineProperty(crypto, "randomUUID", { configurable: true, value: randomUUID }); }
  });
  it("recovers a 75 message disconnect gap and advances only through fetched pages", async () => {
    const initial = timelineFromRoom(page([message(0)]));
    const own = message(76);
    let cached = mergeMessages(initial.messages, [own]);
    const cursors: (string | null)[] = [];
    const fetchPage = vi.fn(async ({ after }: { after?: string; before?: string }) => {
      const index = Number(after?.slice(1) ?? 0);
      const next = Array.from({ length: Math.min(30, 75 - index) }, (_, offset) => message(index + offset + 1));
      return page(next, index + next.length < 75);
    });
    await recoverChatGap({ cursor: initial.contiguousCursor, fetchPage,
      applyPage: (room, cursor) => { cached = mergeMessages(cached, room.messages ?? []); cursors.push(cursor); } });
    expect(fetchPage.mock.calls.map(([query]) => query.after)).toEqual(["m000", "m030", "m060"]);
    expect(cached.map((item) => item.id)).toEqual(Array.from({ length: 77 }, (_, index) => message(index).id));
    expect(cursors).toEqual(["m030", "m060", "m075"]);
    expect(cursors).not.toContain(own.id);
  });

  it("recovers every first message when an empty room received more than one page offline", async () => {
    const all = Array.from({ length: 75 }, (_, index) => message(index + 1));
    let cached: ChatMessage[] = [];
    const fetchPage = vi.fn(async ({ before }: { before?: string }) => {
      const end = before ? all.findIndex((item) => item.id === before) : all.length;
      return page(all.slice(Math.max(0, end - 30), end), end > 30);
    });
    const cursors: (string | null)[] = [];
    await recoverChatGap({ cursor: null, fetchPage,
      applyPage: (room, cursor) => { cached = mergeMessages(cached, room.messages ?? []); cursors.push(cursor); } });
    expect(cached).toEqual(all);
    expect(fetchPage.mock.calls.map(([query]) => query.before)).toEqual([undefined, "m046", "m016"]);
    expect(cursors).toEqual([null, null, null, "m075"]);
  });

  it("deduplicates retries and sorts tied timestamps by immutable message id", () => {
    const first = message(1);
    const second = { ...message(2), createdAt: first.createdAt };
    expect(mergeMessages([second, first], [{ ...first, body: "Updated" }])).toEqual([{ ...first, body: "Updated" }, second]);
  });

  it("does not apply a page after the room identity has been disposed", async () => {
    let alive = true;
    const applyPage = vi.fn();
    await recoverChatGap({ cursor: "m000", fetchPage: async () => { alive = false; return page([message(1)]); }, applyPage, alive: () => alive });
    expect(applyPage).not.toHaveBeenCalled();
  });
});
