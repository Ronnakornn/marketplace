"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteChatContent, refreshChatMessages, fetchChatRoom, markChatRead, sendChatMessage, type ChatAudience, type ChatMessage, type ChatRoom, type SendChatMessageInput } from "./api";
import { ApiClientError } from "#/lib/api-client";

export interface ChatTimeline {
  room: ChatRoom;
  messages: ChatMessage[];
  contiguousCursor: string | null;
  beforeCursor: string | null;
  hasOlder: boolean;
  reconciledRevision: string | null;
}

export function createChatMessageId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    const latest = previous && previous.contentVersion > message.contentVersion ? previous : message;
    const olderQuote = latest === previous ? message.reply : previous?.reply;
    byId.set(message.id, !latest.deleted && latest.reply && olderQuote && olderQuote.messageId === latest.reply.messageId && olderQuote.contentVersion > latest.reply.contentVersion
      ? { ...latest, reply: olderQuote } : latest);
  }
  return [...byId.values()].map((message) => {
    const quote = message.reply;
    const source = quote ? byId.get(quote.messageId) : undefined;
    if (!quote || !source || source.contentVersion < quote.contentVersion) return message;
    const image = source.files.find((file) => file.id === quote.attachmentId) ?? null;
    const unavailable = source.deleted || !!quote.attachmentId && !image;
    return { ...message, reply: { ...quote, contentVersion: source.contentVersion, unavailable, body: unavailable ? null : source.body, image: unavailable ? null : image } };
  })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function mergeRoom(current: ChatRoom, incoming: ChatRoom): ChatRoom {
  const newerBoundary = (a: ChatRoom['readBoundary'], b: ChatRoom['readBoundary']) => {
    if (!a || !b) return a ?? b;
    return a.createdAt > b.createdAt || a.createdAt === b.createdAt && (a.messageId ?? '') > (b.messageId ?? '') ? a : b;
  };
  const newest = BigInt(current.contentRevision) > BigInt(incoming.contentRevision) ? current : incoming;
  const lastMessages = mergeMessages(current.lastMessage ? [current.lastMessage] : [], incoming.lastMessage ? [incoming.lastMessage] : []);
  return { ...incoming, contentRevision: newest.contentRevision,
    lastMessage: newest === current ? current.lastMessage : BigInt(incoming.contentRevision) > BigInt(current.contentRevision) ? incoming.lastMessage : lastMessages.filter((message) => !message.deleted).at(-1) ?? null,
    readBoundary: newerBoundary(current.readBoundary, incoming.readBoundary), otherReadBoundary: newerBoundary(current.otherReadBoundary, incoming.otherReadBoundary) };
}

export function timelineFromRoom(room: ChatRoom): ChatTimeline {
  const messages = mergeMessages([], room.messages ?? []);
  return {
    room, messages, reconciledRevision: null,
    contiguousCursor: messages.at(-1)?.id ?? null,
    beforeCursor: room.pagination?.beforeCursor ?? messages[0]?.id ?? null,
    hasOlder: room.pagination?.hasMore ?? false,
  };
}

export function mergeTimelineMessages(current: ChatTimeline, messages: ChatMessage[], contentRevision: string): ChatTimeline {
  if (!messages.length) return current;
  const knownIds = new Set(current.messages.map((message) => message.id));
  const hasNewMessages = messages.some((message) => !knownIds.has(message.id));
  return { ...current,
    reconciledRevision: hasNewMessages && current.reconciledRevision !== contentRevision ? null : current.reconciledRevision,
    messages: mergeMessages(current.messages, messages),
  };
}

