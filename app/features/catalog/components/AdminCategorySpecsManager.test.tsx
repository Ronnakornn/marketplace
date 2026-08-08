/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../messages/en.json";
import { I18nProvider } from "#/i18n/client";
import { AdminCategorySpecsManager } from "./AdminCategorySpecsManager";

function renderPage() {
  return render(<I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}><AdminCategorySpecsManager /></I18nProvider>);
}

const mutateAsync = vi.fn();
const updateCategory = vi.fn();
const setCategoryActive = vi.fn();
const createSpec = vi.fn();
const updateSpec = vi.fn();
const setSpecActive = vi.fn();
let adminCategorySpecsError: unknown = null;

const categories = [
  { id: "cat_1", parentId: null, name: "Fashion", nameTh: null, nameEn: "Fashion", slug: "fashion", sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "cat_2", parentId: null, name: "Electronics", nameTh: null, nameEn: "Electronics", slug: "electronics", sortOrder: 2, isActive: false, createdAt: new Date(), updatedAt: new Date() },
];

const specs = [
  { id: "spec_1", categoryId: "cat_1", attributeKey: "color", displayName: "Color", displayNameTh: null, displayNameEn: "Color", valueType: "TEXT", isRequired: true, isFilterable: true, unit: null, allowedValues: null, sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "spec_2", categoryId: "cat_1", attributeKey: "material", displayName: "Material", displayNameTh: null, displayNameEn: "Material", valueType: "TEXT", isRequired: false, isFilterable: false, unit: null, allowedValues: null, sortOrder: 2, isActive: false, createdAt: new Date(), updatedAt: new Date() },
];

function mutation(fn = mutateAsync) {
  return { mutateAsync: fn, isPending: false };
}

vi.mock("../hooks/useCatalog", () => ({
  useAdminCategories: () => ({ data: categories, isLoading: false, error: null }),
  useAdminCategorySpecs: () => ({ data: specs, isLoading: false, error: adminCategorySpecsError }),
  useCreateAdminCategory: () => mutation(mutateAsync),
  useUpdateAdminCategory: () => mutation(updateCategory),
  useSetAdminCategoryActive: () => mutation(setCategoryActive),
  useReorderAdminCategories: () => mutation(mutateAsync),
  useCreateAdminCategorySpec: () => mutation(createSpec),
  useUpdateAdminCategorySpec: () => mutation(updateSpec),
  useSetAdminCategorySpecActive: () => mutation(setSpecActive),
  useReorderAdminCategorySpecs: () => mutation(mutateAsync),
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("#/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) => <label {...props}>{children}</label>,
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => <tr {...props}>{children}</tr>,
}));

beforeEach(() => {
  adminCategorySpecsError = null;
  mutateAsync.mockResolvedValue({});
  updateCategory.mockResolvedValue(categories[0]);
  setCategoryActive.mockResolvedValue({ ...categories[1], isActive: true });
  createSpec.mockResolvedValue(specs[0]);
  updateSpec.mockResolvedValue(specs[0]);
  setSpecActive.mockResolvedValue({ ...specs[1], isActive: true });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminCategorySpecsManager", () => {
  it("renders admin categories, inactive states, and editable mutation controls", () => {
    renderPage();

    expect(screen.getAllByText("Fashion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Electronics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Category name")).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: /save category/i })).toHaveProperty("disabled", false);
    expect(screen.queryByText(/mutation APIs are not mounted/i)).toBeNull();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("normalizes object-shaped spec query errors instead of rendering object strings", () => {
    adminCategorySpecsError = {
      value: {
        error: {
          code: "NOT_FOUND",
          message: { detail: "Category specs endpoint failed" },
        },
      },
    };

    renderPage();

    expect(screen.queryByText("[object Object]")).toBeNull();
    expect(screen.getByText(/Category specs endpoint failed/i)).toBeTruthy();
  });

  it("submits category updates and active state changes", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Fashion Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save category/i }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith(expect.objectContaining({ id: "cat_1", name: "Fashion Updated" })));

    fireEvent.click(screen.getAllByRole("button", { name: /reactivate/i })[0]);
    await waitFor(() => expect(setCategoryActive).toHaveBeenCalledWith({ id: "cat_2", isActive: true }));
  });

  it("edits specs and deactivates inactive-aware spec rows", async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Color family" } });
    fireEvent.click(screen.getByRole("button", { name: /save spec/i }));

    await waitFor(() => expect(updateSpec).toHaveBeenCalledWith(expect.objectContaining({ id: "spec_1", categoryId: "cat_1", displayName: "Color family" })));

    fireEvent.click(screen.getAllByRole("button", { name: /reactivate/i })[1]);
    await waitFor(() => expect(setSpecActive).toHaveBeenCalledWith({ categoryId: "cat_1", id: "spec_2", isActive: true }));
  });
});
