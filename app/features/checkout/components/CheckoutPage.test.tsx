/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutPage } from "./CheckoutPage";
import { createCheckout, fetchAddresses, fetchCart } from "#/features/buyer/api";

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

vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "checkout.address": "Address",
      "checkout.cardGateway": "Card gateway",
      "checkout.cashOnDelivery": "Cash on delivery",
      "checkout.coupon": "Coupon",
      "checkout.couponCode": "Coupon code",
      "checkout.emptyDescription": "Your cart is empty.",
      "checkout.emptyTitle": "Empty cart",
      "checkout.loadingAddresses": "Loading addresses",
      "checkout.manageAddresses": "Manage addresses",
      "checkout.noAddressDescription": "Choose a shipping address.",
      "checkout.noAddressTitle": "No address",
      "checkout.orderCreated": "Order {orderNo} created.",
      "checkout.paymentMethod": "Payment method",
      "checkout.placeOrder": "Place order",
      "checkout.shippingMethod": "Shipping method",
      "checkout.standardDelivery": "Standard delivery",
      "checkout.summary": "Summary",
      "checkout.title": "Checkout",
      "checkout.total": "Total",
      "checkout.viewPaymentStatus": "Continue to payment",
      "common.default": "Default",
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the server-provided payment URL after checkout succeeds", async () => {
    renderCheckoutPage();

    fireEvent.click(await screen.findByRole("button", { name: "Place order" }));

    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      cartId: "cart-1",
      addressId: "address-1",
      locale: "en",
    })));
    const paymentLink = await screen.findByRole("link", { name: "Continue to payment" });
    expect(paymentLink.getAttribute("href")).toBe("/en/payment/mock/payment-1");
  });
});
