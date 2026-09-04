"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

export type BuyerCoins = Treaty.Data<ReturnType<(typeof api.api.me)["coins"]["get"]>>;

export function useBuyerCoins(limit = 50) {
  return useQuery({
    queryKey: ["buyer-coins", limit],
    queryFn: async () => {
      const { data, error } = await api.api.me.coins.get({ query: { limit } });
      if (error) throw error;
      return data;
    },
  });
}

export function useBuyerCoinHistory(limit = 50) {
  return useInfiniteQuery({
    queryKey: ["buyer-coins-history", limit],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.api.me.coins.get({ query: { limit, cursor: pageParam } });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
  });
}
