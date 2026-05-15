"use client";

import { MarketplaceHome } from "#/features/marketplace/components/MarketplaceHome";

interface HomeMarketplaceClientProps {
  user?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
}

export function HomeMarketplaceClient(props: HomeMarketplaceClientProps) {
  return <MarketplaceHome {...props} />;
}
