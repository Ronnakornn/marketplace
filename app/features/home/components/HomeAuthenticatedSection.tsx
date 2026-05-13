import { MarketplaceHome } from "#/features/marketplace";

interface HomeAuthenticatedSectionProps {
  user: {
    name: string;
    email: string;
  };
}

export function HomeAuthenticatedSection({
  user,
}: HomeAuthenticatedSectionProps) {
  return <MarketplaceHome user={user} />;
}
