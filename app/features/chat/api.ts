"use client";

import { treaty, type Treaty } from "@elysiajs/eden";
import type { createChatRoutes } from "#server/modules/chat/chat.routes";
import { ApiClientError } from "#/lib/api-client";

const origin = typeof window === "undefined"
  ? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  : window.location.origin;

export const chatApi = treaty<ReturnType<typeof createChatRoutes>>(origin, {
  parseDate: false,
  fetch: { credentials: "include" },
});

type RoomEndpoint = ReturnType<typeof chatApi.api.chats>;
export type ChatRoom = Treaty.Data<ReturnType<RoomEndpoint["get"]>>;
export type ChatMessage = NonNullable<ChatRoom["messages"]>[number];
export type ChatAudience = "buyer" | "seller";
export type CreateChatRoomInput = Parameters<typeof chatApi.api.chats.post>[0];
type SendChatMessageWireInput = Parameters<RoomEndpoint["messages"]["post"]>[0];
export type SendChatMessageInput = Omit<SendChatMessageWireInput, "files"> & { files?: Extract<NonNullable<SendChatMessageWireInput["files"]>, File[]> };
export type ChatRoomQuery = NonNullable<Parameters<RoomEndpoint["get"]>[0]>["query"];

export async function fetchChatRooms(scope?: ChatAudience, shopId?: string) {
  return requireChatData(chatApi.api.chats.get({ query: { scope, shopId } }));
}

export async function fetchChatRoom(roomId: string, query: ChatRoomQuery = {}) {
  return requireChatData(chatApi.api.chats({ roomId }).get({ query: { limit: 30, ...query } }));
}

export async function createChatRoom(input: CreateChatRoomInput) {
  return requireChatData(chatApi.api.chats.post(input));
}

export async function sendChatMessage(roomId: string, input: SendChatMessageInput) {
  if (input.files?.length) {
    const form = new FormData();
    for (const key of ["clientMessageId", "body", "productId", "orderId", "scope", "replyToMessageId", "replyToAttachmentId"] as const) {
      const value = input[key];
      if (value !== undefined) form.append(key, value);
    }
    for (const file of input.files) form.append("files", file, file.name);
    const response = await fetch(`/api/chats/${encodeURIComponent(roomId)}/messages`, { method: "POST", credentials: "include", body: form });
    type SendResponse = Treaty.Data<ReturnType<RoomEndpoint["messages"]["post"]>>;
    const value: unknown = await response.json();
    if (!response.ok) return requireChatData<SendResponse>(Promise.resolve({ data: null, error: { status: response.status, value } }));
    if (!value || typeof value !== "object" || !("sentMessage" in value) || !("roomId" in value)) throw new ApiClientError("Chat response missing");
    return value as SendResponse;
  }
  return requireChatData(chatApi.api.chats({ roomId }).messages.post(input));
}

export async function markChatRead(roomId: string, scope: ChatAudience, throughMessageId: string) {
  return requireChatData(chatApi.api.chats({ roomId }).read.patch(undefined, { query: { scope, throughMessageId } }));
}

export async function refreshChatMessages(roomId: string, messageIds: string[], scope: ChatAudience, shopId?: string) {
  return requireChatData(chatApi.api.chats({ roomId }).messages.refresh.post({ messageIds, scope, shopId }));
}

export async function deleteChatContent(roomId: string, messageId: string, scope: ChatAudience, shopId?: string, attachmentId?: string) {
  const message = chatApi.api.chats({ roomId }).messages({ messageId });
  return requireChatData(attachmentId
    ? message.attachments({ attachmentId }).delete(undefined, { query: { scope, shopId } })
    : message.delete(undefined, { query: { scope, shopId } }));
}

async function requireChatData<T>(request: Promise<{ data: T | null; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await request;
  if (error) {
    const value = typeof error === "object" && "value" in error ? error.value : null;
    const detail = value && typeof value === "object" && "error" in value ? value.error : value;
    const message = detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string"
      ? detail.message : "Chat request failed";
    const code = detail && typeof detail === "object" && "code" in detail && typeof detail.code === "string" ? detail.code : undefined;
    const status = typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
    throw new ApiClientError(message, status, code);
  }
  if (data === null || data === undefined) throw new ApiClientError("Chat response missing");
  return data;
}
