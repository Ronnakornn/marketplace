"use client";

import { DataTable, type DataTableProps } from "#/components/ui/data-table";
import { useTranslations } from "#/i18n/client";

const clientPageSizes = [10, 20, 30, 50, 100];

export function AdminTable<TData, TValue = unknown>({
  labels,
  pageSizeOptions,
  columnVisibilityEnabled = true,
  emptyMessage,
  loadingMessage,
  ...props
}: DataTableProps<TData, TValue>) {
  const t = useTranslations();

  return (
    <DataTable
      {...props}
      columnVisibilityEnabled={columnVisibilityEnabled}
      pageSizeOptions={
        pageSizeOptions ?? (props.pagination ? undefined : clientPageSizes)
      }
      emptyMessage={emptyMessage ?? t("admin.table.empty")}
      loadingMessage={loadingMessage ?? t("admin.table.loading")}
      labels={{
        showing: t("admin.table.showing"),
        of: t("admin.table.of"),
        rows: t("admin.table.rows"),
        previous: t("admin.table.previous"),
        next: t("admin.table.next"),
        previousPage: t("admin.table.previousPage"),
        nextPage: t("admin.table.nextPage"),
        firstPage: t("admin.table.firstPage"),
        lastPage: t("admin.table.lastPage"),
        sortBy: t("admin.table.sortBy"),
        search: t("admin.table.search"),
        searchPlaceholder: t("admin.table.searchPlaceholder"),
        clearSearch: t("admin.table.clearSearch"),
        columns: t("admin.table.columns"),
        rowsPerPage: t("admin.table.rowsPerPage"),
        page: t("admin.table.page"),
        ...labels,
      }}
    />
  );
}
