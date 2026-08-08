"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowLeftIcon,
  BoxesIcon,
  CircleDollarSignIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PackageIcon,
  SaveIcon,
  StoreIcon,
  TagIcon,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import type { ProductStatus } from "#generated/client/enums";
import { useTranslations } from "#/i18n/client";
import {
  type CatalogProduct,
  type CatalogVariant,
  useCreateAdminCatalogVariant,
  useDeleteAdminCatalogVariant,
  useAdminCatalogProductDetail,
  useUpdateAdminCatalogVariant,
  useUpdateAdminCatalogProduct,
} from "../hooks/useCatalog";

interface AdminCatalogEditPageProps {
  productId: string;
}

interface VariantFormState {
  sku: string;
  title: string;
  price: string;
  currency: string;
}

const EMPTY_VARIANT_FORM: VariantFormState = {
  sku: "",
  title: "",
  price: "",
  currency: "USD",
};

function formatMoney(cents: number | bigint, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(cents) / 100);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "value" in error) {
    const value = (error as { value?: { error?: { message?: string }; message?: string } }).value;
    return value?.error?.message ?? value?.message ?? fallback;
  }
  return fallback;
}

function statusDescription(status: ProductStatus, t: ReturnType<typeof useTranslations>) {
  switch (status) {
    case "ACTIVE":
      return t("admin.catalogEdit.activeDescription");
    case "ARCHIVED":
      return t("admin.catalogEdit.archivedDescription");
    default:
      return t("admin.catalogEdit.draftDescription");
  }
}

function statusTone(status: ProductStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-300/30 bg-emerald-300/12 text-emerald-100";
    case "ARCHIVED":
      return "border-slate-300/25 bg-white/8 text-slate-300";
    default:
      return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }
}

