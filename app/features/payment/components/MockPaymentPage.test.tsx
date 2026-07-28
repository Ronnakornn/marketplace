/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBuyerMockPaymentEvent, fetchBuyerMockPayment } from "../api";
import { MockPaymentPage } from "./MockPaymentPage";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  BuyerLoadingList: () => <div>Loading</div>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("#/i18n/client", () => ({
  useFormatters: () => ({ currency: (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}` }),
  useTranslations: () => (key: string) => ({
    "buyer.paymentConfirmed": "Confirm payment",
    "buyer.paymentNotCompleted": "Fail payment",
    "buyer.paymentStatus": "Payment status",
    "order.amount": "Amount",
    "order.order": "Order",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("../api", () => ({
  createBuyerMockPaymentEvent: vi.fn(),
  fetchBuyerMockPayment: vi.fn(),
}));

const pendingPayment = {
  id: "14141414-1414-4141-8141-141414141414",
  orderId: "13131313-1313-4131-8131-131313131313",
  orderNo: "ORD-TEST",
  amountCents: 2900,
  currency: "THB",
  status: "PENDING",
} as const;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MockPaymentPage paymentId={pendingPayment.id} />
    </QueryClientProvider>,
  );
}

describe("MockPaymentPage", () => {
  beforeEach(() => {
    vi.mocked(fetchBuyerMockPayment).mockResolvedValue(pendingPayment);
    vi.mocked(createBuyerMockPaymentEvent).mockResolvedValue({ ok: true, code: "PAYMENT_PAID" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ["Confirm payment", "payment.paid"],
    ["Fail payment", "payment.failed"],
  ] as const)("sends %s through the mock event API and redirects to payment return", async (buttonName, eventType) => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: buttonName }));

    await waitFor(() => expect(createBuyerMockPaymentEvent).toHaveBeenCalledWith(pendingPayment.id, eventType));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(
      `/en/payment/return?orderId=${pendingPayment.orderId}`,
    ));
  });

  it.each(["SUCCEEDED", "FAILED", "CANCELED", "REFUNDED"] as const)(
    "disables both actions when payment status is %s",
    async (status) => {
      vi.mocked(fetchBuyerMockPayment).mockResolvedValue({ ...pendingPayment, status });

      renderPage();

      expect((await screen.findByRole("button", { name: "Confirm payment" }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Fail payment" }) as HTMLButtonElement).disabled).toBe(true);
    },
  );
});
