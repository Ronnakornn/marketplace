import { HomeMarketplaceClient } from "./HomeMarketplaceClient";

interface HomeAuthenticatedSectionProps {
  user: {
    name: string;
    email: string;
  };
}

export function HomeAuthenticatedSection({
  user,
}: HomeAuthenticatedSectionProps) {
  return <HomeMarketplaceClient user={user} />;
}
