import { CreatorDashboardPage } from "#/features/affiliate";
import { requireUser } from "#/lib/auth-server";

export default async function AffiliatesRoutePage() {
  await requireUser();

  return <CreatorDashboardPage />;
}
