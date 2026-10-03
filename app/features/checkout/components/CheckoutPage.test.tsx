/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutPage } from "./CheckoutPage";
import { createCheckout, fetchAddresses, fetchCart, quoteCheckout } from "#/features/buyer/api";
import { minorToDecimalText, type MinorUnitValue } from "#/lib/money";
import { useBuyerCoins, type BuyerCoins } from "#/features/promotion/hooks/useBuyerCoins";

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
      "checkout.coins": "Coins",
      "checkout.coinsAvailable": "{count} coins available",
      "checkout.coinsApply": "Use coins",
      "checkout.coinsApplied": "{count} coins applied",
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
  formatMoney: (cents: MinorUnitValue) => `THB ${minorToDecimalText(cents)}`,
}));

vi.mock("#/features/promotion/hooks/useBuyerCoins", () => ({
  useBuyerCoins: vi.fn(),
}));

function renderCheckoutPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
    <QueryClientProvider client={queryClient}>
      <CheckoutPage />
    </QueryClientProvider>,
    ),
  };
}

const quotedAmounts = {
  quoteFingerprint: "a".repeat(64),
  taxPolicyRevision: "tax-zero-test",
  items: [{ id: "item-1", shopId: "shop-1", unitPrice: "1200", lineTotal: "1200" }],
  shops: [{ shopId: "shop-1", subtotal: "1200" }],
};

