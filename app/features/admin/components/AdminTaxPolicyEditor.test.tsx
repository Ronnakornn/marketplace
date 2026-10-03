/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { AdminTaxPolicyEditor } from "./AdminTaxPolicyEditor";

const calls = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("#/lib/eden", () => ({ api: { api: { admin: { checkout: { "tax-policy": calls } } } } }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key }));
type Response = NonNullable<Treaty.Data<ReturnType<typeof api.api.admin.checkout["tax-policy"]["get"]>>>;
function response(): Response {
  return { settlementEnabled: true, policy: { version: 2, revision: "tax-zero", ratePpm: 0, mode: "EXCLUSIVE", fundingBasis: "BUYER_AFTER_ALL_DISCOUNTS", taxableShipping: false, shippingBasis: "SELLER_SHIPPING_AFTER_WAIVER", rounding: "LINE_HALF_UP", custodian: "SELLER", exclusiveTaxFunding: "BUYER" } };
}
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminTaxPolicyEditor /></QueryClientProvider>); }
beforeEach(() => { calls.get.mockReset().mockResolvedValue({ data: response(), error: null }); calls.put.mockReset().mockResolvedValue({ data: { ...response(), policy: { ...response().policy, revision: "tax-new", ratePpm: 70001 } }, error: null }); });
afterEach(cleanup);

describe("operator tax policy", () => {
  it("starts at zero and sends the exact explicitly selected percentage and taxable basis", async () => {
    mount();
    const rate = await screen.findByLabelText("admin.taxPolicy.rate");
    expect(rate).toHaveProperty("value", "0");
    fireEvent.change(rate, { target: { value: "7.0001" } });
    fireEvent.change(screen.getByLabelText("admin.taxPolicy.mode"), { target: { value: "INCLUSIVE" } });
    fireEvent.change(screen.getByLabelText("admin.taxPolicy.basis"), { target: { value: "SELLER_AFTER_SHOP_COUPON" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "admin.common.save" }));
    await waitFor(() => expect(calls.put).toHaveBeenCalledWith({ ratePpm: 70001, mode: "INCLUSIVE", fundingBasis: "SELLER_AFTER_SHOP_COUPON", taxableShipping: true, shippingBasis: "SELLER_SHIPPING_AFTER_WAIVER", rounding: "LINE_HALF_UP", custodian: "SELLER", exclusiveTaxFunding: "BUYER" }));
    await screen.findByText("admin.taxPolicy.saved");
  });

  it.each(["-1", "100.0001", "7.00001", "NaN"])("rejects unsupported percentage %s without a write", async (value) => {
    mount();
    fireEvent.change(await screen.findByLabelText("admin.taxPolicy.rate"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "admin.common.save" }));
    expect(screen.getByRole("alert").textContent).toBe("admin.taxPolicy.invalidRate");
    expect(calls.put).not.toHaveBeenCalled();
  });

  it("states the operational gate when settlement support is disabled", async () => {
    calls.get.mockResolvedValue({ data: { ...response(), settlementEnabled: false }, error: null });
    mount();
    await screen.findByText("admin.taxPolicy.settlementDisabled");
  });
});
