import {
  HomeAuthenticatedSection,
  HomeGuestSection,
} from "#/features/home";
import { getServerSession } from "#/lib/auth-server";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    return <HomeAuthenticatedSection user={session.user} />;
  }

  return <HomeGuestSection />;
}
