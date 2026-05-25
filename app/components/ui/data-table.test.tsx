/**
 * @vitest-environment jsdom
 */
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type * as React from "react";

import { DataTable } from "./data-table";

vi.mock("#/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({
    children,
    ...props
  }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => (
    <td {...props}>{children}</td>
  ),
  TableHead: ({
    children,
    ...props
  }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => (
    <th {...props}>{children}</th>
  ),
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => (
    <tr {...props}>{children}</tr>
  ),
}));

interface TestRow {
  name: string;
  status: string;
}

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => row.original.status,
  },
];

afterEach(() => {
  cleanup();
});

describe("DataTable", () => {
  it("renders rows from caller-owned data and columns", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "DRAFT" },
        ]}
      />,
    );

    expect(screen.getByText("Alpha Product")).toBeTruthy();
    expect(screen.getByText("Beta Product")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("DRAFT")).toBeTruthy();
  });

  it("renders the empty state when no rows are available", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No products found."
      />,
    );

    expect(screen.getByText("No products found.")).toBeTruthy();
  });

  it("supports pagination and default string-header sorting", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Charlie Product", status: "DRAFT" },
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "ARCHIVED" },
        ]}
        pageSize={1}
      />,
    );

    expect(screen.getByText("Charlie Product")).toBeTruthy();
    expect(screen.queryByText("Alpha Product")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

    expect(screen.getByText("Alpha Product")).toBeTruthy();
    expect(screen.queryByText("Charlie Product")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Beta Product")).toBeTruthy();
    expect(screen.queryByText("Alpha Product")).toBeNull();
  });
});
