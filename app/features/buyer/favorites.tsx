"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchFavoriteStatus, fetchFavoriteStatuses } from "#/features/buyer/api";
import { useSession } from "#/lib/auth-client";

type FavoriteStatuses = Awaited<ReturnType<typeof fetchFavoriteStatuses>>;
const FAVORITE_STATUS_BATCH_SIZE = 100;
const FavoriteStatusContext = createContext<{
  userId: string;
  productIds: Set<string>;
  statuses: FavoriteStatuses;
} | null>(null);

export const favoriteQueryKeys = {
  all: (userId: string) => ["buyer-favorite-state", userId] as const,
  detail: (userId: string, productId: string) => [...favoriteQueryKeys.all(userId), "detail", productId] as const,
  batches: (userId: string) => [...favoriteQueryKeys.all(userId), "batches"] as const,
  batch: (userId: string, productIds: string[]) => [...favoriteQueryKeys.batches(userId), productIds] as const,
  list: (userId: string) => ["buyer-favorites", userId] as const,
};

export function FavoriteStatusesProvider({ productIds, children }: { productIds: string[]; children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user.role === "USER" ? session.user.id : "";
  const ids = [...new Set(productIds)].sort();
  const batches = Array.from({ length: Math.ceil(ids.length / FAVORITE_STATUS_BATCH_SIZE) }, (_, index) =>
    ids.slice(index * FAVORITE_STATUS_BATCH_SIZE, (index + 1) * FAVORITE_STATUS_BATCH_SIZE));
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: favoriteQueryKeys.batch(userId, batch),
      queryFn: () => fetchFavoriteStatuses(batch),
      enabled: Boolean(userId),
      staleTime: 60_000,
    })),
  });
  const statuses: FavoriteStatuses = Object.assign({}, ...queries.map((query) => query.data ?? {}));

  return <FavoriteStatusContext.Provider value={{ userId, productIds: new Set(ids), statuses }}>{children}</FavoriteStatusContext.Provider>;
}

export function useFavoriteStatus(productId: string, userId: string, enabled: boolean) {
  const batch = useContext(FavoriteStatusContext);
  const isBatched = batch !== null && batch.userId === userId && batch.productIds.has(productId);
  const query = useQuery({
    queryKey: favoriteQueryKeys.detail(userId, productId),
    queryFn: () => fetchFavoriteStatus(productId),
    enabled: enabled && !isBatched && Boolean(userId) && Boolean(productId),
    staleTime: 60_000,
  });
  return { data: isBatched ? batch.statuses[productId] : query.data };
}

export async function updateFavoriteCaches(queryClient: QueryClient, userId: string, productId: string, favorited: boolean) {
  await queryClient.cancelQueries({ queryKey: favoriteQueryKeys.all(userId) });
  queryClient.setQueryData(favoriteQueryKeys.detail(userId, productId), favorited);
  queryClient.setQueriesData<FavoriteStatuses>({ queryKey: favoriteQueryKeys.batches(userId) }, (statuses) => {
    if (!statuses || !Object.hasOwn(statuses, productId)) return statuses;
    return { ...statuses, [productId]: favorited };
  });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: favoriteQueryKeys.all(userId) }),
    queryClient.invalidateQueries({ queryKey: favoriteQueryKeys.list(userId) }),
  ]);
}
