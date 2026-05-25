"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArchiveIcon, EditIcon, PlusIcon } from "lucide-react";
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
  type SellerProductInput,
  useArchiveSellerProduct,
  useCreateSellerProduct,
  useSellerBrands,
  useSellerCategories,
  useSellerProducts,
  useUpdateSellerProduct,
} from "../hooks/useSellerManage";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

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
            <Link href={`/seller/products/${row.original.id}/edit`}>
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
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/seller/products/create">
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
  return <SellerProductFormPage mode="create" />;
}

export function SellerProductEditPage({ productId }: { productId: string }) {
  return <SellerProductFormPage mode="edit" productId={productId} />;
}

function SellerProductFormPage({ mode, productId }: { mode: "create" | "edit"; productId?: string }) {
  const router = useRouter();
  const productsQuery = useSellerProducts({ limit: 50 });
  const categoriesQuery = useSellerCategories();
  const brandsQuery = useSellerBrands();
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const product = mode === "edit" ? (productsQuery.data?.data ?? []).find((item) => item.id === productId) : null;
  const initialForm = useMemo(() => product ? productToForm(product) : emptyProductForm, [product]);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [seedProductId, setSeedProductId] = useState<string | undefined>();
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (mode === "edit" && product?.id && seedProductId !== product.id) {
      setSeedProductId(product.id);
      setForm(initialForm);
    }
  }, [initialForm, mode, product?.id, seedProductId]);

  const dirty = isProductFormDirty(form, initialForm);
  const isSaving = createProduct.isPending || updateProduct.isPending;

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    router.push("/seller/products");
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError("Product title is required.");
      return;
    }
    const input = toProductInput(form);
    const options = {
      onSuccess: () => {
        toast.success(mode === "edit" ? "Product updated." : "Product created.");
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

  if (mode === "edit" && productsQuery.error) {
    return (
      <>
        <SellerPageHeader title="Edit product" description="Update listing details and prepare product setup sections." />
        <ErrorState error={productsQuery.error} retry={() => void productsQuery.refetch()} />
      </>
    );
  }

  if (mode === "edit" && productsQuery.isLoading) {
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
        <Card><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Product could not be found.</p><Button type="button" variant="outline" onClick={() => void productsQuery.refetch()}>Retry</Button></CardContent></Card>
      </>
    );
  }

  return (
    <>
      <SellerPageHeader title={mode === "edit" ? "Edit product" : "Create product"} description="Use a page-level workflow for listing fields, media, variants, stock, dimensions, highlights, and attributes." />
      <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={submitProduct}>
        <div className="space-y-4">
          <ProductSection title="Basic info" description="Core listing identity and buyer-facing description.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="product-title"><Input id="product-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={formError ? "product-form-error" : undefined} /></Field>
              <Field label="Slug" htmlFor="product-slug"><Input id="product-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="optional-slug" /></Field>
            </div>
            <Field label="Description" htmlFor="product-description"><Textarea id="product-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></Field>
            <Field label="Status" htmlFor="product-status">
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProductStatus }))}>
                <SelectTrigger id="product-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </ProductSection>
          <ProductSection title="Category and brand" description="Drafts can be saved without category or brand.">
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
              <Field label="Brand" htmlFor="product-brand">
                <Select value={form.brandId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, brandId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-brand" aria-label="Brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No brand</SelectItem>
                    {(brandsQuery.data ?? []).map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </ProductSection>
          <ProductSection title="Localized content" description="Optional Thai and English listing copy.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Thai title" htmlFor="product-title-th"><Input id="product-title-th" value={form.titleTh} onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))} /></Field>
              <Field label="English title" htmlFor="product-title-en"><Input id="product-title-en" value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} /></Field>
              <Field label="Thai description" htmlFor="product-description-th"><Textarea id="product-description-th" value={form.descriptionTh} onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))} rows={3} /></Field>
              <Field label="English description" htmlFor="product-description-en"><Textarea id="product-description-en" value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} rows={3} /></Field>
            </div>
          </ProductSection>
          <ProductSection title="Highlights and attributes" description="Structured buyer-facing listing details.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SEO title" htmlFor="product-meta-title"><Input id="product-meta-title" value={form.metaTitle} onChange={(event) => setForm((current) => ({ ...current, metaTitle: event.target.value }))} /></Field>
              <Field label="Condition" htmlFor="product-condition"><Input id="product-condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} placeholder="New" /></Field>
            </div>
            <Field label="SEO description" htmlFor="product-meta-description"><Textarea id="product-meta-description" value={form.metaDescription} onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))} rows={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Warranty info" htmlFor="product-warranty"><Input id="product-warranty" value={form.warrantyInfo} onChange={(event) => setForm((current) => ({ ...current, warrantyInfo: event.target.value }))} /></Field>
              <Field label="Country of origin" htmlFor="product-origin"><Input id="product-origin" value={form.countryOfOrigin} onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))} placeholder="TH" /></Field>
            </div>
            <Field label="Highlights" htmlFor="product-highlights"><Textarea id="product-highlights" value={form.highlightsText} onChange={(event) => setForm((current) => ({ ...current, highlightsText: event.target.value }))} rows={3} placeholder="One highlight per line" /></Field>
            <Field label="Attributes" htmlFor="product-attributes"><Textarea id="product-attributes" value={form.attributesText} onChange={(event) => setForm((current) => ({ ...current, attributesText: event.target.value }))} rows={3} placeholder="color|Color|Black|filterable" /></Field>
          </ProductSection>
        </div>
        <aside className="space-y-4">
          <ProductSection title="Media" description="Image and video upload management continues in the next task.">
            <p className="text-sm text-slate-600">{product?.images?.length ?? 0} image records attached.</p>
          </ProductSection>
          <ProductSection title="Variants" description="Variant creation and editing will move into this page workflow next.">
            <p className="text-sm text-slate-600">{product?.variants?.length ?? 0} variants configured.</p>
          </ProductSection>
          <ProductSection title="Stock" description="Simple stock setup will use editable on-hand and reorder values only.">
            <p className="text-sm text-slate-600">Reserved stock remains read-only.</p>
          </ProductSection>
          <ProductSection title="Dimensions" description="Weight and package dimensions are captured per variant.">
            <p className="text-sm text-slate-600">Normalized grams and millimeters.</p>
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

function ProductSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white">
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
