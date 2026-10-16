/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flexRender, type ColumnDef } from "@tanstack/react-table";
import { AdminSettingsManager } from "./AdminConfigurationTables";
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), save: vi.fn(), page: { items: [{ id: "s1", key: "coupon.targets.x", valueType: "JSON", description: "Targets", isPublic: false, updatedAt: "2026-01-01" }], pagination: { total: 25 } } }));
vi.mock("../hooks/useAdminOperations", () => ({ PAGE_SIZE: 10, fetchAdminSystemSetting: mocks.detail, useAdminSystemSettings: (input: unknown) => { mocks.list(input); return { data: mocks.page, isLoading: false, error: null, refetch: vi.fn() }; }, useUpsertSystemSetting: () => ({ mutate: mocks.save, isPending: false, error: null }), useAdminCommissionsList: vi.fn(), useUpdateCommissionStatus: vi.fn() }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: (date: string) => date }) }));
vi.mock("./AdminDataShell", () => ({ AdminDataShell: ({ children, search, onSearchChange }: { children: React.ReactNode; search: string; onSearchChange: (q: string) => void }) => <div><input aria-label="Search settings" value={search} onChange={event => onSearchChange(event.target.value)} />{children}</div> }));
vi.mock("./AdminTable", () => ({ AdminTable: ({ data, columns, pagination }: { data: unknown[]; columns: ColumnDef<unknown>[]; pagination: { onPaginationChange: (value: { pageIndex: number; pageSize: number }) => void } }) => <div>{data.map((item, index) => <div key={index}>{columns.map((column, columnIndex) => <div key={columnIndex}>{flexRender(column.cell, { row: { original: item } } as never)}</div>)}</div>)}<button onClick={() => pagination.onPaginationChange({ pageIndex: 1, pageSize: 10 })}>Next settings page</button></div> }));
afterEach(cleanup);
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.clearAllMocks(); mocks.detail.mockResolvedValue({ ...mocks.page.items[0], value: { productIds: ["p1", "p2"] } }); });
describe("settings metadata and detail editor", () => {
  it("paginates metadata, debounces server search, and loads the complete value only when editing", async () => {
    render(<AdminSettingsManager />);
    expect(mocks.detail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next settings page" }));
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, q: "" });
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), { target: { value: "coupon" } });
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, q: "" });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, q: "coupon" }));
    fireEvent.click(screen.getByRole("button", { name: "admin.common.edit" }));
    await waitFor(() => expect((screen.getByLabelText("admin.settingsEditor.value") as HTMLTextAreaElement).value).toContain('"p2"'));
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith("coupon.targets.x");
  });
  it("retains the form and blocks writes after detail failure, then retries the selected key", async () => {
    mocks.detail.mockRejectedValueOnce(new Error("temporary"));
    render(<AdminSettingsManager />);
    fireEvent.click(screen.getByRole("button", { name: "admin.common.edit" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: "admin.common.save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("admin.settingsEditor.key") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "admin.workspace.refresh" }));
    await waitFor(() => expect((screen.getByLabelText("admin.settingsEditor.key") as HTMLInputElement).value).toBe("coupon.targets.x"));
    expect(mocks.save).not.toHaveBeenCalled();
    expect((screen.getByLabelText("admin.settingsEditor.value") as HTMLTextAreaElement).value).toContain('"p2"');
  });
});
