import { CartPage } from "#/features/cart";
import { requireUser } from "#/lib/auth-server";

export default async function CartRoutePage() {
  await requireUser();

  return <CartPage />;
}
