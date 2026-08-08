/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../messages/en.json";
import { I18nProvider } from "#/i18n/client";
import { AdminProductsModerationTable } from "./AdminOperationsTables";

function renderPage() {
  return render(<I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}><AdminProductsModerationTable /></I18nProvider>);
}

const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const suspendMutate = vi.fn();
const restoreMutate = vi.fn();

const product = {
  id: "prod_1",
  title: "Cotton Shirt",
  slug: "cotton-shirt",
  description: "Soft shirt",
  status: "PENDING_REVIEW",
  createdAt: "2026-05-21T08:00:00.000Z",
  updatedAt: "2026-05-22T08:00:00.000Z",
  category: { id: "cat_1", name: "Fashion", slug: "fashion" },
  shop: { id: "shop_1", name: "Nara Goods", slug: "nara-goods", status: "ACTIVE" },
  images: [{ id: "img_1", url: "https://example.com/shirt.jpg", altText: "Cotton shirt", sortOrder: 0, isPrimary: true }],
  variants: [{ id: "var_1", title: "Small", sku: "SHIRT-1", price: 1299, currency: "USD", status: "ACTIVE", inventory: { quantityOnHand: 10, quantityReserved: 0 } }],
};

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));

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

vi.mock("#/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => <tr {...props}>{children}</tr>,
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
  useAdminCatalogModerationList: () => ({
    data: { data: [product], meta: { nextCursor: null, hasNextPage: false } },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useApproveCatalogProduct: () => ({ mutate: approveMutate, isPending: false, error: null, variables: null }),
  useRejectCatalogProduct: () => ({ mutate: rejectMutate, isPending: false, error: null, variables: null }),
  useSuspendCatalogProduct: () => ({ mutate: suspendMutate, isPending: false, error: null, variables: null }),
  useRestoreCatalogProduct: () => ({ mutate: restoreMutate, isPending: false, error: null, variables: null }),
  useAdminAffiliatesList: vi.fn(),
  useAdminOrdersList: vi.fn(),
  useAdminRefundsList: vi.fn(),
  useAdminShopsList: vi.fn(),
  useAdminUsersList: vi.fn(),
  useCreateAdminShop: vi.fn(),
  useDeleteAdminShop: vi.fn(),
  useUpdateAdminShop: vi.fn(),
  useUpdateAffiliateStatus: vi.fn(),
  useUpdateRefundStatus: vi.fn(),
  useUpdateShopStatus: vi.fn(),
  useUpdateUserStatus: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminProductsModerationTable", () => {
  it("requires a reject reason before submitting moderation action", async () => {
    renderPage();

    expect(screen.getByText("Cotton Shirt")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Detail" }).getAttribute("href")).toBe("/admin/products/prod_1");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    const dialogRejectButton = screen.getAllByRole("button", { name: "Reject" }).at(-1)!;
    expect(dialogRejectButton).toHaveProperty("disabled", true);
    expect(screen.getByText("Reason is required.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Missing safety documentation." } });

    await waitFor(() => expect(dialogRejectButton).toHaveProperty("disabled", false));
    fireEvent.click(dialogRejectButton);

    expect(rejectMutate).toHaveBeenCalledWith(
      { id: "prod_1", reason: "Missing safety documentation." },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("requires a suspend reason before submitting moderation action", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

    const dialogSuspendButton = screen.getAllByRole("button", { name: "Suspend" }).at(-1)!;
    expect(dialogSuspendButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Counterfeit report confirmed." } });

    await waitFor(() => expect(dialogSuspendButton).toHaveProperty("disabled", false));
    fireEvent.click(dialogSuspendButton);

    expect(suspendMutate).toHaveBeenCalledWith(
      { id: "prod_1", reason: "Counterfeit report confirmed." },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
