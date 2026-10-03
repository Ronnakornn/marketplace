"use client";

import { compareMinorUnits, parseMinorUnits, type MinorUnitValue } from "#/lib/money";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CoinsIcon, CreditCardIcon, MapPinIcon, PackageCheckIcon, TicketIcon, TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Skeleton } from "#/components/ui/skeleton";
import { createCheckout, fetchAddresses, fetchCart, formatMoney, quoteCheckout } from "#/features/buyer/api";
import { useBuyerCoins } from "#/features/promotion/hooks/useBuyerCoins";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

type CouponSelection =
  | { kind: "legacy"; code: string | null }
  | { kind: "stack"; shopCode: string | null; platformCode: string | null };

const COUPON_REASON_KEYS = {
  COUPON_NOT_FOUND: "checkout.couponReasonNotFound",
  COUPON_FORBIDDEN: "checkout.couponReasonInvalid",
  COUPON_INACTIVE: "checkout.couponReasonInactive",
  COUPON_NOT_STARTED: "checkout.couponReasonNotStarted",
  COUPON_EXPIRED: "checkout.couponReasonExpired",
  COUPON_MIN_ORDER_NOT_MET: "checkout.couponReasonMinOrderNotMet",
  COUPON_USAGE_LIMIT_REACHED: "checkout.couponReasonUsageLimitReached",
  COUPON_USER_LIMIT_REACHED: "checkout.couponReasonUserLimitReached",
  INVALID_COUPON: "checkout.couponReasonInvalid",
} as const;

