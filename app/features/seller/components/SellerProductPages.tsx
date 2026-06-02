"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, EditIcon, PlusIcon, SaveIcon, SendIcon, TrashIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { SellerPageHeader } from "./SellerShell";
import {
  type SellerProduct,
  type SellerProductImage,
  type SellerProductInput,
  type SellerProductOptionInput,
  type SellerProductVideo,
  type SellerVariantInput,
  useArchiveSellerProduct,
  useCreateSellerProduct,
  useCreateSellerVariant,
  useDeleteSellerProductImage,
  useDeleteSellerProductVideo,
  useDeleteSellerVariant,
  useSellerBrands,
  useSellerCategories,
  useSellerProduct,
  useSellerProducts,
  useSubmitSellerProductReview,
  useUpdateSellerProductImagesOrder,
  useUpdateSellerProductImage,
  useUpdateSellerProductOptions,
  useUpdateSellerProduct,
  useUpdateSellerVariant,
  useUpdateSellerVariantStock,
  useUploadAndCreateSellerProductImage,
  useUploadAndUpsertSellerProductVideo,
} from "../hooks/useSellerManage";

type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
type VariantStatus = "ACTIVE" | "INACTIVE";
type ProductStudioSectionId = "basics" | "category-specs" | "media" | "variants" | "inventory" | "review";

const MAX_PRODUCT_IMAGES = 10;
const MAX_PRODUCT_VIDEO_BYTES = 25 * 1024 * 1024;
const PRODUCT_VIDEO_TYPES = ["video/mp4", "video/webm"];
const DEFAULT_BULK_STATUS: VariantStatus = "ACTIVE";
const PRODUCT_STUDIO_SECTIONS: Array<{ id: ProductStudioSectionId; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "category-specs", label: "Category & Specs" },
  { id: "media", label: "Media" },
  { id: "variants", label: "Variants" },
  { id: "inventory", label: "Inventory" },
  { id: "review", label: "Review" },
];

interface ProductFormState {
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  metaTitle: string;
  metaDescription: string;
  warrantyInfo: string;
  condition: string;
  countryOfOrigin: string;
  highlightsText: string;
  attributesText: string;
}

interface VariantFormState {
  id?: string;
  sku: string;
  title: string;
  titleTh: string;
  titleEn: string;
  price: string;
  currency: string;
  status: VariantStatus;
  quantityOnHand: string;
  quantityReserved: number;
  reorderLevel: string;
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  optionValueIds: string[];
}

interface ProductOptionDraftState {
  id: string;
  name: string;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
  values: Array<{
    id: string;
    value: string;
    valueTh: string;
    valueEn: string;
    displayType: string;
    colorHex: string;
    sortOrder: number;
  }>;
}

interface ImageDraftState {
  id: string;
  file?: File;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  width?: number | null;
  height?: number | null;
  status: "existing" | "pending" | "uploading" | "error";
  error?: string;
}

interface VideoDraftState {
  id?: string;
  file?: File;
  url?: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  status: "existing" | "pending" | "uploading" | "error";
  error?: string;
}

interface VariantBulkState {
  price: string;
  stock: string;
  status: VariantStatus;
}

const emptyProductForm: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
  categoryId: "",
  brandId: "",
  titleTh: "",
  titleEn: "",
  descriptionTh: "",
  descriptionEn: "",
  metaTitle: "",
  metaDescription: "",
  warrantyInfo: "",
  condition: "",
  countryOfOrigin: "",
  highlightsText: "",
  attributesText: "",
};

const emptyVariantForm: VariantFormState = {
  sku: "",
  title: "",
  titleTh: "",
  titleEn: "",
  price: "",
  currency: "USD",
  status: "ACTIVE",
  quantityOnHand: "0",
  quantityReserved: 0,
  reorderLevel: "0",
  weightGrams: "",
  lengthMm: "",
  widthMm: "",
  heightMm: "",
  optionValueIds: [],
};

