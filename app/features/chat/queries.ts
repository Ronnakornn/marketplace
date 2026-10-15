import { queryOptions } from "@tanstack/react-query";
import { fetchChatRooms, type ChatAudience } from "./api";

export const chatRoomKeys = {
  list: (audience: ChatAudience, userId: string, shopId?: string) =>
    ["chat-rooms", audience, shopId ?? "", userId] as const,
};

export function chatRoomsQueryOptions(audience: ChatAudience, userId: string, shopId?: string) {
  return queryOptions({
    queryKey: chatRoomKeys.list(audience, userId, shopId),
    queryFn: () => fetchChatRooms(audience, shopId),
    enabled: Boolean(userId) && (audience !== "seller" || Boolean(shopId)),
    staleTime: 30_000,
    retry: false,
  });
}
