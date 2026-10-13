/**
 * @vitest-environment jsdom
 */
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { DataTable } from "./data-table";

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

    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(
      ["Alpha Product", "ACTIVE", "Beta Product", "DRAFT"],
    );
  });

  it("renders the empty state when no rows are available", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No products found."
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("No products found.");
    expect(screen.getByText("Showing 0 of 0 row(s)").textContent).toBe(
      "Showing 0 of 0 row(s)",
    );
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

    expect(screen.getByText("Charlie Product").textContent).toBe(
      "Charlie Product",
    );
    expect(screen.queryByText("Alpha Product")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

    expect(screen.getByText("Alpha Product").textContent).toBe("Alpha Product");
    expect(
      screen
        .getByRole("columnheader", { name: "Name" })
        .getAttribute("aria-sort"),
    ).toBe("ascending");
    expect(screen.queryByText("Charlie Product")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Beta Product").textContent).toBe("Beta Product");
    expect(screen.queryByText("Alpha Product")).toBeNull();
  });

  it("resets client paging when searching and clearing a search", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Charlie Product", status: "DRAFT" },
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "ARCHIVED" },
        ]}
        pageSize={1}
        searchable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Alpha Product").textContent).toBe("Alpha Product");

    fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), {
      target: { value: "beta" },
    });
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(
      ["Beta Product", "ARCHIVED"],
    );
    expect(screen.getByText("Showing 1 of 1 row(s)").textContent).toBe(
      "Showing 1 of 1 row(s)",
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(
      ["Charlie Product", "DRAFT"],
    );
    expect(screen.getByText("Showing 1 of 3 row(s)").textContent).toBe(
      "Showing 1 of 3 row(s)",
    );
  });

  it("changes client page size and returns to the first page", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Charlie Product", status: "DRAFT" },
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "ARCHIVED" },
        ]}
        pageSize={1}
        pageSizeOptions={[1, 2, 10]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));
    expect(screen.getByText("Beta Product").textContent).toBe("Beta Product");

    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "2" },
    });
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(
      ["Charlie Product", "DRAFT", "Alpha Product", "ACTIVE"],
    );
    expect(screen.getByText("Showing 1-2 of 3 row(s)").textContent).toBe(
      "Showing 1-2 of 3 row(s)",
    );
    expect(
      screen
        .getByRole("button", { name: "First page" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("toggles column visibility using localized labels and keeps a column visible", async () => {
    render(
      <DataTable
        columns={columns}
        data={[{ name: "Alpha Product", status: "ACTIVE" }]}
        columnVisibilityEnabled
        columnLabels={{ name: "Product title", status: "Current status" }}
        labels={{ columns: "Choose columns" }}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Choose columns" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Current status" }),
    );

    expect(
      within(screen.getByRole("table", { hidden: true }))
        .getAllByRole("cell", { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(["Alpha Product"]);
    expect(
      screen
        .getByRole("menuitemcheckbox", { name: "Product title" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Current status" }),
    );
    expect(
      within(screen.getByRole("table", { hidden: true }))
        .getAllByRole("cell", { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(["Alpha Product", "ACTIVE"]);
  });

  it("renders a complete server page and requests controlled remote page changes", () => {
    const onPageChange = vi.fn<(page: PaginationState) => void>();
    const remoteRows = Array.from({ length: 20 }, (_, index) => ({
      name: `Remote product ${index + 41}`,
      status: "ACTIVE",
    }));

    function RemoteTable() {
      const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 2,
        pageSize: 20,
      });
      return (
        <DataTable
          columns={columns}
          data={remoteRows}
          searchable
          pagination={{
            ...pagination,
            totalRows: 120,
            onPaginationChange: (updater) => {
              const next =
                typeof updater === "function" ? updater(pagination) : updater;
              onPageChange(next);
              setPagination(next);
            },
          }}
        />
      );
    }

    render(<RemoteTable />);
    expect(screen.getAllByRole("cell")).toHaveLength(40);
    expect(screen.getByText("Remote product 41").textContent).toBe(
      "Remote product 41",
    );
    expect(screen.getByText("Remote product 60").textContent).toBe(
      "Remote product 60",
    );
    expect(screen.getByText("Showing 41-60 of 120 row(s)").textContent).toBe(
      "Showing 41-60 of 120 row(s)",
    );
    expect(screen.queryByRole("button", { name: "Sort by Name" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Search rows" })).toBeNull();
    expect(
      screen.queryByRole("combobox", { name: "Rows per page" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith({
      pageIndex: 3,
      pageSize: 20,
    });
    expect(screen.getAllByRole("cell")).toHaveLength(40);
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));
    expect(onPageChange).toHaveBeenLastCalledWith({
      pageIndex: 5,
      pageSize: 20,
    });
    expect(
      screen
        .getByRole("button", { name: "Next page" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(onPageChange).toHaveBeenLastCalledWith({
      pageIndex: 0,
      pageSize: 20,
    });
  });

  it("keeps all supplied rows when the caller retains an external pager", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "DRAFT" },
          { name: "Charlie Product", status: "DRAFT" },
        ]}
        hidePagination
        pagination={{
          pageIndex: 3,
          pageSize: 2,
          totalRows: 100,
          onPaginationChange: vi.fn(),
        }}
      />,
    );

    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(
      [
        "Alpha Product",
        "ACTIVE",
        "Beta Product",
        "DRAFT",
        "Charlie Product",
        "DRAFT",
      ],
    );
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("requests a page-size change only when the remote caller supplies allowed sizes", () => {
    const changedPage = vi.fn<(page: PaginationState) => void>();
    const pagination = { pageIndex: 2, pageSize: 20 };
    render(
      <DataTable
        columns={columns}
        data={[{ name: "Remote product", status: "ACTIVE" }]}
        pageSizeOptions={[10, 20, 50]}
        pagination={{
          ...pagination,
          totalRows: 100,
          onPaginationChange: (updater) =>
            changedPage(
              typeof updater === "function" ? updater(pagination) : updater,
            ),
        }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "50" },
    });
    expect(changedPage).toHaveBeenLastCalledWith({
      pageIndex: 0,
      pageSize: 50,
    });
    expect(screen.getByText("Remote product").textContent).toBe(
      "Remote product",
    );
  });

  it("gives cells the stable row identifier supplied by their caller", () => {
    const identifierColumns: ColumnDef<TestRow>[] = [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => `${row.id} / ${row.original.name}`,
      },
    ];
    render(
      <DataTable
        columns={identifierColumns}
        data={[{ name: "Alpha", status: "ACTIVE" }]}
        getRowId={(row) => `product-${row.name}`}
      />,
    );
    expect(screen.getByRole("cell").textContent).toBe("product-Alpha / Alpha");
  });

  it("announces loading and prevents paging while rows are being fetched", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Alpha Product", status: "ACTIVE" },
          { name: "Beta Product", status: "DRAFT" },
        ]}
        pageSize={1}
        isLoading
        loadingMessage="Loading products"
        pageSizeOptions={[1, 2]}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Loading products");
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Next page" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("combobox", { name: "Rows per page" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByText("Alpha Product")).toBeNull();
  });
});
