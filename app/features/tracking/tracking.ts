"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { requestApi } from "#/lib/api-client";

const SESSION_STORAGE_KEY = "marketplace-anonymous-session-id";
const RECENTLY_VIEWED_STORAGE_KEY = "marketplace-recently-viewed-products";
const IMPRESSION_DEBOUNCE_MS = 10_000;
const MAX_LOCAL_RECENTLY_VIEWED = 24;

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

export interface LocalRecentlyViewedProduct {
  productId: string;
  title: string;
  imageUrl: string | null;
  href: string;
  viewedAt: string;
}

export interface RecentlyViewedProductCard {
  productId: string;
  title: string;
  imageUrl: string | null;
  href: string;
  minPrice: number | null;
  currency: string | null;
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

export function saveLocalRecentlyViewedProduct(product: Omit<LocalRecentlyViewedProduct, "viewedAt">): LocalRecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];
  const viewedAt = new Date().toISOString();
  const current = getLocalRecentlyViewedProducts();
  const next = [
    { ...product, viewedAt },
    ...current.filter((item) => item.productId !== product.productId),
  ].slice(0, MAX_LOCAL_RECENTLY_VIEWED);
  window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getLocalRecentlyViewedProducts(): LocalRecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(readLocalRecentlyViewedProduct)
      .filter((item): item is LocalRecentlyViewedProduct => item !== null)
      .slice(0, MAX_LOCAL_RECENTLY_VIEWED);
  } catch {
    return [];
  }
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

export function useRecentlyViewedFallback(limit = 12) {
  const read = useCallback(() => getLocalRecentlyViewedProducts().slice(0, limit), [limit]);
  return { read, save: saveLocalRecentlyViewedProduct };
}

export async function fetchRecentlyViewedProducts(limit = 8): Promise<RecentlyViewedProductCard[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const sessionId = getAnonymousSessionId();
  if (sessionId) params.set("sessionId", sessionId);

  const data = await requestApi<unknown>(`/api/discovery/recently-viewed?${params.toString()}`);
  return normalizeRecentlyViewedProducts(data);
}

export function normalizeRecentlyViewedProducts(input: unknown): RecentlyViewedProductCard[] {
  const rawItems = Array.isArray(input) ? input : [];
  return rawItems.map((item) => {
    const record = toRecord(item);
    const productId = readString(record.productId, readString(record.id));
    const shop = toRecord(record.shop);
    return {
      productId,
      title: readString(record.title, "Recently viewed product"),
      imageUrl: optionalString(record.coverImage) ?? optionalString(record.imageUrl),
      href: `/products/${productId}`,
      minPrice: readNumberOrNull(record.minPrice),
      currency: optionalString(record.currency),
      shop: {
        id: readString(shop.id),
        name: readString(shop.name, "Marketplace shop"),
      },
      viewedAt: optionalString(record.viewedAt),
    };
  }).filter((item) => item.productId);
}

export function normalizeLocalRecentlyViewedProducts(input: LocalRecentlyViewedProduct[]): RecentlyViewedProductCard[] {
  return input.map((item) => ({
    productId: item.productId,
    title: item.title,
    imageUrl: item.imageUrl,
    href: item.href,
    minPrice: null,
    currency: null,
    shop: {
      id: "",
      name: "Recently viewed",
    },
    viewedAt: item.viewedAt,
  }));
}

function flushImpressions(events: Map<string, TrackDiscoveryEventInput>): void {
  if (events.size === 0) return;
  const queued = [...events.values()];
  events.clear();
  queued.forEach(trackDiscoveryEvent);
}

function readLocalRecentlyViewedProduct(value: unknown): LocalRecentlyViewedProduct | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const productId = readString(record.productId);
  const title = readString(record.title);
  const href = readString(record.href);
  const viewedAt = readString(record.viewedAt);
  if (!productId || !title || !href || !viewedAt) return null;
  return {
    productId,
    title,
    href,
    viewedAt,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
  };
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
