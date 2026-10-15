"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowLeftIcon, CheckCheckIcon, ImageIcon, MessageCircleIcon, SearchIcon, SendIcon, StoreIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { fetchChatRooms, type ChatAudience, type ChatMessage, type ChatRoom, type SendChatMessageInput } from "../api";
import { useChatRealtime, type ChatConnectionStatus } from "../realtime";
import { createChatMessageId, useChatThread } from "../timeline";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import { ApiClientError } from "#/lib/api-client";
import { cn } from "#/lib/utils";
import { CHAT_ATTACHMENT_ACCEPT, CHAT_ATTACHMENT_POLICY } from "#/lib/chat-attachments";

const subscribeToHydration = () => () => undefined;

function useChatViewer() {
  const { data: session } = useSession();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return { hydrated, currentSession: hydrated ? session : null };
}

export function ChatInboxPage({ audience, shopId }: { audience: ChatAudience; shopId?: string }) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const { currentSession: session } = useChatViewer();
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const roomsQuery = useQuery({
    queryKey: ["chat-rooms", audience, shopId ?? "", session?.user.id ?? ""],
    queryFn: () => fetchChatRooms(audience, shopId),
    enabled: Boolean(session) && (audience !== "seller" || Boolean(shopId)),
    retry: false,
  });
  const channels = !session ? [] : audience === "seller" && shopId ? [`seller:${shopId}:chats`]
    : audience === "buyer" && session?.user.id ? [`user:${session.user.id}:chats`] : [];
  const status = useChatRealtime(channels, () => { void roomsQuery.refetch(); });
  const scopedRooms = !session || roomsQuery.isError ? [] : (roomsQuery.data ?? [])
    .filter((room) => audience !== "seller" || room.shop.id === shopId);
  const rooms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return scopedRooms.filter((room) => (!unreadOnly || room.unreadCount > 0) &&
      (!needle || [getRoomTitle(room, audience), room.shop.name, room.lastMessage?.body ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(needle))));
  }, [scopedRooms, audience, search, unreadOnly]);
  const inboxTitle = t(audience === "seller" ? "chat.sellerInbox" : "chat.inbox");

  return <>
    {audience === "buyer" ? <BuyerTopBar title={inboxTitle} /> : null}
    <main className="mx-auto max-w-4xl space-y-4 px-3 py-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><MessageCircleIcon className="size-6 text-orange-600" aria-hidden="true" /><div>
            <h1 className="text-xl font-semibold text-slate-950">{inboxTitle}</h1>
            <p className="text-sm text-slate-500">{t("chat.inboxDescription")}</p>
          </div></div>
          <ConnectionStatus status={status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1"><SearchIcon className="absolute top-3 left-3 size-4 text-slate-400" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("chat.search")} placeholder={t("chat.search")} className="pl-9" />
          </div>
          <Button variant={unreadOnly ? "default" : "outline"} aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)}>{t("chat.unreadOnly")}</Button>
        </div>
      </section>
      {session && roomsQuery.isLoading ? <BuyerLoadingList /> : null}
      {session && roomsQuery.isError ? <BuyerErrorState message={t(chatErrorKey(roomsQuery.error))} onRetry={() => void roomsQuery.refetch()} /> : null}
      {session && roomsQuery.isSuccess && !scopedRooms.length ? <BuyerEmptyState title={t("chat.emptyInbox")} description={t("chat.emptyInboxDescription")} /> : null}
      {scopedRooms.length > 0 && !rooms.length ? <BuyerEmptyState title={t("chat.noResults")} description={t("chat.noResultsDescription")} /> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white empty:hidden">
        {rooms.map((room) => <ChatRoomListItem key={room.roomId} room={room} audience={audience} href={chatHref(localePath, audience, room.roomId, shopId)} />)}
      </div>
    </main>
  </>;
}

export function ChatThreadPage(props: {
  roomId: string; audience: ChatAudience; shopId?: string; productId?: string; orderId?: string;
}) {
  const { currentSession: session } = useChatViewer();
  return <ChatThread key={[props.roomId, props.audience, props.shopId ?? "", session?.user.id ?? ""].join("|")} {...props} userId={session?.user.id} />;
}

