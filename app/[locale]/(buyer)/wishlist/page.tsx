import { WishlistPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function WishlistRoutePage() {
  await requireUser();

  return <WishlistPage />;
}
