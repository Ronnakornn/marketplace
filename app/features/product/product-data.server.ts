import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { treaty } from "@elysiajs/eden";
import type { App } from "#server/index";
import type { Locale } from "#/i18n/config";

export const getPublicProductData = cache(async (productId: string, locale: Locale) => {
  const api = treaty<App>(process.env.API_BASE_URL ?? "http://127.0.0.1:3001", {
    fetch: { cache: "no-store" },
  });
  const { data, error } = await api.api.products({ productId }).boot.get({ query: { locale } });
  if (error) {
    if (error.status === 404) return null;
    throw Object.assign(new Error(productErrorMessage(error.value, error.status), { cause: error }), {
      status: error.status,
      value: error.value,
    });
  }
  return data;
});

function productErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    if ("error" in payload && payload.error && typeof payload.error === "object" &&
      "message" in payload.error && typeof payload.error.message === "string" && payload.error.message.trim()) {
      return payload.error.message;
    }
    if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) return payload.message;
  }
  return `Product request failed (HTTP ${status})`;
}

export async function requirePublicProductData(productId: string, locale: Locale) {
  const data = await getPublicProductData(productId, locale);
  if (!data) notFound();
  return data;
}

export type InitialPublicProduct = NonNullable<Awaited<ReturnType<typeof getPublicProductData>>>["product"];
export type InitialProductRatingSummary = NonNullable<Awaited<ReturnType<typeof getPublicProductData>>>["ratingSummary"];