function ChatThread({ roomId, audience, shopId, productId, orderId, userId }: {
  roomId: string; audience: ChatAudience; shopId?: string; productId?: string; orderId?: string; userId?: string;
}) {
  const t = useTranslations();
  const localePath = useLocalePath();
  const formatters = useFormatters();
  const thread = useChatThread({ roomId, audience, shopId, userId });
  const status = useChatRealtime(userId ? [`chat:${roomId}`] : [], () => { void thread.sync(); });
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectionError, setSelectionError] = useState(false);
  const draftRevisionRef = useRef(0);
  const sendLockRef = useRef(false);
  const failedRef = useRef<SendChatMessageInput | null>(null);
  const failedRevisionRef = useRef<number | null>(null);
  const [failedMessage, setFailedMessage] = useState<SendChatMessageInput | null>(null);
  const [context, setContext] = useState<Pick<SendChatMessageInput, "productId" | "orderId">>({ productId, orderId });
  const [atBottom, setAtBottom] = useState(true);
  const [active, setActive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef(true);
  const previousLatestRef = useRef<string | null>(null);
  const previousHeightRef = useRef<{ height: number; top: number } | null>(null);
  const data = !userId || thread.isError ? undefined : thread.data;
  const room = data?.room;
  const messages = data?.messages ?? [];
  const latestId = messages.at(-1)?.id ?? null;
  const latestContiguous = data?.contiguousCursor ? messages.find((message) => message.id === data.contiguousCursor) : undefined;
  const readBoundary = room?.readBoundary;
  const needsRead = latestContiguous && messages.some((message) => message.sender.id !== userId &&
    compareMessageBoundary(message, latestContiguous) <= 0 && (!readBoundary || compareMessageBoundary(message, readBoundary) > 0));

  useEffect(() => {
    const update = () => setActive(document.visibilityState === "visible" && document.hasFocus());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    update();
    return () => { document.removeEventListener("visibilitychange", update); window.removeEventListener("focus", update); window.removeEventListener("blur", update); };
  }, []);

  useEffect(() => {
    if (!active || !atBottom || thread.isSyncing || !needsRead || !latestContiguous) return;
    const timer = setTimeout(() => { void thread.acknowledge(latestContiguous.id); }, thread.readError ? 2_000 : 150);
    return () => clearTimeout(timer);
  }, [active, atBottom, thread.isSyncing, needsRead, latestContiguous?.id, readBoundary?.messageId, thread.readError, thread.acknowledge]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (previousHeightRef.current) {
      const previous = previousHeightRef.current;
      element.scrollTop = previous.top + element.scrollHeight - previous.height;
      previousHeightRef.current = null;
    } else if (bottomRef.current && latestId !== previousLatestRef.current) {
      element.scrollTop = element.scrollHeight;
    }
    previousLatestRef.current = latestId;
  }, [latestId, messages.length]);

  function scrollToBottom() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    bottomRef.current = true;
    setAtBottom(true);
  }

  async function loadOlder() {
    const element = scrollRef.current;
    if (!element) return;
    if (!await thread.loadOlder(() => {
      previousHeightRef.current = { height: element.scrollHeight, top: element.scrollTop };
    })) previousHeightRef.current = null;
  }

  async function submitMessage(retry?: SendChatMessageInput) {
    if (sendLockRef.current || !room?.canSend) return;
    const trimmed = body.trim();
    const matchesDraft = (input: SendChatMessageInput) => input.body === trimmed
      && input.productId === context.productId && input.orderId === context.orderId
      && (input.files ?? []).length === files.length && files.every((file, index) => input.files?.[index] === file);
    const input = retry ?? (failedRef.current && failedRevisionRef.current === draftRevisionRef.current && matchesDraft(failedRef.current) ? failedRef.current : {
      messageType: "text", body: trimmed, files: [...files], clientMessageId: createChatMessageId(), scope: audience, ...context,
    } satisfies SendChatMessageInput);
    if (!input.body?.trim() && !input.files?.length) return;
    sendLockRef.current = true;
    const submittedRevision = retry ? failedRevisionRef.current ?? draftRevisionRef.current : draftRevisionRef.current;
    try {
      const sent = await thread.send(input);
      if (!sent) return;
      failedRef.current = null;
      setFailedMessage(null);
      if (draftRevisionRef.current === submittedRevision && matchesDraft(input)) {
        draftRevisionRef.current += 1;
        setBody("");
        setFiles([]);
        setContext({});
      }
    } catch {
      failedRef.current = input;
      failedRevisionRef.current = submittedRevision;
      setFailedMessage(input);
    } finally { sendLockRef.current = false; }
  }

  function selectFiles(selected: File[]) {
    const next = [...files, ...selected];
    if (next.length > CHAT_ATTACHMENT_POLICY.maxFiles || next.some((file) => !file.size || file.size > CHAT_ATTACHMENT_POLICY.maxFileBytes)
      || next.reduce((total, file) => total + file.size, 0) > CHAT_ATTACHMENT_POLICY.maxTotalBytes
      || next.some((file) => !Object.keys(CHAT_ATTACHMENT_POLICY.formats).includes(file.name.split('.').at(-1)?.toLowerCase() ?? ''))) {
      setSelectionError(true);
      return;
    }
    draftRevisionRef.current += 1;
    setSelectionError(false);
    setFiles(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submitMessage(); }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void submitMessage();
  }

  const title = room ? getRoomTitle(room, audience) : t("chat.messages");
  return <>
    {audience === "buyer" ? <BuyerTopBar title={title} /> : null}
    <main className="mx-auto max-w-5xl px-3 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild><Link href={chatHref(localePath, audience, undefined, shopId)}><ArrowLeftIcon className="size-4" />{t("chat.backToInbox")}</Link></Button>
        <ConnectionStatus status={status} />
      </div>
      {userId && thread.isLoading ? <BuyerLoadingList /> : null}
      {userId && thread.isError ? <BuyerErrorState message={t(chatErrorKey(thread.error))} onRetry={() => void thread.refetch()} /> : null}
      {room ? <section className="flex h-[calc(100dvh-15rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-auto">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><StoreIcon className="size-5" aria-hidden="true" /></div>
          <div className="min-w-0"><h1 className="truncate font-semibold text-slate-950">{title}</h1><p className="truncate text-xs text-slate-500">{audience === "seller" ? room.shop.name : t("chat.seller")}</p></div>
          {audience === "buyer" ? <Button variant="outline" size="sm" asChild className="ml-auto"><Link href={localePath(`/shops/${room.shop.slug}`)}>{t("chat.viewShop")}</Link></Button> : null}
        </header>
        {thread.syncError ? <p role="status" className="bg-amber-50 px-4 py-2 text-sm text-amber-900">{t("chat.syncError")} <Button size="sm" variant="ghost" onClick={() => void thread.sync()}>{t("chat.retry")}</Button></p> : null}
        <div ref={scrollRef} onScroll={(event) => {
          const element = event.currentTarget;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
          bottomRef.current = bottom; setAtBottom(bottom);
        }} role="log" aria-label={t("chat.messages")} aria-live={atBottom ? "polite" : "off"} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:h-[min(55dvh,600px)] md:min-h-[240px] md:flex-none md:py-4">
          <div className="space-y-3 py-4 md:py-0">
          {data?.hasOlder ? <div className="flex justify-center"><Button variant="outline" size="sm" disabled={thread.loadingOlder} onClick={() => void loadOlder()}>{t(thread.loadingOlder ? "chat.loadingOlder" : "chat.loadOlder")}</Button></div> : null}
          {thread.olderError ? <p role="alert" className="text-center text-sm text-red-700">{t("chat.historyError")}</p> : null}
          {!messages.length ? <BuyerEmptyState title={t("chat.emptyThread")} description={t("chat.emptyThreadDescription")} /> : null}
          {messages.map((message) => {
            const mine = message.sender.id === userId;
            const read = mine && room.otherReadBoundary && compareMessageBoundary(message, room.otherReadBoundary) <= 0;
            return <div key={message.id} data-message-id={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("min-w-0 max-w-[88%] rounded-2xl px-3 py-2 sm:max-w-[75%]", mine ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-900")}>
                <MessageContext message={message} audience={audience} />
                {message.messageType === "image" && !message.files.length ? <p className="flex items-center gap-2 text-sm"><ImageIcon className="size-4" aria-hidden="true" />{t("chat.legacyImage")}</p> : null}
                {message.files.map((file) => <div key={file.id} className="mb-2 min-w-0 space-y-1">
                  {file.kind === "IMAGE" ? <a href={`${file.contentUrl}?scope=${audience}${shopId ? `&shopId=${encodeURIComponent(shopId)}` : ""}`} target="_blank" rel="noreferrer">
                    <img src={`${file.contentUrl}?scope=${audience}${shopId ? `&shopId=${encodeURIComponent(shopId)}` : ""}`} alt={file.fileName} width={256} height={192} className="h-48 w-64 max-w-full rounded-lg object-contain" />
                  </a> : null}
                  <a className="block break-all text-sm underline underline-offset-2" href={`${file.contentUrl}?mode=download&scope=${audience}${shopId ? `&shopId=${encodeURIComponent(shopId)}` : ""}`} download={file.fileName}>{file.fileName} · {Math.ceil(file.byteSize / 1024)} KiB · {t("chat.download")}</a>
                </div>)}
                {message.body ? <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.body}</p> : null}
                <p className={cn("mt-1 flex flex-wrap items-center justify-end gap-1 text-[11px]", mine ? "text-orange-100" : "text-slate-500")}>
                  {!mine ? <span>{message.sender.name}</span> : null}
                  <time dateTime={message.createdAt}>{formatters.date(message.createdAt, { dateStyle: "short", timeStyle: "short" })}</time>
                  {read ? <span className="inline-flex items-center gap-1"><CheckCheckIcon className="size-3" aria-hidden="true" />{t("chat.read")}</span> : null}
                </p>
              </div>
            </div>;
          })}
          </div>
        </div>
        {!atBottom && latestId ? <div className="flex justify-center border-t border-slate-100 py-2"><Button size="sm" variant="outline" onClick={scrollToBottom}><ArrowDownIcon className="size-4" />{t("chat.latestMessages")}</Button></div> : null}
        <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 p-3">
          {!room.canSend ? <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">{t(room.chatEnabled ? "chat.sendingUnavailable" : "chat.disabled")}</p> : <>
            {context.productId || context.orderId ? <div className="mb-2 flex items-center gap-2 text-xs text-slate-600"><Badge variant="outline">{t(context.orderId ? "chat.aboutOrder" : "chat.aboutProduct")}</Badge><Button type="button" variant="ghost" size="sm" onClick={() => { draftRevisionRef.current += 1; setContext({}); }}>{t("chat.removeContext")}</Button></div> : null}
            <label htmlFor="chat-message" className="sr-only">{t("chat.typeMessage")}</label>
            <Textarea id="chat-message" value={body} maxLength={4000} onChange={(event) => { draftRevisionRef.current += 1; setBody(event.target.value); }} onKeyDown={handleKeyDown} placeholder={t("chat.typeMessage")} className="max-h-40 min-h-20 resize-y" />
            <div className="mt-2 max-h-32 space-y-2 overflow-y-auto">
              {files.map((file, index) => <SelectedChatFile key={`${index}-${file.name}`} file={file} onRemove={() => { draftRevisionRef.current += 1; setFiles((current) => current.filter((_, position) => position !== index)); }} />)}
            </div>
            <label htmlFor="chat-files" className="mt-2 block text-xs text-slate-600">{t("chat.attachFiles")}</label>
            <Input id="chat-files" type="file" multiple accept={CHAT_ATTACHMENT_ACCEPT} aria-describedby="chat-file-help" onChange={(event) => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} className="mt-1 h-auto min-w-0 max-w-full text-xs" />
            <p id="chat-file-help" className="mt-1 text-xs text-slate-500">{t("chat.attachmentHelp")}</p>
            {selectionError ? <p role="alert" className="text-xs text-red-700">{t("chat.invalidAttachment")}</p> : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p id="chat-send-help" className="text-xs text-slate-500">{t("chat.sendHelp")} <span>{body.length}/4000</span></p><Button aria-describedby="chat-send-help" className="bg-orange-600 hover:bg-orange-700" disabled={(!body.trim() && !files.length) || thread.sendMutation.isPending}><SendIcon className="size-4" />{t(thread.sendMutation.isPending ? "chat.sending" : "chat.send")}</Button></div>
          </>}
          {failedMessage ? <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-800"><p>{t(chatErrorKey(thread.sendMutation.error, "chat.sendError"))}</p><Button type="button" variant="outline" size="sm" disabled={thread.sendMutation.isPending || !room.canSend} onClick={() => void submitMessage(failedMessage)}>{t("chat.retrySend")}</Button></div> : null}
          {thread.readError ? <p role="status" className="mt-2 text-xs text-amber-800">{t("chat.readError")}</p> : null}
        </form>
      </section> : null}
    </main>
  </>;
}

function ChatRoomListItem({ room, href, audience }: { room: ChatRoom; href: string; audience: ChatAudience }) {
  const t = useTranslations();
  const formatters = useFormatters();
  return <Link href={href} className="flex items-start gap-3 border-b border-slate-100 p-4 transition-colors last:border-0 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><StoreIcon className="size-5" aria-hidden="true" /></div>
    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="truncate font-semibold text-slate-950">{getRoomTitle(room, audience)}</h2>{room.unreadCount > 0 ? <Badge className="shrink-0 bg-orange-600">{room.unreadCount} {t("chat.unread")}</Badge> : null}</div>
      <p className="mt-1 truncate text-sm text-slate-500">{room.lastMessage?.messageType === "image" && !room.lastMessage.files.length ? t("chat.legacyImage") : room.lastMessage?.body || (room.lastMessage?.files.length ? t("chat.attachedFiles") : t("chat.emptyThread"))}</p>
      <p className="mt-2 text-xs text-slate-400">{room.lastMessage ? formatters.date(room.lastMessage.createdAt, { dateStyle: "medium", timeStyle: "short" }) : t("chat.noMessages")}</p>
    </div>
  </Link>;
}

function ConnectionStatus({ status }: { status: ChatConnectionStatus }) {
  const t = useTranslations();
  return <p role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span className={cn("size-1.5 rounded-full", status === "live" ? "bg-emerald-500" : status === "offline" ? "bg-slate-400" : "bg-amber-500")} aria-hidden="true" />{t(`chat.connection.${status}`)}</p>;
}

function MessageContext({ message, audience }: { message: ChatMessage; audience: ChatAudience }) {
  const localePath = useLocalePath();
  const t = useTranslations();
  if (!message.product && !message.order) return null;
  return <div className="mb-2 flex flex-col gap-1 rounded-lg border border-current/20 p-2 text-xs">
    {message.product ? <Link className="break-words font-medium underline underline-offset-2" href={localePath(audience === "seller" ? `/seller/products/${message.product.id}` : `/products/${message.product.slug}`)}>{message.product.title}</Link> : null}
    {message.order ? audience === "seller"
      ? <span className="break-words">{t("chat.aboutOrder")} · {message.order.orderNumber}</span>
      : <Link className="break-words font-medium underline underline-offset-2" href={localePath(`/orders/${message.order.id}`)}>{message.order.orderNumber}</Link> : null}
  </div>;
}

function compareMessageBoundary(message: Pick<ChatMessage, "createdAt" | "id">, boundary: { createdAt: string; messageId?: string | null; id?: string }) {
  const time = message.createdAt.localeCompare(boundary.createdAt);
  if (time) return time;
  const id = boundary.id ?? boundary.messageId;
  return id ? message.id.localeCompare(id) : 0;
}

function getRoomTitle(room: ChatRoom, audience: ChatAudience) { return audience === "seller" ? room.buyer.name : room.shop.name; }

function chatHref(localePath: (path: string) => string, audience: ChatAudience, roomId?: string, shopId?: string) {
  const base = localePath(`${audience === "seller" ? "/seller/chat" : "/chat"}${roomId ? `/${roomId}` : ""}`);
  return audience === "seller" && shopId ? `${base}?shopId=${encodeURIComponent(shopId)}` : base;
}

export function chatErrorKey(error: unknown, fallback = "chat.loadError") {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 401) return "chat.signInRequired";
  if (error.code === "SHOP_CHAT_DISABLED" || error.code === "CHAT_DISABLED" || error.code === "FEATURE_DISABLED") return "chat.disabled";
  if (error.code === "CHAT_ATTACHMENT_UNSUPPORTED") return "chat.attachmentUnsupported";
  if (error.code === "INVALID_CHAT_ATTACHMENT" || error.status === 413) return "chat.invalidAttachment";
  if (error.status === 403 || error.code === "CHAT_FORBIDDEN") return "chat.accessDenied";
  if (error.status === 404) return "chat.notFound";
  if (error.status === 409) return "chat.sendConflict";
  if (error.code === "INVALID_MESSAGE" || error.code === "MESSAGE_BODY_REQUIRED") return "chat.invalidMessage";
  return fallback;
}

function SelectedChatFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const t = useTranslations();
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 p-2">
    {preview ? <img src={preview} alt="" width={40} height={40} className="size-10 shrink-0 rounded object-cover" /> : null}
    <p className="min-w-0 flex-1 break-all text-xs">{file.name} · {Math.ceil(file.size / 1024)} KiB</p>
    <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label={`${t("chat.removeFile")} ${file.name}`}>{t("chat.removeFile")}</Button>
  </div>;
}
