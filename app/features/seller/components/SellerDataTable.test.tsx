/**
 * @vitest-environment jsdom
 */
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerDataTable } from "./SellerDataTable";

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => ({
    "seller.ui.table.search": "ค้นหารายการ",
    "seller.ui.table.searchPlaceholder": "ค้นหารายการ...",
    "seller.ui.table.clearSearch": "ล้างการค้นหา",
    "seller.ui.table.columns": "คอลัมน์",
    "seller.ui.table.rowsPerPage": "รายการต่อหน้า",
    "seller.ui.table.empty": "ไม่พบรายการ",
    "seller.ui.table.loading": "กำลังโหลดรายการ...",
  }[key] ?? key),
}));

const columns: ColumnDef<{ id: string; title: string }>[] = [
  { accessorKey: "title", header: "Product" },
];

afterEach(cleanup);

describe("SellerDataTable", () => {
  it("finds local records by their product name with localized controls", () => {
    render(
      <SellerDataTable
        columns={columns}
        data={[{ id: "a", title: "Canvas bag" }, { id: "b", title: "Cotton shirt" }]}
        getRowId={(row) => row.id}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหารายการ" }), { target: { value: "bag" } });
    expect(screen.getByText("Canvas bag")).toBeTruthy();
    expect(screen.queryByText("Cotton shirt")).toBeNull();
    expect(screen.getByRole("button", { name: "คอลัมน์" })).toBeTruthy();
    expect(screen.getByLabelText("รายการต่อหน้า")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ล้างการค้นหา" }));
    expect(screen.getByText("Cotton shirt")).toBeTruthy();
  });

  it("does not offer local search on server-paginated records", () => {
    render(
      <SellerDataTable
        columns={columns}
        data={[{ id: "a", title: "Canvas bag" }]}
        pagination={{ pageIndex: 0, pageSize: 20, totalRows: 40, onPaginationChange: vi.fn() }}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "ค้นหารายการ" })).toBeNull();
    expect(screen.getByText("Canvas bag")).toBeTruthy();
  });

  it("uses the localized empty state by default", () => {
    render(<SellerDataTable columns={columns} data={[]} />);
    expect(screen.getByRole("status").textContent).toBe("ไม่พบรายการ");
  });
});
