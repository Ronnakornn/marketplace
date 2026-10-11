/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderTrackingPage } from "./OrderTrackingPage";

const tracking = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("#/features/buyer/api", () => ({ fetchOrderTracking: tracking.fetch }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
  useFormatters: () => ({ date: (timestamp: string) => timestamp }),
}));

afterEach(cleanup);

describe("OrderTrackingPage", () => {
  it("renders carrier, tracking number and genuine timeline from the tracking-only DTO", async () => {
    tracking.fetch.mockResolvedValue({
      orderId: "order-1", orderNo: "ORDER-001", orderStatus: "SHIPPED",
      shipments: [{
        shipmentId: "shipment-1", shopId: "shop-1", shopName: "Parcel Shop", status: "shipped",
        carrier: "Parcel Express", trackingNo: "TRACK-001", shippedAt: "2026-10-10T12:00:00.000Z",
        deliveredAt: null, items: [],
        timeline: [{ label: "Your parcel has been shipped", status: "shipped", timestamp: "2026-10-10T12:00:00.000Z" }],
      }],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><OrderTrackingPage orderId="order-1" /></QueryClientProvider>);
    expect(await screen.findByText("Parcel Express TRACK-001")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Parcel Shop" })).toBeTruthy();
    expect(screen.getByText("Your parcel has been shipped")).toBeTruthy();
    expect(screen.getByText("shipped - 2026-10-10T12:00:00.000Z")).toBeTruthy();
    expect(tracking.fetch).toHaveBeenCalledWith("order-1");
  });
});
