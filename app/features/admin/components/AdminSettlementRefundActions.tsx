"use client";

import { formatMinorCurrency, compareMinorUnits, type MinorUnitValue } from "#/lib/money";

import { useState } from "react";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { useTranslations } from "#/i18n/client";
import {
  type AdminOrder, type AdminRefund, usePrepareCancellationRefund,
  useUpdateRefundPlan, useUpdateRefundStatus,
} from "../hooks/useAdminOperations";
import { AdminStatusAction } from "./AdminStatusAction";

function operationMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  if ("message" in error && typeof error.message === "string") return error.message;
  if ("value" in error) return operationMessage(error.value, fallback);
  if ("error" in error) return operationMessage(error.error, fallback);
  return fallback;
}

function refundMoney(amount: MinorUnitValue, currency: string): string {
  return formatMinorCurrency(amount, "en-US", currency);
}

type CancellationOrder = Pick<AdminOrder, "id" | "paymentStatus" | "status" | "shopOrders"> & {
  items: Array<Pick<AdminOrder["items"][number], "id" | "quantity">>;
  shipments: Array<Pick<AdminOrder["shipments"][number], "status">>;
  refunds: Array<Pick<AdminOrder["refunds"][number], "status">>;
};

export function PrepareCancellationRefund({ order }: { order: CancellationOrder }) {
  const t = useTranslations();
  const prepare = usePrepareCancellationRefund();
  const shops = order.shopOrders ?? [];
  const eligible = order.paymentStatus === "SUCCEEDED" && ["PAID", "PROCESSING"].includes(order.status)
    && order.items.length > 0 && shops.length > 0 && shops.every((shop) => shop.saleSnapshot?.policyVersion === 1 || shop.saleSnapshot?.policyVersion === 2)
    && !order.shipments.some((shipment) => shipment.status === "SHIPPED" || shipment.status === "DELIVERED");
  if (!eligible) return null;
  return <div className="space-y-2 text-right">
    <Button size="sm" variant="outline" disabled={prepare.isPending || order.refunds.some((refund) => refund.status === "PENDING" || refund.status === "PROCESSING")}
      onClick={() => prepare.mutate({ orderId: order.id, plan: {
        items: order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
        shipping: shops.map((shop) => ({ shopOrderId: shop.id, cause: "PRE_SHIPMENT_CANCEL" })),
      } })}>{t("admin.refunds.prepareCancellation")}</Button>
    {prepare.data ? <p role="status" className="text-sm text-emerald-200">{t("admin.refunds.cancellationPrepared").replace("{amount}", refundMoney(prepare.data.amount, prepare.data.payment.currency))}</p> : null}
    {prepare.error ? <p role="alert" className="text-sm text-red-200">{operationMessage(prepare.error, t("admin.refunds.operationFailed"))}</p> : null}
  </div>;
}

type SettlementRefund = Pick<AdminRefund, "id" | "status" | "amount" | "returnRequestId"> & {
  payment: Pick<AdminRefund["payment"], "currency">;
  itemAllocations?: Array<Pick<NonNullable<AdminRefund["itemAllocations"]>[number], "orderItemId" | "quantity" | "remainingQuantity" | "cashMerchandise" | "buyerTaxRefund" | "platformCouponReversal" | "platformCouponTaxReversal" | "coinFundingReversal" | "coinTaxReversal" | "itemSale">>;
  shopAllocations?: Array<Pick<NonNullable<AdminRefund["shopAllocations"]>[number], "shopOrderId" | "shippingCause" | "buyerShippingRefund" | "buyerShippingTaxRefund" | "platformShippingReversal" | "platformShippingTaxReversal">>;
  order: Pick<AdminRefund["order"], "orderNumber" | "shopOrders">;
};

