import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchChatRooms, fetchChatUnreadCount, type ChatAudience, type ChatInboxQuery } from "./api";

export const chatRoomKeys = {
  scope: (audience: ChatAudience, userId: string, shopId?: string) =>
    ["chat-rooms", audience, shopId ?? "", userId] as const,
  list: (audience: ChatAudience, userId: string, shopId?: string, filters: Pick<ChatInboxQuery, "q" | "unreadOnly"> = {}) =>
    [...chatRoomKeys.scope(audience, userId, shopId), "list", { q: filters.q?.trim() || "", unreadOnly: filters.unreadOnly ?? false }] as const,
  unread: (audience: ChatAudience, userId: string, shopId?: string) =>
    [...chatRoomKeys.scope(audience, userId, shopId), "unread-count"] as const,
};

export function chatUnreadQueryOptions(audience: ChatAudience, userId: string, shopId?: string) {
  return queryOptions({
    queryKey: chatRoomKeys.unread(audience, userId, shopId),
    queryFn: () => fetchChatUnreadCount(audience, shopId),
    enabled: Boolean(userId) && (audience !== "seller" || Boolean(shopId)),
    staleTime: 30_000,
    retry: false,
  });
}

export function chatRoomsQueryOptions(audience: ChatAudience, userId: string, shopId?: string, filters: Pick<ChatInboxQuery, "q" | "unreadOnly"> = {}) {
  return infiniteQueryOptions({
    queryKey: chatRoomKeys.list(audience, userId, shopId, filters),
    initialPageParam: undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchChatRooms({ scope: audience, shopId, q: filters.q?.trim() || undefined, unreadOnly: filters.unreadOnly || undefined, limit: 30, cursor: pageParam }),
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
    enabled: Boolean(userId) && (audience !== "seller" || Boolean(shopId)),
    staleTime: 30_000,
    retry: false,
  });
}
