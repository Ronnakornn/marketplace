import "server-only";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";

export async function getInitialMarketplaceHome(locale: "th" | "en"): Promise<DiscoveryHomeResponse | undefined> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/api/discovery/home?locale=${locale}&limit=12`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    return await response.json() as DiscoveryHomeResponse;
  } catch {
    return undefined;
  }
}
