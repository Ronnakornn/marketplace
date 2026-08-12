import { HomeMarketplaceClient } from "./HomeMarketplaceClient";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";

export function HomeGuestSection({ initialHome }: { initialHome?: DiscoveryHomeResponse }) {
  return <HomeMarketplaceClient initialHome={initialHome} />;
}
