import { AddressBookPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function AddressBookRoutePage() {
  await requireUser();

  return <AddressBookPage />;
}
