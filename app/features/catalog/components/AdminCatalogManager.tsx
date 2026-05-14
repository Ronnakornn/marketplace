"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getPaginationRowModel,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnDef,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpRightIcon,
  BoxesIcon,
  CheckCircle2Icon,
  Clock3Icon,
  Columns3Icon,
  MoreHorizontalIcon,
  PackageSearchIcon,
  RefreshCwIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { type CatalogProduct, useAdminCatalogProducts } from "../hooks/useCatalog";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function statusTone(status: CatalogProduct["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-300/30 bg-emerald-300/12 text-emerald-100";
    case "ARCHIVED":
      return "border-slate-300/25 bg-white/8 text-slate-300";
    default:
      return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }
}

function lowestVariantPrice(product: CatalogProduct) {
  const sorted = [...product.variants].sort((a, b) => a.priceCents - b.priceCents);
  return sorted[0] ?? null;
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-28 rounded-xl bg-white/10" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl bg-white/10" />
    </div>
  );
}

function SummaryCard(props: {
  title: string;
  value: string;
  detail: string;
  icon: typeof BoxesIcon;
}) {
  return (
    <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-slate-400">{props.title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{props.value}</p>
          <p className="mt-1 text-xs text-slate-500">{props.detail}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-200">
          <props.icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminCatalogManager() {
  const { data: products = [], isLoading, error, refetch } = useAdminCatalogProducts();
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const activeCount = products.filter((product) => product.status === "ACTIVE").length;
  const draftCount = products.filter((product) => product.status === "DRAFT").length;
  const archivedCount = products.filter((product) => product.status === "ARCHIVED").length;
  const columns = useMemo<ColumnDef<CatalogProduct>[]>(() => [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Product
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[360px]">
          <p className="truncate font-medium text-white">{row.original.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{row.original.slug}</p>
        </div>
      ),
      filterFn: (row, _columnId, filterValue) => {
        const value = String(filterValue ?? "").toLowerCase();
        if (!value) return true;
        const product = row.original;
        return [product.title, product.slug, product.shop.name, product.shop.slug].some((item) =>
          item.toLowerCase().includes(value),
        );
      },
    },
    {
      accessorFn: (row) => row.shop.name,
      id: "shop",
      header: "Shop",
      cell: ({ row }) => (
        <>
          <p className="text-sm text-slate-200">{row.original.shop.name}</p>
          <p className="mt-1 text-xs text-slate-500">{row.original.shop.slug}</p>
        </>
      ),
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => {
        const price = lowestVariantPrice(row.original);
        return price ? formatMoney(price.priceCents, price.currency) : "No variants";
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={statusTone(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => row.original.variants.length,
    },
    {
      id: "actions",
      enableHiding: false,
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto size-8 text-slate-300 hover:bg-white/10 hover:text-white">
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Open actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/admin/catalog/${row.original.id}`}>
                <ArrowUpRightIcon className="size-4" />
                Edit product
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.id)}>
              Copy product ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);
  const table = useReactTable({
    data: products,
    columns,
    state: {
      globalFilter: query,
      sorting,
      columnFilters,
      columnVisibility,
    },
    onGlobalFilterChange: setQuery,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (isLoading) return <CatalogSkeleton />;

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="text-sm text-red-200">Unable to load catalog products.</p>
          <Button
            variant="outline"
            size="sm"
            className="w-fit border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => void refetch()}
          >
            <RefreshCwIcon className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Active products" value={String(activeCount)} detail="Visible to buyers" icon={CheckCircle2Icon} />
        <SummaryCard title="Draft products" value={String(draftCount)} detail="Not visible in storefront" icon={Clock3Icon} />
        <SummaryCard title="Archived products" value={String(archivedCount)} detail="Hidden from public feeds" icon={XCircleIcon} />
      </section>

      <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <PackageSearchIcon className="size-5 text-cyan-200" />
                Catalog Operations
              </CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Review marketplace products and open a dedicated edit workspace for content changes.
              </p>
            </div>
            <div className="relative w-full max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, slug, or shop"
                className="border-white/10 bg-slate-950/60 pl-9 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
                  <Columns3Icon className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-white/10 bg-white/6 hover:bg-white/6">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.column.id === "actions" ? "px-5 text-right text-slate-300" : "px-5 text-slate-300"}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="border-white/8 hover:bg-white/4">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-5 py-4 text-sm text-slate-200">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                    No products match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} products
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="min-w-20 text-center text-sm text-slate-300">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