function productToForm(product: SellerProduct): ProductFormState {
  return {
    title: product.title ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    status: product.status as ProductStatus,
    categoryId: product.category?.id ?? product.categoryId ?? "",
    brandId: product.brand?.id ?? product.brandId ?? "",
    titleTh: product.titleTh ?? "",
    titleEn: product.titleEn ?? "",
    descriptionTh: product.descriptionTh ?? "",
    descriptionEn: product.descriptionEn ?? "",
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    warrantyInfo: product.warrantyInfo ?? "",
    condition: product.condition ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "",
    highlightsText: (product.highlights ?? []).map((highlight: { text?: string }) => highlight.text ?? "").filter(Boolean).join("\n"),
    attributesText: (product.attributes ?? []).map((attribute: { attributeKey?: string; displayName?: string; value?: string; isFilterable?: boolean }) => [
      attribute.attributeKey ?? attribute.displayName ?? "",
      attribute.displayName ?? "",
      attribute.value ?? "",
      attribute.isFilterable ? "filterable" : "",
    ].join("|")).join("\n"),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseHighlights(value: string) {
  return value.split("\n").map((text, index) => ({ text: text.trim(), sortOrder: index })).filter((highlight) => highlight.text);
}

function parseAttributes(value: string) {
  return value
    .split("\n")
    .map((line, index) => {
      const [key, name, attributeValue, filterable] = line.split("|").map((part) => part.trim());
      return {
        attributeKey: key || undefined,
        displayName: name || key || "",
        value: attributeValue || "",
        sortOrder: index,
        isFilterable: filterable?.toLowerCase() === "filterable" || filterable === "true",
      };
    })
    .filter((attribute) => attribute.displayName && attribute.value);
}

function isProductFormDirty(form: ProductFormState, initial: ProductFormState) {
  return JSON.stringify(form) !== JSON.stringify(initial);
}

function productImagesToDrafts(product?: SellerProduct | null): ImageDraftState[] {
  return (product?.images ?? []).map((image, index) => ({
    id: image.id,
    url: image.url,
    altText: image.altText ?? "",
    sortOrder: image.sortOrder ?? index,
    isPrimary: Boolean(image.isPrimary),
    width: image.width ?? null,
    height: image.height ?? null,
    status: "existing",
  }));
}

function productVideoToDraft(product?: SellerProduct | null): VideoDraftState | null {
  const video = product?.video as SellerProductVideo | null | undefined;
  if (!video) return null;
  return {
    id: video.id,
    url: video.url,
    contentType: video.contentType,
    fileName: video.fileName,
    fileSize: video.fileSize,
    status: "existing",
  };
}

function productVariantsToForms(product?: SellerProduct | null): VariantFormState[] {
  return (product?.variants ?? []).map((variant) => ({
    id: variant.id,
    sku: variant.sku ?? "",
    title: variant.title ?? "",
    titleTh: variant.titleTh ?? "",
    titleEn: variant.titleEn ?? "",
    price: String(Number(variant.price ?? 0) / 100),
    currency: variant.currency ?? "USD",
    status: (variant.status ?? "ACTIVE") as VariantStatus,
    quantityOnHand: String(variant.inventory?.quantityOnHand ?? 0),
    quantityReserved: variant.inventory?.quantityReserved ?? 0,
    reorderLevel: String(variant.inventory?.reorderLevel ?? 0),
    weightGrams: variant.weightGrams == null ? "" : String(variant.weightGrams),
    lengthMm: variant.lengthMm == null ? "" : String(variant.lengthMm),
    widthMm: variant.widthMm == null ? "" : String(variant.widthMm),
    heightMm: variant.heightMm == null ? "" : String(variant.heightMm),
    optionValueIds: (variant.optionValues ?? []).map((item: { optionValueId?: string; optionValue?: { id?: string } }) => item.optionValueId ?? item.optionValue?.id ?? "").filter(Boolean),
  }));
}

function productOptionsToDrafts(product?: SellerProduct | null): ProductOptionDraftState[] {
  return (product?.options ?? []).map((option, optionIndex) => ({
    id: option.id ?? `option-${optionIndex}`,
    name: option.name ?? "",
    nameTh: option.nameTh ?? "",
    nameEn: option.nameEn ?? "",
    sortOrder: option.sortOrder ?? optionIndex,
    values: (option.values ?? []).map((value, valueIndex) => ({
      id: value.id ?? `value-${optionIndex}-${valueIndex}`,
      value: value.value ?? "",
      valueTh: value.valueTh ?? "",
      valueEn: value.valueEn ?? "",
      displayType: value.displayType ?? "TEXT",
      colorHex: value.colorHex ?? "",
      sortOrder: value.sortOrder ?? valueIndex,
    })),
  }));
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function toVariantInput(variant: VariantFormState): SellerVariantInput & { status?: VariantStatus } {
  return {
    sku: variant.sku.trim(),
    title: variant.title.trim(),
    titleTh: optionalText(variant.titleTh),
    titleEn: optionalText(variant.titleEn),
    price: Math.round(Number(variant.price || "0") * 100),
    currency: variant.currency.trim() || "USD",
    status: variant.status,
    quantityOnHand: Number(variant.quantityOnHand || "0"),
    reorderLevel: Number(variant.reorderLevel || "0"),
    weightGrams: toOptionalNumber(variant.weightGrams),
    lengthMm: toOptionalNumber(variant.lengthMm),
    widthMm: toOptionalNumber(variant.widthMm),
    heightMm: toOptionalNumber(variant.heightMm),
    optionValueIds: variant.optionValueIds,
  };
}

function getAvailableStock(variant: VariantFormState) {
  return Math.max(0, Number(variant.quantityOnHand || "0") - variant.quantityReserved);
}

function createPreviewUrl(file: File) {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
}

function getPublishReadiness(form: ProductFormState, images: ImageDraftState[], variants: VariantFormState[]) {
  const missing: string[] = [];
  if (!form.categoryId) missing.push("category");
  if (!images.some((image) => image.isPrimary)) missing.push("primary product image");
  if (!variants.some((variant) => variant.status === "ACTIVE" && Number(variant.price || "0") > 0)) missing.push("one active variant with price greater than zero");
  return missing;
}

function getOptionCombinationKey(variant: VariantFormState) {
  return variant.optionValueIds.filter(Boolean).sort().join("|");
}

function getVariantCombinationLabel(variant: VariantFormState, options: ProductOptionDraftState[]) {
  const labels = options.flatMap((option) => option.values.filter((value) => variant.optionValueIds.includes(value.id)).map((value) => `${option.name || "Option"}: ${value.value || "Value"}`));
  return labels.length ? labels.join(" / ") : "Base variant";
}

function getDuplicateOptionCombinationError(variants: VariantFormState[]) {
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = getOptionCombinationKey(variant);
    if (!key) continue;
    if (seen.has(key)) return "Duplicate variant option combination. Choose a unique option value set for each variant.";
    seen.add(key);
  }
  return "";
}

function getDuplicateSkuIndexes(variants: VariantFormState[]) {
  const counts = new Map<string, number>();
  variants.forEach((variant) => {
    const sku = variant.sku.trim().toLowerCase();
    if (sku) counts.set(sku, (counts.get(sku) ?? 0) + 1);
  });
  return new Set(variants.flatMap((variant, index) => {
    const sku = variant.sku.trim().toLowerCase();
    return sku && (counts.get(sku) ?? 0) > 1 ? [index] : [];
  }));
}

function getDuplicateCombinationIndexes(variants: VariantFormState[]) {
  const counts = new Map<string, number>();
  variants.forEach((variant) => {
    const key = getOptionCombinationKey(variant);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set(variants.flatMap((variant, index) => {
    const key = getOptionCombinationKey(variant);
    return key && (counts.get(key) ?? 0) > 1 ? [index] : [];
  }));
}

function getVariantRowErrors(variant: VariantFormState, index: number, duplicateSkuIndexes: Set<number>, duplicateCombinationIndexes: Set<number>) {
  const errors: string[] = [];
  if (!variant.sku.trim()) errors.push("SKU is required.");
  if (duplicateSkuIndexes.has(index)) errors.push("Duplicate SKU.");
  if (duplicateCombinationIndexes.has(index)) errors.push("Duplicate option combination.");
  if (Number(variant.price || "0") < 0) errors.push("Price cannot be negative.");
  if (Number(variant.quantityOnHand || "0") < 0) errors.push("Stock cannot be negative.");
  return errors;
}

function buildOptionCombinations(options: ProductOptionDraftState[]) {
  const activeOptions = options.slice(0, 2).map((option) => option.values.filter((value) => value.value.trim()).map((value) => value.id)).filter((values) => values.length);
  if (!activeOptions.length) return [];
  if (activeOptions.length === 1) return activeOptions[0].map((id) => [id]);
  return activeOptions[0].flatMap((firstId) => activeOptions[1].map((secondId) => [firstId, secondId]));
}

function buildGeneratedVariant(combination: string[], index: number, options: ProductOptionDraftState[]): VariantFormState {
  const labels = options.flatMap((option) => option.values.filter((value) => combination.includes(value.id)).map((value) => value.value.trim())).filter(Boolean);
  return {
    ...emptyVariantForm,
    sku: `SKU-${index + 1}`,
    title: labels.join(" / ") || `Variant ${index + 1}`,
    optionValueIds: combination,
  };
}

function getLatestModerationReason(product?: SellerProduct | null) {
  const actions = ((product as { moderationCase?: { actions?: Array<{ action?: string; note?: string | null }> } } | null)?.moderationCase?.actions ?? []);
  return actions.find((action) => action.action === "REJECT" || action.action === "SUSPEND")?.note ?? null;
}

function toProductOptionsInput(options: ProductOptionDraftState[]): SellerProductOptionInput[] {
  return options
    .map((option, optionIndex) => ({
      name: option.name.trim(),
      nameTh: optionalText(option.nameTh),
      nameEn: optionalText(option.nameEn),
      sortOrder: optionIndex,
      values: option.values
        .map((value, valueIndex) => ({
          value: value.value.trim(),
          valueTh: optionalText(value.valueTh),
          valueEn: optionalText(value.valueEn),
          displayType: value.displayType.trim() || "TEXT",
          colorHex: optionalText(value.colorHex),
          sortOrder: valueIndex,
        }))
        .filter((value) => value.value),
    }))
    .filter((option) => option.name && option.values.length);
}

function toProductInput(form: ProductFormState): SellerProductInput {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    description: optionalText(form.description),
    status: form.status,
    categoryId: optionalText(form.categoryId),
    brandId: optionalText(form.brandId),
    titleTh: optionalText(form.titleTh),
    titleEn: optionalText(form.titleEn),
    descriptionTh: optionalText(form.descriptionTh),
    descriptionEn: optionalText(form.descriptionEn),
    metaTitle: optionalText(form.metaTitle),
    metaDescription: optionalText(form.metaDescription),
    warrantyInfo: optionalText(form.warrantyInfo),
    condition: optionalText(form.condition),
    countryOfOrigin: optionalText(form.countryOfOrigin),
    highlights: parseHighlights(form.highlightsText),
    attributes: parseAttributes(form.attributesText),
  };
}

function formatMoney(cents: number | bigint | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents ?? 0) / 100);
}

function StatusPill({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{value.replaceAll("_", " ")}</span>;
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load seller data."}</p>
        <Button type="button" variant="outline" onClick={retry}>Retry</Button>
      </CardContent>
    </Card>
  );
}

function getVariantPriceContext(product: SellerProduct) {
  const variants = product.variants ?? [];
  if (!variants.length) return "No variants";
  const prices = variants.map((variant) => Number(variant.price ?? 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants[0]?.currency ?? "USD";
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
}

function getVariantStockContext(product: SellerProduct) {
  const variants = product.variants ?? [];
  if (!variants.length) return "No stock";
  const available = variants.reduce((total, variant) => total + ((variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.quantityReserved ?? 0)), 0);
  return `${available} available`;
}

export function SellerProductsPage() {
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<SellerProduct | null>(null);
  const query = useSellerProducts({ q, status, cursor });
  const archiveProduct = useArchiveSellerProduct();
  const products = query.data?.data ?? [];

  function confirmArchiveProduct() {
    if (!archiveTarget) return;
    archiveProduct.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success("Product archived.");
        setArchiveTarget(null);
      },
      onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Product could not be archived."),
    });
  }

  const columns = useMemo<ColumnDef<SellerProduct>[]>(() => [
    {
      accessorKey: "title",
      header: "Product",
      cell: ({ row }) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-950">{row.original.title}</p>
          <p className="text-xs text-slate-500">{row.original.slug}</p>
          <p className="mt-1 text-xs text-slate-500">{row.original.category?.name ?? "No category"} · {row.original.brand?.name ?? "No brand"}</p>
        </div>
      ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
    {
      id: "assets",
      header: "Assets",
      cell: ({ row }) => <div className="text-sm"><p>{row.original.images?.length ?? 0} images</p><p className="text-xs text-slate-500">{row.original.variants.length} variants</p></div>,
    },
    {
      id: "priceStock",
      header: "Price / stock",
      cell: ({ row }) => <div className="min-w-36 text-sm"><p>{getVariantPriceContext(row.original)}</p><p className="text-xs text-slate-500">{getVariantStockContext(row.original)}</p></div>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm" aria-label={`Edit ${row.original.title}`}>
            <Link href={`/seller/products/${row.original.id}`}>
              <EditIcon className="size-4" />
              <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Archive ${row.original.title}`} onClick={() => setArchiveTarget(row.original)} disabled={row.original.status === "ARCHIVED"}>
            <ArchiveIcon className="size-4" />
            <span className="sr-only">Archive</span>
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <>
      <SellerPageHeader title="Products" description="Create products, monitor catalog status, and prepare variants for your shop." />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={products}
            isLoading={query.isLoading}
            loadingMessage="Loading products..."
            emptyMessage="No products found."
            pageSize={10}
            className="overflow-x-auto"
            renderToolbar={() => (
              <>
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Input value={q} onChange={(event) => { setQ(event.target.value); setCursor(undefined); }} placeholder="Search products" aria-label="Search products" className="sm:max-w-sm" />
                  <Select value={status || "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? "" : value as ProductStatus); setCursor(undefined); }}>
                    <SelectTrigger className="sm:w-48" aria-label="Filter by product status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/seller/products/new">
                    <PlusIcon className="size-4" />
                    Create product
                  </Link>
                </Button>
              </>
            )}
          />
          {query.data?.meta.nextCursor ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setCursor(query.data.meta.nextCursor ?? undefined)}>Load next page</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product</AlertDialogTitle>
            <AlertDialogDescription>
              Archive {archiveTarget?.title ?? "this product"}? Archived products stay in history but are removed from active seller management flows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveProduct.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={archiveProduct.isPending} onClick={confirmArchiveProduct}>
              {archiveProduct.isPending ? "Archiving..." : "Archive product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SellerProductCreatePage() {
  const router = useRouter();
  const createProduct = useCreateSellerProduct();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createProduct.mutate(
      {
        title: "Untitled product draft",
        status: "DRAFT",
      },
      {
        onSuccess: (product) => {
          toast.success("Draft created.");
          router.push(`/seller/products/${product.id}`);
        },
        onError: (mutationError: unknown) => {
          setError(mutationError instanceof Error ? mutationError.message : "Product draft could not be created.");
        },
      },
    );
  }, [createProduct, router]);

  return (
    <>
      <SellerPageHeader title="Create product" description="Preparing a draft product before opening Product Studio." />
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-950">{createProduct.isPending ? "Creating draft..." : "Draft preparation"}</p>
            <p className="mt-1 text-sm text-slate-600">Product Studio opens after the draft record is ready.</p>
          </div>
          {error ? (
            <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <Button type="button" variant="outline" onClick={() => {
                setError("");
                createProduct.mutate(
                  { title: "Untitled product draft", status: "DRAFT" },
                  {
                    onSuccess: (product) => router.push(`/seller/products/${product.id}`),
                    onError: (mutationError: unknown) => setError(mutationError instanceof Error ? mutationError.message : "Product draft could not be created."),
                  },
                );
              }} disabled={createProduct.isPending}>
                Retry
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

export function SellerProductEditPage({ productId }: { productId: string }) {
  return <SellerProductFormPage mode="edit" productId={productId} />;
}

function SellerProductFormPage({ mode, productId }: { mode: "create" | "edit"; productId?: string }) {
  const router = useRouter();
  const productsQuery = useSellerProducts({ limit: 50 });
  const productQuery = useSellerProduct(mode === "edit" ? productId : undefined);
  const categoriesQuery = useSellerCategories();
  const brandsQuery = useSellerBrands();
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const createVariant = useCreateSellerVariant();
  const updateVariant = useUpdateSellerVariant();
  const deleteVariant = useDeleteSellerVariant();
  const updateVariantStock = useUpdateSellerVariantStock();
  const uploadImage = useUploadAndCreateSellerProductImage();
  const updateImageOrder = useUpdateSellerProductImagesOrder();
  const updateImage = useUpdateSellerProductImage();
  const deleteImage = useDeleteSellerProductImage();
  const uploadVideo = useUploadAndUpsertSellerProductVideo();
  const deleteVideo = useDeleteSellerProductVideo();
  const updateOptions = useUpdateSellerProductOptions();
  const submitReview = useSubmitSellerProductReview();
  const product = mode === "edit" ? (productQuery.data ?? (productsQuery.data?.data ?? []).find((item) => item.id === productId)) : null;
  const initialForm = useMemo(() => product ? productToForm(product) : emptyProductForm, [product]);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [createdProduct, setCreatedProduct] = useState<SellerProduct | null>(null);
  const [seedProductId, setSeedProductId] = useState<string | undefined>();
  const [formError, setFormError] = useState("");
  const [images, setImages] = useState<ImageDraftState[]>(() => productImagesToDrafts(product));
  const [video, setVideo] = useState<VideoDraftState | null>(() => productVideoToDraft(product));
  const [variants, setVariants] = useState<VariantFormState[]>(() => productVariantsToForms(product));
  const [options, setOptions] = useState<ProductOptionDraftState[]>(() => productOptionsToDrafts(product));
  const [mediaError, setMediaError] = useState("");
  const [variantError, setVariantError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [bulk, setBulk] = useState<VariantBulkState>({ price: "", stock: "", status: DEFAULT_BULK_STATUS });
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const workingProduct = createdProduct ?? product;
  const workingProductId = workingProduct?.id ?? productId;

  useEffect(() => {
    if (mode === "edit" && product?.id && seedProductId !== product.id) {
      setSeedProductId(product.id);
      setForm(initialForm);
      setImages(productImagesToDrafts(product));
      setVideo(productVideoToDraft(product));
      setVariants(productVariantsToForms(product));
      setOptions(productOptionsToDrafts(product));
    }
  }, [initialForm, mode, product?.id, seedProductId]);

  const readinessMissing = getPublishReadiness(form, images, variants);
  const duplicateCombinationError = getDuplicateOptionCombinationError(variants);
  const duplicateSkuIndexes = useMemo(() => getDuplicateSkuIndexes(variants), [variants]);
  const duplicateCombinationIndexes = useMemo(() => getDuplicateCombinationIndexes(variants), [variants]);
  const hasPrimaryImage = images.some((image) => image.isPrimary);
  const generatedCombinationCount = buildOptionCombinations(options).length;
  const moderationReason = getLatestModerationReason(workingProduct);
  const dirty = isProductFormDirty(form, initialForm) || images.some((image) => image.status !== "existing") || variants.some((variant) => !variant.id) || Boolean(video?.status !== "existing" && video);
  const isSaving = createProduct.isPending || updateProduct.isPending || createVariant.isPending || updateVariant.isPending || updateVariantStock.isPending || uploadImage.isPending || updateImage.isPending || updateImageOrder.isPending || deleteImage.isPending || uploadVideo.isPending || deleteVideo.isPending || deleteVariant.isPending || updateOptions.isPending || submitReview.isPending;
  const saveState = isSaving ? "Saving..." : dirty ? "Unsaved changes" : "Saved";

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    router.push("/seller/products");
  }

  function addOption() {
    setOptionError("");
    if (options.length >= 2) {
      setOptionError("Variant options are limited to two axes.");
      return;
    }
    setOptions((current) => [...current, {
      id: `option-${Date.now()}`,
      name: "",
      nameTh: "",
      nameEn: "",
      sortOrder: current.length,
      values: [{ id: `value-${Date.now()}`, value: "", valueTh: "", valueEn: "", displayType: "TEXT", colorHex: "", sortOrder: 0 }],
    }]);
  }

  function updateOptionDraft(index: number, patch: Partial<ProductOptionDraftState>) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  }

  function addOptionValue(optionIndex: number) {
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: [...option.values, { id: `value-${Date.now()}`, value: "", valueTh: "", valueEn: "", displayType: "TEXT", colorHex: "", sortOrder: option.values.length }],
    } : option));
  }

  function updateOptionValueDraft(optionIndex: number, valueIndex: number, patch: Partial<ProductOptionDraftState["values"][number]>) {
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: option.values.map((value, currentValueIndex) => currentValueIndex === valueIndex ? { ...value, ...patch } : value),
    } : option));
  }

  function removeOption(index: number) {
    const option = options[index];
    const impacted = variants.filter((variant) => option.values.some((value) => variant.optionValueIds.includes(value.id)));
    if (impacted.length && !window.confirm(`Remove ${option.name || "this option"}? ${impacted.length} variant row(s) will lose this option selection.`)) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setVariants((current) => current.map((variant) => ({ ...variant, optionValueIds: variant.optionValueIds.filter((id) => !option.values.some((value) => value.id === id)) })));
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    const value = options[optionIndex]?.values[valueIndex];
    const impacted = variants.filter((variant) => variant.optionValueIds.includes(value?.id ?? ""));
    if (impacted.length && !window.confirm(`Remove ${value?.value || "this value"}? ${impacted.length} variant row(s) using it will be affected.`)) return;
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: option.values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex),
    } : option));
    if (value) {
      setVariants((current) => current.map((variant) => ({ ...variant, optionValueIds: variant.optionValueIds.filter((id) => id !== value.id) })));
    }
  }

  function saveOptions() {
    setOptionError("");
    if (!workingProductId) {
      setOptionError("Save the product as a draft before editing variant options.");
      return;
    }
    const input = toProductOptionsInput(options);
    if (options.length && !input.length) {
      setOptionError("Each option needs a name and at least one value.");
      return;
    }
    updateOptions.mutate({ productId: workingProductId, options: input }, {
      onSuccess: (updatedProduct: SellerProduct) => {
        setOptions(productOptionsToDrafts(updatedProduct));
        toast.success("Variant options saved.");
      },
      onError: (error: unknown) => setOptionError(error instanceof Error ? error.message : "Variant options could not be saved."),
    });
  }

  function saveImageOrder() {
    setMediaError("");
    if (!workingProductId) {
      setMediaError("Save the product as a draft before reordering media.");
      return;
    }
    const existingImages = images.filter((image) => image.status === "existing");
    updateImageOrder.mutate({
      productId: workingProductId,
      images: existingImages.map((image, index) => ({ id: image.id, sortOrder: index })),
      primaryImageId: existingImages.find((image) => image.isPrimary)?.id ?? null,
    }, {
      onSuccess: () => {
        setImages((current) => current.map((image, index) => ({ ...image, sortOrder: index })));
        toast.success("Image order saved.");
      },
      onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : "Image order could not be saved."),
    });
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [image] = next.splice(index, 1);
      next.splice(nextIndex, 0, image);
      return next.map((item, sortOrder) => ({ ...item, sortOrder }));
    });
  }

  function submitForReview() {
    setFormError("");
    if (!workingProductId) {
      setFormError("Save this product as a draft before submitting for review.");
      return;
    }
    if (readinessMissing.length) {
      setFormError(`Submit review needs ${readinessMissing.join(", ")}.`);
      return;
    }
    if (duplicateCombinationError) {
      setVariantError(duplicateCombinationError);
      return;
    }
    submitReview.mutate(workingProductId, {
      onSuccess: () => toast.success("Product submitted for review."),
      onError: (error: unknown) => setFormError(error instanceof Error ? error.message : "Product could not be submitted for review."),
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim()) {
      setFormError("Product title is required.");
      return;
    }
    if (form.status === "ACTIVE" && readinessMissing.length) {
      setFormError(`Active products need ${readinessMissing.join(", ")} before publishing.`);
      return;
    }
    if (duplicateCombinationError) {
      setVariantError(duplicateCombinationError);
      return;
    }
    const input = toProductInput(form);
    const options = {
      onSuccess: (savedProduct: SellerProduct) => {
        toast.success(mode === "edit" ? "Product updated." : "Product created.");
        if (mode === "create") {
          setCreatedProduct(savedProduct);
          setSeedProductId(savedProduct.id);
          setForm(productToForm(savedProduct));
          return;
        }
        router.push("/seller/products");
      },
      onError: (error: unknown) => {
        setFormError(error instanceof Error ? error.message : "Product could not be saved.");
        toast.error("Product could not be saved.");
      },
    };
    if (mode === "edit" && productId) {
      updateProduct.mutate({ productId, ...input }, options);
      return;
    }
    createProduct.mutate(input, options);
  }

  function addImageFiles(event: ChangeEvent<HTMLInputElement>) {
    addImageFileList(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function addImageFileList(files: File[]) {
    setMediaError("");
    if (!files.length) return;
    if (images.length + files.length > MAX_PRODUCT_IMAGES) {
      setMediaError(`Product images are limited to ${MAX_PRODUCT_IMAGES}. Remove an image before adding more.`);
      return;
    }
    setImages((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `pending-${Date.now()}-${index}`,
        file,
        url: createPreviewUrl(file),
        altText: file.name,
        sortOrder: current.length + index,
        isPrimary: current.length === 0 && index === 0,
        status: "pending" as const,
      })),
    ]);
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImages(false);
    addImageFileList(Array.from(event.dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/")));
  }

  function handleImageDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    setIsDraggingImages(active);
  }

  function addVideoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMediaError("");
    if (!file) return;
    if (video) {
      setMediaError("Only one product video can be attached. Remove the current video before uploading another.");
      return;
    }
    if (!PRODUCT_VIDEO_TYPES.includes(file.type)) {
      setMediaError("Product video must be MP4 or WebM.");
      return;
    }
    if (file.size > MAX_PRODUCT_VIDEO_BYTES) {
      setMediaError("Product video must be 25MB or smaller.");
      return;
    }
    setVideo({
      file,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      url: createPreviewUrl(file),
      status: "pending",
    });
  }

  function updateImageDraft(imageId: string, patch: Partial<ImageDraftState>) {
    setImages((current) => current.map((image) => image.id === imageId ? { ...image, ...patch } : image));
  }

  function setPrimaryImage(imageId: string) {
    setImages((current) => current.map((image) => ({ ...image, isPrimary: image.id === imageId })));
  }

  function removeImage(image: ImageDraftState) {
    if (image.status !== "existing" || !workingProductId) {
      setImages((current) => {
        const next = current.filter((item) => item.id !== image.id);
        if (image.isPrimary && next.length) return next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
        return next;
      });
      return;
    }
    deleteImage.mutate({ productId: workingProductId, imageId: image.id }, {
      onSuccess: () => {
        setImages((current) => {
          const next = current.filter((item) => item.id !== image.id);
          if (image.isPrimary && next.length) return next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
          return next;
        });
        toast.success("Image removed.");
      },
      onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : "Image could not be removed."),
    });
  }

  function saveImage(image: ImageDraftState) {
    if (!workingProductId) {
      setMediaError("Save the product as a draft before uploading media.");
      return;
    }
    updateImageDraft(image.id, { status: "uploading", error: undefined });
    if (image.status === "existing") {
      updateImage.mutate({ productId: workingProductId, imageId: image.id, altText: optionalText(image.altText), sortOrder: image.sortOrder, isPrimary: image.isPrimary, width: image.width, height: image.height }, {
        onSuccess: () => {
          updateImageDraft(image.id, { status: "existing" });
          toast.success("Image updated.");
        },
        onError: (error: unknown) => updateImageDraft(image.id, { status: "error", error: error instanceof Error ? error.message : "Image could not be saved." }),
      });
      return;
    }
    if (!image.file) return;
    uploadImage.mutate({ productId: workingProductId, file: image.file, altText: optionalText(image.altText), sortOrder: image.sortOrder, isPrimary: image.isPrimary, width: image.width, height: image.height }, {
      onSuccess: ({ image: savedImage }: { image: SellerProductImage }) => {
        setImages((current) => current.map((item) => item.id === image.id ? { ...item, id: savedImage.id, url: savedImage.url, status: "existing", error: undefined } : item));
        toast.success("Image uploaded.");
      },
      onError: (error: unknown) => updateImageDraft(image.id, { status: "error", error: error instanceof Error ? error.message : "Image upload failed." }),
    });
  }

  function removeVideo() {
    if (video?.status === "existing" && workingProductId) {
      deleteVideo.mutate(workingProductId, {
        onSuccess: () => {
          setVideo(null);
          toast.success("Video removed.");
        },
        onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : "Video could not be removed."),
      });
      return;
    }
    setVideo(null);
  }

  function saveVideo() {
    if (!workingProductId) {
      setMediaError("Save the product as a draft before uploading media.");
      return;
    }
    if (!video?.file) return;
    setVideo((current) => current ? { ...current, status: "uploading", error: undefined } : current);
    uploadVideo.mutate({ productId: workingProductId, file: video.file, sortOrder: 0 }, {
      onSuccess: ({ video: savedVideo }: { video: SellerProductVideo }) => {
        setVideo({
          id: savedVideo.id,
          url: savedVideo.url,
          contentType: savedVideo.contentType,
          fileName: savedVideo.fileName,
          fileSize: savedVideo.fileSize,
          status: "existing",
        });
        toast.success("Video uploaded.");
      },
      onError: (error: unknown) => setVideo((current) => current ? { ...current, status: "error", error: error instanceof Error ? error.message : "Video upload failed." } : current),
    });
  }

  function addVariant() {
    setVariants((current) => [...current, { ...emptyVariantForm, sku: `SKU-${current.length + 1}` }]);
  }

  function generateVariantsFromOptions() {
    const combinations = buildOptionCombinations(options);
    if (!combinations.length) {
      setVariantError("Add at least one option value before generating variant rows.");
      return;
    }
    setVariantError("");
    setVariants((current) => {
      const existingKeys = new Set(current.map(getOptionCombinationKey).filter(Boolean));
      const nextRows = combinations
        .filter((combination) => !existingKeys.has(combination.slice().sort().join("|")))
        .map((combination, index) => buildGeneratedVariant(combination, current.length + index, options));
      return [...current, ...nextRows];
    });
  }

  function moveOptionValue(optionIndex: number, valueIndex: number, direction: -1 | 1) {
    setOptions((current) => current.map((option, index) => {
      if (index !== optionIndex) return option;
      const nextIndex = valueIndex + direction;
      if (nextIndex < 0 || nextIndex >= option.values.length) return option;
      const nextValues = [...option.values];
      const [value] = nextValues.splice(valueIndex, 1);
      nextValues.splice(nextIndex, 0, value);
      return { ...option, values: nextValues.map((item, sortOrder) => ({ ...item, sortOrder })) };
    }));
  }

  function applyBulk(field: keyof VariantBulkState) {
    setVariantError("");
    setVariants((current) => current.map((variant) => {
      if (field === "price" && bulk.price.trim()) return { ...variant, price: bulk.price };
      if (field === "stock" && bulk.stock.trim()) return { ...variant, quantityOnHand: bulk.stock };
      if (field === "status") return { ...variant, status: bulk.status };
      return variant;
    }));
  }

  function updateVariantDraft(index: number, patch: Partial<VariantFormState>) {
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant));
  }

  function deleteVariantDraft(variant: VariantFormState, index: number) {
    if (!window.confirm(`Delete variant ${variant.title || variant.sku || index + 1}?`)) return;
    if (!variant.id || !workingProductId) {
      setVariants((current) => current.filter((_, variantIndex) => variantIndex !== index));
      return;
    }
    deleteVariant.mutate({ productId: workingProductId, variantId: variant.id }, {
      onSuccess: () => {
        setVariants((current) => current.filter((item) => item.id !== variant.id));
        toast.success("Variant deleted.");
      },
      onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : "Variant could not be deleted."),
    });
  }

  function saveVariant(variant: VariantFormState, index: number) {
    setVariantError("");
    if (!workingProductId) {
      setVariantError("Save the product as a draft before adding variants.");
      return;
    }
    if (!variant.sku.trim() || !variant.title.trim()) {
      setVariantError("Variant SKU and title are required.");
      return;
    }
    const rowErrors = getVariantRowErrors(variant, index, duplicateSkuIndexes, duplicateCombinationIndexes);
    if (rowErrors.length) {
      setVariantError(rowErrors.join(" "));
      return;
    }
    if (Number(variant.price || "0") < 0 || Number(variant.quantityOnHand || "0") < 0 || Number(variant.reorderLevel || "0") < 0) {
      setVariantError("Variant price and stock values cannot be negative.");
      return;
    }
    const input = toVariantInput(variant);
    const saveStock = (variantId: string) => {
      updateVariantStock.mutate({
        productId: workingProductId,
        variantId,
        quantityOnHand: input.quantityOnHand,
        reorderLevel: input.reorderLevel,
      }, {
        onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : "Variant stock could not be saved."),
      });
    };
    if (variant.id) {
      updateVariant.mutate({ productId: workingProductId, variantId: variant.id, ...input }, {
        onSuccess: () => {
          saveStock(variant.id!);
          toast.success("Variant updated.");
        },
        onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : "Variant could not be saved."),
      });
      return;
    }
    createVariant.mutate({ productId: workingProductId, ...input }, {
      onSuccess: (savedVariant: { id: string }) => {
        updateVariantDraft(index, { id: savedVariant.id });
        saveStock(savedVariant.id);
        toast.success("Variant created.");
      },
      onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : "Variant could not be saved."),
    });
  }

  if (mode === "edit" && (productQuery.error || productsQuery.error)) {
    return (
      <>
        <SellerPageHeader title="Edit product" description="Update listing details and prepare product setup sections." />
        <ErrorState error={productQuery.error ?? productsQuery.error} retry={() => { void productQuery.refetch(); void productsQuery.refetch(); }} />
      </>
    );
  }

  if (mode === "edit" && (productQuery.isLoading || productsQuery.isLoading)) {
    return (
      <>
        <SellerPageHeader title="Edit product" description="Update listing details and prepare product setup sections." />
        <Card><CardContent className="pt-6 text-sm text-slate-500">Loading product...</CardContent></Card>
      </>
    );
  }

  if (mode === "edit" && !product) {
    return (
      <>
        <SellerPageHeader title="Edit product" description="Update listing details and prepare product setup sections." />
        <Card><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Product could not be found or you do not have access to it.</p><Button type="button" variant="outline" onClick={() => { void productQuery.refetch(); void productsQuery.refetch(); }}>Retry</Button></CardContent></Card>
      </>
    );
  }

  return (
    <>
      <SellerPageHeader title="Product Studio" description="Edit draft content, catalog setup, media, variants, inventory, and review readiness from one workspace." />
      <ProductStudioHeader
        productTitle={form.title || workingProduct?.title || "Untitled product draft"}
        productStatus={form.status}
        saveState={saveState}
        isSaving={isSaving}
        canSubmitReview={Boolean(workingProductId) && readinessMissing.length === 0 && !duplicateCombinationError && form.status !== "PENDING_REVIEW"}
        onSubmitReview={submitForReview}
        onCancel={cancel}
      />
      <ProductStudioNav />
      <form id="seller-product-studio-form" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={submitProduct}>
        <div className="space-y-4">
          <ProductSection id="basics" title="Basics" description="Core listing identity, buyer-facing copy, SEO, brand, condition, warranty, and origin.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="product-title"><Input id="product-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={formError ? "product-form-error" : undefined} /></Field>
              <Field label="Slug" htmlFor="product-slug"><Input id="product-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="optional-slug" /></Field>
            </div>
            <Field label="Description" htmlFor="product-description"><Textarea id="product-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Thai title" htmlFor="product-title-th"><Input id="product-title-th" value={form.titleTh} onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))} /></Field>
              <Field label="English title" htmlFor="product-title-en"><Input id="product-title-en" value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} /></Field>
              <Field label="Thai description" htmlFor="product-description-th"><Textarea id="product-description-th" value={form.descriptionTh} onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))} rows={3} /></Field>
              <Field label="English description" htmlFor="product-description-en"><Textarea id="product-description-en" value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} rows={3} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand" htmlFor="product-brand">
                <Select value={form.brandId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, brandId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-brand" aria-label="Brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No brand</SelectItem>
                    {(brandsQuery.data ?? []).map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="SEO title" htmlFor="product-meta-title"><Input id="product-meta-title" value={form.metaTitle} onChange={(event) => setForm((current) => ({ ...current, metaTitle: event.target.value }))} /></Field>
            </div>
            <Field label="SEO description" htmlFor="product-meta-description"><Textarea id="product-meta-description" value={form.metaDescription} onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))} rows={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Condition" htmlFor="product-condition"><Input id="product-condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} placeholder="New" /></Field>
              <Field label="Warranty info" htmlFor="product-warranty"><Input id="product-warranty" value={form.warrantyInfo} onChange={(event) => setForm((current) => ({ ...current, warrantyInfo: event.target.value }))} /></Field>
              <Field label="Country of origin" htmlFor="product-origin"><Input id="product-origin" value={form.countryOfOrigin} onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))} placeholder="TH" /></Field>
            </div>
          </ProductSection>
          <ProductSection id="category-specs" title="Category & Specs" description="Choose the primary category and enter category-specific specifications as attributes.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="product-category">
                <Select value={form.categoryId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-category" aria-label="Category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No category</SelectItem>
                    {(categoriesQuery.data ?? []).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status" htmlFor="product-status">
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProductStatus }))}>
                  <SelectTrigger id="product-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Specifications" htmlFor="product-attributes"><Textarea id="product-attributes" value={form.attributesText} onChange={(event) => setForm((current) => ({ ...current, attributesText: event.target.value }))} rows={3} placeholder="color|Color|Black|filterable" /></Field>
            <Field label="Highlights" htmlFor="product-highlights"><Textarea id="product-highlights" value={form.highlightsText} onChange={(event) => setForm((current) => ({ ...current, highlightsText: event.target.value }))} rows={3} placeholder="One highlight per line" /></Field>
          </ProductSection>
        </div>
        <aside className="space-y-4">
          <ProductSection id="media" title="Media" description="Upload up to 10 images and one MP4/WebM video after the product has a draft record.">
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Save this product as a draft before uploading media.</p> : null}
            {!hasPrimaryImage ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Readiness warning: choose one primary product image before submitting for review.</p> : null}
            <div
              className={`rounded-lg border border-dashed p-4 text-sm ${isDraggingImages ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-300 bg-white text-slate-600"}`}
              onDragOver={(event) => handleImageDrag(event, true)}
              onDragLeave={(event) => handleImageDrag(event, false)}
              onDrop={handleImageDrop}
            >
              Drag product images here, or use the upload button.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={addImageFiles} aria-label="Upload product images" />
              <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                Add images
              </Button>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="sr-only" onChange={addVideoFile} aria-label="Upload product video" />
              <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                Add video
              </Button>
            </div>
            <p className="text-xs text-slate-500">{images.length}/{MAX_PRODUCT_IMAGES} images. Video limit: one MP4 or WebM up to 25MB.</p>
            {mediaError ? <p className="text-sm text-red-600">{mediaError}</p> : null}
            {images.some((image) => image.status === "existing") ? (
              <Button type="button" variant="outline" onClick={saveImageOrder} disabled={isSaving}>Save image order</Button>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((image, imageIndex) => (
                <div key={image.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <img src={image.url} alt={image.altText || "Product image preview"} className="aspect-square w-full rounded-md object-cover" />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 font-semibold ${image.status === "error" ? "bg-red-100 text-red-700" : image.status === "uploading" ? "bg-blue-100 text-blue-700" : image.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                      {image.status === "existing" ? "Completed" : image.status}
                    </span>
                    {image.isPrimary ? <span className="rounded-full bg-slate-900 px-2 py-1 font-semibold text-white">Primary</span> : null}
                  </div>
                  <Field label="Alt text" htmlFor={`image-alt-${image.id}`}>
                    <Input id={`image-alt-${image.id}`} value={image.altText} onChange={(event) => updateImageDraft(image.id, { altText: event.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Order" htmlFor={`image-order-${image.id}`}>
                      <Input id={`image-order-${image.id}`} type="number" min="0" value={image.sortOrder} onChange={(event) => updateImageDraft(image.id, { sortOrder: Number(event.target.value) })} />
                    </Field>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                      <input type="radio" name="primary-image" checked={image.isPrimary} onChange={() => setPrimaryImage(image.id)} />
                      Primary
                    </label>
                  </div>
                  {image.error ? <p className="text-sm text-red-600">{image.error}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" aria-label={`Move image ${imageIndex + 1} up`} onClick={() => moveImage(image.id, -1)} disabled={imageIndex === 0}><ArrowUpIcon className="size-4" /></Button>
                    <Button type="button" variant="outline" aria-label={`Move image ${imageIndex + 1} down`} onClick={() => moveImage(image.id, 1)} disabled={imageIndex === images.length - 1}><ArrowDownIcon className="size-4" /></Button>
                    <Button type="button" variant="outline" onClick={() => saveImage(image)} disabled={isSaving}>{image.status === "uploading" ? "Uploading..." : image.status === "error" ? "Retry" : "Save image"}</Button>
                    <Button type="button" variant="outline" aria-label={`Remove image ${image.altText || image.id}`} onClick={() => removeImage(image)}><TrashIcon className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            {video ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{video.fileName ?? "Product video"}</p>
                <p className="text-xs text-slate-500">{video.contentType ?? "video"} {video.fileSize ? `- ${(video.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}</p>
                {video.url && video.contentType && PRODUCT_VIDEO_TYPES.includes(video.contentType) ? <video src={video.url} controls className="aspect-video w-full rounded-md bg-slate-100" /> : <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Video preview is unavailable for this file type.</p>}
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${video.status === "error" ? "bg-red-100 text-red-700" : video.status === "uploading" ? "bg-blue-100 text-blue-700" : video.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {video.status === "existing" ? "Completed" : video.status}
                </span>
                {video.error ? <p className="text-sm text-red-600">{video.error}</p> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={saveVideo} disabled={isSaving || video.status === "existing"}>{video.status === "uploading" ? "Uploading..." : video.status === "error" ? "Retry video" : "Save video"}</Button>
                  <Button type="button" variant="outline" onClick={removeVideo}>Remove video</Button>
                </div>
              </div>
            ) : null}
            {!video ? <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">No product video attached.</p> : null}
          </ProductSection>
          <ProductSection id="variants" title="Variants" description="Define option axes, option values, and sellable variant rows.">
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Save this product as a draft before editing variant options.</p> : null}
            {optionError ? <p className="text-sm text-red-600">{optionError}</p> : null}
            {duplicateCombinationError ? <p className="text-sm text-red-600">{duplicateCombinationError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addOption} disabled={options.length >= 2}><PlusIcon className="size-4" />Add option</Button>
              <Button type="button" variant="outline" onClick={saveOptions} disabled={isSaving}>Save options</Button>
              <Button type="button" variant="outline" onClick={generateVariantsFromOptions} disabled={!generatedCombinationCount}>Generate rows</Button>
            </div>
            <p className="text-xs text-slate-500">Up to two axes. Current option values can generate {generatedCombinationCount} combination row(s).</p>
            <div className="space-y-3">
              {options.length ? options.map((option, optionIndex) => (
                <div key={option.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label="Option name" htmlFor={`option-name-${optionIndex}`}><Input id={`option-name-${optionIndex}`} value={option.name} onChange={(event) => updateOptionDraft(optionIndex, { name: event.target.value })} placeholder="Color" /></Field>
                    <Field label="Thai name" htmlFor={`option-name-th-${optionIndex}`}><Input id={`option-name-th-${optionIndex}`} value={option.nameTh} onChange={(event) => updateOptionDraft(optionIndex, { nameTh: event.target.value })} /></Field>
                    <div className="flex items-end"><Button type="button" variant="outline" onClick={() => removeOption(optionIndex)}>Remove</Button></div>
                  </div>
                  <div className="space-y-2">
                    {option.values.map((value, valueIndex) => (
                      <div key={value.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto_auto]">
                        <Input aria-label={`Option ${optionIndex + 1} value ${valueIndex + 1}`} value={value.value} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { value: event.target.value })} placeholder="Black" />
                        <Input aria-label={`Option ${optionIndex + 1} value ${valueIndex + 1} Thai`} value={value.valueTh} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { valueTh: event.target.value })} />
                        <Input aria-label={`Option ${optionIndex + 1} value ${valueIndex + 1} color`} value={value.colorHex} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { colorHex: event.target.value })} placeholder="#000000" />
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" aria-label={`Move option ${optionIndex + 1} value ${valueIndex + 1} up`} onClick={() => moveOptionValue(optionIndex, valueIndex, -1)} disabled={valueIndex === 0}><ArrowUpIcon className="size-4" /></Button>
                          <Button type="button" variant="outline" aria-label={`Move option ${optionIndex + 1} value ${valueIndex + 1} down`} onClick={() => moveOptionValue(optionIndex, valueIndex, 1)} disabled={valueIndex === option.values.length - 1}><ArrowDownIcon className="size-4" /></Button>
                        </div>
                        <Button type="button" variant="outline" onClick={() => removeOptionValue(optionIndex, valueIndex)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={() => addOptionValue(optionIndex)}>Add value</Button>
                </div>
              )) : <p className="text-sm text-slate-500">No structured options yet. Add options such as color or size when this product has variants.</p>}
            </div>
          </ProductSection>
          <ProductSection title="Variant rows" description="Create, edit, delete, price, dimensions, and stock setup per sellable option combination.">
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Save this product as a draft before adding variants.</p> : null}
            {variantError ? <p className="text-sm text-red-600">{variantError}</p> : null}
            <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto]">
              <Field label="Bulk price" htmlFor="bulk-price"><Input id="bulk-price" type="number" min="0" step="0.01" value={bulk.price} onChange={(event) => setBulk((current) => ({ ...current, price: event.target.value }))} /></Field>
              <Field label="Bulk stock" htmlFor="bulk-stock"><Input id="bulk-stock" type="number" min="0" value={bulk.stock} onChange={(event) => setBulk((current) => ({ ...current, stock: event.target.value }))} /></Field>
              <Field label="Bulk status" htmlFor="bulk-status">
                <Select value={bulk.status} onValueChange={(value) => setBulk((current) => ({ ...current, status: value as VariantStatus }))}>
                  <SelectTrigger id="bulk-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("price")}>Apply price</Button></div>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("stock")}>Apply stock</Button></div>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("status")}>Apply status</Button></div>
            </div>
            <Button type="button" variant="outline" onClick={addVariant}><PlusIcon className="size-4" />Add variant</Button>
            <div className="space-y-3">
              {variants.map((variant, index) => {
                const rowErrors = getVariantRowErrors(variant, index, duplicateSkuIndexes, duplicateCombinationIndexes);
                const available = getAvailableStock(variant);
                return (
                <div key={variant.id ?? index} className={`space-y-3 rounded-lg border p-3 ${rowErrors.length ? "border-red-200 bg-red-50" : variant.status === "INACTIVE" ? "border-slate-200 bg-slate-100 opacity-80" : available <= 0 ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-slate-900">{getVariantCombinationLabel(variant, options)}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {variant.status === "INACTIVE" ? <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700">Inactive</span> : null}
                      {available <= 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">Out of stock</span> : null}
                    </div>
                  </div>
                  {rowErrors.length ? <p className="text-sm text-red-700">{rowErrors.join(" ")}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="SKU" htmlFor={`variant-sku-${index}`}><Input id={`variant-sku-${index}`} value={variant.sku} onChange={(event) => updateVariantDraft(index, { sku: event.target.value })} /></Field>
                    <Field label="Variant title" htmlFor={`variant-title-${index}`}><Input id={`variant-title-${index}`} value={variant.title} onChange={(event) => updateVariantDraft(index, { title: event.target.value })} /></Field>
                    <Field label="Thai variant title" htmlFor={`variant-title-th-${index}`}><Input id={`variant-title-th-${index}`} value={variant.titleTh} onChange={(event) => updateVariantDraft(index, { titleTh: event.target.value })} /></Field>
                    <Field label="English variant title" htmlFor={`variant-title-en-${index}`}><Input id={`variant-title-en-${index}`} value={variant.titleEn} onChange={(event) => updateVariantDraft(index, { titleEn: event.target.value })} /></Field>
                    <Field label="Price" htmlFor={`variant-price-${index}`}><Input id={`variant-price-${index}`} type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariantDraft(index, { price: event.target.value })} /></Field>
                    <Field label="Currency" htmlFor={`variant-currency-${index}`}><Input id={`variant-currency-${index}`} value={variant.currency} onChange={(event) => updateVariantDraft(index, { currency: event.target.value.toUpperCase() })} /></Field>
                    <Field label="Variant status" htmlFor={`variant-status-${index}`}>
                      <Select value={variant.status} onValueChange={(value) => updateVariantDraft(index, { status: value as VariantStatus })}>
                        <SelectTrigger id={`variant-status-${index}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {options.length ? (
                    <div className="space-y-2 rounded-md bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">Option values</p>
                      {options.map((option) => (
                        <div key={option.id} className="space-y-1">
                          <p className="text-xs font-semibold text-slate-600">{option.name || "Option"}</p>
                          <div className="flex flex-wrap gap-2">
                            {option.values.map((value) => {
                              const checked = variant.optionValueIds.includes(value.id);
                              return (
                                <label key={value.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const nextIds = event.target.checked
                                        ? [...variant.optionValueIds.filter((id) => !option.values.some((item) => item.id === id)), value.id]
                                        : variant.optionValueIds.filter((id) => id !== value.id);
                                      updateVariantDraft(index, { optionValueIds: nextIds });
                                    }}
                                  />
                                  {value.value || "Value"}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Quantity on hand" htmlFor={`variant-on-hand-${index}`}><Input id={`variant-on-hand-${index}`} type="number" min="0" value={variant.quantityOnHand} onChange={(event) => updateVariantDraft(index, { quantityOnHand: event.target.value })} /></Field>
                    <Field label="Reorder level" htmlFor={`variant-reorder-${index}`}><Input id={`variant-reorder-${index}`} type="number" min="0" value={variant.reorderLevel} onChange={(event) => updateVariantDraft(index, { reorderLevel: event.target.value })} /></Field>
                    <Field label="Quantity reserved" htmlFor={`variant-reserved-${index}`}><Input id={`variant-reserved-${index}`} value={variant.quantityReserved} readOnly /></Field>
                    <Field label="Available stock" htmlFor={`variant-available-${index}`}><Input id={`variant-available-${index}`} value={getAvailableStock(variant)} readOnly /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Weight grams" htmlFor={`variant-weight-${index}`}><Input id={`variant-weight-${index}`} type="number" min="0" value={variant.weightGrams} onChange={(event) => updateVariantDraft(index, { weightGrams: event.target.value })} /></Field>
                    <Field label="Length mm" htmlFor={`variant-length-${index}`}><Input id={`variant-length-${index}`} type="number" min="0" value={variant.lengthMm} onChange={(event) => updateVariantDraft(index, { lengthMm: event.target.value })} /></Field>
                    <Field label="Width mm" htmlFor={`variant-width-${index}`}><Input id={`variant-width-${index}`} type="number" min="0" value={variant.widthMm} onChange={(event) => updateVariantDraft(index, { widthMm: event.target.value })} /></Field>
                    <Field label="Height mm" htmlFor={`variant-height-${index}`}><Input id={`variant-height-${index}`} type="number" min="0" value={variant.heightMm} onChange={(event) => updateVariantDraft(index, { heightMm: event.target.value })} /></Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => saveVariant(variant, index)} disabled={isSaving}>Save variant</Button>
                    <Button type="button" variant="outline" onClick={() => deleteVariantDraft(variant, index)}>Delete variant</Button>
                  </div>
                </div>
              );})}
            </div>
          </ProductSection>
          <ProductSection id="inventory" title="Inventory" description="Review on-hand, reserved, available, reorder, and low-stock state across variants.">
            {variants.length ? (
              <div className="space-y-2">
                {variants.map((variant, index) => {
                  const available = getAvailableStock(variant);
                  const reorderLevel = Number(variant.reorderLevel || "0");
                  return (
                    <div key={variant.id ?? `inventory-${index}`} className="rounded-md border border-slate-200 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{variant.title || variant.sku || `Variant ${index + 1}`}</p>
                          <p className="text-xs text-slate-500">{variant.sku || "No SKU"}</p>
                        </div>
                        {available <= reorderLevel ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Low stock</span> : null}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                        <span>On hand: {variant.quantityOnHand || 0}</span>
                        <span>Reserved: {variant.quantityReserved}</span>
                        <span>Available: {available}</span>
                        <span>Reorder: {variant.reorderLevel || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Inventory appears after at least one variant is added.</p>
            )}
          </ProductSection>
          <ProductSection id="review" title="Review" description="Drafts can save early; review submission needs catalog, media, and sellable variant setup.">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">Moderation status: {workingProduct?.status?.replaceAll("_", " ") ?? "Draft not saved"}</p>
              {moderationReason ? <p className="mt-1 text-sm text-red-700">Reason: {moderationReason}</p> : null}
            </div>
            {readinessMissing.length ? (
              <p className="text-sm text-amber-700">Active publish readiness missing: {readinessMissing.join(", ")}.</p>
            ) : (
              <p className="text-sm text-green-700">This product has the visible setup needed for active publishing. Backend validation remains final.</p>
            )}
            {duplicateCombinationError ? <p className="text-sm text-red-600">{duplicateCombinationError}</p> : null}
            <Button type="button" variant="outline" onClick={submitForReview} disabled={isSaving || readinessMissing.length > 0 || Boolean(duplicateCombinationError) || form.status === "PENDING_REVIEW"}>
              <SendIcon className="size-4" />
              {submitReview.isPending ? "Submitting..." : "Submit for review"}
            </Button>
          </ProductSection>
          {formError ? <p id="product-form-error" className="text-sm text-red-600">{formError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end xl:flex-col-reverse">
            <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save product"}</Button>
          </div>
        </aside>
      </form>
    </>
  );
}

function ProductStudioHeader({
  productTitle,
  productStatus,
  saveState,
  isSaving,
  canSubmitReview,
  onSubmitReview,
  onCancel,
}: {
  productTitle: string;
  productStatus: ProductStatus;
  saveState: string;
  isSaving: boolean;
  canSubmitReview: boolean;
  onSubmitReview: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-950">{productTitle}</h2>
            <StatusPill value={productStatus} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Save state: {saveState}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button form="seller-product-studio-form" type="submit" disabled={isSaving}>
            <SaveIcon className="size-4" />
            {isSaving ? "Saving..." : "Save draft"}
          </Button>
          <Button type="button" variant="outline" onClick={onSubmitReview} disabled={isSaving || !canSubmitReview}>
            <SendIcon className="size-4" />
            Submit review
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductStudioNav() {
  return (
    <nav aria-label="Product Studio sections" className="overflow-x-auto border-b border-slate-200 pb-2">
      <div className="flex min-w-max gap-2">
        {PRODUCT_STUDIO_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function ProductSection({ id, title, description, children }: { id?: ProductStudioSectionId; title: string; description: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-32 rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
