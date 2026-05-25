/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SellerProductsPage } from "./SellerManagePages";

const refetch = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const archiveMutate = vi.fn();
const createImageMutate = vi.fn();
const updateImageMutate = vi.fn();
const deleteImageMutate = vi.fn();
const createVariantMutate = vi.fn();
const updateVariantMutate = vi.fn();
const deleteVariantMutate = vi.fn();

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
    categoryId: "cat_1",
    category: { id: "cat_1", name: "Fashion", slug: "fashion" },
    brandId: "brand_1",
    brand: { id: "brand_1", name: "Acme", slug: "acme", code: "ACME", isActive: true },
    images: [
      { id: "img_1", productId: "prod_1", url: "https://example.com/shirt.jpg", altText: "Cotton shirt front", sortOrder: 0, isPrimary: true, width: 800, height: 600 },
    ],
    variants: [
      {
        id: "var_1",
        sku: "SHIRT-1",
        title: "Small",
        titleTh: null,
        titleEn: "Small",
        price: 1299,
        currency: "USD",
        weightGrams: 250,
        lengthMm: 300,
        widthMm: 200,
        heightMm: 20,
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
    categoryId: null,
    category: null,
    brandId: null,
    brand: null,
    images: [],
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

vi.mock("#/components/ui/select", () => {
  const SelectContext = React.createContext<((value: string) => void) | undefined>(undefined);
  return {
  Select: ({ children, value, onValueChange }: { children: ReactNode; value?: string; onValueChange?: (value: string) => void }) => (
    <SelectContext.Provider value={onValueChange}>
      <div data-value={value}>{children}</div>
    </SelectContext.Provider>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
    const onValueChange = React.useContext(SelectContext);
    return <button type="button" data-value={value} onClick={() => onValueChange?.(value)}>{children}</button>;
  },
  SelectTrigger: ({ children, "aria-label": ariaLabel }: { children: ReactNode; "aria-label"?: string }) => <span aria-label={ariaLabel}>{children}</span>,
  SelectValue: () => null,
}});

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

vi.mock("../hooks/useSellerManage", () => {
  const inertQuery = () => ({ data: undefined, isLoading: false, error: null, refetch });
  const inertMutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useSellerProducts: vi.fn(() => ({
      ...sellerProductsState,
      refetch,
    })),
    useSellerCategories: vi.fn(() => ({ data: [{ id: "cat_1", name: "Fashion", slug: "fashion", sortOrder: 0 }], isLoading: false })),
    useSellerBrands: vi.fn(() => ({ data: [{ id: "brand_1", name: "Acme", slug: "acme", code: "ACME", isActive: true }], isLoading: false })),
    useCreateSellerProduct: vi.fn(() => ({ mutate: createMutate, isPending: false })),
    useUpdateSellerProduct: vi.fn(() => ({ mutate: updateMutate, isPending: false })),
    useArchiveSellerProduct: vi.fn(() => ({ mutate: archiveMutate, isPending: false })),
    useCreateSellerProductImage: vi.fn(() => ({ mutate: createImageMutate, isPending: false })),
    useUpdateSellerProductImage: vi.fn(() => ({ mutate: updateImageMutate, isPending: false })),
    useDeleteSellerProductImage: vi.fn(() => ({ mutate: deleteImageMutate, isPending: false })),
    useCreateSellerVariant: vi.fn(() => ({ mutate: createVariantMutate, isPending: false })),
    useUpdateSellerVariant: vi.fn(() => ({ mutate: updateVariantMutate, isPending: false })),
    useDeleteSellerVariant: vi.fn(() => ({ mutate: deleteVariantMutate, isPending: false })),
    useSellerDashboard: vi.fn(inertQuery),
    useSellerShipments: vi.fn(inertQuery),
    useSellerReturns: vi.fn(inertQuery),
    useSellerCoupons: vi.fn(inertQuery),
    useSellerWallet: vi.fn(inertQuery),
    useSellerTransactions: vi.fn(inertQuery),
    useSellerPayouts: vi.fn(inertQuery),
    useUpdateSellerInventory: vi.fn(inertMutation),
    usePackShipment: vi.fn(inertMutation),
    useShipShipment: vi.fn(inertMutation),
    useDeliverShipment: vi.fn(inertMutation),
    useApproveReturn: vi.fn(inertMutation),
    useRejectReturn: vi.fn(inertMutation),
    useCreateSellerCoupon: vi.fn(inertMutation),
    useUpdateSellerCoupon: vi.fn(inertMutation),
    useDeleteSellerCoupon: vi.fn(inertMutation),
    useCreateSellerPayout: vi.fn(inertMutation),
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

    expect(screen.getAllByText("Cotton Shirt").length).toBeGreaterThan(0);
    expect(screen.getByText("cotton-shirt")).toBeTruthy();
    expect(screen.getByText("Fashion · Acme")).toBeTruthy();
    expect(screen.getByText("1 images")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Cotton Shirt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Cotton Shirt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create variant for Cotton Shirt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit variant SHIRT-1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete variant SHIRT-1" })).toBeTruthy();
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

  it("shows category, brand, image metadata, and publish readiness in the product dialog", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Cotton Shirt" }));

    expect(screen.getByLabelText("Category")).toBeTruthy();
    expect(screen.getByLabelText("Brand")).toBeTruthy();
    expect(screen.getByText("Fashion")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("https://example.com/shirt.jpg")).toBeTruthy();
    expect(screen.getAllByText(/Primary/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Drafts can be saved without category/)).toBeTruthy();
  });

  it("creates image metadata and preserves values on failure", async () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Cotton Shirt" }));
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.com/new.jpg" } });
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "New product angle" } });
    fireEvent.change(screen.getByLabelText("Width pixels"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("Height pixels"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Add image metadata" }));

    expect(createImageMutate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prod_1", url: "https://example.com/new.jpg", altText: "New product angle", width: 1200, height: 900 }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );

    createImageMutate.mock.calls[0][1].onError(new Error("Image URL must be a valid URL or absolute path"));
    await waitFor(() => expect(screen.getByText("Image URL must be a valid URL or absolute path")).toBeTruthy());
    expect(screen.getByDisplayValue("https://example.com/new.jpg")).toBeTruthy();
  });

  it("shows active publish readiness feedback for missing listing requirements", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    fireEvent.click(screen.getAllByText("Active").at(-1)!);

    expect(screen.getByText(/Active products still need category, at least one image, an active priced variant/)).toBeTruthy();
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

  it("creates a variant and preserves form data when mutation fails", async () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create variant for Cotton Shirt" }));
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "SHIRT-2" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Medium" } });
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "15.50" } });
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "thb" } });
    fireEvent.change(screen.getByLabelText("Weight grams"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Length mm"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Width mm"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Height mm"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /save variant/i }));

    expect(createVariantMutate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prod_1", sku: "SHIRT-2", title: "Medium", price: 1550, currency: "THB", weightGrams: 300, lengthMm: 250, widthMm: 180, heightMm: 30 }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );

    const options = createVariantMutate.mock.calls[0][1];
    options.onError(new Error("SKU already exists"));

    await waitFor(() => expect(screen.getByText("SKU already exists")).toBeTruthy());
    expect(screen.getByDisplayValue("SHIRT-2")).toBeTruthy();
    expect(screen.getByDisplayValue("Medium")).toBeTruthy();
  });

  it("edits a variant and asks before discarding dirty changes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit variant SHIRT-1" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Small updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved variant changes?");
    expect(screen.getByDisplayValue("Small updated")).toBeTruthy();
  });

  it("requires explicit confirmation before deleting a variant", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete variant SHIRT-1" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete variant" }));

    expect(deleteVariantMutate).toHaveBeenCalledWith(
      { productId: "prod_1", variantId: "var_1" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});
