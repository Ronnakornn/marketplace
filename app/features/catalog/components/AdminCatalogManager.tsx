"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoxesIcon,
  Layers3Icon,
  PackagePlusIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
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
import {
  type CatalogProduct,
  type CatalogVariant,
  useCatalogProducts,
  useCatalogProductDetail,
  useCreateCatalogProduct,
  useCreateCatalogVariant,
  useUpdateCatalogInventory,
  useUpdateCatalogProduct,
} from "../hooks/useCatalog";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

interface ProductFormState {
  shopId: string;
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
}

interface VariantFormState {
  sku: string;
  title: string;
  priceCents: string;
  currency: string;
  quantityOnHand: string;
  reorderLevel: string;
}

interface InventoryFormState {
  quantityOnHand: string;
  quantityReserved: string;
  reorderLevel: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  shopId: "",
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
};

const EMPTY_VARIANT_FORM: VariantFormState = {
  sku: "",
  title: "",
  priceCents: "",
  currency: "USD",
  quantityOnHand: "0",
  reorderLevel: "0",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "value" in error &&
    typeof (error as { value?: unknown }).value === "object" &&
    (error as { value?: { message?: unknown } }).value?.message
  ) {
    return String((error as { value?: { message?: unknown } }).value?.message);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function statusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-300/25 bg-emerald-300/12 text-emerald-100";
    case "ARCHIVED":
      return "border-slate-300/20 bg-white/6 text-slate-300";
    default:
      return "border-amber-300/25 bg-amber-300/12 text-amber-100";
  }
}

function CatalogSkeleton() {
  return (
    <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
      <CardHeader>
        <Skeleton className="h-7 w-48 bg-white/12" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-11 w-full bg-white/10" />
        <Skeleton className="mt-4 h-64 w-full bg-white/8" />
      </CardContent>
    </Card>
  );
}

function ProductDialog(props: {
  mode: "create" | "edit";
  open: boolean;
  initialValues: ProductFormState;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProductFormState) => Promise<void>;
}) {
  const { mode, open, initialValues, pending, errorMessage, onOpenChange, onSubmit } = props;
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    if (open) setForm(initialValues);
  }, [initialValues, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.8)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create product" : "Update product"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Product data is catalog-only. Cart and checkout are not part of this screen.
          </DialogDescription>
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-shop-id`}>
                Shop ID
              </label>
              <Input
                id={`${mode}-shop-id`}
                value={form.shopId}
                onChange={(event) => setForm((current) => ({ ...current, shopId: event.target.value }))}
                disabled={mode === "edit"}
                className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-status`}>
                Status
              </label>
              <select
                id={`${mode}-status`}
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProductStatus }))}
                className="flex h-9 w-full rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-title`}>
                Title
              </label>
              <Input
                id={`${mode}-title`}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-slug`}>
                Slug
              </label>
              <Input
                id={`${mode}-slug`}
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-description`}>
              Description
            </label>
            <textarea
              id={`${mode}-description`}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(168,85,247,0.9))] text-slate-950 hover:opacity-95" disabled={pending}>
              {pending ? "Saving..." : "Save product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog(props: {
  open: boolean;
  product: CatalogProduct | null;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VariantFormState) => Promise<void>;
}) {
  const { open, product, pending, errorMessage, onOpenChange, onSubmit } = props;
  const [form, setForm] = useState(EMPTY_VARIANT_FORM);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.8)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create variant</DialogTitle>
          <DialogDescription className="text-slate-400">
            {product ? `Add a sellable variant for ${product.title}.` : "Add a sellable variant."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(form).then(() => setForm(EMPTY_VARIANT_FORM));
          }}
        >
          {errorMessage ? <div className="rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 text-sm text-red-200">{errorMessage}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="SKU" value={form.sku} onChange={(value) => setForm((current) => ({ ...current, sku: value }))} required />
            <InputField label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} required />
            <InputField label="Price cents" type="number" value={form.priceCents} onChange={(value) => setForm((current) => ({ ...current, priceCents: value }))} required />
            <InputField label="Currency" value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value }))} required />
            <InputField label="Quantity on hand" type="number" value={form.quantityOnHand} onChange={(value) => setForm((current) => ({ ...current, quantityOnHand: value }))} required />
            <InputField label="Reorder level" type="number" value={form.reorderLevel} onChange={(value) => setForm((current) => ({ ...current, reorderLevel: value }))} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={pending || !product}>
              {pending ? "Saving..." : "Create variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryDialog(props: {
  open: boolean;
  variant: CatalogVariant | null;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: InventoryFormState) => Promise<void>;
}) {
  const { open, variant, pending, errorMessage, onOpenChange, onSubmit } = props;
  const inventory = variant?.inventory;
  const [form, setForm] = useState<InventoryFormState>({
    quantityOnHand: String(inventory?.quantityOnHand ?? 0),
    quantityReserved: String(inventory?.quantityReserved ?? 0),
    reorderLevel: String(inventory?.reorderLevel ?? 0),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.8)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage inventory</DialogTitle>
          <DialogDescription className="text-slate-400">
            {variant ? `${variant.sku} - ${variant.title}` : "Update stock levels."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(form);
          }}
        >
          {errorMessage ? <div className="rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 text-sm text-red-200">{errorMessage}</div> : null}
          <InputField label="Quantity on hand" type="number" value={form.quantityOnHand} onChange={(value) => setForm((current) => ({ ...current, quantityOnHand: value }))} required />
          <InputField label="Quantity reserved" type="number" value={form.quantityReserved} onChange={(value) => setForm((current) => ({ ...current, quantityReserved: value }))} required />
          <InputField label="Reorder level" type="number" value={form.reorderLevel} onChange={(value) => setForm((current) => ({ ...current, reorderLevel: value }))} required />
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={pending || !variant}>
              {pending ? "Saving..." : "Save inventory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InputField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-200" htmlFor={id}>
        {props.label}
      </label>
      <Input
        id={id}
        type={props.type}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required={props.required}
        className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
      />
    </div>
  );
}

