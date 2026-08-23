import { MarketplaceGuestHome } from "#/features/marketplace/components/MarketplaceGuestHome";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";
import type { Locale } from "#/i18n/config";

export async function HomeGuestSection({ initialHome, locale }: { initialHome?: DiscoveryHomeResponse; locale: Locale }) {
  if (initialHome) return <MarketplaceGuestHome initialHome={initialHome} locale={locale} />;
  const { HomeGuestClientFallback } = await import("./HomeGuestClientFallback");
  return <HomeGuestClientFallback />;
}
