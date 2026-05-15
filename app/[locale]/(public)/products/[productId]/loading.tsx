import { BuyerProductDetailSkeleton } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";

export default function ProductLoading() {
  return (
    <>
      <BuyerTopBar title="Product" />
      <div className="mx-auto max-w-6xl px-3 pb-28 pt-4">
        <BuyerProductDetailSkeleton />
      </div>
    </>
  );
}
