"use client";

import * as React from "react";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  SortingState,
  TableOptions,
  Table as TanStackTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "#/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { cn } from "#/lib/utils";

export type DataTablePagination = PaginationState & {
  totalRows: number;
  onPaginationChange: OnChangeFn<PaginationState>;
};

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: React.ReactNode;
  pageSize?: number;
  pagination?: DataTablePagination;
  pageSizeOptions?: number[];
  hidePagination?: boolean;
  getRowId?: TableOptions<TData>["getRowId"];
  searchable?: boolean;
  columnVisibilityEnabled?: boolean;
  columnLabels?: Record<string, string>;
  renderToolbar?: (table: TanStackTable<TData>) => React.ReactNode;
  className?: string;
  labels?: {
    showing?: string;
    of?: string;
    rows?: string;
    previous?: string;
    next?: string;
    previousPage?: string;
    nextPage?: string;
    sortBy?: string;
    firstPage?: string;
    lastPage?: string;
    page?: string;
    search?: string;
    searchPlaceholder?: string;
    clearSearch?: string;
    columns?: string;
    rowsPerPage?: string;
  };
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUpIcon className="size-3.5" />;
  if (direction === "desc") return <ArrowDownIcon className="size-3.5" />;
  return <ArrowUpDownIcon className="size-3.5" />;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  isLoading = false,
  loadingMessage = "Loading...",
  pageSize = 10,
  pagination,
  pageSizeOptions,
  hidePagination = false,
  getRowId,
  searchable = false,
  columnVisibilityEnabled = false,
  columnLabels,
  renderToolbar,
  className,
  labels,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const pageSizeId = React.useId();
  const isRemote = pagination !== undefined;
  const showSearch = searchable && !isRemote;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      ...(pagination ? { pagination } : {}),
    },
    getRowId,
    manualPagination: isRemote,
    manualSorting: isRemote,
    manualFiltering: isRemote,
    enableSorting: !isRemote,
    enableFilters: !isRemote,
    ...(pagination
      ? {
          rowCount: pagination.totalRows,
          onPaginationChange: pagination.onPaginationChange,
        }
      : {}),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const rowCount =
    pagination?.totalRows ?? table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);
  const rows = table.getRowModel().rows;
  const currentPage = table.getState().pagination;
  const rangeStart = rows.length
    ? currentPage.pageIndex * currentPage.pageSize + 1
    : 0;
  const rangeEnd = Math.min(
    rangeStart + Math.max(rows.length - 1, 0),
    rowCount,
  );
  const sizeOptions = pageSizeOptions?.length
    ? Array.from(new Set([currentPage.pageSize, ...pageSizeOptions])).sort(
        (a, b) => a - b,
      )
    : [];
  const hideableColumns = table
    .getAllLeafColumns()
    .filter(
      (column) =>
        column.getCanHide() &&
        (columnLabels?.[column.id] ||
          typeof column.columnDef.header === "string"),
    );

  return (
    <div
      data-slot="data-table"
      className={cn("min-w-0 max-w-full space-y-4", className)}
    >
      {renderToolbar || showSearch || columnVisibilityEnabled ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {showSearch ? (
              <div className="relative w-full sm:max-w-sm">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label={labels?.search ?? "Search rows"}
                  placeholder={labels?.searchPlaceholder ?? "Search..."}
                  value={globalFilter}
                  onChange={(event) => {
                    table.setGlobalFilter(event.target.value);
                    table.setPageIndex(0);
                  }}
                  className="h-9 bg-background pr-9 pl-9"
                />
                {globalFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                    aria-label={labels?.clearSearch ?? "Clear search"}
                    onClick={() => {
                      table.setGlobalFilter("");
                      table.setPageIndex(0);
                    }}
                  >
                    <XIcon aria-hidden="true" className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ) : null}
            {renderToolbar?.(table)}
          </div>
          {columnVisibilityEnabled && hideableColumns.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 self-start bg-background sm:self-auto"
                >
                  <Columns3Icon aria-hidden="true" className="size-4" />
                  {labels?.columns ?? "Columns"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>
                  {labels?.columns ?? "Columns"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    disabled={
                      column.getIsVisible() &&
                      table.getVisibleLeafColumns().length === 1
                    }
                    onCheckedChange={(value) =>
                      column.toggleVisibility(value === true)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {columnLabels?.[column.id] ??
                      String(column.columnDef.header)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <Table aria-busy={isLoading}>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const headerContent = header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      );
                  const canUseDefaultSort =
                    header.column.getCanSort() &&
                    typeof header.column.columnDef.header === "string";

                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getCanSort()
                          ? header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className="h-11 px-4 text-xs font-semibold text-muted-foreground"
                    >
                      {canUseDefaultSort ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 px-3 text-xs font-semibold hover:bg-muted"
                          aria-label={`${labels?.sortBy ?? "Sort by"} ${header.column.columnDef.header}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {headerContent}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </Button>
                      ) : (
                        headerContent
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {!isLoading && rows.length
              ? rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3 align-top">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
        {isLoading || !rows.length ? (
          <div
            role="status"
            className="flex min-h-44 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-sm text-muted-foreground"
          >
            {isLoading ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-5 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <SearchIcon
                aria-hidden="true"
                className="size-6 text-muted-foreground/60"
              />
            )}
            {isLoading ? loadingMessage : emptyMessage}
          </div>
        ) : null}
      </div>

      {!hidePagination ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {labels?.showing ?? "Showing"} {rangeStart}
            {rangeStart !== rangeEnd ? `-${rangeEnd}` : ""} {labels?.of ?? "of"}{" "}
            {rowCount} {labels?.rows ?? "row(s)"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
            {sizeOptions.length ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={pageSizeId}
                  className="text-xs text-muted-foreground"
                >
                  {labels?.rowsPerPage ?? "Rows per page"}
                </label>
                <NativeSelect
                  id={pageSizeId}
                  size="sm"
                  value={currentPage.pageSize}
                  disabled={isLoading}
                  onChange={(event) =>
                    table.setPagination({
                      pageIndex: 0,
                      pageSize: Number(event.target.value),
                    })
                  }
                >
                  {sizeOptions.map((size) => (
                    <NativeSelectOption key={size} value={size}>
                      {size}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={labels?.firstPage ?? "First page"}
                onClick={() => table.setPageIndex(0)}
                disabled={isLoading || !table.getCanPreviousPage()}
              >
                <ChevronsLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={labels?.previousPage ?? "Previous page"}
                onClick={() => table.previousPage()}
                disabled={isLoading || !table.getCanPreviousPage()}
              >
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">
                  {labels?.previous ?? "Previous"}
                </span>
              </Button>
              <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
                <span className="sr-only">{labels?.page ?? "Page"} </span>
                {currentPage.pageIndex + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={labels?.nextPage ?? "Next page"}
                onClick={() => table.nextPage()}
                disabled={isLoading || !table.getCanNextPage()}
              >
                <span className="hidden sm:inline">
                  {labels?.next ?? "Next"}
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label={labels?.lastPage ?? "Last page"}
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={isLoading || !table.getCanNextPage()}
              >
                <ChevronsRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
