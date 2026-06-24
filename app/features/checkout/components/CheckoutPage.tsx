"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCardIcon, MapPinIcon, TicketIcon, TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { createCheckout, fetchAddresses, fetchCart, formatMoney } from "#/features/buyer/api";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function CheckoutPage() {
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const localePath = useLocalePath();
  const locale = useLocale();
  const t = useTranslations();
  const cartQuery = useQuery({ queryKey: ["buyer-cart", locale], queryFn: () => fetchCart(locale) });
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: fetchAddresses });
  const defaultAddress = addressesQuery.data?.find((address) => address.isDefault) ?? addressesQuery.data?.[0];
  const addressId = selectedAddressId || defaultAddress?.id || "";
  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cartQuery.data?.id) throw new Error(t("checkout.emptyTitle"));
      if (!addressId) throw new Error(t("checkout.noAddressDescription"));
      return createCheckout({
        cartId: cartQuery.data.id,
        addressId,
        couponCode: couponCode || undefined,
        paymentMethod,
        shippingMethod: "standard",
        locale,
      });
    },
  });
  const total = useMemo(() => cartQuery.data?.subtotal ?? 0, [cartQuery.data?.subtotal]);
  const itemCount = cartQuery.data?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0;

  return (
    <>
      <BuyerTopBar title={t("checkout.title")} />
      <div className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4">
        {cartQuery.isLoading ? <BuyerLoadingList /> : null}
        {cartQuery.isError ? <BuyerErrorState message={cartQuery.error.message} onRetry={() => void cartQuery.refetch()} /> : null}
        {cartQuery.isSuccess && itemCount === 0 ? (
          <BuyerEmptyState title={t("checkout.emptyTitle")} description={t("checkout.emptyDescription")} />
        ) : null}
        {cartQuery.data && itemCount > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <CheckoutBlock icon={<MapPinIcon className="size-5" />} title={t("checkout.address")}>
                {addressesQuery.isLoading ? <p className="text-sm text-slate-700">{t("checkout.loadingAddresses")}</p> : null}
                {addressesQuery.data?.length ? (
                  <RadioGroup value={addressId} onValueChange={setSelectedAddressId} className="space-y-2">
                    {addressesQuery.data.map((address) => (
                      <label key={address.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3 has-[[data-state=checked]]:border-orange-200 has-[[data-state=checked]]:bg-orange-50">
                        <span>
                          <span className="font-semibold text-slate-950">{address.recipientName}</span>
                          {address.isDefault ? <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{t("common.default")}</span> : null}
                          <span className="mt-1 block text-sm text-slate-700">
                            {[address.line1, address.line2, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(", ")}
                          </span>
                          {address.phone ? <span className="mt-1 block text-xs font-medium text-slate-600">{address.phone}</span> : null}
                        </span>
                        <RadioGroupItem value={address.id} />
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-3">
                    <p className="font-semibold text-slate-950">{t("checkout.noAddressTitle")}</p>
                    <p className="mt-1 text-sm text-slate-700">{t("checkout.noAddressDescription")}</p>
                  </div>
                )}
                <Button asChild variant="outline" className="mt-3 rounded-full">
                  <Link href={localePath("/account/addresses")}>{t("checkout.manageAddresses")}</Link>
                </Button>
              </CheckoutBlock>
              <CheckoutBlock icon={<TruckIcon className="size-5" />} title={t("checkout.shippingMethod")}>
                <RadioGroup defaultValue="standard">
                  <div className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 p-3">
                    <Label htmlFor="standard" className="font-semibold">{t("checkout.standardDelivery")}</Label>
                    <RadioGroupItem id="standard" value="standard" />
                  </div>
                </RadioGroup>
              </CheckoutBlock>
              <CheckoutBlock icon={<TicketIcon className="size-5" />} title={t("checkout.coupon")}>
                <Input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder={t("checkout.couponCode")} />
              </CheckoutBlock>
              <CheckoutBlock icon={<CreditCardIcon className="size-5" />} title={t("checkout.paymentMethod")}>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <Label htmlFor="card" className="font-semibold">{t("checkout.cardGateway")}</Label>
                    <RadioGroupItem id="card" value="card" />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <Label htmlFor="cod" className="font-semibold">{t("checkout.cashOnDelivery")}</Label>
                    <RadioGroupItem id="cod" value="cod" />
                  </div>
                </RadioGroup>
              </CheckoutBlock>
            </div>
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">{t("checkout.summary")}</h2>
              <div className="mt-4 space-y-3">
                {cartQuery.data.shops.map((shop) => (
                  <div key={shop.shopId} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{shop.shopName}</span>
                    <span className="font-semibold text-slate-950">{formatMoney(shop.subtotal, cartQuery.data.currency)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("checkout.total")}</span>
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
            <Button className="h-12 min-w-40 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={checkoutMutation.isPending || !addressId} onClick={() => checkoutMutation.mutate()}>
              {t("checkout.placeOrder")}
            </Button>
          </div>
          {checkoutMutation.isError ? <p className="mx-auto mt-2 max-w-5xl text-sm text-red-600">{checkoutMutation.error.message}</p> : null}
          {checkoutMutation.isSuccess ? (
            <p className="mx-auto mt-2 max-w-5xl text-sm text-emerald-700">
              {t("checkout.orderCreated").replace("{orderNo}", checkoutMutation.data.orderNo)} <Link className="font-semibold underline" href={checkoutMutation.data.paymentUrl}>{t("checkout.viewPaymentStatus")}</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CheckoutBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-bold text-slate-950">{icon}{title}</div>
      {children}
    </section>
  );
}
