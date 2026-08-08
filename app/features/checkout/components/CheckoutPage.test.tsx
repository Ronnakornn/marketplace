/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutPage } from "./CheckoutPage";
import { createCheckout, fetchAddresses, fetchCart, quoteCheckout } from "#/features/buyer/api";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerEmptyState: ({ title, description }: { title: string; description: string }) => <div>{title}{description}</div>,
  BuyerErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  BuyerLoadingList: () => <div>Loading</div>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ asChild, children, ...props }: { asChild?: boolean; children: ReactNode }) => (
    asChild ? children : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("#/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("#/components/ui/radio-group", () => ({
  RadioGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  RadioGroupItem: ({ value, id }: { value: string; id?: string }) => <input id={id} type="radio" value={value} readOnly />,
}));

vi.mock("#/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="quote-skeleton" />,
}));

vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "checkout.address": "Address",
      "checkout.cardGateway": "Card gateway",
      "checkout.cashOnDelivery": "Cash on delivery",
      "checkout.coupon": "Coupon",
      "checkout.couponApply": "Apply",
      "checkout.couponApplied": "Coupon applied: {code}",
      "checkout.couponCode": "Coupon code",
      "checkout.couponReasonExpired": "This coupon has expired.",
      "checkout.couponReasonInactive": "This coupon is not active.",
      "checkout.couponReasonInvalid": "This coupon code is invalid.",
      "checkout.couponReasonMinOrderNotMet": "Your order doesn't meet the minimum for this coupon.",
      "checkout.couponReasonNotFound": "This coupon code doesn't exist.",
      "checkout.couponReasonNotStarted": "This coupon isn't available yet.",
      "checkout.couponReasonUsageLimitReached": "This coupon has reached its usage limit.",
      "checkout.couponReasonUserLimitReached": "You've already used this coupon the maximum number of times.",
      "checkout.couponRemove": "Remove",
      "checkout.discount": "Discount",
      "checkout.emptyDescription": "Your cart is empty.",
      "checkout.emptyTitle": "Empty cart",
      "checkout.loadingAddresses": "Loading addresses",
      "checkout.manageAddresses": "Manage addresses",
      "checkout.noAddressDescription": "Choose a shipping address.",
      "checkout.noAddressTitle": "No address",
      "checkout.orderCreated": "Order {orderNo} created.",
      "checkout.paymentMethod": "Payment method",
      "checkout.placeOrder": "Place order",
      "checkout.quoteError": "Could not load the total.",
      "checkout.shipping": "Shipping",
      "checkout.shippingMethod": "Shipping method",
      "checkout.standardDelivery": "Standard delivery",
      "checkout.summary": "Summary",
      "checkout.title": "Checkout",
      "checkout.total": "Total",
      "checkout.viewPaymentStatus": "Continue to payment",
      "common.default": "Default",
      "state.retry": "Try again",
    };
    return translations[key] ?? key;
  },
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/features/buyer/api", () => ({
  createCheckout: vi.fn(),
  fetchAddresses: vi.fn(),
  fetchCart: vi.fn(),
  quoteCheckout: vi.fn(),
  formatMoney: (cents: number) => `THB ${(cents / 100).toFixed(2)}`,
}));

function renderCheckoutPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutPage />
    </QueryClientProvider>,
  );
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.mocked(fetchCart).mockResolvedValue({
      id: "cart-1",
      shops: [{
        shopId: "shop-1",
        shopName: "Demo Shop",
        items: [{
          id: "item-1",
          variantId: "variant-1",
          productId: "product-1",
          title: "Demo Product",
          variantTitle: "Default",
          imageUrl: "https://example.com/product.jpg",
          quantity: 1,
          unitPrice: 1200,
          currency: "THB",
        }],
        subtotal: 1200,
      }],
      subtotal: 1200,
      currency: "THB",
    });
    vi.mocked(fetchAddresses).mockResolvedValue([{
      id: "address-1",
      recipientName: "Jane Buyer",
      phone: "0800000000",
      line1: "123 Market Road",
      line2: null,
      city: "Bangkok",
      region: "Bangkok",
      postalCode: "10110",
      country: "TH",
      isDefault: true,
    }]);
    vi.mocked(createCheckout).mockResolvedValue({
      orderId: "order-1",
      orderNo: "ORD-TEST",
      paymentStatus: "pending",
      paymentUrl: "/en/payment/mock/payment-1",
      totalCents: 1700,
    });
    vi.mocked(quoteCheckout).mockResolvedValue({
      subtotal: 1200,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 1700,
      currency: "THB",
      coupon: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the server-provided payment URL after checkout succeeds", async () => {
    renderCheckoutPage();

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    fireEvent.click(placeOrderButton);

    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      cartId: "cart-1",
      addressId: "address-1",
      locale: "en",
    })));
    const paymentLink = await screen.findByRole("link", { name: "Continue to payment" });
    expect(paymentLink.getAttribute("href")).toBe("/en/payment/mock/payment-1");
  });

  it("shows selected product details in the order summary", async () => {
    renderCheckoutPage();

    expect((await screen.findByRole("img", { name: "Demo Product" })).getAttribute("src")).toBe("https://example.com/product.jpg");
    expect(screen.getAllByText("Default")).toHaveLength(2);
    expect(screen.getByText("×1")).toBeTruthy();
  });

  it("disables place order and shows no final amount while the quote is loading", async () => {
    let resolveQuote: (value: Awaited<ReturnType<typeof quoteCheckout>>) => void = () => {};
    vi.mocked(quoteCheckout).mockImplementation(() => new Promise((resolve) => {
      resolveQuote = resolve;
    }));

    renderCheckoutPage();

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    expect(placeOrderButton.disabled).toBe(true);
    expect(screen.getAllByTestId("quote-skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("THB 17.00")).toBeNull();

    resolveQuote({ subtotal: 1200, discountTotal: 0, shippingTotal: 500, taxTotal: 0, grandTotal: 1700, currency: "THB", coupon: null });
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
  });

  it("disables place order and shows a retryable error affordance when the quote fails", async () => {
    vi.mocked(quoteCheckout).mockRejectedValueOnce(new Error("Quote request failed"));
    vi.mocked(quoteCheckout).mockResolvedValueOnce({
      subtotal: 1200, discountTotal: 0, shippingTotal: 500, taxTotal: 0, grandTotal: 1700, currency: "THB", coupon: null,
    });

    renderCheckoutPage();

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(screen.getAllByText("Could not load the total.").length).toBeGreaterThan(0));
    expect(placeOrderButton.disabled).toBe(true);

    const [retryButton] = screen.getAllByRole("button", { name: "Try again" });
    fireEvent.click(retryButton);

    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    expect(quoteCheckout).toHaveBeenCalledTimes(2);
  });

  it("never shows cart.subtotal as the total when the quote fails", async () => {
    // Two shops so cart.subtotal (2000) differs from either shop's own subtotal
    // (1200 and 800) -- if the screen ever fell back to displaying cart.subtotal
    // as the total, this figure would be unambiguous evidence of it.
    vi.mocked(fetchCart).mockResolvedValue({
      id: "cart-1",
      shops: [
        {
          shopId: "shop-1",
          shopName: "Demo Shop",
          items: [{ id: "item-1", variantId: "variant-1", productId: "product-1", title: "Demo Product", variantTitle: "Default", quantity: 1, unitPrice: 1200, currency: "THB" }],
          subtotal: 1200,
        },
        {
          shopId: "shop-2",
          shopName: "Second Shop",
          items: [{ id: "item-2", variantId: "variant-2", productId: "product-2", title: "Other Product", variantTitle: "Default", quantity: 1, unitPrice: 800, currency: "THB" }],
          subtotal: 800,
        },
      ],
      subtotal: 2000,
      currency: "THB",
    });
    vi.mocked(quoteCheckout).mockRejectedValue(new Error("Quote request failed"));

    renderCheckoutPage();

    await screen.findByRole("button", { name: "Place order" });
    await waitFor(() => expect(screen.getAllByText("Could not load the total.").length).toBeGreaterThan(0));
    expect(screen.queryByText("THB 20.00")).toBeNull();
  });

  it("sends the applied coupon code, not a typed-but-unapplied code, to createCheckout", async () => {
    vi.mocked(quoteCheckout).mockImplementation(({ couponCode }) => Promise.resolve({
      subtotal: 1200,
      discountTotal: couponCode === "SAVE10" ? 100 : 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: couponCode === "SAVE10" ? 1600 : 1700,
      currency: "THB",
      coupon: couponCode ? { code: couponCode, applied: true } : null,
    }));

    renderCheckoutPage();

    const couponInput = await screen.findByPlaceholderText("Coupon code");
    fireEvent.change(couponInput, { target: { value: "SAVE10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await screen.findByText("Coupon applied: SAVE10");

    fireEvent.change(couponInput, { target: { value: "UNAPPLIEDCODE" } });

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    fireEvent.click(placeOrderButton);

    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      couponCode: "SAVE10",
    })));
  });

  it("renders discount and shipping rows from the quote response", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({
      subtotal: 1200,
      discountTotal: 300,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 1400,
      currency: "THB",
      coupon: { code: "SAVE10", applied: true },
    });

    renderCheckoutPage();

    await waitFor(() => expect(screen.getByText("Discount")).toBeTruthy());
    expect(screen.getByText("-THB 3.00")).toBeTruthy();
    expect(screen.getByText("Shipping")).toBeTruthy();
    expect(screen.getByText("THB 5.00")).toBeTruthy();
  });

  it("keeps the summary and place-order button usable when the coupon is unusable", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({
      subtotal: 1200,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 1700,
      currency: "THB",
      coupon: { code: "EXPIRED10", applied: false, reason: "COUPON_EXPIRED" },
    });

    renderCheckoutPage();

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    expect(screen.getByText("This coupon has expired.")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
  });
});