export async function recoverChatGap({
  cursor, fetchPage, applyPage, alive = () => true,
}: {
  cursor: string | null;
  fetchPage: (query: { after?: string; before?: string }) => Promise<ChatRoom>;
  applyPage: (room: ChatRoom, contiguousCursor: string | null) => void;
  alive?: () => boolean;
}) {
  if (!cursor) {
    const newest = await fetchPage({});
    if (!alive()) return;
    const latestCursor = newest.pagination?.afterCursor ?? newest.messages?.at(-1)?.id ?? null;
    applyPage(newest, null);
    let page = newest;
    while (page.pagination?.hasMore && page.pagination.beforeCursor && alive()) {
      page = await fetchPage({ before: page.pagination.beforeCursor });
      if (!alive()) return;
      applyPage(page, null);
    }
    if (alive()) applyPage(newest, latestCursor);
    return;
  }
  let nextCursor = cursor;
  let pages = 0;
  do {
    const room = await fetchPage({ after: nextCursor });
    if (!alive()) return;
    const next = room.pagination?.afterCursor ?? room.messages?.at(-1)?.id ?? nextCursor;
    applyPage(room, next);
    if (!room.pagination?.hasMore || next === nextCursor) return;
    nextCursor = next;
    if (++pages % 10 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (alive());
}

export function useChatThread({ roomId, audience, shopId, userId }: {
  roomId: string; audience: ChatAudience; shopId?: string; userId?: string;
}) {
  const client = useQueryClient();
  const queryKey = ["chat-room", roomId, audience, shopId ?? "", userId ?? ""];
  const identity = queryKey.join("|");
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const aliveRef = useRef(true);
  const syncingRef = useRef(false);
  const queuedRef = useRef(false);
  const olderRef = useRef(false);
  const readLockRef = useRef(false);
  const sendLockRef = useRef(false);
  const [syncError, setSyncError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [accessError, setAccessError] = useState<Error | null>(null);
  const [olderError, setOlderError] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readError, setReadError] = useState(false);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const room = await fetchChatRoom(roomId, { scope: audience, shopId });
      const previous = client.getQueryData<ChatTimeline>(queryKey);
      return previous ? { ...mergeTimelineMessages(previous, room.messages ?? [], room.contentRevision), room: mergeRoom(previous.room, room) } : timelineFromRoom(room);
    },
    enabled: Boolean(userId) && (audience !== "seller" || Boolean(shopId)),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, [identity]);

  const alive = () => aliveRef.current && identityRef.current === identity;

  async function reconcileLoaded() {
    for (let attempt = 0; attempt < 3 && alive(); attempt++) {
      const current = client.getQueryData<ChatTimeline>(queryKey);
      if (!current || current.reconciledRevision === current.room.contentRevision) return;
      const ids = current.messages.map((message) => message.id);
      let revision: string | null = null;
      let newestRevision = current.room.contentRevision;
      let consistent = true;
      const refreshed: ChatMessage[] = [];
      try {
        for (let offset = 0; offset < ids.length; offset += 50) {
          const batch = await refreshChatMessages(roomId, ids.slice(offset, offset + 50), audience, shopId);
          if (!alive()) return;
          if (revision !== null && revision !== batch.contentRevision) consistent = false;
          revision = batch.contentRevision;
          if (BigInt(batch.contentRevision) > BigInt(newestRevision)) newestRevision = batch.contentRevision;
          refreshed.push(...batch.messages);
        }
      } finally {
        if (alive() && refreshed.length) {
          client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? { ...previous,
            room: { ...previous.room, contentRevision: BigInt(newestRevision) > BigInt(previous.room.contentRevision) ? newestRevision : previous.room.contentRevision },
            messages: mergeMessages(previous.messages, refreshed),
          } : previous);
        }
      }
      const latest = client.getQueryData<ChatTimeline>(queryKey);
      if (latest && consistent && latest.messages.length === ids.length && (revision === null || revision === latest.room.contentRevision)) {
        client.setQueryData<ChatTimeline>(queryKey, { ...latest, reconciledRevision: latest.room.contentRevision });
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('Chat content changed during refresh');
  }

  const sync = useCallback(async () => {
    if (!aliveRef.current || !client.getQueryData<ChatTimeline>(queryKey)) return;
    if (syncingRef.current) { queuedRef.current = true; return; }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      do {
        queuedRef.current = false;
        const current = client.getQueryData<ChatTimeline>(queryKey);
        if (!current) return;
        await recoverChatGap({
          cursor: current.contiguousCursor,
          fetchPage: (cursor) => fetchChatRoom(roomId, { scope: audience, shopId, ...cursor }),
          alive,
          applyPage: (room, contiguousCursor) => {
            client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? {
              ...mergeTimelineMessages(previous, room.messages ?? [], room.contentRevision), room: mergeRoom(previous.room, room), contiguousCursor,
            } : previous);
          },
        });
        await reconcileLoaded();
        const refreshed = client.getQueryData<ChatTimeline>(queryKey);
        if (refreshed && (refreshed.room.lastMessage?.id !== current.room.lastMessage?.id || refreshed.room.contentRevision !== current.room.contentRevision || refreshed.room.unreadCount !== current.room.unreadCount)) {
          void client.invalidateQueries({ queryKey: ["chat-rooms", audience] });
        }
        if (aliveRef.current) { setSyncError(false); setAccessError(null); }
      } while (queuedRef.current && aliveRef.current);
    } catch (error) {
      if (aliveRef.current) {
        setSyncError(true);
        if (error instanceof ApiClientError && [401, 403, 404].includes(error.status ?? 0)) setAccessError(error);
      }
    }
    finally { syncingRef.current = false; if (aliveRef.current) setIsSyncing(false); }
  }, [client, identity, roomId, audience, shopId]);

  useEffect(() => { if (query.isSuccess) void sync(); }, [query.isSuccess, sync]);

  async function loadOlder(beforeApply?: () => void) {
    const current = client.getQueryData<ChatTimeline>(queryKey);
    if (!current?.hasOlder || !current.beforeCursor || olderRef.current) return false;
    olderRef.current = true;
    setLoadingOlder(true);
    try {
      const room = await fetchChatRoom(roomId, { scope: audience, shopId, before: current.beforeCursor });
      if (!alive()) return;
      const ids = (room.messages ?? []).map((message) => message.id);
      const refreshed = ids.length ? await refreshChatMessages(roomId, ids, audience, shopId) : { messages: [], contentRevision: room.contentRevision };
      if (!alive()) return;
      beforeApply?.();
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? {
        ...mergeTimelineMessages(previous, refreshed.messages, refreshed.contentRevision),
        room: { ...previous.room, contentRevision: BigInt(refreshed.contentRevision) > BigInt(previous.room.contentRevision) ? refreshed.contentRevision : previous.room.contentRevision },
        beforeCursor: room.pagination?.beforeCursor ?? previous.beforeCursor,
        hasOlder: room.pagination?.hasMore ?? false,
      } : previous);
      setOlderError(false);
      void sync();
      return true;
    } catch { if (aliveRef.current) setOlderError(true); return false; }
    finally { olderRef.current = false; if (aliveRef.current) setLoadingOlder(false); }
  }

  const sendMutation = useMutation({
    mutationFn: (input: SendChatMessageInput) => sendChatMessage(roomId, input),
    onSuccess: async (room) => {
      if (!alive()) return;
      // Sending reads its message before the room revision, so refresh that snapshot separately.
      let refreshed: Awaited<ReturnType<typeof refreshChatMessages>> | null = null;
      try { refreshed = await refreshChatMessages(roomId, [room.sentMessage.id], audience, shopId); }
      catch { /* The normal sync retries reconciliation after a refresh failure. */ }
      if (!alive()) return;
      client.setQueryData<ChatTimeline>(queryKey, (previous) => {
        if (!previous) return previous;
        const merged = mergeTimelineMessages(previous, refreshed?.messages ?? [], refreshed?.contentRevision ?? '');
        return { ...merged, reconciledRevision: refreshed ? merged.reconciledRevision : null,
          room: mergeRoom(previous.room, { ...room, contentRevision: refreshed?.contentRevision ?? room.contentRevision }),
        };
      });
      void client.invalidateQueries({ queryKey: ["chat-rooms", audience] });
      void sync();
    },
  });

  async function send(input: SendChatMessageInput) {
    if (sendLockRef.current) return false;
    sendLockRef.current = true;
    try { await sendMutation.mutateAsync(input); return true; }
    finally { sendLockRef.current = false; }
  }

  async function acknowledge(throughMessageId: string) {
    if (readLockRef.current) return;
    readLockRef.current = true;
    try {
      const room = await markChatRead(roomId, audience, throughMessageId);
      if (!alive()) return;
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? { ...previous, room: mergeRoom(previous.room, room) } : previous);
      void client.invalidateQueries({ queryKey: ["chat-rooms", audience] });
      void client.invalidateQueries({ queryKey: ["notifications"] });
      setReadError(false);
    } catch { if (aliveRef.current) setReadError(true); }
    finally { readLockRef.current = false; }
  }

  const deleteMutation = useMutation({
    mutationFn: ({ messageId, attachmentId }: { messageId: string; attachmentId?: string }) => deleteChatContent(roomId, messageId, audience, shopId, attachmentId),
    onSuccess: (room) => {
      if (!alive()) return;
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? { ...previous,
        room: mergeRoom(previous.room, room), messages: mergeMessages(previous.messages, [room.changedMessage]),
      } : previous);
      void client.invalidateQueries({ queryKey: ["chat-rooms", audience] });
      void sync();
    },
  });

  return { ...query, isError: query.isError || accessError !== null, error: accessError ?? query.error,
    sync, syncError, isSyncing, loadOlder, loadingOlder, olderError, send, sendMutation, deleteMutation, acknowledge, readError };
}
