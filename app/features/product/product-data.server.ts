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
  const { data: product, error } = await api.api.products({ productId }).get({ query: { locale } });
  if (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const summary = await api.api.products({ productId: product.id })["rating-summary"].get().catch(() => undefined);
  return { product, ratingSummary: summary?.error ? undefined : summary?.data };
});

export async function requirePublicProductData(productId: string, locale: Locale) {
  const data = await getPublicProductData(productId, locale);
  if (!data) notFound();
  return data;
}

export type InitialPublicProduct = NonNullable<Awaited<ReturnType<typeof getPublicProductData>>>["product"];
export type InitialProductRatingSummary = NonNullable<Awaited<ReturnType<typeof getPublicProductData>>>["ratingSummary"];
