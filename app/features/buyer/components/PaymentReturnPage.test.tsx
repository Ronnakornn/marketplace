/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerOrder } from "#/features/buyer/api";
import { PaymentReturnPage } from "./PaymentReturnPage";

const paymentReturnMocks = vi.hoisted(() => ({
  fetchOrder: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  BuyerLoadingList: () => <div>Loading payment status</div>,
}));

vi.mock("#/components/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ asChild, children, ...props }: { asChild?: boolean; children: ReactNode }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/features/buyer/api", () => ({
  fetchOrder: paymentReturnMocks.fetchOrder,
  formatMoney: (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`,
}));

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => ({
    "buyer.paymentStatus": "Payment status",
    "buyer.paymentConfirmed": "Payment confirmed",
    "buyer.paymentConfirmedDescription": "The server confirmed payment.",
    "buyer.paymentNotCompleted": "Payment was not completed",
    "buyer.paymentNotCompletedDescription": "The server did not confirm payment.",
    "buyer.paymentRefunded": "Payment refunded",
    "buyer.paymentRefundedDescription": "The payment was refunded.",
    "buyer.waitingPayment": "Waiting for payment confirmation",
    "buyer.waitingPaymentDescription": "Waiting for the server payment event.",
    "buyer.orderNumber": "Order number",
    "buyer.viewOrder": "View order",
    "buyer.shopMore": "Shop more",
    "order.payment": "Payment",
    "common.total": "Total",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

describe("PaymentReturnPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    paymentReturnMocks.fetchOrder.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("polls server order data every two seconds while payment remains pending", async () => {
    paymentReturnMocks.fetchOrder.mockResolvedValue(createOrder("PENDING"));

    renderPaymentReturnPage();
    await vi.waitFor(() => expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.getByText("Waiting for payment confirmation")).toBeTruthy());
    paymentReturnMocks.fetchOrder.mockClear();

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await vi.waitFor(() => expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1));
  });

  it("stops polling as soon as the server reports a terminal payment state", async () => {
    paymentReturnMocks.fetchOrder
      .mockResolvedValueOnce(createOrder("REQUIRES_ACTION"))
      .mockResolvedValue(createOrder("SUCCEEDED"));

    renderPaymentReturnPage();
    await vi.waitFor(() => expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1));

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await vi.waitFor(() => expect(screen.getByText("Payment confirmed")).toBeTruthy());
    expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["FAILED", "Payment was not completed"],
    ["CANCELED", "Payment was not completed"],
    ["REFUNDED", "Payment refunded"],
  ])("renders %s as an accurate terminal state without polling", async (paymentStatus, expectedTitle) => {
    paymentReturnMocks.fetchOrder.mockResolvedValue(createOrder(paymentStatus));

    renderPaymentReturnPage();
    await vi.waitFor(() => expect(screen.getByText(expectedTitle)).toBeTruthy());
    expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1);
  });

  it("stops polling pending payment after the bounded wait window", async () => {
    paymentReturnMocks.fetchOrder.mockResolvedValue(createOrder("PENDING"));

    renderPaymentReturnPage();
    await vi.waitFor(() => expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(1));

    await act(async () => vi.advanceTimersByTimeAsync(46_000));
    const callsAtTimeout = paymentReturnMocks.fetchOrder.mock.calls.length;
    expect(callsAtTimeout).toBeGreaterThan(1);

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(paymentReturnMocks.fetchOrder).toHaveBeenCalledTimes(callsAtTimeout);
  });
});

function renderPaymentReturnPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentReturnPage orderId="order-1" />
    </QueryClientProvider>,
  );
}

function createOrder(paymentStatus: string): BuyerOrder {
  return {
    id: "order-1",
    orderNo: "ORD-TEST",
    status: paymentStatus === "SUCCEEDED" ? "PAID" : "PENDING_PAYMENT",
    paymentStatus,
    totalCents: 1_700,
    currency: "THB",
    createdAt: "2026-07-28T00:00:00.000Z",
    items: [],
    shipments: [],
  };
}