describe("CheckoutPage", () => {
  it("submits once for rapid clicks in one batch and allows retry after a network failure", async () => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(createCheckout).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    renderCheckoutPage();
    const button = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    act(() => {
      button.click();
      button.click();
    });
    await waitFor(() => expect(createCheckout).toHaveBeenCalledTimes(1));
    await act(async () => { rejectRequest(new Error("Network disconnected")); });
    expect(await screen.findByText("Network disconnected")).toBeTruthy();
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(createCheckout).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("link", { name: "Continue to payment" })).toBeTruthy();
  });

  beforeEach(() => {
    vi.mocked(useBuyerCoins).mockImplementation(() => useQuery<BuyerCoins>({
      queryKey: ["buyer-coins"],
      queryFn: async () => ({ balance: "20", pendingBalance: "0", debtBalance: "0", lifetimeEarned: "20", lifetimeSpent: "0", entries: [], nextCursor: null }),
      initialData: { balance: "20", pendingBalance: "0", debtBalance: "0", lifetimeEarned: "20", lifetimeSpent: "0", entries: [], nextCursor: null },
    }));
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
          unitPrice: "1200",
          currency: "THB",
        }],
        subtotal: "1200",
      }],
      subtotal: "1200",
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
      paymentId: "payment-1",
      orderNo: "ORD-TEST",
      paymentStatus: "pending",
      paymentUrl: "/en/payment/mock/payment-1",
      totalCents: "1700",
    });
    vi.mocked(quoteCheckout).mockResolvedValue({
      subtotal: "1200",
      discountTotal: "0",
      shippingTotal: "500",
      taxTotal: "0",
      grandTotal: "1700",
      currency: "THB",
      coupon: null,
      ...quotedAmounts, coinsApplied: 0,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the server-provided payment URL after checkout succeeds", async () => {
    const { queryClient } = renderCheckoutPage();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

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
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["buyer-cart"] }));
  });

  it("keeps the payment handoff visible after checkout invalidates the emptied cart", async () => {
    vi.mocked(fetchCart).mockResolvedValueOnce({
      id: "cart-1",
      shops: [{
        shopId: "shop-1",
        shopName: "Demo Shop",
        items: [{ id: "item-1", variantId: "variant-1", productId: "product-1", title: "Demo Product", variantTitle: "Default", quantity: 1, unitPrice: "1200", currency: "THB" }],
        subtotal: "1200",
      }],
      subtotal: "1200",
      currency: "THB",
    }).mockResolvedValue({ id: "cart-1", shops: [], subtotal: "0", currency: "THB" });

    renderCheckoutPage();
    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    fireEvent.click(placeOrderButton);

    const paymentLink = await screen.findByRole("link", { name: "Continue to payment" });
    await waitFor(() => expect(screen.getByText("Empty cartYour cart is empty.")).toBeTruthy());
    expect(paymentLink.getAttribute("href")).toBe("/en/payment/mock/payment-1");
  });

  it("shows selected product details in the order summary", async () => {
    renderCheckoutPage();

    expect((await screen.findByRole("img", { name: "Demo Product" })).getAttribute("src")).toBe("https://example.com/product.jpg");
    expect(screen.getAllByText("Default")).toHaveLength(2);
    expect(screen.getByText("×1")).toBeTruthy();
  });

  it.each([
    { name: "repriced variant", unitPrice: "1200", lineTotal: "2400", grandTotal: "2900", lineLabel: "THB 24.00", totalLabel: "THB 29.00" },
    { name: "flash-sale variant", unitPrice: "900", lineTotal: "1800", grandTotal: "2300", lineLabel: "THB 18.00", totalLabel: "THB 23.00" },
  ])("shows quoted line and shop amounts for a $name", async ({ unitPrice, lineTotal, grandTotal, lineLabel, totalLabel }) => {
    vi.mocked(fetchCart).mockResolvedValue({
      id: "cart-1", currency: "THB", subtotal: "2000",
      shops: [{ shopId: "shop-1", shopName: "Demo Shop", subtotal: "2000", items: [{
        id: "item-1", variantId: "variant-1", productId: "product-1", title: "Demo Product", variantTitle: "Default",
        quantity: 2, unitPrice: "1000", currency: "THB",
      }] }],
    });
    const quote = {
      subtotal: lineTotal, discountTotal: "0", shippingTotal: "500", taxTotal: "0", grandTotal,
      currency: "THB", coupon: null, ...quotedAmounts, coinsApplied: 0,
      items: [{ id: "item-1", shopId: "shop-1", unitPrice, lineTotal }],
      shops: [{ shopId: "shop-1", subtotal: lineTotal }],
    };
    vi.mocked(quoteCheckout).mockResolvedValue(quote);
    renderCheckoutPage();
    await screen.findAllByText(totalLabel);
    expect(screen.getAllByText(lineLabel)).toHaveLength(3);
    expect(screen.queryByText("THB 20.00")).toBeNull();
    expect(screen.getByText("THB 5.00")).toBeTruthy();
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

    resolveQuote({ subtotal: "1200", discountTotal: "0", shippingTotal: "500", taxTotal: "0", grandTotal: "1700", currency: "THB", coupon: null, ...quotedAmounts, coinsApplied: 0 });
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
  });

  it("disables place order and shows a retryable error affordance when the quote fails", async () => {
    vi.mocked(quoteCheckout).mockRejectedValueOnce(new Error("Quote request failed"));
    vi.mocked(quoteCheckout).mockResolvedValueOnce({
      subtotal: "1200", discountTotal: "0", shippingTotal: "500", taxTotal: "0", grandTotal: "1700", currency: "THB", coupon: null, ...quotedAmounts, coinsApplied: 0,
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
          items: [{ id: "item-1", variantId: "variant-1", productId: "product-1", title: "Demo Product", variantTitle: "Default", quantity: 1, unitPrice: "1200", currency: "THB" }],
          subtotal: "1200",
        },
        {
          shopId: "shop-2",
          shopName: "Second Shop",
          items: [{ id: "item-2", variantId: "variant-2", productId: "product-2", title: "Other Product", variantTitle: "Default", quantity: 1, unitPrice: "800", currency: "THB" }],
          subtotal: "800",
        },
      ],
      subtotal: "2000",
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
      subtotal: "1200",
      discountTotal: couponCode === "SAVE10" ? "100" : "0",
      shippingTotal: "500",
      taxTotal: "0",
      grandTotal: couponCode === "SAVE10" ? "1600" : "1700",
      currency: "THB",
      coupon: couponCode ? { code: couponCode, applied: true } : null,
      ...quotedAmounts, coinsApplied: 0,
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
      subtotal: "1200",
      discountTotal: "300",
      shippingTotal: "500",
      taxTotal: "0",
      grandTotal: "1400",
      currency: "THB",
      coupon: { code: "SAVE10", applied: true },
      ...quotedAmounts, coinsApplied: 0,
    });

    renderCheckoutPage();

    await waitFor(() => expect(screen.getByText("Discount")).toBeTruthy());
    expect(screen.getByText("-THB 3.00")).toBeTruthy();
    expect(screen.getByText("Shipping")).toBeTruthy();
    expect(screen.getByText("THB 5.00")).toBeTruthy();
  });

  it("quotes and creates checkout with the buyer-selected coins", async () => {
    vi.mocked(quoteCheckout).mockImplementation(({ coinsToUse }) => Promise.resolve({
      subtotal: "1200",
      discountTotal: String((coinsToUse ?? 0) * 100),
      shippingTotal: "500",
      taxTotal: "0",
      grandTotal: String(1700 - (coinsToUse ?? 0) * 100),
      currency: "THB",
      coupon: null,
      ...quotedAmounts, coinsApplied: coinsToUse ?? 0,
    }));
    renderCheckoutPage();

    fireEvent.change(await screen.findByLabelText("Coins"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Use coins" }));
    await screen.findByText("5 coins applied");

    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({ coinsToUse: 5 })));
    expect(quoteCheckout).toHaveBeenCalledWith(expect.objectContaining({ coinsToUse: 5 }));
  });

  it("keeps the summary and place-order button usable when the coupon is unusable", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({
      subtotal: "1200",
      discountTotal: "0",
      shippingTotal: "500",
      taxTotal: "0",
      grandTotal: "1700",
      currency: "THB",
      coupon: { code: "EXPIRED10", applied: false, reason: "COUPON_EXPIRED" },
      ...quotedAmounts, coinsApplied: 0,
    });

    renderCheckoutPage();

    const placeOrderButton = await screen.findByRole("button", { name: "Place order" }) as HTMLButtonElement;
    await waitFor(() => expect(placeOrderButton.disabled).toBe(false));
    expect(screen.getByText("This coupon has expired.")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
  });
  it.each([
    { mode: "INCLUSIVE", taxTotal: "0", includedTax: "7", addedTax: "0", total: "101", label: "checkout.taxIncluded", display: "THB 1.01" },
    { mode: "EXCLUSIVE", taxTotal: "7", includedTax: "0", addedTax: "7", total: "108", label: "checkout.taxAdded", display: "THB 1.08" },
  ] as const)("discloses $mode tax and accepts the exact displayed quote without adding it again", async (scenario) => {
    vi.mocked(quoteCheckout).mockResolvedValue({ ...quotedAmounts, subtotal: "101", discountTotal: "0", shippingTotal: "0",
      taxTotal: scenario.taxTotal, includedTaxTotal: scenario.includedTax, addedTaxTotal: scenario.addedTax, reportedTaxTotal: "7",
      taxMode: scenario.mode, grandTotal: scenario.total, currency: "THB", coupon: null, coinsApplied: 0 });
    renderCheckoutPage();
    const disclosure = await screen.findByTestId("checkout-tax-disclosure");
    expect(within(disclosure).getByText(scenario.label)).toBeTruthy();
    expect(within(disclosure).getByText("THB 0.07")).toBeTruthy();
    expect(screen.getAllByText(scenario.display)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      acceptedQuoteFingerprint: "a".repeat(64), acceptedTaxPolicyRevision: "tax-zero-test",
    })));
  });

  it("quotes both named coupon slots and submits them with the reviewed fingerprint", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({ ...quotedAmounts, subtotal: "1200", discountTotal: "200", shippingTotal: "500",
      taxTotal: "0", grandTotal: "1500", currency: "THB", coinsApplied: 0, coupon: null,
      couponOutcomes: [{ code: "SHOP100", applied: true }, { code: "PLATFORM100", applied: true }] });
    renderCheckoutPage();
    await screen.findAllByText("THB 15.00");
    fireEvent.change(screen.getByLabelText("checkout.shopCoupon"), { target: { value: "SHOP100" } });
    fireEvent.click(screen.getByRole("button", { name: "checkout.applyShopCoupon" }));
    await waitFor(() => expect(quoteCheckout).toHaveBeenLastCalledWith(expect.objectContaining({ shopCouponCode: "SHOP100", couponCode: undefined })));
    fireEvent.change(screen.getByLabelText("checkout.platformCoupon"), { target: { value: "PLATFORM100" } });
    fireEvent.click(screen.getByRole("button", { name: "checkout.applyPlatformCoupon" }));
    await waitFor(() => expect(quoteCheckout).toHaveBeenLastCalledWith(expect.objectContaining({ shopCouponCode: "SHOP100", platformCouponCode: "PLATFORM100" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).not.toHaveProperty("disabled", true));
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({ shopCouponCode: "SHOP100", platformCouponCode: "PLATFORM100", couponCode: undefined, acceptedQuoteFingerprint: "a".repeat(64) })));
  });

  it("blocks a quote without acceptance evidence", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({ ...quotedAmounts, quoteFingerprint: undefined, subtotal: "1200", discountTotal: "0", shippingTotal: "500", taxTotal: "0", grandTotal: "1700", currency: "THB", coupon: null, coinsApplied: 0 });
    renderCheckoutPage();
    await screen.findAllByText("THB 17.00");
    expect(screen.getByRole("button", { name: "Place order" })).toHaveProperty("disabled", true);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("requires a new click to accept a changed server quote", async () => {
    vi.mocked(createCheckout).mockRejectedValueOnce(new Error("Checkout quote changed; review and accept the replacement quote"));
    vi.mocked(quoteCheckout).mockResolvedValueOnce({ ...quotedAmounts, subtotal: "1200", discountTotal: "0", shippingTotal: "500", taxTotal: "0", grandTotal: "1700", currency: "THB", coupon: null, coinsApplied: 0 })
      .mockResolvedValue({ ...quotedAmounts, quoteFingerprint: "b".repeat(64), taxPolicyRevision: "tax-new-test", subtotal: "1200", discountTotal: "0", shippingTotal: "500", taxTotal: "100", addedTaxTotal: "100", reportedTaxTotal: "100", includedTaxTotal: "0", taxMode: "EXCLUSIVE", grandTotal: "1800", currency: "THB", coupon: null, coinsApplied: 0 });
    renderCheckoutPage();
    await screen.findAllByText("THB 17.00");
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findAllByText("THB 18.00");
    expect(createCheckout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).not.toHaveProperty("disabled", true));
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(createCheckout).toHaveBeenLastCalledWith(expect.objectContaining({ acceptedQuoteFingerprint: "b".repeat(64), acceptedTaxPolicyRevision: "tax-new-test" })));
  });

  it("shows the second slot rejection when the same shop code is entered as a platform code", async () => {
    vi.mocked(quoteCheckout).mockResolvedValue({ ...quotedAmounts, subtotal: "1200", discountTotal: "100", shippingTotal: "500", taxTotal: "0", grandTotal: "1600", currency: "THB", coinsApplied: 0, coupon: { code: "SHOP100", applied: true },
      couponOutcomes: [{ code: "SHOP100", applied: true }, { code: "SHOP100", applied: false, reason: "INVALID_COUPON" }] });
    renderCheckoutPage();
    await screen.findAllByText("THB 16.00");
    fireEvent.change(screen.getByLabelText("checkout.shopCoupon"), { target: { value: "SHOP100" } });
    fireEvent.click(screen.getByRole("button", { name: "checkout.applyShopCoupon" }));
    await waitFor(() => expect(quoteCheckout).toHaveBeenLastCalledWith(expect.objectContaining({ shopCouponCode: "SHOP100" })));
    fireEvent.change(screen.getByLabelText("checkout.platformCoupon"), { target: { value: "SHOP100" } });
    fireEvent.click(screen.getByRole("button", { name: "checkout.applyPlatformCoupon" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This coupon code is invalid.");
  });

});
