/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnRequestPage } from "./ReturnRequestPage";
import { OrderDetailPage } from "#/features/order/components/OrderDetailPage";
import { createReturnRequest, fetchOrder, type BuyerOrder } from "#/features/buyer/api";
import { formatMinorCurrency, type MinorUnitValue } from "#/lib/money";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
vi.mock("#/features/chat", () => ({ createChatRoom: vi.fn() }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: () => "Oct 4" }) }));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => `/en${path}` }));
vi.mock("#/features/buyer/upload-helper", () => ({ uploadBuyerImage: vi.fn() }));
vi.mock("#/features/buyer/api", () => ({ fetchOrder: vi.fn(), createReturnRequest: vi.fn(), cancelOrder: vi.fn(), formatMoney: (value: MinorUnitValue, currency: string) => formatMinorCurrency(value, "en-US", currency) }));

function order(): BuyerOrder {
  return { id: "order-1", orderNo: "ORD-1", status: "DELIVERED", paymentStatus: "SUCCEEDED", totalCents: "101", currency: "THB", createdAt: "2026-10-04T00:00:00Z",
    taxTotals: { taxTotal: "0", includedTaxTotal: "7", reportedTaxTotal: "7" },
    items: [{ id: "item-1", shopId: "shop-1", productTitle: "Original product", variantTitle: "Original variant", quantity: 3, lineTotal: "101", shopName: "Shop", fulfillmentStatus: "DELIVERED", remainingReturnQuantity: 2, hasActiveReturn: false }], shipments: [] };
}
function mount(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
beforeEach(() => { vi.mocked(fetchOrder).mockReset().mockResolvedValue(order()); vi.mocked(createReturnRequest).mockReset().mockResolvedValue({ id: "return-1" }); });
afterEach(cleanup);

describe("partial return admission UI", () => {
  it("uses the server remaining quantity and submits one explicit unit", async () => {
    mount(<ReturnRequestPage orderId="order-1" />);
    const input = await screen.findByRole("spinbutton", { name: "buyer.returnQuantity" });
    expect(input.getAttribute("max")).toBe("2");
    expect(input).toHaveProperty("value", "1");
    fireEvent.click(screen.getByRole("button", { name: "buyer.submitRequest" }));
    await waitFor(() => expect(createReturnRequest).toHaveBeenCalledWith({ orderId: "order-1", orderItemId: "item-1", quantity: 1, reason: "buyer.damagedItem", description: "", uploadIds: [] }));
  });

  it.each(["0", "3", "1.5"])("rejects quantity %s before upload or API mutation", async (quantity) => {
    mount(<ReturnRequestPage orderId="order-1" />);
    fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: quantity } });
    expect(screen.getByRole("button", { name: "buyer.submitRequest" })).toHaveProperty("disabled", true);
    expect(createReturnRequest).not.toHaveBeenCalled();
  });

  it.each(["exhausted", "active"])("does not admit a %s item", async (state) => {
    const data = order();
    if (!data.items[0]) throw new Error("Missing original item");
    if (state === "exhausted") data.items[0].remainingReturnQuantity = 0;
    else data.items[0].hasActiveReturn = true;
    vi.mocked(fetchOrder).mockResolvedValue(data);
    mount(<ReturnRequestPage orderId="order-1" />);
    await screen.findByText("buyer.noItemsEligibleForReturn");
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByRole("button", { name: "buyer.submitRequest" })).toHaveProperty("disabled", true);
  });
});

describe("original order tax receipt", () => {
  it("shows included and reported tax while retaining the exact original total", async () => {
    mount(<OrderDetailPage orderId="order-1" />);
    const included = (await screen.findByText("checkout.taxIncluded")).parentElement;
    const reported = screen.getByText("checkout.taxReported").parentElement;
    if (!included || !reported) throw new Error("Missing receipt tax rows");
    expect(within(included).getByText(/0\.07/)).toBeTruthy();
    expect(within(reported).getByText(/0\.07/)).toBeTruthy();
    expect(screen.getAllByText(/1\.01/)).toHaveLength(2);
    expect(screen.queryByText(/1\.08/)).toBeNull();
  });
});