function ProductSnapshot({ product, status }: { product: CatalogProduct; status: ProductStatus }) {
  const t = useTranslations();
  const lowestPrice = useMemo(
    () => [...product.variants].sort((a, b) => Number(a.price) - Number(b.price))[0] ?? null,
    [product.variants],
  );
  const totalStock = product.variants.reduce((total, variant) => total + (variant.inventory?.quantityOnHand ?? 0), 0);

  return (
    <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <PackageIcon className="size-5 text-cyan-200" />
              {t("admin.catalogEdit.productSummary")}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-400">{t("admin.operationalCatalogSnapshot")}</p>
          </div>
          <Badge variant="outline" className={statusTone(status)}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-200">
              <StoreIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-400">{t("admin.shopOwner")}</p>
              <p className="mt-1 truncate font-medium text-white">{product.shop.name}</p>
              <p className="truncate text-xs text-slate-500">{product.shop.slug}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label={t("admin.ui.variants")} value={String(product.variants.length)} />
          <Metric label={t("admin.catalogEdit.fromPrice")} value={lowestPrice ? formatMoney(lowestPrice.price, lowestPrice.currency) : t("admin.catalogEdit.none")} />
          <Metric label={t("admin.catalogEdit.totalStock")} value={String(totalStock)} />
          <Metric label={t("admin.catalogEdit.currency")} value={lowestPrice?.currency ?? t("admin.catalogEdit.notAvailable")} />
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
          <p className="text-sm font-medium text-white">{status}</p>
          <p className="mt-1 text-sm text-slate-400">{statusDescription(status, t)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantDataTable(props: {
  product: CatalogProduct;
  pendingDelete: boolean;
  onCreate: () => void;
  onEdit: (variant: CatalogVariant) => void;
  onDelete: (variant: CatalogVariant) => Promise<void>;
}) {
  const t = useTranslations();
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<CatalogVariant>[]>(() => [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.ui.variant")}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <p className="truncate font-medium text-white">{row.original.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{row.original.id}</p>
        </div>
      ),
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          SKU
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs text-slate-300">{row.original.sku}</span>,
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.ui.price")}
        </Button>
      ),
      cell: ({ row }) => formatMoney(row.original.price, row.original.currency),
    },
    {
      accessorKey: "currency",
      header: t("admin.catalogEdit.currency"),
    },
    {
      id: "stock",
      accessorFn: (row) => row.inventory?.quantityOnHand ?? 0,
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.catalogEdit.stock")}
        </Button>
      ),
      cell: ({ row }) => row.original.inventory?.quantityOnHand ?? 0,
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
              <span className="sr-only">{t("admin.openVariantActions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t("admin.actions")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => props.onEdit(row.original)}>
              {t("admin.catalogEdit.editVariant")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              disabled={props.pendingDelete}
              onClick={() => void props.onDelete(row.original)}
            >
              {t("admin.catalogEdit.deleteVariant")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [props.onEdit, props.onDelete, props.pendingDelete]);
  const table = useReactTable({
    data: props.product.variants,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-white">{t("admin.variantDataTable")}</CardTitle>
          <p className="mt-1 text-sm text-slate-400">{t("admin.variantTableDescription")}</p>
        </div>
        <Button size="sm" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" onClick={props.onCreate}>
          {t("admin.catalogEdit.createVariant")}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-white/10 bg-white/6 hover:bg-white/6">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-5 text-slate-300">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="border-white/8 hover:bg-white/4">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-5 py-4 text-sm text-slate-200">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-28 text-center text-slate-400">
                  {t("admin.ui.noVariants")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantDialog(props: {
  open: boolean;
  mode: "create" | "edit";
  initialValues: VariantFormState;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VariantFormState) => Promise<void>;
}) {
  const t = useTranslations();
  const { open, mode, initialValues, pending, errorMessage, onOpenChange, onSubmit } = props;
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    if (open) setForm(initialValues);
  }, [initialValues, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("admin.catalogEdit.createVariant") : t("admin.catalogEdit.editVariant")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(form);
          }}
        >
          {errorMessage ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" value={form.sku} onChange={(value) => setForm((current) => ({ ...current, sku: value }))} required />
            <Field label={t("admin.catalogEdit.title")} value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} required />
            <Field label={t("admin.catalogEdit.priceCents")} type="number" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} required />
            <Field label={t("admin.catalogEdit.currency")} value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value }))} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("admin.ui.cancel")}
            </Button>
            <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={pending}>
              {pending ? t("admin.ui.saving") : t("admin.catalogEdit.saveVariant")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-slate-200">{props.label}</Label>
      <Input
        id={id}
        type={props.type}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required={props.required}
        className="border-white/10 bg-slate-950/60 text-slate-100"
      />
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
      <p className="text-xs text-slate-500">{props.label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{props.value}</p>
    </div>
  );
}

function WorkspaceStat(props: {
  label: string;
  value: string;
  icon: typeof PackageIcon;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-slate-500">{props.label}</p>
          <p className="mt-2 truncate text-lg font-semibold text-white">{props.value}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-200">
          <props.icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

export function AdminCatalogEditPage({ productId }: AdminCatalogEditPageProps) {
  const t = useTranslations();
  const { data: product, isLoading, error } = useAdminCatalogProductDetail(productId);
  const updateProduct = useUpdateAdminCatalogProduct();
  const createVariant = useCreateAdminCatalogVariant();
  const updateVariant = useUpdateAdminCatalogVariant();
  const deleteVariant = useDeleteAdminCatalogVariant();
  const [form, setForm] = useState({
    title: "",
    titleTh: "",
    titleEn: "",
    slug: "",
    description: "",
    descriptionTh: "",
    descriptionEn: "",
    status: "DRAFT" as ProductStatus,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [variantDialogMode, setVariantDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingVariant, setEditingVariant] = useState<CatalogVariant | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setForm({
      title: product.title,
      titleTh: product.titleTh ?? "",
      titleEn: product.titleEn ?? "",
      slug: product.slug,
      description: product.description ?? "",
      descriptionTh: product.descriptionTh ?? "",
      descriptionEn: product.descriptionEn ?? "",
      status: product.status,
    });
  }, [product]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-36 rounded-2xl bg-white/10" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[520px] rounded-xl bg-white/10" />
          <Skeleton className="h-[420px] rounded-xl bg-white/10" />
        </div>
        <Skeleton className="h-80 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-red-200">{t("admin.variantLoadError")}</p>
          <Button asChild variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
            <Link href="/admin/catalog">
              <ArrowLeftIcon className="size-4" />
              {t("admin.catalogEdit.backToCatalog")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const lowestPrice = [...product.variants].sort((a, b) => Number(a.price) - Number(b.price))[0] ?? null;
  const totalStock = product.variants.reduce((total, variant) => total + (variant.inventory?.quantityOnHand ?? 0), 0);

  return (
    <div className="space-y-6">
      <section className="admin-panel rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <Link href="/admin/catalog" className="inline-flex items-center gap-1 text-cyan-100 hover:text-cyan-50">
                <ArrowLeftIcon className="size-4" />
                {t("admin.catalogEdit.catalog")}
              </Link>
              <span>/</span>
              <span className="truncate">{product.title}</span>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                {t("admin.catalogEdit.editProduct")}
              </h1>
              <Badge variant="outline" className={statusTone(form.status)}>
                {form.status}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              {t("admin.catalogEdit.workspaceDescription")}
            </p>
            <p className="mt-3 max-w-full truncate font-mono text-xs text-slate-500">
              {product.id}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row xl:shrink-0">
            <Button asChild variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
              <Link href="/admin/catalog">{t("admin.ui.cancel")}</Link>
            </Button>
            <Button form="admin-product-edit-form" type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={updateProduct.isPending}>
              {updateProduct.isPending ? (
                t("admin.ui.saving")
              ) : (
                <>
                  <SaveIcon className="size-4" />
                  {t("admin.catalogEdit.saveChanges")}
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceStat label={t("admin.ui.shop")} value={product.shop.name} icon={StoreIcon} />
          <WorkspaceStat label={t("admin.ui.variants")} value={String(product.variants.length)} icon={TagIcon} />
          <WorkspaceStat label={t("admin.catalogEdit.fromPrice")} value={lowestPrice ? formatMoney(lowestPrice.price, lowestPrice.currency) : t("admin.catalogEdit.none")} icon={CircleDollarSignIcon} />
          <WorkspaceStat label={t("admin.catalogEdit.totalStock")} value={String(totalStock)} icon={BoxesIcon} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="admin-panel rounded-xl border-white/10 bg-white/5 xl:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BoxesIcon className="size-5 text-cyan-200" />
              {t("admin.catalogEdit.productContent")}
            </CardTitle>
            <p className="text-sm text-slate-400">
              {t("admin.catalogEdit.contentDescription")}
            </p>
          </CardHeader>
          <CardContent>
            <form
              id="admin-product-edit-form"
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setMessage(null);
                try {
                  await updateProduct.mutateAsync({
                    id: product.id,
                    title: form.title,
                    titleTh: form.titleTh || null,
                    titleEn: form.titleEn || null,
                    slug: form.slug,
                    description: form.description || null,
                    descriptionTh: form.descriptionTh || null,
                    descriptionEn: form.descriptionEn || null,
                    status: form.status,
                  });
                  setMessage(t("admin.catalogEdit.productSaved"));
                } catch (submitError) {
                  setMessage(getErrorMessage(submitError, t("admin.catalogEdit.saveFailed")));
                }
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-title" className="text-slate-200">{t("admin.catalogEdit.title")}</Label>
                  <Input
                    id="product-title"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="border-white/10 bg-slate-950/60 text-slate-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-slug" className="text-slate-200">{t("admin.categoryManager.slug")}</Label>
                  <Input
                    id="product-slug"
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                    className="border-white/10 bg-slate-950/60 text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description" className="text-slate-200">{t("admin.catalogEdit.description")}</Label>
                <Textarea
                  id="product-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-36 border-white/10 bg-slate-950/60 text-slate-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-title-th" className="text-slate-200">{t("admin.catalogEdit.titleTh")}</Label>
                  <Input
                    id="product-title-th"
                    value={form.titleTh}
                    onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))}
                    className="border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-title-en" className="text-slate-200">{t("admin.catalogEdit.titleEn")}</Label>
                  <Input
                    id="product-title-en"
                    value={form.titleEn}
                    onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))}
                    className="border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-description-th" className="text-slate-200">{t("admin.catalogEdit.descriptionTh")}</Label>
                  <Textarea
                    id="product-description-th"
                    value={form.descriptionTh}
                    onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))}
                    className="min-h-28 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-description-en" className="text-slate-200">{t("admin.catalogEdit.descriptionEn")}</Label>
                  <Textarea
                    id="product-description-en"
                    value={form.descriptionEn}
                    onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))}
                    className="min-h-28 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label className="text-slate-200">{t("admin.ui.status")}</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProductStatus }))}>
                    <SelectTrigger className="w-full border-white/10 bg-slate-950/60 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">{t("admin.statuses.DRAFT")}</SelectItem>
                      <SelectItem value="ACTIVE">{t("admin.statuses.ACTIVE")}</SelectItem>
                      <SelectItem value="ARCHIVED">{t("admin.statuses.ARCHIVED")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-medium text-white">{form.status}</p>
                  <p className="mt-1 text-sm text-slate-400">{statusDescription(form.status, t)}</p>
                </div>
              </div>

              {message ? (
                <div className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                  {message}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <Button asChild variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
                  <Link href="/admin/catalog">{t("admin.ui.cancel")}</Link>
                </Button>
                <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={updateProduct.isPending}>
                  {updateProduct.isPending ? (
                    t("admin.ui.saving")
                  ) : (
                    <>
                      <SaveIcon className="size-4" />
                      {t("admin.catalogEdit.saveChanges")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5 xl:order-2">
          <ProductSnapshot product={product} status={form.status} />
        </div>
      </div>

      <section className="space-y-3">
        <VariantDataTable
          product={product}
          pendingDelete={deleteVariant.isPending}
          onCreate={() => {
            setEditingVariant(null);
            setVariantError(null);
            setVariantDialogMode("create");
          }}
          onEdit={(variant) => {
            setEditingVariant(variant);
            setVariantError(null);
            setVariantDialogMode("edit");
          }}
          onDelete={async (variant) => {
            try {
              setVariantError(null);
              await deleteVariant.mutateAsync({ productId: product.id, variantId: variant.id });
              setMessage(t("admin.catalogEdit.variantDeleted"));
            } catch (deleteError) {
              setVariantError(getErrorMessage(deleteError, t("admin.catalogEdit.deleteVariantFailed")));
            }
          }}
        />
        {variantError ? <p className="text-sm text-red-200">{variantError}</p> : null}
      </section>

      {message === t("admin.catalogEdit.productSaved") ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          <CheckIcon className="size-4" />
          {t("admin.catalogEdit.savedSuccessfully")}
        </div>
      ) : null}

      <VariantDialog
        open={variantDialogMode !== null}
        mode={variantDialogMode ?? "create"}
        initialValues={editingVariant ? {
          sku: editingVariant.sku,
          title: editingVariant.title,
          price: String(editingVariant.price),
          currency: editingVariant.currency,
        } : EMPTY_VARIANT_FORM}
        pending={createVariant.isPending || updateVariant.isPending}
        errorMessage={variantError}
        onOpenChange={(open) => {
          if (!open) {
            setVariantDialogMode(null);
            setEditingVariant(null);
            setVariantError(null);
          }
        }}
        onSubmit={async (values) => {
          try {
            setVariantError(null);
            if (editingVariant) {
              await updateVariant.mutateAsync({
                productId: product.id,
                variantId: editingVariant.id,
                sku: values.sku,
                title: values.title,
                price: Number(values.price),
                currency: values.currency,
              });
              setMessage("Variant saved.");
            } else {
              await createVariant.mutateAsync({
                productId: product.id,
                sku: values.sku,
                title: values.title,
                price: Number(values.price),
                currency: values.currency,
              });
              setMessage("Variant created.");
            }
            setVariantDialogMode(null);
            setEditingVariant(null);
          } catch (submitError) {
            setVariantError(getErrorMessage(submitError, "Failed to save variant."));
          }
        }}
      />
    </div>
  );
}
