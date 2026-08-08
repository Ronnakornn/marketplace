"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
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
import { Checkbox } from "#/components/ui/checkbox";
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
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { useTranslations } from "#/i18n/client";
import { AdminStatusBadge } from "#/features/admin/components/AdminStatusBadge";
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
import {
  type AdminBrand,
  useAdminBrandsList,
  useCreateAdminBrand,
  useToggleAdminBrandActive,
  useUpdateAdminBrand,
} from "#/features/admin/hooks/useAdminOperations";

const emptyBrandForm = {
  name: "",
  slug: "",
  code: "",
  logoUrl: "",
  websiteUrl: "",
  countryCode: "",
  sortOrder: "0",
  isFeatured: false,
};

function formatMoney(cents: number | bigint, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(cents) / 100);
}

function lowestVariantPrice(product: CatalogProduct) {
  const sorted = [...product.variants].sort((a, b) => Number(a.price) - Number(b.price));
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
  const t = useTranslations();
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
          {t("admin.product")}
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
      header: t("admin.shop"),
      cell: ({ row }) => (
        <>
          <p className="text-sm text-slate-200">{row.original.shop.name}</p>
          <p className="mt-1 text-xs text-slate-500">{row.original.shop.slug}</p>
        </>
      ),
    },
    {
      id: "price",
      header: t("admin.common.price"),
      cell: ({ row }) => {
        const price = lowestVariantPrice(row.original);
        return price ? formatMoney(price.price, price.currency) : t("admin.variants");
      },
    },
    {
      accessorKey: "status",
      header: t("admin.status"),
      cell: ({ row }) => (
        <AdminStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "variants",
      header: t("admin.variants"),
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
              <span className="sr-only">{t("admin.openActions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t("admin.actions")}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/admin/catalog/${row.original.id}`}>
                <ArrowUpRightIcon className="size-4" />
                {t("admin.common.editProduct")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.id)}>
              {t("admin.common.copyProductId")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [t]);
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
          <p className="text-sm text-red-200">{t("admin.catalogLoadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-fit border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => void refetch()}
          >
            <RefreshCwIcon className="size-4" />
            {t("admin.common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <AdminBrandManager />
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title={t("admin.catalogManager.activeProducts")} value={String(activeCount)} detail={t("admin.catalogManager.activeDetail")} icon={CheckCircle2Icon} />
        <SummaryCard title={t("admin.catalogManager.draftProducts")} value={String(draftCount)} detail={t("admin.catalogManager.draftDetail")} icon={Clock3Icon} />
        <SummaryCard title={t("admin.catalogManager.archivedProducts")} value={String(archivedCount)} detail={t("admin.catalogManager.archivedDetail")} icon={XCircleIcon} />
      </section>

      <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <PackageSearchIcon className="size-5 text-cyan-200" />
                {t("admin.pages.catalog.title")}
              </CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                {t("admin.pages.catalog.description")}
              </p>
            </div>
            <div className="relative w-full max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("admin.common.searchProducts")}
                className="border-white/10 bg-slate-950/60 pl-9 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
                  <Columns3Icon className="size-4" />
                  {t("admin.common.columns")}
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
                    {t("admin.common.noProductsMatch")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {t("admin.common.showingRecords").replace("{visible}", String(table.getRowModel().rows.length)).replace("{total}", String(table.getFilteredRowModel().rows.length))}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("admin.common.previous")}
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
            {t("admin.common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminBrandManager() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | boolean>("");
  const [form, setForm] = useState(emptyBrandForm);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const query = useAdminBrandsList({ page, q, isActive: activeFilter });
  const createBrand = useCreateAdminBrand();
  const updateBrand = useUpdateAdminBrand();
  const toggleActive = useToggleAdminBrandActive();
  const rows = query.data?.items ?? [];
  const isMutating = createBrand.isPending || updateBrand.isPending;

  function resetForm() {
    setForm(emptyBrandForm);
    setEditingBrand(null);
  }

  function startEdit(brand: AdminBrand) {
    setEditingBrand(brand);
    setForm({
      name: brand.name ?? "",
      slug: brand.slug ?? "",
      code: brand.code ?? "",
      logoUrl: brand.logoUrl ?? "",
      websiteUrl: brand.websiteUrl ?? "",
      countryCode: brand.countryCode ?? "",
      sortOrder: String(brand.sortOrder ?? 0),
      isFeatured: Boolean(brand.isFeatured),
    });
  }

  function submitBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      code: form.code.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      countryCode: form.countryCode.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isFeatured: form.isFeatured,
    };
    if (editingBrand) {
      updateBrand.mutate({ id: editingBrand.id, ...payload }, { onSuccess: resetForm });
      return;
    }
    createBrand.mutate(payload, { onSuccess: resetForm });
  }

  return (
    <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
      <CardHeader className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <BoxesIcon className="size-5 text-cyan-200" />
              {t("admin.brandManager.title")}
            </CardTitle>
            <p className="mt-2 text-sm text-slate-400">{t("admin.brandManager.description")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder={t("admin.brandManager.search")} className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500" />
            <NativeSelect value={activeFilter === "" ? "ALL" : String(activeFilter)} onChange={(event) => { setActiveFilter(event.target.value === "ALL" ? "" : event.target.value === "true"); setPage(1); }} className="h-10">
              <NativeSelectOption value="ALL">{t("admin.common.allStatuses")}</NativeSelectOption>
              <NativeSelectOption value="true">{t("admin.common.active")}</NativeSelectOption>
              <NativeSelectOption value="false">{t("admin.common.inactive")}</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <form onSubmit={submitBrand} className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/50 p-4 lg:grid-cols-4">
          <BrandInput id="brand-name" label={t("admin.brandManager.name")} value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
          <BrandInput id="brand-slug" label={t("admin.categoryManager.slug")} value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: value }))} placeholder="auto-from-name" />
          <BrandInput id="brand-code" label={t("admin.brandManager.code")} value={form.code} onChange={(value) => setForm((current) => ({ ...current, code: value }))} />
          <BrandInput id="brand-country" label={t("admin.ui.country")} value={form.countryCode} onChange={(value) => setForm((current) => ({ ...current, countryCode: value }))} placeholder="TH" />
          <BrandInput id="brand-logo" label={t("admin.brandManager.logoUrl")} value={form.logoUrl} onChange={(value) => setForm((current) => ({ ...current, logoUrl: value }))} />
          <BrandInput id="brand-website" label={t("admin.brandManager.websiteUrl")} value={form.websiteUrl} onChange={(value) => setForm((current) => ({ ...current, websiteUrl: value }))} />
          <BrandInput id="brand-sort" label={t("admin.categoryManager.sortOrder")} value={form.sortOrder} onChange={(value) => setForm((current) => ({ ...current, sortOrder: value }))} type="number" />
          <div className="flex items-end gap-2 pb-2 text-sm text-slate-300">
            <Checkbox id="brand-featured" checked={form.isFeatured} onCheckedChange={(checked) => setForm((current) => ({ ...current, isFeatured: checked === true }))} />
            <label htmlFor="brand-featured">{t("admin.brandManager.featured")}</label>
          </div>
          <div className="flex gap-2 lg:col-span-4">
            <Button type="submit" disabled={isMutating} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">{editingBrand ? t("admin.brandManager.save") : t("admin.brandManager.create")}</Button>
            {editingBrand ? <Button type="button" variant="outline" className="border-white/12 bg-white/5 text-slate-100" onClick={resetForm}>{t("admin.ui.cancel")}</Button> : null}
          </div>
        </form>
        <div className="overflow-hidden rounded-lg border border-white/10">
          <Table>
            <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">{t("admin.ui.brand")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.country")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.status")}</TableHead><TableHead className="text-right text-slate-300">{t("admin.ui.actions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length ? rows.map((brand: AdminBrand) => (
                <TableRow key={brand.id} className="border-white/8 hover:bg-white/4">
                  <TableCell className="px-5 py-4"><p className="font-medium text-white">{brand.name}</p><p className="text-xs text-slate-500">{brand.slug}{brand.code ? ` · ${brand.code}` : ""}</p></TableCell>
                  <TableCell className="text-sm text-slate-300">{brand.countryCode ?? t("admin.brandManager.notSet")}</TableCell>
                  <TableCell><Badge variant="outline" className={brand.isActive ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : "border-slate-300/25 bg-white/8 text-slate-300"}>{brand.isActive ? t("admin.common.active") : t("admin.common.inactive")}</Badge></TableCell>
                  <TableCell><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={() => startEdit(brand)}>{t("admin.ui.edit")}</Button><Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate({ id: brand.id, isActive: !brand.isActive })}>{brand.isActive ? t("admin.ui.deactivate") : t("admin.ui.reactivate")}</Button></div></TableCell>
                </TableRow>
              )) : <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={4} className="h-24 text-center text-slate-400">{query.isLoading ? t("admin.brandManager.loading") : t("admin.brandManager.empty")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{t("admin.brandManager.count").replace("{count}", String(query.data?.pagination.total ?? rows.length))}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="border-white/12 bg-white/5 text-slate-100" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t("admin.common.previous")}</Button>
            <Button type="button" size="sm" variant="outline" className="border-white/12 bg-white/5 text-slate-100" disabled={page >= (query.data?.pagination.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>{t("admin.common.next")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandInput(props: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm text-slate-300">{props.label}</label>
      <Input id={props.id} type={props.type} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} required={props.required} className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600" />
    </div>
  );
}
