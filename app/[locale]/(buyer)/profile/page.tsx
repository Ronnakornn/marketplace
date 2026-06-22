import { ProfilePage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function ProfileRoutePage() {
  await requireUser();

  return <ProfilePage />;
}
