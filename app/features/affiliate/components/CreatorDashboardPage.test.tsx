/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "#/lib/api-client";
import { fetchAffiliateLinks, fetchAffiliateStats, fetchAffiliateTargets } from "../api";
import { fetchAffiliateProductTargets } from "#/features/product/queries";
import { CreatorDashboardPage } from "./CreatorDashboardPage";

vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => ({
    "affiliate.affiliates": "Affiliates",
    "affiliate.unavailableTitle": "Affiliate program unavailable",
    "affiliate.unavailableDescription": "Affiliate links and commissions are currently unavailable.",
    "affiliate.createLink": "Create affiliate link",
    "affiliate.noLinksTitle": "No links",
    "state.retry": "Retry",
  })[key] ?? key,
  useFormatters: () => ({ date: (value: string | Date) => new Date(value).toISOString() }),
}));
vi.mock("../api", async (original) => ({
  ...await original<typeof import("../api")>(),
  fetchAffiliateStats: vi.fn(),
  fetchAffiliateLinks: vi.fn(),
  fetchAffiliateTargets: vi.fn(),
  createAffiliateLink: vi.fn(),
}));
vi.mock("#/features/product/queries", () => ({
  affiliateProductTargetsQueryOptions: () => ({ queryKey: ["affiliate", "product-targets"] }),
  fetchAffiliateProductTargets: vi.fn(async () => []),
  normalizeAffiliateProductTargets: (items: unknown[]) => items,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CreatorDashboardPage /></QueryClientProvider>);
  return client;
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAffiliateStats).mockResolvedValue({ clicks: 0, conversions: 0, commissionCents: "0" });
  vi.mocked(fetchAffiliateLinks).mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalCount: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } });
});

describe("CreatorDashboardPage availability", () => {
  it("shows a deliberate unavailable state with no link creation, retry or target requests when disabled", async () => {
    vi.mocked(fetchAffiliateStats).mockRejectedValue(new ApiClientError("Affiliate feature is disabled", 403, "AFFILIATE_DISABLED"));
    renderPage();

    await screen.findByText("Affiliate program unavailable");
    expect(screen.getByText("Affiliate links and commissions are currently unavailable.")).toBeTruthy();
    expect(screen.queryByText("Affiliate feature is disabled")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create affiliate link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(fetchAffiliateTargets).not.toHaveBeenCalled();
    expect(fetchAffiliateProductTargets).not.toHaveBeenCalled();
  });

  it("keeps creation unavailable during loading before the server confirms access", async () => {
    vi.mocked(fetchAffiliateStats).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.queryByRole("button", { name: "Create affiliate link" })).toBeNull();
    expect(fetchAffiliateProductTargets).not.toHaveBeenCalled();
  });

  it("retains a retryable error for a temporary service failure", async () => {
    vi.mocked(fetchAffiliateStats).mockRejectedValue(new ApiClientError("Service temporarily unavailable", 503));
    renderPage();
    await screen.findByText("Service temporarily unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText("Affiliate program unavailable")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create affiliate link" })).toBeNull();
  });

  it("loads target choices and creation after the server confirms Affiliate access", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Create affiliate link" });
    await waitFor(() => expect(fetchAffiliateProductTargets).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Affiliate program unavailable")).toBeNull();
  });
});


describe("CreatorDashboardPage link pagination", () => {
  const link = { id: "link-61", affiliateId: "affiliate", code: "OLDER61", targetType: "product" as const, targetId: "product", status: "ACTIVE" as const, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };
  const page = (page: number, data: typeof link[], hasNextPage: boolean) => ({ data, meta: { page, limit: 20, totalCount: 61, totalPages: 4, hasNextPage, hasPreviousPage: page > 1 } });
  it("loads older links on demand and retains them when the next request fails", async () => {
    vi.mocked(fetchAffiliateLinks).mockResolvedValueOnce(page(1, [link], true)).mockRejectedValueOnce(new Error("Older links failed"));
    renderPage();
    await screen.findByText("OLDER61");
    expect(fetchAffiliateLinks).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    await screen.findByText("Older links failed");
    expect(screen.getByText("OLDER61")).toBeTruthy();
    expect(fetchAffiliateLinks).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    expect(screen.getByText("61 affiliate.activeRecords")).toBeTruthy();
  });
});
