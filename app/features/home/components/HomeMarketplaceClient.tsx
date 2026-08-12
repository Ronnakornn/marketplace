"use client";

import { MarketplaceHome } from "#/features/marketplace/components/MarketplaceHome";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";

interface HomeMarketplaceClientProps {
  initialHome?: DiscoveryHomeResponse;
  user?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
}

export function HomeMarketplaceClient(props: HomeMarketplaceClientProps) {
  return <MarketplaceHome {...props} />;
}
