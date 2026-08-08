/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../messages/en.json";
import { I18nProvider } from "#/i18n/client";
import { AdminContentModerationQueues } from "./AdminContentModerationQueues";

function renderPage() {
  return render(<I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}><AdminContentModerationQueues /></I18nProvider>);
}

const updateReviewMutate = vi.fn();
const updateReportMutate = vi.fn();
const updateQuestionMutate = vi.fn();
const updateAnswerMutate = vi.fn();

const review = {
  id: "review_1",
  status: "PENDING",
  rating: 2,
  body: "Damaged item arrived.",
  moderationReason: null,
  moderatedAt: null,
  reportCount: 1,
  createdAt: "2026-05-21T08:00:00.000Z",
  updatedAt: "2026-05-21T08:00:00.000Z",
  user: { id: "user_1", name: "Jane Buyer", email: "jane@example.com" },
  product: { id: "prod_1", title: "Cotton Shirt", slug: "cotton-shirt", status: "ACTIVE" },
  shop: { id: "shop_1", name: "Nara Goods", slug: "nara-goods", status: "ACTIVE" },
  orderItem: { id: "item_1", productTitle: "Cotton Shirt", variantTitle: "Small", shopName: "Nara Goods", shopSlug: "nara-goods" },
};

const report = {
  id: "report_1",
  status: "OPEN",
  reason: "Abuse",
  detail: "Contains abusive language.",
  moderationNote: null,
  moderatedAt: null,
  createdAt: "2026-05-22T08:00:00.000Z",
  updatedAt: "2026-05-22T08:00:00.000Z",
  reportedBy: { id: "user_2", name: "Reporter", email: "reporter@example.com" },
  moderatedBy: null,
  review,
};

const question = {
  id: "question_1",
  productId: "prod_1",
  shopId: "shop_1",
  userId: "user_1",
  question: "Is this authentic?",
  status: "PENDING",
  answerCount: 0,
  createdAt: "2026-05-23T08:00:00.000Z",
  updatedAt: "2026-05-23T08:00:00.000Z",
  user: review.user,
  product: review.product,
  shop: review.shop,
};

const answer = {
  id: "answer_1",
  questionId: "question_1",
  userId: "seller_1",
  answer: "Yes, this is authentic.",
  status: "PENDING",
  createdAt: "2026-05-24T08:00:00.000Z",
  updatedAt: "2026-05-24T08:00:00.000Z",
  user: { id: "seller_1", name: "Seller", email: "seller@example.com" },
  question: { id: question.id, question: question.question, status: question.status, user: question.user, product: question.product, shop: question.shop },
};

function query(items: unknown[]) {
  return {
    data: { items, pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 } },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

vi.mock("#/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
  AlertDialogAction: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div role="alertdialog">{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; asChild?: boolean }) => (
    asChild && React.isValidElement(children) ? React.cloneElement(children, props) : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/card", () => ({
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("#/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) => <label {...props}>{children}</label>,
}));

vi.mock("#/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => null,
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => <tr {...props}>{children}</tr>,
}));

vi.mock("#/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("./AdminDataShell", () => ({
  AdminDataShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock("./AdminStatusBadge", () => ({
  AdminStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("./AdminTablePagination", () => ({
  AdminTablePagination: () => <nav aria-label="pagination" />,
}));

vi.mock("../hooks/useAdminOperations", () => ({
  PAGE_SIZE: 10,
  useAdminModerationReviewsList: () => query([review]),
  useAdminModerationReviewReportsList: () => query([report]),
  useAdminModerationQuestionsList: () => query([question]),
  useAdminModerationAnswersList: () => query([answer]),
  useUpdateModerationReviewStatus: () => ({ mutate: updateReviewMutate, isPending: false, error: null }),
  useUpdateModerationReviewReportStatus: () => ({ mutate: updateReportMutate, isPending: false, error: null }),
  useUpdateModerationQuestionStatus: () => ({ mutate: updateQuestionMutate, isPending: false, error: null }),
  useUpdateModerationAnswerStatus: () => ({ mutate: updateAnswerMutate, isPending: false, error: null }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminContentModerationQueues", () => {
  it("renders all moderation queues with content context", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Content Moderation" })).toBeTruthy();
    expect(screen.getAllByText("Damaged item arrived.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cotton Shirt").length).toBeGreaterThan(0);
    expect(screen.getByText("Contains abusive language.")).toBeTruthy();
    expect(screen.getAllByText("Is this authentic?").length).toBeGreaterThan(0);
    expect(screen.getByText("Yes, this is authentic.")).toBeTruthy();
  });

  it("requires a note before hiding a review and submits mutation with the note", async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: "Hidden" })[0]!);

    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toHaveProperty("disabled", true);
    expect(screen.getByText("Moderation note is required for this action.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Moderation note"), { target: { value: "Abusive content." } });

    await waitFor(() => expect(confirm).toHaveProperty("disabled", false));
    fireEvent.click(confirm);

    expect(updateReviewMutate).toHaveBeenCalledWith(
      { id: "review_1", status: "HIDDEN", note: "Abusive content." },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
