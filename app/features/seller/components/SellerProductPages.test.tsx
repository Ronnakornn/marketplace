/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SellerProductCreatePage, SellerProductEditPage, SellerProductsPage } from "./SellerProductPages";

const refetch = vi.fn();
const push = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const archiveMutate = vi.fn();
const createVariantMutate = vi.fn();
const updateVariantMutate = vi.fn();
const deleteVariantMutate = vi.fn();
const updateVariantStockMutate = vi.fn();
const uploadImageMutate = vi.fn();
const updateImageOrderMutate = vi.fn();
const updateImageMutate = vi.fn();
const deleteImageMutate = vi.fn();
const uploadVideoMutate = vi.fn();
const deleteVideoMutate = vi.fn();
const updateOptionsMutate = vi.fn();
const submitReviewMutate = vi.fn();

const products: Array<any> = [
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
    metaTitle: "",
    metaDescription: "",
    warrantyInfo: "",
    condition: "",
    countryOfOrigin: "",
    highlights: [{ text: "Soft cotton", sortOrder: 0 }],
    attributes: [{ attributeKey: "color", displayName: "Color", value: "Blue", isFilterable: true }],
    moderationCase: null,
    options: [
      {
        id: "opt_color",
        name: "Color",
        nameTh: null,
        nameEn: "Color",
        sortOrder: 0,
        values: [
          { id: "opt_value_blue", optionId: "opt_color", value: "Blue", valueTh: null, valueEn: "Blue", displayType: "TEXT", colorHex: "#0000ff", sortOrder: 0 },
        ],
      },
    ],
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
        status: "ACTIVE",
        weightGrams: 250,
        lengthMm: 300,
        widthMm: 200,
        heightMm: 20,
        inventory: { quantityOnHand: 10, quantityReserved: 2, reorderLevel: 1 },
        optionValues: [{ optionValueId: "opt_value_blue", optionValue: { id: "opt_value_blue", value: "Blue", option: { id: "opt_color", name: "Color" } } }],
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
    metaTitle: null,
    metaDescription: null,
    warrantyInfo: null,
    condition: null,
    countryOfOrigin: null,
    highlights: [],
    attributes: [],
    options: [],
    moderationCase: { actions: [{ action: "REJECT", note: "Missing image proof" }] },
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
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    SelectTrigger: ({ children, "aria-label": ariaLabel, id }: { children: ReactNode; "aria-label"?: string; id?: string }) => <span id={id} aria-label={ariaLabel}>{children}</span>,
    SelectValue: () => null,
  };
});

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; asChild?: boolean }) => (
    asChild && React.isValidElement(children) ? React.cloneElement(children, props) : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("#/components/ui/data-table", () => ({
  DataTable: ({ columns, data, renderToolbar, isLoading, loadingMessage, emptyMessage }: {
    columns: Array<{ id?: string; accessorKey?: string; cell?: (context: { row: { original: (typeof products)[number] } }) => ReactNode }>;
    data: typeof products;
    renderToolbar?: () => ReactNode;
    isLoading?: boolean;
    loadingMessage?: string;
    emptyMessage?: string;
  }) => (
    <div>
      <div>{renderToolbar?.()}</div>
      {isLoading ? <p>{loadingMessage}</p> : null}
      {!isLoading && !data.length ? <p>{emptyMessage}</p> : null}
      {data.map((row) => (
        <article key={row.id}>
          {columns.map((column) => (
            <div key={String(column.id ?? column.accessorKey)}>
              {column.cell ? column.cell({ row: { original: row } }) : String(row[column.accessorKey as keyof typeof row] ?? "")}
            </div>
          ))}
        </article>
      ))}
    </div>
  ),
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

vi.mock("../hooks/useSellerManage", () => ({
  useSellerProducts: vi.fn(() => ({
    ...sellerProductsState,
    refetch,
  })),
  useSellerProduct: vi.fn((productId?: string) => ({
    data: productId ? (sellerProductsState.data?.data ?? products).find((product) => product.id === productId) : undefined,
    error: sellerProductsState.error,
    isLoading: sellerProductsState.isLoading,
    refetch,
  })),
  useSellerCategories: vi.fn(() => ({ data: [{ id: "cat_1", name: "Fashion", slug: "fashion", sortOrder: 0 }], isLoading: false })),
  useSellerBrands: vi.fn(() => ({ data: [{ id: "brand_1", name: "Acme", slug: "acme", code: "ACME", isActive: true }], isLoading: false })),
  useCreateSellerProduct: vi.fn(() => ({ mutate: createMutate, isPending: false })),
  useUpdateSellerProduct: vi.fn(() => ({ mutate: updateMutate, isPending: false })),
  useArchiveSellerProduct: vi.fn(() => ({ mutate: archiveMutate, isPending: false })),
  useCreateSellerVariant: vi.fn(() => ({ mutate: createVariantMutate, isPending: false })),
  useUpdateSellerVariant: vi.fn(() => ({ mutate: updateVariantMutate, isPending: false })),
  useDeleteSellerVariant: vi.fn(() => ({ mutate: deleteVariantMutate, isPending: false })),
  useUpdateSellerVariantStock: vi.fn(() => ({ mutate: updateVariantStockMutate, isPending: false })),
  useUploadAndCreateSellerProductImage: vi.fn(() => ({ mutate: uploadImageMutate, isPending: false })),
  useUpdateSellerProductImagesOrder: vi.fn(() => ({ mutate: updateImageOrderMutate, isPending: false })),
  useUpdateSellerProductImage: vi.fn(() => ({ mutate: updateImageMutate, isPending: false })),
  useDeleteSellerProductImage: vi.fn(() => ({ mutate: deleteImageMutate, isPending: false })),
  useUploadAndUpsertSellerProductVideo: vi.fn(() => ({ mutate: uploadVideoMutate, isPending: false })),
  useDeleteSellerProductVideo: vi.fn(() => ({ mutate: deleteVideoMutate, isPending: false })),
  useUpdateSellerProductOptions: vi.fn(() => ({ mutate: updateOptionsMutate, isPending: false })),
  useSubmitSellerProductReview: vi.fn(() => ({ mutate: submitReviewMutate, isPending: false })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sellerProductsState = { data: { data: products, meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
});

describe("Seller product pages", () => {
  it("renders product list controls and links to create and edit pages", () => {
    render(<SellerProductsPage />);

    expect(screen.getAllByText("Cotton Shirt").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Search products")).toBeTruthy();
    expect(screen.getByLabelText("Filter by product status")).toBeTruthy();
    expect(screen.getByRole("link", { name: /create product/i }).getAttribute("href")).toBe("/seller/products/new");
    expect(screen.getByRole("link", { name: "Edit Cotton Shirt" }).getAttribute("href")).toBe("/seller/products/prod_1");
  });

  it("requires archive confirmation before calling archive mutation", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive Cotton Shirt" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive product" }));

    expect(archiveMutate).toHaveBeenCalledWith("prod_1", expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("renders create form shell with key mobile-friendly page sections", () => {
    render(<SellerProductCreatePage />);

    expect(screen.getByRole("heading", { name: "Create product" })).toBeTruthy();
    for (const section of ["Basic info", "Category and specs", "Localized content", "Highlights and attributes", "Media", "Variant matrix", "Variants"]) {
      if (["Stock", "Dimensions"].includes(section)) continue;
      expect(screen.getByRole("heading", { name: section })).toBeTruthy();
    }
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.getByText("Save this product as a draft before uploading media.")).toBeTruthy();
    expect(screen.getByText("Save this product as a draft before adding variants.")).toBeTruthy();
  });

  it("creates a product from the page form and preserves values until mutation success", () => {
    render(<SellerProductCreatePage />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Product" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-product" } });
    fireEvent.click(screen.getByRole("button", { name: /save product/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Product", slug: "new-product", status: "DRAFT" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByDisplayValue("New Product")).toBeTruthy();
  });

  it("asks before discarding dirty create form changes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SellerProductCreatePage />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved product changes?");
    expect(push).not.toHaveBeenCalled();
  });

  it("renders edit form data and page-level retry state", async () => {
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getByRole("heading", { name: "Edit product" })).toBeTruthy();
    expect(screen.getAllByDisplayValue("Cotton Shirt").length).toBeGreaterThan(0);
    expect(screen.getByText("1/10 images. Video limit: one MP4 or WebM up to 25MB.")).toBeTruthy();

    cleanup();
    sellerProductsState = { data: undefined, error: new Error("Load failed"), isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getByText("Load failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("prevents adding more than ten images before upload", () => {
    const fullImageProduct = { ...products[0], images: Array.from({ length: 10 }, (_, index) => ({ ...products[0].images[0], id: `img_${index}`, sortOrder: index })) };
    sellerProductsState = { data: { data: [fullImageProduct], meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText("Upload product images"), { target: { files: [new File(["x"], "extra.png", { type: "image/png" })] } });

    expect(screen.getByText("Product images are limited to 10. Remove an image before adding more.")).toBeTruthy();
    expect(uploadImageMutate).not.toHaveBeenCalled();
  });

  it("validates one product video with visible MIME and size feedback", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText("Upload product video"), { target: { files: [new File(["x"], "clip.mov", { type: "video/quicktime" })] } });
    expect(screen.getByText("Product video must be MP4 or WebM.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Upload product video"), { target: { files: [new File([new Uint8Array(26 * 1024 * 1024)], "clip.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("Product video must be 25MB or smaller.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Upload product video"), { target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("clip.mp4")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Upload product video"), { target: { files: [new File(["x"], "second.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("Only one product video can be attached. Remove the current video before uploading another.")).toBeTruthy();
  });

  it("shows media upload errors and allows retry without clearing image form state", () => {
    uploadImageMutate.mockImplementation((_input, options) => options.onError(new Error("Upload failed")));
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText("Upload product images"), { target: { files: [new File(["x"], "front.png", { type: "image/png" })] } });
    fireEvent.change(screen.getAllByLabelText("Alt text").at(-1)!, { target: { value: "Front preview" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save image" }).at(-1)!);

    expect(screen.getByText("Upload failed")).toBeTruthy();
    expect(screen.getByDisplayValue("Front preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("creates, edits, and deletes variants with stock fields limited to allowed values", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    updateVariantMutate.mockImplementation((_input, options) => options.onSuccess());
    createVariantMutate.mockImplementation((_input, options) => options.onSuccess({ id: "var_new" }));
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText("Quantity on hand"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Reorder level"), { target: { value: "3" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save variant" })[0]);

    expect(updateVariantMutate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prod_1", variantId: "var_1", sku: "SHIRT-1", price: 1299 }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(updateVariantStockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prod_1", variantId: "var_1", quantityOnHand: 14, reorderLevel: 3 }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(updateVariantStockMutate.mock.calls[0][0]).not.toHaveProperty("quantityReserved");

    fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
    fireEvent.change(screen.getByLabelText("SKU", { selector: "#variant-sku-1" }), { target: { value: "SHIRT-2" } });
    fireEvent.change(screen.getByLabelText("Variant title", { selector: "#variant-title-1" }), { target: { value: "Medium" } });
    fireEvent.change(screen.getByLabelText("Price", { selector: "#variant-price-1" }), { target: { value: "15.50" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save variant" })[1]);

    expect(createVariantMutate).toHaveBeenCalledWith(expect.objectContaining({ productId: "prod_1", sku: "SHIRT-2", price: 1550 }), expect.any(Object));

    fireEvent.click(screen.getAllByRole("button", { name: "Delete variant" })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(deleteVariantMutate).toHaveBeenCalledWith({ productId: "prod_1", variantId: "var_1" }, expect.any(Object));
  });

  it("blocks active save with publish readiness messaging while preserving form state", () => {
    render(<SellerProductCreatePage />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Almost Active" } });
    fireEvent.click(screen.getByText("Active"));
    fireEvent.click(screen.getByRole("button", { name: /save product/i }));

    expect(screen.getByText("Active products need category, at least one product image, one active variant with price greater than zero before publishing.")).toBeTruthy();
    expect(screen.getByDisplayValue("Almost Active")).toBeTruthy();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("preserves product form values after mutation failure", () => {
    createMutate.mockImplementation((_input, options) => options.onError(new Error("Save failed")));
    render(<SellerProductCreatePage />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Retry Product" } });
    fireEvent.click(screen.getByRole("button", { name: /save product/i }));

    expect(screen.getByText("Save failed")).toBeTruthy();
    expect(screen.getByDisplayValue("Retry Product")).toBeTruthy();
  });

  it("submits a ready draft for review and shows moderation rejection reasons", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(submitReviewMutate).toHaveBeenCalledWith("prod_1", expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));

    cleanup();
    render(<SellerProductEditPage productId="prod_2" />);
    expect(screen.getByText("Reason: Missing image proof")).toBeTruthy();
  });

  it("blocks submit review when variant option combinations are duplicated", () => {
    const duplicateProduct = {
      ...products[0],
      variants: [
        products[0].variants[0],
        { ...products[0].variants[0], id: "var_2", sku: "SHIRT-2" },
      ],
    };
    sellerProductsState = { data: { data: [duplicateProduct], meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getAllByText("Duplicate variant option combination. Choose a unique option value set for each variant.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /submit for review/i }).hasAttribute("disabled")).toBe(true);
  });
});
