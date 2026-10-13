/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "#/i18n/client";
import messages from "../../../../messages/en.json";
import { AdminFinance, AdminReconciliation } from "./Finance";

const transport = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  match: vi.fn(),
  reconciliation: vi.fn(),
  cycles: vi.fn(),
  channels: vi.fn(),
  payout: vi.fn(),
  record: vi.fn(),
  approveRoute: vi.fn(),
}));
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    operationsApi: {
      finance: {
        reconciliation: Object.assign(transport.reconciliation, {
          get: transport.list,
          post: transport.create,
        }),
        channels: { get: transport.channels },
        cycles: { get: transport.cycles },
        payouts: transport.payout,
      },
    },
  };
});
vi.mock("#/lib/eden", () => ({
  api: { api: { admin: { payouts: transport.approveRoute }, uploads: {} } },
}));
const clients: QueryClient[] = [];
const payoutId = "11111111-1111-4111-8111-111111111111";
const paymentId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  transport.reconciliation.mockReturnValue({
    match: { post: transport.match },
  });
  transport.payout.mockReturnValue({ record: { post: transport.record } });
  transport.list.mockResolvedValue({
    data: {
      items: [
        {
          id: "evidence-1",
          kind: "BANK_STATEMENT",
          sourceKey: "Statement 100",
          currency: "THB",
          amount: "12345",
          externalReference: "BANK-100",
          status: "UNMATCHED",
          paymentId,
          payoutId: null,
          refundId: null,
          uploadId: null,
          occurredAt: "2026-10-13T00:00:00Z",
          version: 3,
        },
      ],
      total: 1,
    },
    error: null,
  });
  transport.cycles.mockResolvedValue({
    data: {
      items: [
        {
          id: payoutId,
          shop: { name: "Test shop" },
          currency: "THB",
          amount: "12345",
          status: "approved",
          cycleKey: "2026-10",
          externalReference: null,
          evidenceUploadId: null,
        },
      ],
      total: 1,
    },
    error: null,
  });
  transport.channels.mockResolvedValue({ data: [], error: null });
  transport.create.mockResolvedValue({ data: {}, error: null });
  transport.record.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.clearAllMocks();
});
function open(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="en" messages={messages} fallbackMessages={messages}>
        {component}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

it("does not carry a reviewed payment into a fresh evidence record", async () => {
  open(<AdminReconciliation />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: messages.admin.operations.review,
    }),
  );
  let dialog = within(screen.getByRole("dialog"));
  expect(
    dialog.getByLabelText(messages.admin.operations.fields.targetId),
  ).toHaveProperty("value", paymentId);
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.targetType),
    { target: { value: "PAYOUT" } },
  );
  expect(
    dialog.getByLabelText(messages.admin.operations.fields.targetId),
  ).toHaveProperty("value", "");
  fireEvent.click(
    dialog.getByRole("button", { name: messages.admin.operations.cancel }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(
    screen.getByRole("button", {
      name: messages.admin.operations.createEvidence,
    }),
  );
  dialog = within(screen.getByRole("dialog"));
  expect(
    dialog.getByLabelText(messages.admin.operations.fields.targetId),
  ).toHaveProperty("value", "");
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.sourceKey),
    { target: { value: "new-source" } },
  );
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.amount),
    { target: { value: "12500" } },
  );
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.externalReference),
    { target: { value: "new-reference" } },
  );
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.reason),
    { target: { value: "Record new evidence" } },
  );
  fireEvent.click(
    dialog.getByRole("button", { name: messages.admin.operations.save }),
  );
  await waitFor(() =>
    expect(transport.create).toHaveBeenCalledWith({
      kind: "BANK_STATEMENT",
      sourceKey: "new-source",
      amount: "12500",
      currency: "THB",
      externalReference: "new-reference",
      occurredAt: null,
      reason: "Record new evidence",
    }),
  );
  expect(transport.match).not.toHaveBeenCalled();
});

it("shows the chosen payout and discards canceled completion references", async () => {
  open(<AdminFinance />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: messages.admin.operations.recordPaid,
    }),
  );
  let dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Test shop")).toBeTruthy();
  expect(dialog.getByText(/123\.45/)).toBeTruthy();
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.externalReference),
    { target: { value: "old-reference" } },
  );
  fireEvent.click(
    dialog
      .getAllByRole("button", { name: messages.admin.operations.cancel })
      .at(-1)!,
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(transport.record).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.admin.operations.recordPaid }),
  );
  dialog = within(screen.getByRole("dialog"));
  expect(
    dialog.getByLabelText(messages.admin.operations.fields.externalReference),
  ).toHaveProperty("value", "");
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.evidenceId),
    { target: { value: "evidence-2" } },
  );
  fireEvent.change(
    dialog.getByLabelText(messages.admin.operations.fields.externalReference),
    { target: { value: "bank-transfer-2" } },
  );
  fireEvent.click(
    dialog.getByRole("button", { name: messages.admin.operations.save }),
  );
  await waitFor(() =>
    expect(transport.payout).toHaveBeenCalledWith({ id: payoutId }),
  );
  expect(transport.record).toHaveBeenCalledWith({
    evidenceId: "evidence-2",
    externalReference: "bank-transfer-2",
  });
});
