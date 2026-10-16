import { WishlistPage } from "#/features/buyer/components/WishlistPage";
import { requireUser } from "#/lib/auth-server";

export default async function WishlistRoutePage() {
  await requireUser();

  return <WishlistPage />;
}
