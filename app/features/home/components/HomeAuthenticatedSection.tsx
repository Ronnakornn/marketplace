import { HomeMarketplaceClient } from "./HomeMarketplaceClient";

interface HomeAuthenticatedSectionProps {
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
}

export function HomeAuthenticatedSection({
  user,
}: HomeAuthenticatedSectionProps) {
  return <HomeMarketplaceClient user={user} />;
}
