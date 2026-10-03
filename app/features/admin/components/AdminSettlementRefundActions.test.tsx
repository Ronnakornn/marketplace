/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PrepareCancellationRefund, RefundSettlementActions } from "./AdminSettlementRefundActions";

const { prepare, updatePlan, updateStatus } = vi.hoisted(() => ({ prepare: vi.fn(), updatePlan: vi.fn(), updateStatus: vi.fn() }));
let planData: { amount: string; payment: { currency: string } } | undefined;
let planError: unknown;
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key === "admin.refunds.planUpdatedReview" ? "Review the new total {amount}" : key }));
vi.mock("#/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => <button {...props}>{children}</button> }));
vi.mock("../hooks/useAdminOperations", () => ({
  usePrepareCancellationRefund: () => ({ mutate: prepare, isPending: false, error: planError }),
  useUpdateRefundPlan: () => ({ mutate: updatePlan, isPending: false, data: planData, error: planError }),
  useUpdateRefundStatus: () => ({ mutate: updateStatus, isPending: false }),
}));
vi.mock("./AdminStatusAction", () => ({ AdminStatusAction: ({ disabled, onConfirm }: { disabled?: boolean; onConfirm: (status: string) => void }) => <>
  <button disabled={disabled} onClick={() => onConfirm("PROCESSING")}>Process</button>
  <button disabled={disabled} onClick={() => onConfirm("SUCCESS")}>Complete</button>
</> }));

function order(): Parameters<typeof PrepareCancellationRefund>[0]["order"] {
  return { id: "order-1", status: "PAID", paymentStatus: "SUCCEEDED", items: [{ id: "item-1", quantity: 2 }],
    shipments: [{ status: "PENDING" }], refunds: [], shopOrders: [{ id: "shop-order-1", shopId: "shop-1", saleSnapshot: { policyVersion: 1 } }] };
}
function refund(): Parameters<typeof RefundSettlementActions>[0]["refund"] {
  return { payment: { currency: "THB" }, id: "refund-1", status: "PENDING", amount: "8300", order: { orderNumber: "ORD-1", shopOrders: order().shopOrders },
    itemAllocations: [{ orderItemId: "item-1", quantity: 2, remainingQuantity: 3, cashMerchandise: "8300", buyerTaxRefund: "0", platformCouponReversal: "0", platformCouponTaxReversal: "0", coinFundingReversal: "0", coinTaxReversal: "0" }],
    shopAllocations: [{ shopOrderId: "shop-order-1", shippingCause: "NONE", buyerShippingRefund: "0", buyerShippingTaxRefund: "0", platformShippingReversal: "0", platformShippingTaxReversal: "0" }] };
}
beforeEach(() => { planData = undefined; planError = undefined; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("settlement refund review controls", () => {
  it("prepares a pending cancellation with original full item quantities and shop intent", () => {
    render(<PrepareCancellationRefund order={order()} />);
    fireEvent.click(screen.getByRole("button", { name: "admin.refunds.prepareCancellation" }));
    expect(prepare).toHaveBeenCalledWith({ orderId: "order-1", plan: {
      items: [{ orderItemId: "item-1", quantity: 2 }], shipping: [{ shopOrderId: "shop-order-1", cause: "PRE_SHIPMENT_CANCEL" }],
    } });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it.each(["shipped", "legacy", "unpaid"] as const)("does not offer cancellation preparation for %s orders", reason => {
    const data = order();
    if (reason === "shipped") data.shipments = [{ status: "SHIPPED" }];
    if (reason === "legacy") data.shopOrders = [{ id: "shop-order-1", shopId: "shop-1", saleSnapshot: null }];
    if (reason === "unpaid") data.paymentStatus = "PENDING";
    render(<PrepareCancellationRefund order={data} />);
    expect(screen.queryByRole("button", { name: "admin.refunds.prepareCancellation" })).toBeNull();
  });

  it("requires saving shipping and reviewing the refreshed server total before processing", () => {
    const data = refund();
    const view = render(<RefundSettlementActions refund={data} />);
    const shippingCheckbox = screen.getByRole("checkbox", { name: "admin.refunds.confirmedSellerFaultShipping" });
    fireEvent.click(screen.getByText("admin.refunds.confirmedSellerFaultShipping"));
    expect(shippingCheckbox).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "admin.refunds.updatePlan" }));
    expect(updatePlan).toHaveBeenCalledWith({ refundId: "refund-1", plan: {
      items: [{ orderItemId: "item-1", quantity: 2 }], shipping: [{ shopOrderId: "shop-order-1", cause: "SELLER_FAULT" }],
    } }, expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(updateStatus).not.toHaveBeenCalled();
    planData = { amount: "8700", payment: { currency: "THB" } };
    view.rerender(<RefundSettlementActions refund={{ ...data, amount: "8700", shopAllocations: [{ shopOrderId: "shop-order-1", shippingCause: "SELLER_FAULT", buyerShippingRefund: "400", buyerShippingTaxRefund: "0", platformShippingReversal: "0", platformShippingTaxReversal: "0" }] }} />);
    expect(screen.getByRole("status").textContent).toMatch(/87\.00/);
    expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Process" }));
    expect(updateStatus).toHaveBeenCalledWith({ id: "refund-1", status: "PROCESSING", externalReference: undefined });
  });

  it("keeps an unchanged refund plan when processing without a shipping edit", () => {
    render(<RefundSettlementActions refund={refund()} />);
    fireEvent.click(screen.getByRole("button", { name: "Process" }));
    expect(updatePlan).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith({ id: "refund-1", status: "PROCESSING", externalReference: undefined });
  });

  it("preserves the final cent in the server review total at the safe integer boundary", () => {
    planData = { amount: "9007199254740991", payment: { currency: "THB" } };
    render(<RefundSettlementActions refund={refund()} />);
    expect(screen.getByRole("status").textContent).toContain("90,071,992,547,409.91");
  });

  it("uses an internal evidence reference to complete a zero-cash adjustment", () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("INTERNAL-1");
    render(<RefundSettlementActions refund={{ ...refund(), amount: "0", status: "PROCESSING" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(prompt).toHaveBeenCalledWith("admin.refunds.internalReferencePrompt");
    expect(updateStatus).toHaveBeenCalledWith({ id: "refund-1", status: "SUCCESS", externalReference: "INTERNAL-1" });
  });

  it("shows the server conflict and retains the review gate after a failed plan edit", () => {
    const view = render(<RefundSettlementActions refund={refund()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "admin.refunds.confirmedSellerFaultShipping" }));
    planError = { value: { error: { message: "Shipping has already been refunded" } } };
    view.rerender(<RefundSettlementActions refund={refund()} />);
    expect(screen.getByRole("alert").textContent).toBe("Shipping has already been refunded");
    expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
  });
  it("saves a partial quantity using the authoritative remaining capacity", () => {
    render(<RefundSettlementActions refund={refund()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "admin.refunds.quantity 1" }), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Process" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "admin.refunds.updatePlan" }));
    expect(updatePlan).toHaveBeenCalledWith({ refundId: "refund-1", plan: { items: [{ orderItemId: "item-1", quantity: 1 }], shipping: [{ shopOrderId: "shop-order-1", cause: "NONE" }] } }, expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it.each(["0", "4", "1.5"])("blocks an invalid partial quantity %s without updating rights", (quantity) => {
    render(<RefundSettlementActions refund={refund()} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: quantity } });
    expect(screen.getByRole("button", { name: "admin.refunds.updatePlan" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Process" })).toHaveProperty("disabled", true);
    expect(updatePlan).not.toHaveBeenCalled();
  });

  it.each([
    { cash: "31", tax: "2", amount: "33", cashLabel: "0.31", taxLabel: "0.02" },
    { cash: "31", tax: "2", amount: "33", cashLabel: "0.31", taxLabel: "0.02" },
    { cash: "32", tax: "3", amount: "35", cashLabel: "0.32", taxLabel: "0.03" },
  ])("shows original net $cash and tax $tax separately for a cash refund of $amount", (scenario) => {
    const data = refund();
    data.amount = scenario.amount;
    if (!data.itemAllocations?.[0]) throw new Error("Missing original item allocation");
    data.itemAllocations[0].cashMerchandise = scenario.cash;
    data.itemAllocations[0].buyerTaxRefund = scenario.tax;
    data.order.shopOrders = [{ id: "shop-order-1", shopId: "shop-1", saleSnapshot: { policyVersion: 2 } }];
    render(<RefundSettlementActions refund={data} />);
    expect(screen.getByText(/admin.refunds.merchandiseNet:/).textContent).toContain(scenario.cashLabel);
    expect(screen.getByText(/admin.refunds.buyerTax:/).textContent).toContain(scenario.taxLabel);
    expect(screen.getByRole("spinbutton")).toBeTruthy();
  });

});
