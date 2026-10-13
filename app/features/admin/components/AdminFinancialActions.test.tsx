/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMinorCurrency } from "#/lib/money";
import { AdminPayoutsTable } from "./AdminBackofficeTables";
import { AdminCommissionsTable } from "./AdminConfigurationTables";

const transport = vi.hoisted(() => ({ payoutList: vi.fn(), payoutRoute: vi.fn(), approve: vi.fn(), reject: vi.fn(), paid: vi.fn(), commissionList: vi.fn(), commissionRoute: vi.fn(), commissionStatus: vi.fn() }));
vi.mock("#/lib/eden", () => ({ api: { api: { admin: {
  payouts: Object.assign(transport.payoutRoute, { get: transport.payoutList }),
  commissions: Object.assign(transport.commissionRoute, { get: transport.commissionList }),
} } } }));
vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatters: () => ({ date: () => "Oct 13, 2026", currency: (amount: string, currency: string) => formatMinorCurrency(amount, "en-US", currency) }),
}));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => `/en${path}` }));

const clients: QueryClient[] = [];
function renderTable(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  transport.payoutRoute.mockReturnValue({ approve: { patch: transport.approve }, reject: { patch: transport.reject }, "mark-paid": { patch: transport.paid } });
  transport.commissionRoute.mockReturnValue({ status: { patch: transport.commissionStatus } });
  transport.approve.mockResolvedValue({ data: {}, error: null });
  transport.reject.mockResolvedValue({ data: {}, error: null });
  transport.paid.mockResolvedValue({ data: {}, error: null });
  transport.commissionStatus.mockResolvedValue({ data: {}, error: null });
  transport.payoutList.mockResolvedValue({ data: [{ id: "payout-42", shop: { id: "shop-42", name: "Bangkok shop" }, status: "approved", amount: "9007199254740991", currency: "THB", requestedAt: "2026-10-13T00:00:00.000Z" }], error: null });
  transport.commissionList.mockResolvedValue({ data: { items: [{ id: "commission-42", affiliateName: "Affiliate Alice", affiliateEmail: "alice@example.com", linkCode: "LINK-42", orderNumber: "ORD-42", status: "PENDING", eligibleSubtotalCents: "123400", commissionCents: "12340", currency: "THB", commissionBps: 1000, createdAt: "2026-10-13T00:00:00.000Z" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }, error: null });
});
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); });

describe("financial table confirmations", () => {
  it("waits for confirmation before approving the exact payout", async () => {
    transport.payoutList.mockResolvedValue({ data: [{ id: "payout-42", shop: { id: "shop-42", name: "Bangkok shop" }, status: "requested", amount: "123400", currency: "THB", requestedAt: "2026-10-13T00:00:00.000Z" }], error: null });
    renderTable(<AdminPayoutsTable />);
    await screen.findByRole("link", { name: "Bangkok shop" });
    fireEvent.click(screen.getByRole("button", { name: "admin.ui.approve" }));
    expect(transport.approve).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByRole("textbox")).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "admin.ui.approve" }));
    await waitFor(() => expect(transport.payoutRoute).toHaveBeenCalledWith({ payoutId: "payout-42" }));
    expect(transport.approve).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("requires the verified payout reference and preserves its exact target and amount", async () => {
    renderTable(<AdminPayoutsTable />);
    await screen.findByRole("link", { name: "Bangkok shop" });
    fireEvent.click(screen.getByRole("button", { name: "admin.ui.paid" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Bangkok shop")).toBeTruthy();
    expect(dialog.getByText("payout-42")).toBeTruthy();
    expect(dialog.getByText(/90,071,992,547,409\.91/).textContent).toContain("THB");
    expect(dialog.getByRole("button", { name: "admin.ui.paid" })).toHaveProperty("disabled", true);
    expect(transport.paid).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByRole("textbox", { name: "admin.financialAction.externalReference" }), { target: { value: " BANK-42 " } });
    fireEvent.click(dialog.getByRole("button", { name: "admin.ui.paid" }));
    await waitFor(() => expect(transport.payoutRoute).toHaveBeenCalledWith({ payoutId: "payout-42" }));
    expect(transport.paid).toHaveBeenCalledWith({ externalReference: "BANK-42" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("canceling a rejection performs zero payout writes", async () => {
    renderTable(<AdminPayoutsTable />);
    await screen.findByRole("link", { name: "Bangkok shop" });
    fireEvent.click(screen.getByRole("button", { name: "admin.ui.reject" }));
    fireEvent.change(screen.getByRole("textbox", { name: "admin.financialAction.reason" }), { target: { value: "Wrong bank details" } });
    fireEvent.click(screen.getByRole("button", { name: "admin.common.cancel" }));
    expect(transport.reject).not.toHaveBeenCalled();
    expect(transport.approve).not.toHaveBeenCalled();
    expect(transport.paid).not.toHaveBeenCalled();
  });

  it("records the rejection reason only on confirmation", async () => {
    renderTable(<AdminPayoutsTable />);
    await screen.findByRole("link", { name: "Bangkok shop" });
    fireEvent.click(screen.getByRole("button", { name: "admin.ui.reject" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "admin.ui.reject" })).toHaveProperty("disabled", true);
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "  Wrong bank details  " } });
    fireEvent.click(dialog.getByRole("button", { name: "admin.ui.reject" }));
    await waitFor(() => expect(transport.reject).toHaveBeenCalledWith({ reason: "Wrong bank details" }));
    expect(transport.payoutRoute).toHaveBeenCalledWith({ payoutId: "payout-42" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps payout completion open when the API rejects its reviewer", async () => {
    transport.paid.mockResolvedValue({ data: null, error: { value: { error: { message: "Payout requester cannot complete their payout" } } } });
    renderTable(<AdminPayoutsTable />);
    await screen.findByRole("link", { name: "Bangkok shop" });
    fireEvent.click(screen.getByRole("button", { name: "admin.ui.paid" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "BANK-42" } });
    fireEvent.click(dialog.getByRole("button", { name: "admin.ui.paid" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Payout requester cannot complete their payout");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("textbox")).toHaveProperty("value", "BANK-42");
  });

  it.each(["APPROVED", "VOID"])("requires an audit reason and submits the unchanged commission decision %s", async (status) => {
    renderTable(<AdminCommissionsTable />);
    await screen.findByText("Affiliate Alice");
    const label = status === "APPROVED" ? "admin.ui.approve" : "admin.commissions.void";
    fireEvent.click(screen.getByRole("button", { name: label }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Affiliate Alice · ORD-42")).toBeTruthy();
    expect(dialog.getByText("commission-42")).toBeTruthy();
    expect(dialog.getByText(/123\.40/).textContent).toContain("THB");
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "ok" } });
    expect(dialog.getByRole("button", { name: label })).toHaveProperty("disabled", true);
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: " Verified order " } });
    fireEvent.click(dialog.getByRole("button", { name: label }));
    await waitFor(() => expect(transport.commissionRoute).toHaveBeenCalledWith({ commissionId: "commission-42" }));
    expect(transport.commissionStatus).toHaveBeenCalledWith({ status, reason: "Verified order" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
