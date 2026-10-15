"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChatRoom, markChatRead, sendChatMessage, type ChatAudience, type ChatMessage, type ChatRoom, type SendChatMessageInput } from "./api";
import { ApiClientError } from "#/lib/api-client";

export interface ChatTimeline {
  room: ChatRoom;
  messages: ChatMessage[];
  contiguousCursor: string | null;
  beforeCursor: string | null;
  hasOlder: boolean;
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
  return [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function timelineFromRoom(room: ChatRoom): ChatTimeline {
  const messages = mergeMessages([], room.messages ?? []);
  return {
    room, messages,
    contiguousCursor: messages.at(-1)?.id ?? null,
    beforeCursor: room.pagination?.beforeCursor ?? messages[0]?.id ?? null,
    hasOlder: room.pagination?.hasMore ?? false,
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
    queryFn: async () => timelineFromRoom(await fetchChatRoom(roomId, { scope: audience, shopId })),
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
          alive: () => aliveRef.current,
          applyPage: (room, contiguousCursor) => {
            client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? {
              ...previous, room, contiguousCursor,
              messages: mergeMessages(previous.messages, room.messages ?? []),
            } : previous);
          },
        });
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
      if (!aliveRef.current) return;
      beforeApply?.();
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? {
        ...previous,
        messages: mergeMessages(previous.messages, room.messages ?? []),
        beforeCursor: room.pagination?.beforeCursor ?? previous.beforeCursor,
        hasOlder: room.pagination?.hasMore ?? false,
      } : previous);
      setOlderError(false);
      return true;
    } catch { if (aliveRef.current) setOlderError(true); return false; }
    finally { olderRef.current = false; if (aliveRef.current) setLoadingOlder(false); }
  }

  const sendMutation = useMutation({
    mutationFn: (input: SendChatMessageInput) => sendChatMessage(roomId, input),
    onSuccess: (room) => {
      if (!aliveRef.current) return;
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? {
        ...previous, room,
        messages: mergeMessages(previous.messages, [room.sentMessage]),
      } : previous);
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
      if (!aliveRef.current) return;
      client.setQueryData<ChatTimeline>(queryKey, (previous) => previous ? { ...previous, room } : previous);
      void client.invalidateQueries({ queryKey: ["chat-rooms", audience] });
      void client.invalidateQueries({ queryKey: ["notifications"] });
      setReadError(false);
    } catch { if (aliveRef.current) setReadError(true); }
    finally { readLockRef.current = false; }
  }

  return { ...query, isError: query.isError || accessError !== null, error: accessError ?? query.error,
    sync, syncError, isSyncing, loadOlder, loadingOlder, olderError, send, sendMutation, acknowledge, readError };
}
