/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SellerFinancePage, SellerOrdersPage } from "./SellerManagePages";
import type { SellerShipment, SellerTransactions } from "../hooks/useSellerManage";

const { pack, ship, transactionsHook, shipmentsHook } = vi.hoisted(() => ({ pack: vi.fn(), ship: vi.fn(), transactionsHook: vi.fn(), shipmentsHook: vi.fn() }));
let shipments: SellerShipment[] = [];
let transactionItems: NonNullable<SellerTransactions>["items"] = [];
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
  useFormatters: () => ({ date: () => "13 Oct 2026", currency: (amount: string | number) => String(amount) }),
}));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => path }));
vi.mock("./SellerShell", () => ({ SellerPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("../hooks/useSellerManage", () => ({
  useSellerShipments: (filters: { status?: string; q?: string; page: number; limit: number }) => {
    shipmentsHook(filters);
    const filtered = shipments.filter((row) => (!filters.status || row.status.toUpperCase() === filters.status) && (!filters.q || row.orderNo.toLowerCase().includes(filters.q.toLowerCase())));
    return { data: { data: filtered.slice((filters.page - 1) * filters.limit, filters.page * filters.limit), meta: { totalCount: filtered.length } }, isLoading: false, error: null };
  },
  usePackShipment: () => ({ mutate: pack, isPending: false }),
  useShipShipment: () => ({ mutate: ship, isPending: false }),
  useSellerWallet: () => ({ data: null }),
  useSellerPayouts: () => ({ data: { data: [], meta: { totalCount: 0 } }, isLoading: false }),
  useCreateSellerPayout: () => ({ mutate: vi.fn(), isPending: false }),
  useSellerTransactions: (page: number, limit: number) => {
    transactionsHook(page, limit);
    return { data: { items: page === 1 ? transactionItems : [], pagination: { page, limit } }, isLoading: false };
  },
}));

function shipment(id: string, status: string): SellerShipment {
  return {
    id, status, orderId: `order-${id}`, orderNo: `ORD-${id}`, shopId: "shop-1",
    carrier: null, trackingNumber: null, trackingStatus: "PENDING",
    shippingAddress: { name: "Buyer One", phone: null, line1: "10 Main St", line2: null, city: "Bangkok", region: null, postalCode: "10100", country: "TH" },
    items: [{ id: `item-${id}`, orderItemId: `order-item-${id}`, productTitle: "Cotton Tee", productSlug: "cotton-tee", variantTitle: "Black M", variantSku: "TEE-M", quantity: 1, fulfillmentStatus: "PENDING" }],
  };
}

beforeEach(() => {
  pack.mockReset();
  ship.mockReset();
  transactionsHook.mockReset();
  shipmentsHook.mockReset();
  searchParams = new URLSearchParams();
  shipments = [shipment("pending", "pending_pack"), shipment("packed", "packed"), shipment("shipped", "shipped")];
  transactionItems = Array.from({ length: 20 }, (_, index) => ({
    id: `transaction-${index}`, type: "test_entry", amount: String(index), currency: "THB",
    orderId: null, payoutId: null, refundId: null, description: `Entry ${index}`, createdAt: new Date("2026-10-13T00:00:00Z"),
  }));
});
afterEach(cleanup);

describe("seller shipment actions", () => {
  it("shows the next shipment action without exposing tracking inputs in the table", () => {
    render(<SellerOrdersPage />);
    expect(screen.getAllByRole("button", { name: "seller.manage.pages.orders.markPacked" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "seller.manage.pages.orders.ship" })).toHaveLength(1);
    expect(screen.queryByLabelText("seller.manage.pages.orders.carrier")).toBeNull();
    const pendingRow = screen.getByText("ORD-pending").closest("tr")!;
    fireEvent.click(within(pendingRow).getByRole("button", { name: "seller.manage.pages.orders.markPacked" }));
    expect(pack).toHaveBeenCalledWith("pending", expect.objectContaining({ onError: expect.any(Function) }));
  });

  it("validates trimmed shipping fields before sending a request", () => {
    render(<SellerOrdersPage />);
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.carrier"), { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    expect(ship).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert").textContent).toBe("seller.operationsUi.shippingRequired");
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.carrier"), { target: { value: "  DHL  " } });
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.tracking"), { target: { value: "  TH123  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    expect(ship).toHaveBeenCalledWith({ shipmentId: "packed", carrier: "DHL", trackingNo: "TH123" }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("retains the draft after cancel and after a failed shipping request", () => {
    ship.mockImplementation((_input, options) => options.onError());
    render(<SellerOrdersPage />);
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.carrier"), { target: { value: "DHL" } });
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.tracking"), { target: { value: "TH123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ship).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("seller.manage.pages.orders.tracking") as HTMLInputElement).value).toBe("TH123");
    fireEvent.click(within(dialog).getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("seller.operationsUi.shippingFailed");
    expect((within(dialog).getByLabelText("seller.manage.pages.orders.carrier") as HTMLInputElement).value).toBe("DHL");
  });

  it("closes the shipping dialog after a successful request", () => {
    ship.mockImplementation((_input, options) => options.onSuccess());
    render(<SellerOrdersPage />);
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.carrier"), { target: { value: "DHL" } });
    fireEvent.change(within(dialog).getByLabelText("seller.manage.pages.orders.tracking"), { target: { value: "TH123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "seller.manage.pages.orders.ship" }));
    expect(ship).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens pending-pack links with that status selected", () => {
    searchParams = new URLSearchParams("shopId=shop-1&status=pending_pack");
    render(<SellerOrdersPage />);
    expect(screen.getByText("ORD-pending")).toBeTruthy();
    expect(screen.queryByText("ORD-packed")).toBeNull();
    expect(shipmentsHook).toHaveBeenLastCalledWith({ page: 1, limit: 20, q: undefined, status: "PENDING_PACK", shopId: "shop-1" });
  });

  it("requests later shipment pages and resets to the first page when search changes", () => {
    shipments = Array.from({ length: 65 }, (_, index) => shipment(String(index), "shipped"));
    render(<SellerOrdersPage />);
    expect(screen.queryByText("ORD-60")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "seller.ui.table.nextPage" }));
    fireEvent.click(screen.getByRole("button", { name: "seller.ui.table.nextPage" }));
    fireEvent.click(screen.getByRole("button", { name: "seller.ui.table.nextPage" }));
    expect(shipmentsHook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 4, limit: 20 }));
    expect(screen.getByText("ORD-60")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "seller.manage.pages.orders.search" }), { target: { value: "ORD-64" } });
    expect(shipmentsHook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: "ORD-64" }));
    expect(screen.getByText("ORD-64")).toBeTruthy();
    expect(screen.queryByText("ORD-60")).toBeNull();
  });
});

describe("seller transaction pagination", () => {
  it("requests API pages and can return from an empty next page", () => {
    render(<SellerFinancePage />);
    expect(transactionsHook).toHaveBeenLastCalledWith(1, 20);
    expect(screen.getByText("Entry 19")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(transactionsHook).toHaveBeenLastCalledWith(2, 20);
    expect(screen.getByText("seller.manage.pages.finance.emptyTransactions")).toBeTruthy();
    expect((screen.getByRole("button", { name: "common.next" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "common.previous" }));
    expect(transactionsHook).toHaveBeenLastCalledWith(1, 20);
    expect(screen.getByText("Entry 19")).toBeTruthy();
  });
});
