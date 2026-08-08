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
const answerQuestionMutate = vi.fn();

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

const categorySpecDefinitions = [
  { id: "spec_color", attributeKey: "color", displayName: "Color", valueType: "TEXT", isRequired: true, isFilterable: true, allowedValues: ["Blue", "Black"], sortOrder: 0 },
  { id: "spec_weight", attributeKey: "weight", displayName: "Weight", valueType: "NUMBER", unit: "kg", isRequired: false, isFilterable: true, allowedValues: null, sortOrder: 1 },
  { id: "spec_fragile", attributeKey: "fragile", displayName: "Fragile", valueType: "BOOLEAN", isRequired: false, isFilterable: true, allowedValues: null, sortOrder: 2 },
  { id: "spec_material", attributeKey: "material", displayName: "Material", valueType: "MULTI_SELECT", isRequired: false, isFilterable: true, allowedValues: null, sortOrder: 3 },
];

let sellerCategories: Array<any> = [
  {
    id: "cat_1",
    name: "Fashion",
    slug: "fashion",
    sortOrder: 0,
    attributeDefinitions: categorySpecDefinitions,
  },
];

let sellerCategorySpecsById: Record<string, Array<any> | undefined> = {
  cat_1: undefined,
};

let sellerQuestionsByProductId: Record<string, Array<any>> = {};
let sellerQuestionPending = false;
let sellerQuestionSuccess = false;
let sellerQuestionError: Error | null = null;

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("#/i18n/client", async () => {
  const { default: messages } = await import("../../../../messages/en.json");
  return {
    useLocale: () => "en",
    useTranslations: () => (key: string) => {
      const value = key.split(".").reduce<unknown>((current, part) => {
        if (!current || typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[part];
      }, messages);
      return typeof value === "string" ? value : key;
    },
  };
});

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
  useSellerProductQuestions: vi.fn((productId?: string) => ({
    data: productId ? sellerQuestionsByProductId[productId] ?? [] : [],
    error: null,
    isLoading: false,
    refetch,
  })),
  useSellerCategories: vi.fn(() => ({
    data: sellerCategories,
    isLoading: false,
  })),
  useSellerCategorySpecs: vi.fn((categoryId?: string | null) => ({
    data: categoryId ? sellerCategorySpecsById[categoryId] : undefined,
    isLoading: false,
  })),
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
  useAnswerSellerProductQuestion: vi.fn(() => ({
    mutate: answerQuestionMutate,
    isPending: sellerQuestionPending,
    isSuccess: sellerQuestionSuccess,
    error: sellerQuestionError,
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sellerProductsState = { data: { data: products, meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
  sellerCategories = [{ id: "cat_1", name: "Fashion", slug: "fashion", sortOrder: 0, attributeDefinitions: categorySpecDefinitions }];
  sellerCategorySpecsById = { cat_1: undefined };
  sellerQuestionsByProductId = {};
  sellerQuestionPending = false;
  sellerQuestionSuccess = false;
  sellerQuestionError = null;
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

  it("renders unanswered product questions and submits seller answers", () => {
    sellerProductsState = {
      data: {
        data: [{ ...products[0], status: "ACTIVE" }],
        meta: { nextCursor: null, hasNextPage: false },
      },
      error: null,
      isLoading: false,
    };
    sellerQuestionsByProductId = {
      prod_1: [{
        id: "question-1",
        productId: "prod_1",
        shopId: "shop_1",
        question: "Does this ship with a box?",
        status: "PUBLISHED",
        createdAt: "2026-01-04T00:00:00.000Z",
        user: { id: "buyer-1", name: "Jane Buyer" },
        answers: [],
      }],
    };

    render(<SellerProductsPage />);

    expect(screen.getByText("Product questions")).toBeTruthy();
    expect(screen.getByText("Does this ship with a box?")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Answer question from Jane Buyer"), { target: { value: "Yes, retail box is included." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(answerQuestionMutate).toHaveBeenCalledWith(
      { productId: "prod_1", questionId: "question-1", answer: "Yes, retail box is included." },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("shows seller answer submission state", () => {
    sellerProductsState = {
      data: {
        data: [{ ...products[0], status: "ACTIVE" }],
        meta: { nextCursor: null, hasNextPage: false },
      },
      error: null,
      isLoading: false,
    };
    sellerQuestionsByProductId = {
      prod_1: [{
        id: "question-1",
        productId: "prod_1",
        shopId: "shop_1",
        question: "Is the fabric pre-shrunk?",
        status: "PUBLISHED",
        createdAt: "2026-01-04T00:00:00.000Z",
        user: { id: "buyer-1", name: "Jane Buyer" },
        answers: [],
      }],
    };
    sellerQuestionPending = true;

    render(<SellerProductsPage />);

    expect(screen.getByRole("button", { name: "Submitting..." })).toHaveProperty("disabled", true);
  });

  it("requires archive confirmation before calling archive mutation", () => {
    render(<SellerProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive Cotton Shirt" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive product" }));

    expect(archiveMutate).toHaveBeenCalledWith("prod_1", expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("prepares a draft from the new product route before opening Product Studio", () => {
    render(<SellerProductCreatePage />);

    expect(screen.getByRole("heading", { name: "Create product" })).toBeTruthy();
    expect(screen.getByText("Draft preparation")).toBeTruthy();
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Untitled product draft", status: "DRAFT" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("redirects to Product Studio after draft creation succeeds", () => {
    createMutate.mockImplementation((_input, options) => options.onSuccess({ id: "prod_new" }));
    render(<SellerProductCreatePage />);

    expect(push).toHaveBeenCalledWith("/seller/products/prod_new");
  });

  it("renders edit form data and page-level retry state", async () => {
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getByRole("heading", { name: "Product Studio" })).toBeTruthy();
    expect(screen.getAllByDisplayValue("Cotton Shirt").length).toBeGreaterThan(0);
    expect(screen.getByText("1/10 images. Video limit: one MP4 or WebM up to 25MB.")).toBeTruthy();
    for (const section of ["Basics", "Category & Specs", "Media", "Variants", "Inventory", "Review"]) {
      expect(screen.getByRole("link", { name: section })).toBeTruthy();
      expect(screen.getByRole("heading", { name: section })).toBeTruthy();
    }

    cleanup();
    sellerProductsState = { data: undefined, error: new Error("Load failed"), isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getByText("Load failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("shows required and optional category specs with inline readiness validation", () => {
    const missingSpecProduct = {
      ...products[0],
      attributes: [],
    };
    sellerProductsState = { data: { data: [missingSpecProduct], meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getByText("Required specs")).toBeTruthy();
    expect(screen.getByText("Optional specs")).toBeTruthy();
    expect(screen.getByText("Color is required.")).toBeTruthy();
    expect(screen.getByText(/Missing: required specs: Color/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /submit for review/i }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText(/Color/), { target: { value: "Blue" } });
    expect(screen.queryByText("Color is required.")).toBeNull();
    expect(screen.getByRole("button", { name: /submit for review/i }).hasAttribute("disabled")).toBe(false);
  });

  it("renders number, boolean, and multi-select category specs with helper text", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    const weight = screen.getByLabelText(/^Weight \(kg\)$/);
    expect((weight as HTMLInputElement).type).toBe("number");
    expect(screen.getByText("Enter a numeric value in kg.")).toBeTruthy();

    expect(screen.getByText("Choose true or false.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(screen.getByText("Enter one or more values separated by commas.")).toBeTruthy();
    expect(screen.getByLabelText("Material")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("renders category specs fetched from the category specs endpoint", () => {
    sellerCategories = [{ id: "cat_1", name: "Fashion", slug: "fashion", sortOrder: 0 }];
    sellerCategorySpecsById = { cat_1: categorySpecDefinitions };

    render(<SellerProductEditPage productId="prod_1" />);

    const weight = screen.getByLabelText(/^Weight \(kg\)$/);
    expect((weight as HTMLInputElement).type).toBe("number");
    expect(screen.getByText("Choose true or false.")).toBeTruthy();
    expect(screen.getByLabelText("Material")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("keeps category spec attributes in the save payload while additional specs stay free-form", () => {
    updateMutate.mockImplementation((_input, options) => options.onSuccess(products[0]));
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText(/^Weight \(kg\)$/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "False" }));
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "cotton, linen" } });
    fireEvent.change(screen.getByLabelText("Additional specifications"), { target: { value: "care|Care instructions|Machine wash cold" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_1",
        attributes: expect.arrayContaining([
          expect.objectContaining({ attributeKey: "color", displayName: "Color", value: "Blue", isFilterable: true }),
          expect.objectContaining({ attributeKey: "weight", displayName: "Weight", value: "1.5", isFilterable: true }),
          expect.objectContaining({ attributeKey: "fragile", displayName: "Fragile", value: "false", isFilterable: true }),
          expect.objectContaining({ attributeKey: "material", displayName: "Material", value: "cotton, linen", isFilterable: true }),
          expect.objectContaining({ attributeKey: "care", displayName: "Care instructions", value: "Machine wash cold" }),
        ]),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
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
    expect(screen.getByText("Product video must be 25 MB or smaller.")).toBeTruthy();

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

  it("keeps exactly one primary image while reordering and removing media", () => {
    const multiImageProduct = {
      ...products[0],
      images: [
        products[0].images[0],
        { ...products[0].images[0], id: "img_2", url: "https://example.com/back.jpg", altText: "Cotton shirt back", sortOrder: 1, isPrimary: false },
      ],
    };
    sellerProductsState = { data: { data: [multiImageProduct], meta: { nextCursor: null, hasNextPage: false } }, error: null, isLoading: false };
    render(<SellerProductEditPage productId="prod_1" />);

    const primaryInputs = screen.getAllByRole("radio", { name: /primary/i });
    expect(primaryInputs.filter((input) => (input as HTMLInputElement).checked)).toHaveLength(1);

    fireEvent.click(primaryInputs[1]);
    expect(primaryInputs.filter((input) => (input as HTMLInputElement).checked)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Move image 2 up" }));
    expect(updateImageOrderMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save image order" }));
    expect(updateImageOrderMutate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prod_1", primaryImageId: "img_2" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("edits variant stock with fields limited to allowed values", () => {
    updateVariantMutate.mockImplementation((_input, options) => options.onSuccess());
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
  });

  it("creates variants", () => {
    createVariantMutate.mockImplementation((_input, options) => options.onSuccess({ id: "var_new" }));
    render(<SellerProductEditPage productId="prod_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
    fireEvent.change(screen.getByLabelText("SKU", { selector: "#variant-sku-1" }), { target: { value: "SHIRT-2" } });
    fireEvent.change(screen.getByLabelText("Variant title", { selector: "#variant-title-1" }), { target: { value: "Medium" } });
    fireEvent.change(screen.getByLabelText("Price", { selector: "#variant-price-1" }), { target: { value: "15.50" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save variant" })[1]);

    expect(createVariantMutate).toHaveBeenCalledWith(expect.objectContaining({ productId: "prod_1", sku: "SHIRT-2", price: 1550 }), expect.any(Object));
  });

  it("deletes variants after confirmation", () => {
    render(<SellerProductEditPage productId="prod_1" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete variant" })[0]);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete variant" }).at(-1)!);
    expect(deleteVariantMutate).toHaveBeenCalledWith({ productId: "prod_1", variantId: "var_1" }, expect.any(Object));
  });

  it("shows inventory as derived stock state with reserved quantity read-only and movement access", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    expect(screen.getAllByText("On hand").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reserved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getByText("On hand minus reserved")).toBeTruthy();
    expect((screen.getByLabelText("Quantity reserved") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("link", { name: "Movement history" }).getAttribute("href")).toBe("/seller/inventory?variantId=var_1");
  });

  it("generates variant rows, applies bulk values, and shows duplicate SKU errors inline", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate rows" }));
    expect(screen.getAllByText("Color: Blue").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
    fireEvent.change(screen.getByLabelText("SKU", { selector: "#variant-sku-1" }), { target: { value: "SHIRT-1" } });
    expect(screen.getAllByText("Duplicate SKU.").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Bulk price"), { target: { value: "22.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));
    expect(screen.getAllByDisplayValue("22.25").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Bulk stock"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply stock" }));
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Inactive" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "Apply status" }));
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  }, 10_000);

  it("limits options to two axes and confirms removal when variants are affected", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    expect(screen.getByRole("button", { name: "Add option" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/1 affected variant row/)).toBeTruthy();
    expect(screen.getAllByDisplayValue("Blue").length).toBeGreaterThan(0);
  }, 10_000);

  it("shows retry when draft preparation fails", () => {
    createMutate.mockImplementation((_input, options) => options.onError(new Error("Save failed")));
    render(<SellerProductCreatePage />);

    expect(screen.getByText("Save failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
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

  it("warns before unloading when any studio field has unsaved changes", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "Unsaved image description" } });
    const event = new Event("beforeunload", { cancelable: true });

    expect(window.dispatchEvent(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByText("Save state: Unsaved changes")).toBeTruthy();
  });

  it("exposes accessible status, errors, media dimensions, and form semantics", () => {
    render(<SellerProductEditPage productId="prod_1" />);

    const form = document.getElementById("seller-product-studio-form") as HTMLFormElement;
    const title = screen.getByLabelText("Title") as HTMLInputElement;
    const preview = screen.getByAltText("Cotton shirt front") as HTMLImageElement;
    const saveState = screen.getByText("Save state: Saved");

    expect(form.getAttribute("autocomplete")).toBe("off");
    expect(title.name).toBe("title");
    expect((screen.getByLabelText("Bulk price") as HTMLInputElement).name).toBe("bulkPrice");
    expect(screen.getByLabelText("Bulk price").className).toContain("tabular-nums");
    expect(preview.getAttribute("width")).toBe("800");
    expect(preview.getAttribute("height")).toBe("600");
    expect(preview.getAttribute("loading")).toBe("lazy");
    expect(saveState.getAttribute("aria-live")).toBe("polite");

    fireEvent.change(title, { target: { value: "" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert").textContent).toBe("Product title is required.");
    expect(document.activeElement).toBe(title);
  });
});
