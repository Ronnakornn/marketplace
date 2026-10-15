import { describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatRoom } from "./api";
import { createChatMessageId, mergeMessages, mergeRoom, recoverChatGap, timelineFromRoom } from "./timeline";

function message(index: number): ChatMessage {
  return { id: `m${index.toString().padStart(3, "0")}`, sender: { id: "seller", name: "Seller", email: "seller@example.com", role: "SELLER" },
    contentVersion: 0, deleted: false, reply: null, messageType: "text", body: `Message ${index}`, attachments: [], files: [], product: null, order: null,
    createdAt: new Date(Date.UTC(2026, 9, 13, 0, 0, index)).toISOString() };
}
function page(items: ChatMessage[], hasMore = false): ChatRoom {
  return { contentRevision: "0", roomId: "room", shop: { id: "shop", name: "Shop", slug: "shop", ownerId: "seller" }, buyer: { id: "buyer", name: "Buyer", email: "buyer@example.com", role: "USER" },
    lastMessage: items.at(-1) ?? null, unreadCount: items.length, chatEnabled: true, canSend: true, readBoundary: null, otherReadBoundary: null, messages: items,
    pagination: { page: 1, limit: 30, total: 75, totalPages: 3, hasMore, beforeCursor: items[0]?.id ?? null, afterCursor: items.at(-1)?.id ?? null } };
}
describe("contiguous chat recovery", () => {
  it('does not restore deleted bodies or quote content from any stale message response', () => {
    const source = message(1);
    const reply = { ...message(2), reply: { messageId: source.id, attachmentId: null, contentVersion: 0, unavailable: false, sender: source.sender, body: source.body, image: null } };
    const deleted = { ...source, contentVersion: 1, deleted: true, body: null };
    const redacted = mergeMessages([source, reply], [deleted]);
    expect(redacted[1].reply).toMatchObject({ contentVersion: 1, unavailable: true, body: null });
    expect(mergeMessages(redacted, [source, reply])).toEqual(redacted);
    expect(mergeMessages([redacted[1]], [reply])[0].reply).toMatchObject({ contentVersion: 1, unavailable: true, body: null });
  });
  it('retains a higher room revision and read boundary against a late read or send response', () => {
    const latest = { ...page([]), contentRevision: '9007199254740993', readBoundary: { messageId: 'm003', createdAt: message(3).createdAt } };
    const stale = { ...page([message(1)]), contentRevision: '9007199254740992', readBoundary: { messageId: 'm001', createdAt: message(1).createdAt } };
    expect(mergeRoom(latest, stale)).toMatchObject({ contentRevision: latest.contentRevision, readBoundary: latest.readBoundary, lastMessage: null });
  });
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
