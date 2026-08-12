import { HomeMarketplaceClient } from "./HomeMarketplaceClient";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";

interface HomeAuthenticatedSectionProps {
  initialHome?: DiscoveryHomeResponse;
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
}

export function HomeAuthenticatedSection({
  initialHome,
  user,
}: HomeAuthenticatedSectionProps) {
  return <HomeMarketplaceClient initialHome={initialHome} user={user} />;
}
