import { FollowedShopsPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function FollowedShopsRoutePage() {
  await requireUser();

  return <FollowedShopsPage />;
}
