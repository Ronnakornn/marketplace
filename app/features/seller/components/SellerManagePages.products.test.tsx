/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SellerProductsPage } from "./SellerManagePages";

const refetch = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const archiveMutate = vi.fn();

const products = [
  {
    id: "prod_1",
    title: "Cotton Shirt",
    titleTh: "เสื้อผ้าฝ้าย",
    titleEn: "Cotton Shirt",
    slug: "cotton-shirt",
    description: "Soft shirt",
    descriptionTh: "",
    descriptionEn: "",
    status: "DRAFT",
    variants: [
      {
        id: "var_1",
        sku: "SHIRT-1",
        title: "Small",
        price: 1299,
        currency: "USD",
        inventory: { quantityOnHand: 10, quantityReserved: 2, reorderLevel: 1 },
      },
    ],
  },
  {
    id: "prod_2",
    title: "Archived Hat",
    titleTh: null,
    titleEn: null,
    slug: "archived-hat",
    description: null,
    descriptionTh: null,
    descriptionEn: null,
    status: "ARCHIVED",
    variants: [],
  },
];

let sellerProductsState: {
  data?: { data: typeof products; meta: { nextCursor: string | null; hasNextPage: boolean } };
  error?: Error | null;
  isLoading?: boolean;
} = {
  data: { data: products, meta: { nextCursor: null, hasNextPage: false } },
  error: null,
  isLoading: false,
};

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("#/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("#/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
  AlertDialogAction: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => <button type="button" disabled={disabled}>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div role="alertdialog">{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("#/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value?: string; onValueChange?: (value: string) => void }) => (
    <div data-value={value} onChange={(event) => onValueChange?.((event.target as HTMLSelectElement).value)}>{children}</div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children, "aria-label": ariaLabel }: { children: ReactNode; "aria-label"?: string }) => <span aria-label={ariaLabel}>{children}</span>,
  SelectValue: () => null,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("#/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) => <label {...props}>{children}</label>,
}));

vi.mock("#/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => <tr {...props}>{children}</tr>,
}));

vi.mock("../hooks/useSellerManage", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useSellerManage")>("../hooks/useSellerManage");
  return {
    ...actual,
    useSellerProducts: vi.fn(() => ({
      ...sellerProductsState,
      refetch,
    })),
    useCreateSellerProduct: vi.fn(() => ({ mutate: createMutate, isPending: false })),
    useUpdateSellerProduct: vi.fn(() => ({ mutate: updateMutate, isPending: false })),
    useArchiveSellerProduct: vi.fn(() => ({ mutate: archiveMutate, isPending: false })),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sellerProductsState = { data: { data: products, meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
});

describe("SellerProductsPage", () => {
  it("renders products in the shared table with accessible row actions", () => {
    render(<SellerProductsPage />);

    expect(screen.getByText("Cotton Shirt")).toBeTruthy();
    expect(screen.getByText("cotton-shirt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Cotton Shirt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Cotton Shirt" })).toBeTruthy();
  });

  it("creates a product from the dialog and keeps data until mutation success", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Product" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-product" } });
    fireEvent.click(screen.getByRole("button", { name: /save product/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Product", slug: "new-product", status: "DRAFT" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByDisplayValue("New Product")).toBeTruthy();
  });

  it("edits an existing product and asks before discarding dirty changes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Cotton Shirt" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed Shirt" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved product changes?");
    expect(screen.getByDisplayValue("Changed Shirt")).toBeTruthy();
  });

  it("requires archive confirmation before calling archive mutation", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive Cotton Shirt" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive product" }));

    expect(archiveMutate).toHaveBeenCalledWith("prod_1", expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("shows page load failures with retry", async () => {
    sellerProductsState = { data: undefined, error: new Error("Load failed"), isLoading: false };

    render(<SellerProductsPage />);

    expect(screen.getByText("Load failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
