"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, CreditCardIcon, MapPinIcon, TicketIcon, TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Label } from "#/components/ui/label";
import { createCheckout, fetchCart, formatMoney } from "#/features/buyer/api";

export function CheckoutPage({ resultStatus, orderId }: { resultStatus?: string; orderId?: string }) {
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const cartQuery = useQuery({ queryKey: ["buyer-cart"], queryFn: fetchCart });
  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cartQuery.data?.id) throw new Error("ไม่พบ cart ที่พร้อม checkout");
      return createCheckout({
        cartId: cartQuery.data.id,
        addressId: "default",
        couponCode: couponCode || undefined,
        paymentMethod,
        shippingMethod: "standard",
      });
    },
  });
  const total = useMemo(() => (cartQuery.data?.subtotalCents ?? 0) + 0, [cartQuery.data?.subtotalCents]);
  const itemCount = cartQuery.data?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0;

  return (
    <>
      <BuyerTopBar title="Checkout" />
      <div className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4">
        {resultStatus ? <PaymentResult status={resultStatus} orderId={orderId} /> : null}
        {cartQuery.isLoading ? <BuyerLoadingList /> : null}
        {cartQuery.isError ? <BuyerErrorState message={cartQuery.error.message} onRetry={() => void cartQuery.refetch()} /> : null}
        {cartQuery.isSuccess && itemCount === 0 ? <BuyerEmptyState title="ไม่มีสินค้าให้ชำระเงิน" description="กลับไปเลือกสินค้าในรถเข็นก่อนเริ่ม checkout" /> : null}
        {cartQuery.data && itemCount > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <CheckoutBlock icon={<MapPinIcon className="size-5" />} title="Address">
                <p className="font-semibold">Default shipping address</p>
                <p className="text-sm text-slate-500">เลือกที่อยู่จริงจาก API เมื่อ backend เปิด endpoint address สำหรับ buyer</p>
              </CheckoutBlock>
              <CheckoutBlock icon={<TruckIcon className="size-5" />} title="Shipping method">
                <RadioGroup defaultValue="standard">
                  <div className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 p-3">
                    <Label htmlFor="standard" className="font-semibold">Standard delivery</Label>
                    <RadioGroupItem id="standard" value="standard" />
                  </div>
                </RadioGroup>
              </CheckoutBlock>
              <CheckoutBlock icon={<TicketIcon className="size-5" />} title="Coupon">
                <Input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Coupon code" />
              </CheckoutBlock>
              <CheckoutBlock icon={<CreditCardIcon className="size-5" />} title="Payment method">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <Label htmlFor="card" className="font-semibold">Card / payment gateway</Label>
                    <RadioGroupItem id="card" value="card" />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <Label htmlFor="cod" className="font-semibold">Cash on delivery</Label>
                    <RadioGroupItem id="cod" value="cod" />
                  </div>
                </RadioGroup>
              </CheckoutBlock>
            </div>
            <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Summary</h2>
              <div className="mt-4 space-y-3">
                {cartQuery.data.shops.map((shop) => (
                  <div key={shop.shopId} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">{shop.shopName}</span>
                    <span className="font-semibold">{formatMoney(shop.subtotalCents, cartQuery.data.currency)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatMoney(total, cartQuery.data.currency)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>

      {cartQuery.data && itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-lg font-bold">{formatMoney(total, cartQuery.data.currency)}</p>
            <Button className="h-12 min-w-40 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
              Place order
            </Button>
          </div>
          {checkoutMutation.isError ? <p className="mx-auto mt-2 max-w-5xl text-sm text-red-600">{checkoutMutation.error.message}</p> : null}
          {checkoutMutation.isSuccess ? <p className="mx-auto mt-2 max-w-5xl text-sm text-emerald-700">Order {checkoutMutation.data.orderNo} created.</p> : null}
        </div>
      ) : null}
    </>
  );
}

function CheckoutBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-bold text-slate-950">{icon}{title}</div>
      {children}
    </section>
  );
}

function PaymentResult({ status, orderId }: { status: string; orderId?: string }) {
  const isSuccess = status === "success" || status === "paid";
  return (
    <Alert className={isSuccess ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}>
      <CheckCircle2Icon className="size-4" />
      <AlertTitle>{isSuccess ? "Payment completed" : "Payment status updated"}</AlertTitle>
      <AlertDescription>
        {orderId ? <Link className="font-semibold underline" href={`/orders/${orderId}`}>View order</Link> : "ตรวจสอบสถานะคำสั่งซื้อได้ในหน้า Orders"}
      </AlertDescription>
    </Alert>
  );
}
