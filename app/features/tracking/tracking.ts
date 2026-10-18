"use client";

import { minorUnitsText, type MinorUnitValue } from "#/lib/money";

import { useEffect, useMemo, useRef, useState, type RefCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { IMPRESSION_KEEPALIVE_BUDGET_BYTES, MAX_IMPRESSION_BATCH_BYTES, MAX_IMPRESSION_BATCH_EVENTS, MAX_TRACKING_REFERRER_LENGTH, MAX_TRACKING_SESSION_ID_LENGTH, MAX_TRACKING_SOURCE_LENGTH } from "#server/modules/tracking/tracking.limits";

const SESSION_STORAGE_KEY = "marketplace-anonymous-session-id";
const IMPRESSION_DEBOUNCE_MS = 10_000;
type RecentlyViewedResponse = Treaty.Data<ReturnType<(typeof api.api.discovery)["recently-viewed"]["get"]>>;
type ProductImpressionPayload = Parameters<typeof api.api.discovery.impressions.post>[0]["events"][number];
const encoder = new TextEncoder();
const IMPRESSION_ENVELOPE_BYTES = encoder.encode('{"events":[]}').byteLength;

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
  minPrice: MinorUnitValue | null;
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
  const generated = uuidv4();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function trackDiscoveryEvent(input: TrackDiscoveryEventInput): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(trackingPayload(input));
  sendTrackingBody("/api/discovery/track", body);
}

function trackingPayload(input: TrackDiscoveryEventInput) {
  return {
    ...input,
    sessionId: getAnonymousSessionId(),
    referrer: input.referrer ?? (document.referrer || undefined),
    timestamp: new Date().toISOString(),
  };
}

function sendTrackingBody(url: string, body: string, keepalive = true): void {
  if (keepalive && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive,
  }).catch(() => undefined);
}

export function useDiscoveryTracking(source: string) {
  const pendingImpressions = useRef<Map<string, ProductImpressionPayload>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
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
      const payload = {
        ...trackingPayload({ source, ...input, eventType: "product_impression" }),
        eventType: "product_impression" as const,
        productId: input.productId,
      };
      if ((payload.source?.trim().length ?? 0) > MAX_TRACKING_SOURCE_LENGTH
        || payload.sessionId.trim().length > MAX_TRACKING_SESSION_ID_LENGTH
        || (payload.referrer?.trim().length ?? 0) > MAX_TRACKING_REFERRER_LENGTH
        || IMPRESSION_ENVELOPE_BYTES + encoder.encode(JSON.stringify(payload)).byteLength > MAX_IMPRESSION_BATCH_BYTES) return;
      pendingImpressions.current.set(`${source}:${input.productId}`, payload);
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
): RefCallback<HTMLElement> {
  const tracking = useDiscoveryTracking(source);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const seenBySource = useRef(new Map<string, Set<string>>());
  const productKey = JSON.stringify(products.map((product) => [product.id, product.shop?.id]));

  useEffect(() => {
    if (!container) return;
    const seen = seenBySource.current.get(source) ?? new Set<string>();
    seenBySource.current.set(source, seen);
    const productsById = new Map(products.map((product, position) => [product.id, { product, position }]));
    const elements = [...container.querySelectorAll("[data-product-id]")];
    function trackVisible(element: Element) {
      if (document.visibilityState === "hidden") return;
      const id = element.getAttribute("data-product-id");
      if (!id || seen.has(id)) return;
      const item = productsById.get(id);
      if (!item) return;
      seen.add(id);
      tracking.queueProductImpression({
        productId: id,
        shopId: item.product.shop?.id,
        position: item.position,
      });
    }
    function checkViewport() {
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0) {
          trackVisible(element);
        }
      }
    }
    document.addEventListener("visibilitychange", checkViewport);
    if (typeof IntersectionObserver === "undefined") {
      checkViewport();
      window.addEventListener("scroll", checkViewport, { passive: true, capture: true });
      window.addEventListener("resize", checkViewport);
      return () => {
        document.removeEventListener("visibilitychange", checkViewport);
        window.removeEventListener("scroll", checkViewport, true);
        window.removeEventListener("resize", checkViewport);
      };
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) trackVisible(entry.target);
      }
    }, { threshold: 0.01 });
    for (const element of elements) observer.observe(element);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", checkViewport);
    };
  }, [container, productKey, source, tracking]);
  return setContainer;
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
      minPrice: record.minPrice === null || record.minPrice === undefined ? null : minorUnitsText(record.minPrice),
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

function flushImpressions(events: Map<string, ProductImpressionPayload>): void {
  if (events.size === 0) return;
  const queued = [...events.values()];
  events.clear();
  let batch: ProductImpressionPayload[] = [];
  let batchBytes = IMPRESSION_ENVELOPE_BYTES;
  let keepaliveBytes = 0;
  function sendBatch() {
    if (batch.length === 0) return;
    const body = JSON.stringify({ events: batch });
    const bytes = encoder.encode(body).byteLength;
    const keepalive = keepaliveBytes + bytes <= IMPRESSION_KEEPALIVE_BUDGET_BYTES;
    if (keepalive) keepaliveBytes += bytes;
    sendTrackingBody("/api/discovery/impressions", body, keepalive);
    batch = [];
    batchBytes = IMPRESSION_ENVELOPE_BYTES;
  }
  for (const event of queued) {
    const eventBytes = encoder.encode(JSON.stringify(event)).byteLength;
    if (batch.length >= MAX_IMPRESSION_BATCH_EVENTS || batchBytes + eventBytes + (batch.length ? 1 : 0) > MAX_IMPRESSION_BATCH_BYTES) sendBatch();
    batchBytes += eventBytes + (batch.length ? 1 : 0);
    batch.push(event);
  }
  sendBatch();
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
