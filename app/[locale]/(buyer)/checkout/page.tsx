import { CheckoutPage } from "#/features/checkout";
import { requireUser } from "#/lib/auth-server";

export default async function CheckoutRoutePage() {
  await requireUser();

  return <CheckoutPage />;
}