export function RefundSettlementActions({ refund }: { refund: SettlementRefund }) {
  const t = useTranslations();
  const updatePlan = useUpdateRefundPlan();
  const updateStatus = useUpdateRefundStatus();
  const items = refund.itemAllocations ?? [];
  const allocations = refund.shopAllocations ?? [];
  const snapshotShops = refund.order.shopOrders ?? [];
  const savedShipping = allocations.some((shop) => shop.shippingCause === "SELLER_FAULT");
  const [quantityEdits, setQuantityEdits] = useState<Record<string, string>>({});
  const [shippingChoice, setShippingChoice] = useState<boolean | null>(null);
  const includeShipping = shippingChoice ?? savedShipping;
  const canEditShipping = refund.status === "PENDING" && Boolean(refund.itemAllocations?.length) && allocations.length > 0
    && snapshotShops.length > 0 && snapshotShops.every((shop) => shop.saleSnapshot?.policyVersion === 1 || shop.saleSnapshot?.policyVersion === 2)
    && allocations.every((shop) => shop.shippingCause !== "PRE_SHIPMENT_CANCEL");
  const canEditQuantity = canEditShipping && refund.returnRequestId === null;
  const requestedItems = items.map((item) => ({ orderItemId: item.orderItemId, quantity: canEditQuantity ? Number(quantityEdits[item.orderItemId] ?? item.quantity) : item.quantity }));
  const validQuantities = requestedItems.every((item, index) => Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= (items[index]?.remainingQuantity ?? 0));
  const dirty = canEditShipping && (includeShipping !== savedShipping || requestedItems.some((item, index) => item.quantity !== items[index]?.quantity));
  return <div className="ml-auto flex w-64 max-w-full flex-col items-end gap-2 whitespace-normal">
    {items.map((item, index) => <div key={item.orderItemId} className="w-full space-y-1 rounded-lg border border-white/10 p-2 text-left text-xs text-slate-200">
      <p className="font-semibold">{item.itemSale?.orderItem.productTitle ?? t("order.items")} {item.itemSale?.orderItem.variantTitle ?? ""}</p>
      {canEditQuantity ? <label className="space-y-1"><span>{t("admin.refunds.quantity")}</span><Input aria-label={[t("admin.refunds.quantity"), item.itemSale?.orderItem.productTitle ?? String(index + 1), item.itemSale?.orderItem.variantTitle ?? ""].filter(Boolean).join(" ")} type="number" min="1" max={item.remainingQuantity} step="1" disabled={updatePlan.isPending} value={quantityEdits[item.orderItemId] ?? String(item.quantity)} onChange={(event) => setQuantityEdits({ ...quantityEdits, [item.orderItemId]: event.target.value })} /></label> : <p>{t("admin.refunds.quantity")}: {item.quantity}</p>}
      <p>{t("admin.refunds.merchandiseNet")}: {refundMoney(item.cashMerchandise, refund.payment.currency)}</p>
      <p>{t("admin.refunds.buyerTax")}: {refundMoney(item.buyerTaxRefund, refund.payment.currency)}</p>
      <p>{t("admin.refunds.platformTax")}: {refundMoney(item.platformCouponTaxReversal, refund.payment.currency)}</p>
      <p>{t("admin.refunds.coinTax")}: {refundMoney(item.coinTaxReversal, refund.payment.currency)}</p>
    </div>)}
    {refund.returnRequestId ? <p className="w-full text-left text-xs text-slate-300">{t("admin.refunds.approvedReturnQuantity")}</p> : null}
    {allocations.map((shop) => <div key={shop.shopOrderId} className="w-full text-left text-xs text-slate-300"><p>{t("admin.refunds.shippingTax")}: {refundMoney(shop.buyerShippingTaxRefund, refund.payment.currency)}</p><p>{t("admin.refunds.platformShippingTax")}: {refundMoney(shop.platformShippingTaxReversal, refund.payment.currency)}</p></div>)}
    {!validQuantities && canEditShipping ? <p role="alert" className="text-sm text-red-200">{t("buyer.invalidReturnQuantity")}</p> : null}
    {canEditShipping ? <>
      <label className="flex w-full cursor-pointer items-start gap-2 text-left text-sm text-slate-200">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={includeShipping} disabled={updatePlan.isPending}
          onChange={(event) => setShippingChoice(event.target.checked)} />
        <span className="min-w-0 flex-1 break-words">{t("admin.refunds.confirmedSellerFaultShipping")}</span>
      </label>
      <Button size="sm" variant="outline" disabled={!dirty || !validQuantities || updatePlan.isPending || updateStatus.isPending}
        onClick={() => updatePlan.mutate({ refundId: refund.id, plan: {
          items: requestedItems,
          shipping: allocations.map((shop) => ({ shopOrderId: shop.shopOrderId, cause: includeShipping ? "SELLER_FAULT" : "NONE" })),
        } }, { onSuccess: () => { setShippingChoice(null); setQuantityEdits({}); } })}>{t("admin.refunds.updatePlan")}</Button>
      {dirty ? <p className="max-w-80 text-sm text-amber-200">{t("admin.refunds.savePlanFirst")}</p> : null}
    </> : null}
    {updatePlan.data ? <p role="status" className="max-w-80 text-sm text-emerald-200">{t("admin.refunds.planUpdatedReview").replace("{amount}", refundMoney(updatePlan.data.amount, updatePlan.data.payment.currency))}</p> : null}
    <AdminStatusAction label={refund.order.orderNumber} currentStatus={refund.status} options={["PENDING", "PROCESSING", "SUCCESS", "FAILED"]}
      disabled={dirty || !validQuantities || updatePlan.isPending} isPending={updateStatus.isPending}
      onConfirm={(next) => {
        const externalReference = next === "SUCCESS" ? window.prompt(t(compareMinorUnits(refund.amount, 0) === 0
          ? "admin.refunds.internalReferencePrompt" : "admin.refunds.externalReferencePrompt"))?.trim() : undefined;
        if (next !== "SUCCESS" || externalReference) updateStatus.mutate({ id: refund.id, status: next, externalReference });
      }} />
    {updatePlan.error || updateStatus.error ? <p role="alert" className="max-w-80 text-sm text-red-200">{operationMessage(updatePlan.error ?? updateStatus.error, t("admin.refunds.operationFailed"))}</p> : null}
  </div>;
}
