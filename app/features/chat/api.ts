"use client";

import { requestApi } from "#/lib/api-client";

export interface ChatUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ChatShopSummary {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface ChatMessage {
  id: string;
  sender: ChatUserSummary;
  messageType: "text" | "image";
  body: string | null;
  attachments: string[];
  createdAt: string;
}

export interface ChatRoom {
  roomId: string;
  shop: ChatShopSummary;
  buyer: ChatUserSummary;
  product?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  messages?: ChatMessage[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateChatRoomInput {
  shopId: string;
  productId?: string;
  orderId?: string;
}

export type ChatAudience = "buyer" | "seller";

export async function fetchChatRooms(audience?: ChatAudience, shopId?: string): Promise<ChatRoom[]> {
  const query = new URLSearchParams();
  if (audience) query.set("scope", audience);
  if (shopId) query.set("shopId", shopId);
  const response = await chatFetch(`/api/chats${query.size ? `?${query}` : ""}`);
  return readArray(response).map(normalizeRoom);
}

export async function fetchChatRoom(roomId: string, page = 1, limit = 30, audience?: ChatAudience): Promise<ChatRoom> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (audience) query.set("scope", audience);
  return normalizeRoom(await chatFetch(`/api/chats/${roomId}?${query}`));
}

export async function createChatRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
  return normalizeRoom(await chatFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function sendChatMessage(roomId: string, body: string, audience?: ChatAudience): Promise<ChatRoom> {
  return normalizeRoom(await chatFetch(`/api/chats/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messageType: "text", body, ...(audience ? { scope: audience } : {}) }),
  }));
}

export async function markChatRead(roomId: string, audience?: ChatAudience): Promise<ChatRoom> {
  const query = audience ? `?scope=${encodeURIComponent(audience)}` : "";
  return normalizeRoom(await chatFetch(`/api/chats/${roomId}/read${query}`, {
    method: "PATCH",
  }));
}

async function chatFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  return requestApi(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
}

function normalizeRoom(input: unknown): ChatRoom {
  const record = toRecord(input);
  const messages = readArray(record.messages).map(normalizeMessage);
  return {
    roomId: readString(record.roomId, readString(record.id)),
    shop: normalizeShop(record.shop),
    buyer: normalizeUser(record.buyer),
    product: normalizeOptionalProduct(record.product),
    order: normalizeOptionalOrder(record.order),
    lastMessage: record.lastMessage ? normalizeMessage(record.lastMessage) : null,
    unreadCount: readNumber(record.unreadCount),
    ...(messages.length ? { messages } : {}),
    ...(record.pagination ? { pagination: normalizePagination(record.pagination) } : {}),
  };
}

function normalizeMessage(input: unknown): ChatMessage {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    sender: normalizeUser(record.sender),
    messageType: readString(record.messageType, "text") === "image" ? "image" : "text",
    body: optionalString(record.body),
    attachments: readArray(record.attachments).map(String),
    createdAt: readString(record.createdAt, new Date().toISOString()),
  };
}

function normalizeUser(input: unknown): ChatUserSummary {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    name: readString(record.name, "User"),
    email: readString(record.email),
    role: readString(record.role, "USER"),
  };
}

function normalizeShop(input: unknown): ChatShopSummary {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    name: readString(record.name, "Shop"),
    slug: readString(record.slug),
    ownerId: readString(record.ownerId),
  };
}

function normalizeOptionalProduct(input: unknown): ChatRoom["product"] {
  if (!input) return null;
  const record = toRecord(input);
  const id = readString(record.id);
  if (!id) return null;
  return {
    id,
    title: readString(record.title, "Product"),
    slug: readString(record.slug),
  };
}

function normalizeOptionalOrder(input: unknown): ChatRoom["order"] {
  if (!input) return null;
  const record = toRecord(input);
  const id = readString(record.id);
  if (!id) return null;
  return {
    id,
    orderNumber: readString(record.orderNumber, "Order"),
    status: readString(record.status),
  };
}

function normalizePagination(input: unknown): NonNullable<ChatRoom["pagination"]> {
  const record = toRecord(input);
  return {
    page: readNumber(record.page, 1),
    limit: readNumber(record.limit, 30),
    total: readNumber(record.total),
    totalPages: readNumber(record.totalPages),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