export function CheckoutPage() {
  const searchParams = useSearchParams();
  const requestedVoucher = searchParams?.get("voucher")?.trim().slice(0, 64) ?? "";
  const [couponInput, setCouponInput] = useState(requestedVoucher);
  const [couponSelection, setCouponSelection] = useState<CouponSelection>({ kind: "legacy", code: requestedVoucher || null });
  const [shopCouponInput, setShopCouponInput] = useState("");
  const [platformCouponInput, setPlatformCouponInput] = useState("");
  const appliedCoupon = couponSelection.kind === "legacy" ? couponSelection.code : null;
  const shopCouponCode = couponSelection.kind === "stack" ? couponSelection.shopCode : null;
  const platformCouponCode = couponSelection.kind === "stack" ? couponSelection.platformCode : null;
  const [coinInput, setCoinInput] = useState("");
  const [coinsToUse, setCoinsToUse] = useState(0);
  const paymentMethod = "card";
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const checkoutSubmitting = useRef(false);
  const localePath = useLocalePath();
  const locale = useLocale();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const cartQuery = useQuery({ queryKey: ["buyer-cart", locale], queryFn: () => fetchCart(locale) });
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: fetchAddresses });
  const coinsQuery = useBuyerCoins(5);
  const defaultAddress = addressesQuery.data?.find((address) => address.isDefault) ?? addressesQuery.data?.[0];
  const addressId = selectedAddressId || defaultAddress?.id || "";
  const requestedItemIds = new Set(searchParams?.get("items")?.split(",").filter(Boolean) ?? []);
  const hasRequestedItems = searchParams?.has("items") ?? false;
  const selectedShops = cartQuery.data?.shops.map((shop) => {
    const items = shop.items.filter((item) => !hasRequestedItems || requestedItemIds.has(item.id));
    return { ...shop, items };
  }).filter((shop) => shop.items.length > 0) ?? [];
  const selectedItemIds = selectedShops.flatMap((shop) => shop.items.map((item) => item.id));
  const itemCount = selectedItemIds.length;
  const cartId = cartQuery.data?.id ?? null;
  const quoteQuery = useQuery({
    queryKey: ["checkout-quote", cartId, selectedItemIds, appliedCoupon, shopCouponCode, platformCouponCode, coinsToUse, locale],
    queryFn: () => {
      if (!cartId) throw new Error(t("checkout.emptyTitle"));
      return quoteCheckout({ cartId, cartItemIds: selectedItemIds, couponCode: appliedCoupon ?? undefined,
        shopCouponCode: shopCouponCode ?? undefined, platformCouponCode: platformCouponCode ?? undefined, coinsToUse });
    },
    enabled: Boolean(cartId) && itemCount > 0,
  });
  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cartQuery.data?.id) throw new Error(t("checkout.emptyTitle"));
      if (!addressId) throw new Error(t("checkout.noAddressDescription"));
      if (!quoteQuery.data?.quoteFingerprint || !quoteQuery.data.taxPolicyRevision) throw new Error(t("checkout.quoteError"));
      return createCheckout({
        cartId: cartQuery.data.id,
        cartItemIds: selectedItemIds,
        addressId,
        couponCode: appliedCoupon || undefined,
        shopCouponCode: shopCouponCode ?? undefined,
        platformCouponCode: platformCouponCode ?? undefined,
        acceptedQuoteFingerprint: quoteQuery.data.quoteFingerprint,
        acceptedTaxPolicyRevision: quoteQuery.data.taxPolicyRevision,
        coinsToUse,
        paymentMethod,
        shippingMethod: "standard",
        locale,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart"] });
    },
    onError: () => { void quoteQuery.refetch(); },
    onSettled: () => {
      checkoutSubmitting.current = false;
    },
  });
  const quotedItems = new Map(quoteQuery.data?.items.map((item) => [item.id, item]));
  const quotedShops = new Map(quoteQuery.data?.shops.map((shop) => [shop.shopId, shop]));
  const renderQuotedAmount = (amount: MinorUnitValue | undefined) => amount === undefined || !quoteQuery.isSuccess
    ? <Skeleton className="h-4 w-20" />
    : formatMoney(amount, quoteQuery.data.currency);
  const handleApplyCoupon = () => {
    const trimmed = couponInput.trim();
    if (!trimmed) return;
    setCouponSelection({ kind: "legacy", code: trimmed });
  };
  const handleClearCoupon = () => {
    setCouponSelection({ kind: "legacy", code: null });
    setCouponInput("");
  };
  const applyNamedCoupon = (slot: "shop" | "platform", code: string | null) => {
    setCouponSelection({ kind: "stack",
      shopCode: slot === "shop" ? code : shopCouponCode,
      platformCode: slot === "platform" ? code : platformCouponCode });
  };
  const handleApplyCoins = () => {
    let requested: bigint;
    try { requested = parseMinorUnits(coinInput); } catch { return; }
    if (requested < 0n || requested > 9007199254740991n) return;
    const available = parseMinorUnits(coinsQuery.data?.balance ?? 0);
    if (available < 0n) return;
    const applied = Number(requested < available ? requested : available);
    setCoinsToUse(applied);
    setCoinInput(String(applied));
  };
  const canPlaceOrder = Boolean(addressId) && quoteQuery.isSuccess && !quoteQuery.isFetching
    && Boolean(quoteQuery.data?.quoteFingerprint && quoteQuery.data.taxPolicyRevision);
  const handlePlaceOrder = () => {
    if (checkoutSubmitting.current || !canPlaceOrder || checkoutMutation.isSuccess) return;
    // Mutation state renders asynchronously; claim the submission synchronously
    // so two clicks in the same browser event batch cannot both create checkout.
    checkoutSubmitting.current = true;
    checkoutMutation.mutate();
  };
  const couponRejected = quoteQuery.data?.coupon?.applied === false;

  const renderQuoteTotal = () => {
    if (quoteQuery.isLoading) return <Skeleton className="h-6 w-24" />;
    if (quoteQuery.isError) {
      return (
        <span className="flex items-center gap-2 text-sm font-normal text-red-600">
          {t("checkout.quoteError")}
          <Button type="button" variant="outline" size="sm" onClick={() => void quoteQuery.refetch()}>
            {t("state.retry")}
          </Button>
        </span>
      );
    }
    if (!quoteQuery.data) return null;
    return <span>{formatMoney(quoteQuery.data.grandTotal, quoteQuery.data.currency)}</span>;
  };

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
              <CheckoutBlock icon={<PackageCheckIcon className="size-5" />} title={t("order.items")}>
                <div className="space-y-3">
                  {selectedShops.map((shop) => (
                    <section key={shop.shopId} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{shop.shopName}</span>
                        <span className="font-semibold text-slate-950">{renderQuotedAmount(quotedShops.get(shop.shopId)?.subtotal)}</span>
                      </div>
                      <div className="space-y-2">
                        {shop.items.map((item) => (
                          <div key={item.id} className="flex gap-3">
                            <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-[10px] text-slate-400">{t("cart.noImage")}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                              <p className="truncate text-xs text-slate-500">{item.variantTitle}</p>
                              <div className="mt-1 flex justify-between gap-2 text-xs text-slate-600">
                                <span>×{item.quantity}</span>
                                <span className="font-semibold text-slate-950">{renderQuotedAmount(quotedItems.get(item.id)?.lineTotal)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </CheckoutBlock>
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
                <div className="flex gap-2">
                  <Input value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder={t("checkout.couponCode")} />
                  <Button type="button" variant="outline" className="rounded-full" disabled={!couponInput.trim()} onClick={handleApplyCoupon}>
                    {t("checkout.couponApply")}
                  </Button>
                </div>
                {appliedCoupon ? (
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className={couponRejected ? "font-medium text-slate-700" : "font-medium text-emerald-700"}>
                      {t(couponRejected ? "checkout.couponNotApplied" : "checkout.couponApplied").replace("{code}", appliedCoupon)}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearCoupon}>
                      {t("checkout.couponRemove")}
                    </Button>
                  </div>
                ) : null}
                <p className="mt-4 text-xs text-slate-600">{t("checkout.couponStackOrder")}</p>
                {([
                  { slot: "shop", input: shopCouponInput, setInput: setShopCouponInput, code: shopCouponCode, label: "checkout.shopCoupon", applyLabel: "checkout.applyShopCoupon" },
                  { slot: "platform", input: platformCouponInput, setInput: setPlatformCouponInput, code: platformCouponCode, label: "checkout.platformCoupon", applyLabel: "checkout.applyPlatformCoupon" },
                ] as const).map((field) => {
                  const outcomeIndex = field.slot === "platform" && shopCouponCode ? 1 : 0;
                  const candidate = quoteQuery.data?.couponOutcomes?.[outcomeIndex];
                  const outcome = candidate?.code.toUpperCase() === field.code?.toUpperCase() ? candidate : undefined;
                  return <div key={field.slot} className="mt-3 space-y-2">
                    <Label htmlFor={`checkout-${field.slot}-coupon`}>{t(field.label)}</Label>
                    <div className="flex gap-2">
                      <Input id={`checkout-${field.slot}-coupon`} value={field.input} onChange={(event) => field.setInput(event.target.value)} />
                      <Button type="button" variant="outline" disabled={!field.input.trim()} onClick={() => applyNamedCoupon(field.slot, field.input.trim())}>{t(field.applyLabel)}</Button>
                    </div>
                    {field.code ? <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{t(outcome?.applied === true ? "checkout.couponApplied" : "checkout.couponNotApplied").replace("{code}", field.code)}</span>
                      <Button type="button" variant="ghost" size="sm" aria-label={`${t("checkout.couponRemove")} ${t(field.label)}`} onClick={() => applyNamedCoupon(field.slot, null)}>{t("checkout.couponRemove")}</Button>
                    </div> : null}
                    {outcome?.applied === false ? <p role="alert" className="text-sm text-red-600">{t(Object.entries(COUPON_REASON_KEYS).find(([reason]) => reason === outcome.reason)?.[1] ?? "checkout.couponReasonInvalid")}</p> : null}
                  </div>;
                })}
                {quoteQuery.data?.coupon && quoteQuery.data.coupon.applied === false ? (
                  <p className="mt-2 text-sm text-red-600">
                    {t(COUPON_REASON_KEYS[quoteQuery.data.coupon.reason as keyof typeof COUPON_REASON_KEYS] ?? "checkout.couponReasonInvalid")}
                  </p>
                ) : null}
              </CheckoutBlock>
              <CheckoutBlock icon={<CoinsIcon className="size-5" />} title={t("checkout.coins")}>
                <p className="mb-2 text-sm text-slate-600">{t("checkout.coinsAvailable").replace("{count}", String(coinsQuery.data?.balance ?? 0))}</p>
                <div className="flex gap-2">
                  <Input id="checkout-coins" aria-label={t("checkout.coins")} type="number" min="0" max={coinsQuery.data?.balance ?? 0} step="1" value={coinInput} onChange={(event) => setCoinInput(event.target.value)} />
                  <Button type="button" variant="outline" className="rounded-full" disabled={coinsQuery.isLoading || !coinInput} onClick={handleApplyCoins}>{t("checkout.coinsApply")}</Button>
                </div>
                {coinsToUse > 0 ? <div className="mt-2 flex items-center justify-between gap-2 text-sm"><span className="font-medium text-emerald-700">{t("checkout.coinsApplied").replace("{count}", String(quoteQuery.data?.coinsApplied ?? coinsToUse))}</span><Link className="font-semibold text-orange-700" href={localePath("/coins")}>{t("checkout.coinsHistory")}</Link></div> : null}
              </CheckoutBlock>
              <CheckoutBlock icon={<CreditCardIcon className="size-5" />} title={t("checkout.paymentMethod")}>
                <RadioGroup value={paymentMethod}>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <Label htmlFor="card" className="font-semibold">{t("checkout.cardGateway")}</Label>
                    <RadioGroupItem id="card" value="card" />
                  </div>
                </RadioGroup>
              </CheckoutBlock>
            </div>
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">{t("checkout.summary")}</h2>
              <div className="mt-4 space-y-3">
                {selectedShops.map((shop) => (
                  <div key={shop.shopId} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{shop.shopName}</span>
                    <span className="font-semibold text-slate-950">{renderQuotedAmount(quotedShops.get(shop.shopId)?.subtotal)}</span>
                  </div>
                ))}
                {quoteQuery.data && compareMinorUnits(quoteQuery.data.discountTotal, 0) > 0 ? (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{t("checkout.discount")}</span>
                    <span className="font-semibold text-emerald-700">-{formatMoney(quoteQuery.data.discountTotal, quoteQuery.data.currency)}</span>
                  </div>
                ) : null}
                {quoteQuery.data ? (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{t("checkout.shipping")}</span>
                    <span className="font-semibold text-slate-950">{formatMoney(quoteQuery.data.shippingTotal, quoteQuery.data.currency)}</span>
                  </div>
                ) : null}
                {quoteQuery.data?.taxMode ? <div className="flex justify-between gap-3 text-sm" data-testid="checkout-tax-disclosure">
                  <span className="text-slate-700">{t(quoteQuery.data.taxMode === "INCLUSIVE" ? "checkout.taxIncluded" : "checkout.taxAdded")}</span>
                  <span className="font-semibold text-slate-950">{renderQuotedAmount(quoteQuery.data.taxMode === "INCLUSIVE"
                    ? quoteQuery.data.includedTaxTotal : quoteQuery.data.addedTaxTotal ?? quoteQuery.data.taxTotal)}</span>
                </div> : null}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("checkout.total")}</span>
                    {renderQuoteTotal()}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>

      {checkoutMutation.isSuccess ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm text-emerald-700">
            <span>{t("checkout.orderCreated").replace("{orderNo}", checkoutMutation.data.orderNo)}</span>
            <Button asChild className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
              <Link href={checkoutMutation.data.paymentUrl}>{t("checkout.viewPaymentStatus")}</Link>
            </Button>
          </p>
        </div>
      ) : cartQuery.data && itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="text-lg font-bold">{renderQuoteTotal()}</div>
            <Button className="h-12 min-w-40 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={checkoutMutation.isPending || !canPlaceOrder} onClick={handlePlaceOrder}>
              {t("checkout.placeOrder")}
            </Button>
          </div>
          {checkoutMutation.isError ? <p className="mx-auto mt-2 max-w-5xl text-sm text-red-600">{checkoutMutation.error.message}</p> : null}
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
