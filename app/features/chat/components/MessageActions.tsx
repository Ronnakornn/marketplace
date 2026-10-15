"use client";

import { useRef, useState } from 'react';
import { MoreHorizontalIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '#/components/ui/alert-dialog';
import { useTranslations } from '#/i18n/client';
import type { ChatMessage } from '../api';
import { copyChatImage, copyChatText } from '../clipboard';

export function MessageActions({ message, image, contentUrl, mine, canReply, onReply, onDelete, onFeedback }: {
  message: ChatMessage; image?: ChatMessage['files'][number]; contentUrl?: string; mine: boolean; canReply: boolean;
  onReply: (messageId: string, attachmentId?: string) => void;
  onDelete: (messageId: string, attachmentId?: string) => Promise<unknown>;
  onFeedback: (key: string) => void;
}) {
  const t = useTranslations();
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const replyFocus = useRef(false);
  async function copy() {
    try {
      await (image && contentUrl ? copyChatImage(contentUrl) : copyChatText(message.body ?? ''));
      onFeedback('chat.copied');
    } catch (error) {
      onFeedback(error instanceof Error && error.message === 'CLIPBOARD_UNSUPPORTED' ? 'chat.copyUnsupported'
        : error instanceof DOMException && error.name === 'NotAllowedError' ? 'chat.copyPermission' : 'chat.copyError');
    }
  }
  async function remove() {
    if (pending) return;
    setPending(true);
    setError(false);
    try { await onDelete(message.id, image?.id); setConfirm(false); document.getElementById('chat-message')?.focus(); }
    catch { setError(true); }
    finally { setPending(false); }
  }
  if (message.deleted) return null;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="sm" className="h-8 min-w-8 px-2" aria-label={image ? `${t('chat.imageActions')} ${image.fileName}` : t('chat.messageActions')}><MoreHorizontalIcon className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent onCloseAutoFocus={(event) => { if (replyFocus.current) { event.preventDefault(); replyFocus.current = false; document.getElementById('chat-message')?.focus(); } }}>
        {image || message.body ? <DropdownMenuItem onSelect={() => void copy()}>{t(image ? 'chat.copyImage' : 'chat.copyText')}</DropdownMenuItem> : null}
        <DropdownMenuItem disabled={!canReply} onSelect={() => { replyFocus.current = true; onReply(message.id, image?.id); }}>{t('chat.reply')}</DropdownMenuItem>
        {mine ? <DropdownMenuItem variant="destructive" onSelect={() => { setError(false); setConfirm(true); }}>{t(image ? 'chat.deleteImage' : 'chat.deleteMessage')}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirm} onOpenChange={(value) => { if (!pending) setConfirm(value); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); const element = trigger.current ?? document.getElementById('chat-message'); element?.focus(); }}>
        <AlertDialogHeader><AlertDialogTitle>{t(image ? 'chat.deleteImage' : 'chat.deleteMessage')}</AlertDialogTitle><AlertDialogDescription>{t(image ? 'chat.deleteImageConfirm' : 'chat.deleteMessageConfirm')}</AlertDialogDescription></AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-red-700">{t('chat.deleteError')}</p> : null}
        <AlertDialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm(false)}>{t('chat.cancel')}</Button><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>{t(pending ? 'chat.deleting' : 'chat.confirmDelete')}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

export function ReplyQuote({ quote, scope, shopId }: { quote: NonNullable<ChatMessage['reply']>; scope: string; shopId?: string }) {
  const t = useTranslations();
  return <div className="mb-2 max-w-full rounded border-l-2 border-current bg-black/5 px-2 py-1 text-xs">
    <p className="font-semibold">{quote.sender.name}</p>
    {quote.unavailable ? <p>{t('chat.replyUnavailable')}</p> : <>
      {quote.image ? <img src={`${quote.image.contentUrl}?scope=${scope}${shopId ? `&shopId=${encodeURIComponent(shopId)}` : ''}`} alt={quote.image.fileName} width={48} height={48} className="size-12 rounded object-cover" /> : null}
      <p className="line-clamp-2 whitespace-pre-wrap break-words">{quote.body || (!quote.image ? t('chat.attachedFiles') : '')}</p>
    </>}
  </div>;
}
