import "server-only";

import { treaty } from "@elysiajs/eden";
import type { App } from "#server/index";
import type { Locale } from "#/i18n/config";
import { cleanSearchProductInput, productListingInput, type ProductListingFilters } from "./listing-input";

export async function getInitialProductListing(filters: ProductListingFilters, locale: Locale) {
  const query = cleanSearchProductInput(productListingInput(filters, locale));
  try {
    const api = treaty<App>(process.env.API_BASE_URL ?? "http://127.0.0.1:3001", {
      fetch: { cache: "no-store" },
    });
    const { data, error } = await api.api.search.products.get({ query });
    return error ? undefined : { query, data };
  } catch {
    return undefined;
  }
}

export type InitialProductListing = NonNullable<Awaited<ReturnType<typeof getInitialProductListing>>>;
