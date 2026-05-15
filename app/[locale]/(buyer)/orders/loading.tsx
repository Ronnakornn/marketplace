import { BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";

export default function OrdersLoading() {
  return (
    <>
      <BuyerTopBar title="Orders" />
      <div className="mx-auto max-w-4xl px-3 pb-28 pt-4">
        <BuyerLoadingList />
      </div>
    </>
  );
}
