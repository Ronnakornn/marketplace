/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCategorySpecsManager } from "./AdminCategorySpecsManager";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      { id: "cat_1", name: "Fashion", slug: "fashion", sortOrder: 1 },
      { id: "cat_2", name: "Electronics", slug: "electronics", sortOrder: 2 },
    ],
    isLoading: false,
    error: null,
  }),
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

vi.mock("#/features/product/queries", () => ({
  normalizePublicCategories: (items: unknown) => items,
  publicCategoriesQueryOptions: () => ({ queryKey: ["categories"], queryFn: vi.fn() }),
}));

afterEach(() => cleanup());

describe("AdminCategorySpecsManager", () => {
  it("renders active categories and keeps mutation controls disabled when APIs are unavailable", () => {
    render(<AdminCategorySpecsManager />);

    expect(screen.getAllByText("Fashion").length).toBeGreaterThan(0);
    expect(screen.getByText("Electronics")).toBeTruthy();
    expect(screen.getByText(/mutation APIs are not mounted yet/i)).toBeTruthy();

    expect(screen.getByLabelText("Category name")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Parent category")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Spec name")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /add spec/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /save draft/i })).toHaveProperty("disabled", true);
  });
});
