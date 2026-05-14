"use client";

import { useQuery } from "@tanstack/react-query";
import { TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { fetchOrderTracking } from "#/features/buyer/api";

export function OrderTrackingPage({ orderId }: { orderId: string }) {
  const trackingQuery = useQuery({ queryKey: ["buyer-order-tracking", orderId], queryFn: () => fetchOrderTracking(orderId) });

  return (
    <>
      <BuyerTopBar title="Tracking" />
      <div className="mx-auto max-w-4xl space-y-4 px-3 py-4">
        {trackingQuery.isLoading ? <BuyerLoadingList /> : null}
        {trackingQuery.isError ? <BuyerErrorState message={trackingQuery.error.message} onRetry={() => void trackingQuery.refetch()} /> : null}
        {trackingQuery.data?.shipments.length === 0 ? <BuyerEmptyState title="ยังไม่มีข้อมูลการจัดส่ง" description="เมื่อร้านค้าแยก shipment แล้ว timeline จะแสดงในหน้านี้" /> : null}
        {trackingQuery.data?.shipments.map((shipment) => (
          <section key={shipment.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-bold"><TruckIcon className="size-5 text-orange-600" />{shipment.shopName}</h2>
                <p className="mt-1 text-sm text-slate-500">{shipment.carrier ?? "Carrier pending"} {shipment.trackingNumber ?? ""}</p>
              </div>
              <Badge variant="secondary" className="rounded-md">{shipment.status}</Badge>
            </div>
            <div className="space-y-4">
              {(shipment.timeline.length ? shipment.timeline : [{ label: shipment.status, status: shipment.status, timestamp: trackingQuery.data.createdAt }]).map((step, index) => (
                <div key={`${shipment.id}-${index}`} className="grid grid-cols-[20px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="size-3 rounded-full bg-orange-600" />
                    {index < shipment.timeline.length - 1 ? <span className="mt-1 h-full w-px bg-slate-200" /> : null}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{step.label}</p>
                    <p className="text-sm text-slate-500">{step.status} · {new Date(step.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