export function AdminCatalogManager() {
  const { data: products = [], isLoading, error, refetch } = useCatalogProducts();
  const createProduct = useCreateCatalogProduct();
  const updateProduct = useUpdateCatalogProduct();
  const createVariant = useCreateCatalogVariant();
  const updateInventory = useUpdateCatalogInventory();

  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [variantProduct, setVariantProduct] = useState<CatalogProduct | null>(null);
  const [inventoryVariant, setInventoryVariant] = useState<CatalogVariant | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0] ?? null;
  const { data: productDetail } = useCatalogProductDetail(selectedProduct?.id ?? null);
  const detailProduct = productDetail ?? selectedProduct;

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.title, product.slug, product.shop.name, product.shop.slug]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [products, query]);

  if (isLoading) return <CatalogSkeleton />;

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="pt-6">
          <p className="text-sm text-red-200">{getErrorMessage(error, "Failed to load catalog")}</p>
          <Button variant="outline" size="sm" className="mt-3 border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => void refetch()}>
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
      <Card className="admin-panel overflow-hidden rounded-2xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <BoxesIcon className="size-5 text-cyan-200" />
                Products
              </CardTitle>
              <p className="mt-2 text-sm text-slate-300">Create products, add variants, and keep stock levels current.</p>
            </div>
            <Button
              size="sm"
              className="border border-cyan-300/30 bg-[linear-gradient(90deg,rgba(125,211,252,0.95),rgba(167,243,208,0.95))] font-semibold text-slate-950 shadow-[0_10px_30px_rgba(103,232,249,0.18)] hover:brightness-105"
              onClick={() => {
                setDialogError(null);
                setIsCreateProductOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              Create Product
            </Button>
          </div>
          <div className="relative mt-5 max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products or shops..."
              className="pl-9 border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
                <TableHead className="px-6 text-slate-300">Product</TableHead>
                <TableHead className="px-6 text-slate-300">Shop</TableHead>
                <TableHead className="px-6 text-slate-300">Status</TableHead>
                <TableHead className="px-6 text-slate-300">Variants</TableHead>
                <TableHead className="px-6 text-right text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length ? filteredProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className="border-white/8 hover:bg-white/4"
                  data-state={selectedProduct?.id === product.id ? "selected" : undefined}
                >
                  <TableCell className="px-6 py-4">
                    <button type="button" className="text-left" onClick={() => setSelectedProductId(product.id)}>
                      <span className="block font-medium text-white">{product.title}</span>
                      <span className="mt-1 block text-xs text-slate-400">{product.slug}</span>
                    </button>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-300">
                    <span className="block">{product.shop.name}</span>
                    <span className="text-xs text-slate-500">{product.shop.slug}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(product.status)}`}>
                      {product.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-300">{product.variants.length}</TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="border-cyan-300/20 bg-cyan-300/8 text-cyan-100 hover:bg-cyan-300/16 hover:text-white" onClick={() => setEditingProduct(product)}>
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="border-violet-300/20 bg-violet-300/8 text-violet-100 hover:bg-violet-300/16 hover:text-white" onClick={() => setVariantProduct(product)}>
                        <PackagePlusIcon className="size-3.5" />
                        Variant
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableCell colSpan={5} className="h-28 text-center text-slate-300">No products found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Layers3Icon className="size-5 text-cyan-200" />
            Product Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detailProduct ? (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-white">{detailProduct.title}</p>
                <p className="mt-1 text-sm text-slate-400">{detailProduct.description ?? "No description"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Metric label="Shop" value={detailProduct.shop.name} />
                <Metric label="Product ID" value={detailProduct.id} />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-white">Variants</p>
                {detailProduct.variants.length ? detailProduct.variants.map((variant) => (
                  <div key={variant.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{variant.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{variant.sku}</p>
                      </div>
                      <p className="text-sm font-semibold text-cyan-100">{formatMoney(variant.priceCents, variant.currency)}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <Metric label="On hand" value={String(variant.inventory?.quantityOnHand ?? 0)} compact />
                      <Metric label="Reserved" value={String(variant.inventory?.quantityReserved ?? 0)} compact />
                      <Metric label="Reorder" value={String(variant.inventory?.reorderLevel ?? 0)} compact />
                    </div>
                    <Button variant="outline" size="sm" className="mt-4 border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => setInventoryVariant(variant)}>
                      <SlidersHorizontalIcon className="size-3.5" />
                      Inventory
                    </Button>
                  </div>
                )) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No variants yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300">Select a product to inspect variants and inventory.</p>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        mode="create"
        open={isCreateProductOpen}
        initialValues={EMPTY_PRODUCT_FORM}
        pending={createProduct.isPending}
        errorMessage={dialogError}
        onOpenChange={(open) => {
          setIsCreateProductOpen(open);
          if (!open) setDialogError(null);
        }}
        onSubmit={async (values) => {
          try {
            setDialogError(null);
            await createProduct.mutateAsync({
              shopId: values.shopId,
              title: values.title,
              slug: values.slug || undefined,
              description: values.description || null,
              status: values.status,
            });
            setIsCreateProductOpen(false);
          } catch (submitError) {
            setDialogError(getErrorMessage(submitError, "Failed to create product"));
          }
        }}
      />

      <ProductDialog
        mode="edit"
        open={editingProduct !== null}
        initialValues={editingProduct ? {
          shopId: editingProduct.shopId,
          title: editingProduct.title,
          slug: editingProduct.slug,
          description: editingProduct.description ?? "",
          status: editingProduct.status,
        } : EMPTY_PRODUCT_FORM}
        pending={updateProduct.isPending}
        errorMessage={dialogError}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setDialogError(null);
          }
        }}
        onSubmit={async (values) => {
          if (!editingProduct) return;
          try {
            setDialogError(null);
            await updateProduct.mutateAsync({
              id: editingProduct.id,
              title: values.title,
              slug: values.slug,
              description: values.description || null,
              status: values.status,
            });
            setEditingProduct(null);
          } catch (submitError) {
            setDialogError(getErrorMessage(submitError, "Failed to update product"));
          }
        }}
      />

      <VariantDialog
        open={variantProduct !== null}
        product={variantProduct}
        pending={createVariant.isPending}
        errorMessage={dialogError}
        onOpenChange={(open) => {
          if (!open) {
            setVariantProduct(null);
            setDialogError(null);
          }
        }}
        onSubmit={async (values) => {
          if (!variantProduct) return;
          try {
            setDialogError(null);
            await createVariant.mutateAsync({
              productId: variantProduct.id,
              sku: values.sku,
              title: values.title,
              priceCents: Number(values.priceCents),
              currency: values.currency,
              inventory: {
                quantityOnHand: Number(values.quantityOnHand),
                reorderLevel: Number(values.reorderLevel),
              },
            });
            setVariantProduct(null);
          } catch (submitError) {
            setDialogError(getErrorMessage(submitError, "Failed to create variant"));
          }
        }}
      />

      <InventoryDialog
        open={inventoryVariant !== null}
        variant={inventoryVariant}
        pending={updateInventory.isPending}
        errorMessage={dialogError}
        onOpenChange={(open) => {
          if (!open) {
            setInventoryVariant(null);
            setDialogError(null);
          }
        }}
        onSubmit={async (values) => {
          if (!inventoryVariant) return;
          try {
            setDialogError(null);
            await updateInventory.mutateAsync({
              variantId: inventoryVariant.id,
              quantityOnHand: Number(values.quantityOnHand),
              quantityReserved: Number(values.quantityReserved),
              reorderLevel: Number(values.reorderLevel),
            });
            setInventoryVariant(null);
          } catch (submitError) {
            setDialogError(getErrorMessage(submitError, "Failed to update inventory"));
          }
        }}
      />
    </div>
  );
}

function Metric(props: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 ${props.compact ? "px-2 py-2" : "px-3 py-3"}`}>
      <p className="text-[11px] font-medium uppercase text-slate-400">{props.label}</p>
      <p className="mt-1 truncate text-sm text-slate-100">{props.value}</p>
    </div>
  );
}
