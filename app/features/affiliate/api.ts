"use client";

import { requestApi } from "#/lib/api-client";

export type AffiliateTargetType = "product" | "shop" | "campaign";
export type AffiliateStatus = "ACTIVE" | "DISABLED";

export interface AffiliateLink {
  id: string;
  code: string;
  targetType: AffiliateTargetType;
  targetId: string;
  status: AffiliateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateStats {
  clicks: number;
  conversions: number;
  commissionCents: number;
}

export interface AffiliateTargetOption {
  id: string;
  label: string;
  description: string | null;
  type: AffiliateTargetType;
}

export interface AdminAffiliate {
  id: string;
  userId: string;
  status: AffiliateStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  links: AffiliateLink[];
}

export interface CreateAffiliateLinkInput {
  code?: string;
  targetType: AffiliateTargetType;
  targetId: string;
}

export async function fetchAffiliateStats(): Promise<AffiliateStats> {
  const record = toRecord(await apiFetch("/api/affiliate/stats"));
  return {
    clicks: readNumber(record.clicks),
    conversions: readNumber(record.conversions),
    commissionCents: readNumber(record.commissionCents),
  };
}

export async function fetchAffiliateLinks(): Promise<AffiliateLink[]> {
  const response = await apiFetch("/api/affiliate/links");
  const items = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return items.map(normalizeLink);
}

export async function createAffiliateLink(input: CreateAffiliateLinkInput): Promise<AffiliateLink> {
  return normalizeLink(await apiFetch("/api/affiliate/links", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function fetchAffiliateTargets(input: { targetType: AffiliateTargetType; q?: string; limit?: number }): Promise<AffiliateTargetOption[]> {
  const response = toRecord(await apiFetch(`/api/affiliate/targets${toQuery(input)}`));
  return readArray(response.items).map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      label: readString(record.label, "Untitled"),
      description: optionalString(record.description),
      type: readString(record.type, input.targetType) as AffiliateTargetType,
    };
  });
}

export async function fetchAdminAffiliates(): Promise<AdminAffiliate[]> {
  const response = await apiFetch("/api/admin/affiliates");
  const items = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return items.map((item) => {
    const record = toRecord(item);
    const user = toRecord(record.user);
    return {
      id: readString(record.id),
      userId: readString(record.userId),
      status: readString(record.status, "ACTIVE") as AffiliateStatus,
      createdAt: readString(record.createdAt, new Date().toISOString()),
      updatedAt: readString(record.updatedAt, new Date().toISOString()),
      user: {
        id: readString(user.id),
        name: readString(user.name, "Creator"),
        email: readString(user.email),
      },
      links: readArray(record.links).map(normalizeLink),
    };
  });
}

export async function updateAdminAffiliateStatus(input: { affiliateId: string; status: AffiliateStatus }): Promise<unknown> {
  return apiFetch(`/api/admin/affiliates/${input.affiliateId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: input.status }),
  });
}

export function formatAffiliateMoney(cents: number, _currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(cents / 100);
}

export function affiliateTrackingUrl(code: string): string {
  if (typeof window === "undefined") return `/api/a/${encodeURIComponent(code)}`;
  return `${window.location.origin}/api/a/${encodeURIComponent(code)}`;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  return requestApi(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
}

function normalizeLink(input: unknown): AffiliateLink {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    code: readString(record.code),
    targetType: readString(record.targetType, "product") as AffiliateTargetType,
    targetId: readString(record.targetId),
    status: readString(record.status, "ACTIVE") as AffiliateStatus,
    createdAt: readString(record.createdAt, new Date().toISOString()),
    updatedAt: readString(record.updatedAt, new Date().toISOString()),
  };
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
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
