"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

const SESSION_STORAGE_KEY = "marketplace-anonymous-session-id";
const IMPRESSION_DEBOUNCE_MS = 10_000;
type RecentlyViewedResponse = Treaty.Data<ReturnType<(typeof api.api.discovery)["recently-viewed"]["get"]>>;

export type DiscoveryTrackingEvent =
  | "product_impression"
  | "product_click"
  | "search_submitted"
  | "filter_applied"
  | "category_viewed"
  | "banner_clicked"
  | "recommendation_clicked"
  | "recently_viewed_update"
  | "shop_viewed"
  | "shop_followed"
  | "shop_chat_opened";

export interface TrackDiscoveryEventInput {
  eventType: DiscoveryTrackingEvent;
  productId?: string;
  shopId?: string;
  categoryId?: string;
  bannerId?: string;
  recommendationId?: string;
  query?: string;
  filters?: Record<string, unknown>;
  source?: string;
  position?: number;
  resultCount?: number;
  referrer?: string;
}

export interface RecentlyViewedProductCard {
  productId: string;
  title: string;
  imageUrl: string | null;
  href: string;
  minPrice: number | null;
  currency: string | null;
  rating: number;
  soldCount: number;
  shop: {
    id: string;
    name: string;
  };
  viewedAt: string | null;
}

export function getAnonymousSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const generated = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function trackDiscoveryEvent(input: TrackDiscoveryEventInput): void {
  if (typeof window === "undefined") return;
  const payload = {
    ...input,
    sessionId: getAnonymousSessionId(),
    referrer: input.referrer ?? (document.referrer || undefined),
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/discovery/track", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch("/api/discovery/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function useDiscoveryTracking(source: string) {
  const pendingImpressions = useRef<Map<string, TrackDiscoveryEventInput>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushImpressions(pendingImpressions.current);
  }, []);

  return useMemo(() => ({
    track: (input: TrackDiscoveryEventInput) => trackDiscoveryEvent({ source, ...input }),
    trackProductClick: (input: Omit<TrackDiscoveryEventInput, "eventType" | "source">) =>
      trackDiscoveryEvent({ source, ...input, eventType: "product_click" }),
    trackRecentlyViewed: (input: Omit<TrackDiscoveryEventInput, "eventType" | "source">) =>
      trackDiscoveryEvent({ source, ...input, eventType: "recently_viewed_update" }),
    queueProductImpression: (input: Omit<TrackDiscoveryEventInput, "eventType" | "source">) => {
      if (!input.productId) return;
      pendingImpressions.current.set(input.productId, { source, ...input, eventType: "product_impression" });
      if (flushTimer.current) return;
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushImpressions(pendingImpressions.current);
      }, IMPRESSION_DEBOUNCE_MS);
    },
  }), [source]);
}

export function useTrackVisibleProducts(
  products: Array<{ id: string; shop?: { id?: string } }>,
  source: string,
): void {
  const tracking = useDiscoveryTracking(source);
  const seenKey = products.map((product) => product.id).join(",");

  useEffect(() => {
    products.forEach((product, position) => {
      tracking.queueProductImpression({
        productId: product.id,
        shopId: product.shop?.id,
        position,
      });
    });
  }, [seenKey, tracking, products]);
}

export async function fetchRecentlyViewedProducts(limit = 8): Promise<RecentlyViewedProductCard[]> {
  const sessionId = getAnonymousSessionId();
  const { data, error } = await api.api.discovery["recently-viewed"].get({
    query: { limit, ...(sessionId ? { sessionId } : {}) },
  });
  if (error) throw error;
  return normalizeRecentlyViewedProducts(data);
}

export function normalizeRecentlyViewedProducts(input: RecentlyViewedResponse): RecentlyViewedProductCard[] {
  const rawItems = Array.isArray(input) ? input : [];
  return rawItems.map((item) => {
    const record = toRecord(item);
    const productId = readString(record.productId, readString(record.id));
    const title = readString(record.title);
    const shop = toRecord(record.shop);
    const shopId = readString(shop.id);
    const shopName = readString(shop.name);
    if (!productId || !title || !shopId || !shopName) {
      throw new Error("Recently viewed API response is missing required fields");
    }
    return {
      productId,
      title,
      imageUrl: optionalString(record.coverImage) ?? optionalString(record.imageUrl),
      href: `/products/${productId}`,
      minPrice: readNumberOrNull(record.minPrice),
      currency: optionalString(record.currency),
      rating: readNumber(record.rating),
      soldCount: readNumber(record.soldCount),
      shop: {
        id: shopId,
        name: shopName,
      },
      viewedAt: optionalString(record.viewedAt),
    };
  });
}

function flushImpressions(events: Map<string, TrackDiscoveryEventInput>): void {
  if (events.size === 0) return;
  const queued = [...events.values()];
  events.clear();
  queued.forEach(trackDiscoveryEvent);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNumber(value: unknown): number {
  return readNumberOrNull(value) ?? 0;
}
