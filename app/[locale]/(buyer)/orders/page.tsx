import { OrderListPage } from "#/features/order";
import { requireUser } from "#/lib/auth-server";

export default async function OrdersRoutePage() {
  await requireUser();

  return <OrderListPage />;
}
