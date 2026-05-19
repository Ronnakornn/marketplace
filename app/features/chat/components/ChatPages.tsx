"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleIcon, SendIcon, StoreIcon, UserCircleIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { fetchChatRoom, fetchChatRooms, markChatRead, sendChatMessage, type ChatRoom } from "#/features/chat/api";
import { useChatRealtime } from "#/features/chat/realtime";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import { cn } from "#/lib/utils";

type ChatAudience = "buyer" | "seller";

export function ChatInboxPage({ audience }: { audience: ChatAudience }) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const roomsQuery = useQuery({ queryKey: ["chat-rooms"], queryFn: fetchChatRooms });
  const sellerChannels = useMemo(() => {
    if (audience !== "seller") return [];
    const shopIds = new Set((roomsQuery.data ?? []).map((room) => room.shop.id).filter(Boolean));
    return Array.from(shopIds).map((shopId) => `seller:${shopId}:chats`);
  }, [audience, roomsQuery.data]);

  useChatRealtime(sellerChannels);

  return (
    <>
      <BuyerTopBar title={audience === "seller" ? t("chat.sellerInbox") : t("chat.inbox")} />
      <main className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <MessageCircleIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">{audience === "seller" ? t("chat.sellerInbox") : t("chat.inbox")}</h1>
              <p className="text-sm text-slate-500">{t("chat.messages")}</p>
            </div>
          </div>
        </section>

        {roomsQuery.isLoading ? <BuyerLoadingList /> : null}
        {roomsQuery.isError ? <BuyerErrorState message={roomsQuery.error.message} onRetry={() => void roomsQuery.refetch()} /> : null}
        {roomsQuery.data?.length === 0 ? (
          <BuyerEmptyState title={t("chat.emptyInbox")} description={t("chat.emptyInboxDescription")} />
        ) : null}
        {roomsQuery.data?.length ? (
          <div className="space-y-3">
            {roomsQuery.data.map((room) => (
              <ChatRoomListItem
                key={room.roomId}
                room={room}
                audience={audience}
                href={localePath(audience === "seller" ? `/seller/chat/${room.roomId}` : `/chat/${room.roomId}`)}
              />
            ))}
          </div>
        ) : null}
      </main>
    </>
  );
}

export function ChatThreadPage({ roomId, audience }: { roomId: string; audience: ChatAudience }) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const formatters = useFormatters();
  const markedReadRoomRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [body, setBody] = useState("");
  const roomQuery = useQuery({
    queryKey: ["chat-room", roomId],
    queryFn: () => fetchChatRoom(roomId),
  });
  const sendMutation = useMutation({
    mutationFn: (messageBody: string) => sendChatMessage(roomId, messageBody),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["chat-room", roomId] }),
        queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }),
      ]);
      scrollToMessagesEnd("smooth");
    },
  });
  const readMutation = useMutation({
    mutationFn: () => markChatRead(roomId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  useChatRealtime([`chat:${roomId}`]);

  useEffect(() => {
    if (
      roomQuery.data &&
      roomQuery.data.unreadCount > 0 &&
      markedReadRoomRef.current !== roomId &&
      !readMutation.isPending
    ) {
      markedReadRoomRef.current = roomId;
      readMutation.mutate();
    }
  }, [readMutation, roomId, roomQuery.data]);

  const latestMessageId = roomQuery.data?.messages?.at(-1)?.id;

  useEffect(() => {
    if (!latestMessageId) return;
    scrollToMessagesEnd("smooth");
  }, [latestMessageId]);

  function scrollToMessagesEnd(behavior: ScrollBehavior = "auto") {
    const scroll = () => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior,
      });
    };

    window.requestAnimationFrame(() => {
      scroll();
      window.setTimeout(scroll, 80);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitMessage();
  }

  function submitMessage() {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  }

  const room = roomQuery.data;

  return (
    <>
      <BuyerTopBar title={room ? getRoomTitle(room, audience) : t("chat.messages")} />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4">
        <Button variant="outline" className="w-fit rounded-full" asChild>
          <Link href={localePath(audience === "seller" ? "/seller/chat" : "/chat")}>{t("chat.backToInbox")}</Link>
        </Button>

        {roomQuery.isLoading ? <BuyerLoadingList /> : null}
        {roomQuery.isError ? <BuyerErrorState message={roomQuery.error.message} onRetry={() => void roomQuery.refetch()} /> : null}
        {room ? (
          <>
            <ChatContextCard room={room} audience={audience} />
            <section className="min-h-[420px] rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              {room.messages?.length ? (
                <div className="flex flex-col gap-3">
                  {room.messages.map((message) => {
                    const mine = message.sender.id === session?.user.id;
                    return (
                      <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[82%] rounded-3xl px-4 py-2 text-sm shadow-sm",
                          mine ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-900",
                        )}>
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className={cn("mt-1 text-[11px]", mine ? "text-orange-100" : "text-slate-500")}>
                            {message.sender.name} - {formatters.date(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>
              ) : (
                <BuyerEmptyState title={t("chat.emptyThread")} description={t("chat.emptyThreadDescription")} />
              )}
            </section>
            <form onSubmit={handleSubmit} className="sticky bottom-20 rounded-3xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-3">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder={t("chat.typeMessage")}
                className="min-h-24 resize-none rounded-2xl border-slate-200"
              />
              <div className="mt-2 flex justify-end">
                <Button className="rounded-full bg-orange-600 hover:bg-orange-700" disabled={!body.trim() || sendMutation.isPending}>
                  <SendIcon className="size-4" />
                  {sendMutation.isPending ? t("chat.sending") : t("chat.send")}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </main>
    </>
  );
}

function ChatRoomListItem({ room, audience, href }: { room: ChatRoom; audience: ChatAudience; href: string }) {
  const t = useTranslations();
  const formatters = useFormatters();
  const title = getRoomTitle(room, audience);
  const preview = room.lastMessage?.body ?? t("chat.emptyThread");

  return (
    <Link href={href} className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          {audience === "seller" ? <UserCircleIcon className="size-5" /> : <StoreIcon className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-bold text-slate-950">{title}</h2>
            {room.unreadCount > 0 ? (
              <Badge className="rounded-full bg-orange-600">{room.unreadCount} {t("chat.unread")}</Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{preview}</p>
          <p className="mt-2 text-xs text-slate-400">
            {room.lastMessage ? formatters.date(room.lastMessage.createdAt, { dateStyle: "medium", timeStyle: "short" }) : t("chat.noMessages")}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ChatContextCard({ room, audience }: { room: ChatRoom; audience: ChatAudience }) {
  const t = useTranslations();
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full">{audience === "seller" ? t("chat.buyer") : t("chat.seller")}: {getRoomTitle(room, audience)}</Badge>
        {room.product ? <Badge variant="outline" className="rounded-full">{room.product.title}</Badge> : null}
        {room.order ? <Badge variant="outline" className="rounded-full">{room.order.orderNumber}</Badge> : null}
      </div>
    </section>
  );
}

function getRoomTitle(room: ChatRoom, audience: ChatAudience): string {
  return audience === "seller" ? room.buyer.name : room.shop.name;
}
