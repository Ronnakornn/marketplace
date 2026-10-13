"use client";

import { DataTable, type DataTableProps } from "#/components/ui/data-table";
import { useTranslations } from "#/i18n/client";

const pageSizeOptions = [10, 20, 50];

export function SellerDataTable<TData, TValue = unknown>({
  labels,
  pagination,
  searchable = pagination === undefined,
  columnVisibilityEnabled = true,
  ...props
}: DataTableProps<TData, TValue>) {
  const t = useTranslations();

  return (
    <DataTable
      emptyMessage={t("seller.ui.table.empty")}
      loadingMessage={t("seller.ui.table.loading")}
      pageSizeOptions={pageSizeOptions}
      {...props}
      pagination={pagination}
      searchable={searchable}
      columnVisibilityEnabled={columnVisibilityEnabled}
      labels={{
        showing: t("seller.ui.table.showing"),
        of: t("seller.ui.table.of"),
        rows: t("seller.ui.table.rows"),
        previous: t("seller.ui.table.previous"),
        next: t("seller.ui.table.next"),
        previousPage: t("seller.ui.table.previousPage"),
        nextPage: t("seller.ui.table.nextPage"),
        sortBy: t("seller.ui.table.sortBy"),
        firstPage: t("seller.ui.table.firstPage"),
        lastPage: t("seller.ui.table.lastPage"),
        page: t("seller.ui.table.page"),
        search: t("seller.ui.table.search"),
        searchPlaceholder: t("seller.ui.table.searchPlaceholder"),
        clearSearch: t("seller.ui.table.clearSearch"),
        columns: t("seller.ui.table.columns"),
        rowsPerPage: t("seller.ui.table.rowsPerPage"),
        ...labels,
      }}
    />
  );
}
