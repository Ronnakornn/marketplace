/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "#/i18n/client";
import messages from "../../../../messages/en.json";
import { AdminAnalytics } from "./AdminAnalytics";

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  exports: vi.fn(),
  post: vi.fn(),
  permissions: ["reports.read", "reports.export"],
}));
vi.mock("../access/useAdminAccess", () => ({
  useAdminAccess: () => ({
    data: { userId: "admin-1", permissions: transport.permissions },
  }),
}));
vi.mock("./api", () => ({
  reportingApi: {
    api: {
      admin: {
        analytics: { get: transport.get },
        "report-exports": { get: transport.exports, post: transport.post },
      },
    },
  },
  requireData: async (call: Promise<{ data: unknown; error: unknown }>) => {
    const result = await call;
    if (result.error) throw result.error;
    return result.data;
  },
}));
beforeEach(() => {
  transport.permissions = ["reports.read", "reports.export"];
  transport.get.mockResolvedValue({
    data: { totals: [], items: [], total: "0", searchQueries: [] },
    error: null,
  });
  transport.exports.mockResolvedValue({ data: [], error: null });
  transport.post.mockResolvedValue({ data: { id: "export-1" }, error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openReport() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="en" messages={messages} fallbackMessages={messages}>
        <AdminAnalytics />
      </I18nProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(transport.get).toHaveBeenCalledTimes(2));
}

it("stages filters until Apply and blocks exporting unapplied changes", async () => {
  await openReport();
  fireEvent.change(screen.getByLabelText(messages.admin.reporting.from), {
    target: { value: "2026-10-01" },
  });
  expect(transport.get).toHaveBeenCalledTimes(2);
  const exportButton = screen.getByRole("button", {
    name: messages.admin.reporting.export + " CSV",
  });
  expect(exportButton).toHaveProperty("disabled", true);
  fireEvent.click(exportButton);
  expect(transport.post).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.applyFilters }),
  );
  await waitFor(() =>
    expect(transport.get).toHaveBeenCalledWith({
      query: {
        group: "day",
        timeZone: "Asia/Bangkok",
        from: "2026-10-01",
        shopId: undefined,
        categoryId: undefined,
        region: undefined,
        page: 1,
        limit: 25,
      },
    }),
  );
  fireEvent.click(exportButton);
  await waitFor(() =>
    expect(transport.post).toHaveBeenCalledWith({
      type: "SALES",
      format: "CSV",
      filters: {
        group: "day",
        timeZone: "Asia/Bangkok",
        from: "2026-10-01",
        shopId: undefined,
        categoryId: undefined,
        region: undefined,
        page: 1,
        limit: 25,
      },
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.resetFilters }),
  );
  expect(screen.getByLabelText(messages.admin.reporting.from)).toHaveProperty(
    "value",
    "",
  );
});

it("keeps invalid date ranges and incomplete IDs out of API queries", async () => {
  await openReport();
  fireEvent.change(screen.getByLabelText(messages.admin.reporting.from), {
    target: { value: "2026-10-12" },
  });
  fireEvent.change(
    screen.getByLabelText(messages.admin.reporting.toExclusive),
    { target: { value: "2026-10-01" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.applyFilters }),
  );
  expect(screen.getByRole("alert").textContent).toBe(
    messages.admin.reporting.filterDateError,
  );
  expect(transport.get).toHaveBeenCalledTimes(2);
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.resetFilters }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.moreFilters }),
  );
  fireEvent.change(screen.getByLabelText(messages.admin.reporting.shopId), {
    target: { value: "partial-id" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.reporting.applyFilters }),
  );
  expect(screen.getByRole("alert").textContent).toBe(
    messages.admin.reporting.filterIdError,
  );
  expect(transport.get).toHaveBeenCalledTimes(2);
});

it("does not request private exports for a report reader", async () => {
  transport.permissions = ["reports.read"];
  await openReport();
  expect(transport.exports).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", {
      name: messages.admin.reporting.export + " CSV",
    }),
  ).toBeNull();
});
