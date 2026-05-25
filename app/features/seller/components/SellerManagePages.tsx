"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, ArchiveIcon, BanknoteIcon, EditIcon, PackageCheckIcon, PlusIcon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import { SellerPageHeader } from "./SellerShell";
import {
  type SellerCoupon,
  type SellerPayout,
  type SellerProduct,
  type SellerReturn,
  type SellerShipment,
  useApproveReturn,
  useCreateSellerCoupon,
  useCreateSellerPayout,
  useCreateSellerProduct,
  useDeleteSellerCoupon,
  useDeliverShipment,
  usePackShipment,
  useRejectReturn,
  useSellerCoupons,
  useSellerDashboard,
  useSellerPayouts,
  useSellerProducts,
  useSellerReturns,
  useSellerShipments,
  useSellerTransactions,
  useSellerWallet,
  useShipShipment,
  useArchiveSellerProduct,
  useUpdateSellerProduct,
  useUpdateSellerCoupon,
  useUpdateSellerInventory,
} from "../hooks/useSellerManage";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

interface ProductFormState {
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
}

const emptyProductForm: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
  titleTh: "",
  titleEn: "",
  descriptionTh: "",
  descriptionEn: "",
};

function productToForm(product: SellerProduct): ProductFormState {
  return {
    title: product.title ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    status: product.status as ProductStatus,
    titleTh: product.titleTh ?? "",
    titleEn: product.titleEn ?? "",
    descriptionTh: product.descriptionTh ?? "",
    descriptionEn: product.descriptionEn ?? "",
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isProductFormDirty(form: ProductFormState, initial: ProductFormState) {
  return JSON.stringify(form) !== JSON.stringify(initial);
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
  const available = variants.reduce((total, variant) => {
    const inventory = variant.inventory;
    return total + ((inventory?.quantityOnHand ?? 0) - (inventory?.quantityReserved ?? 0));
  }, 0);
  return `${available} available`;
}

function formatMoney(cents: number | bigint | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents ?? 0) / 100);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusPill({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{value.replaceAll("_", " ")}</span>;
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load seller data."}</p>
        <Button type="button" variant="outline" onClick={retry}>Retry</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">{message}</div>;
}

export function SellerDashboardPage() {
  const query = useSellerDashboard();
  const dashboard = query.data;

  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;

  const cards = [
    { label: "Today sales", value: formatMoney(dashboard?.sales.todaySalesCents), icon: BanknoteIcon },
    { label: "Month sales", value: formatMoney(dashboard?.sales.thisMonthSalesCents), icon: BanknoteIcon },
    { label: "Pending pack", value: String(dashboard?.orders.pendingPack ?? 0), icon: PackageCheckIcon },
    { label: "Low stock", value: String(dashboard?.products.lowStock ?? 0), icon: AlertTriangleIcon },
  ];

  return (
    <>
      <SellerPageHeader title="Dashboard" description="Track paid shipment work, low stock, sales, and recent shop activity." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-lg border-slate-200 bg-white">
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{query.isLoading ? "..." : card.value}</p>
              </div>
              <card.icon className="size-5 text-emerald-600" />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle>Low stock alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.lowStockItems.length ? dashboard.lowStockItems.slice(0, 6).map((item) => (
              <div key={item.variantId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div><p className="text-sm font-medium">{item.productTitle}</p><p className="text-xs text-slate-500">{item.sku} · available {item.availableQuantity}</p></div>
                <Link href="/seller/inventory" className="text-sm font-semibold text-emerald-700 no-underline">Restock</Link>
              </div>
            )) : <EmptyState message={query.isLoading ? "Loading alerts..." : "No low stock variants."} />}
          </CardContent>
        </Card>
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.recentOrders.length ? dashboard.recentOrders.slice(0, 6).map((order) => (
              <div key={order.orderId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div><p className="text-sm font-medium">{order.orderNo}</p><p className="text-xs text-slate-500">{order.items.length} items · {formatMoney(order.totalCents)}</p></div>
                <StatusPill value={order.status} />
              </div>
            )) : <EmptyState message={query.isLoading ? "Loading orders..." : "No recent orders."} />}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export function SellerProductsPage() {
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [initialForm, setInitialForm] = useState<ProductFormState>(emptyProductForm);
  const [formError, setFormError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<SellerProduct | null>(null);
  const query = useSellerProducts({ q, status, cursor });
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const archiveProduct = useArchiveSellerProduct();
  const products = query.data?.data ?? [];
  const isMutatingProduct = createProduct.isPending || updateProduct.isPending;
  const isDialogOpen = dialogMode !== null;
  const dirty = isDialogOpen && isProductFormDirty(form, initialForm);

  function openCreateDialog() {
    setDialogMode("create");
    setEditingProduct(null);
    setForm(emptyProductForm);
    setInitialForm(emptyProductForm);
    setFormError("");
  }

  function openEditDialog(product: SellerProduct) {
    const nextForm = productToForm(product);
    setDialogMode("edit");
    setEditingProduct(product);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError("");
  }

  function requestDialogClose(open: boolean) {
    if (open) return;
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    setDialogMode(null);
    setEditingProduct(null);
    setFormError("");
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const slug = form.slug.trim();

    if (!title) {
      setFormError("Product title is required.");
      return;
    }

    const input = {
      title,
      slug: slug || undefined,
      description: optionalText(form.description),
      status: form.status,
      titleTh: optionalText(form.titleTh),
      titleEn: optionalText(form.titleEn),
      descriptionTh: optionalText(form.descriptionTh),
      descriptionEn: optionalText(form.descriptionEn),
    };

    const options = {
      onSuccess: () => {
        toast.success(dialogMode === "edit" ? "Product updated." : "Product created.");
        setDialogMode(null);
        setEditingProduct(null);
        setForm(emptyProductForm);
        setInitialForm(emptyProductForm);
        setFormError("");
      },
      onError: (error: unknown) => {
        setFormError(error instanceof Error ? error.message : "Product could not be saved.");
        toast.error("Product could not be saved.");
      },
    };

    if (dialogMode === "edit" && editingProduct) {
      updateProduct.mutate({ productId: editingProduct.id, ...input }, options);
      return;
    }

    createProduct.mutate(input, options);
  }

  function confirmArchiveProduct() {
    if (!archiveTarget) return;
    archiveProduct.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success("Product archived.");
        setArchiveTarget(null);
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Product could not be archived.");
      },
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
          {(row.original.titleTh || row.original.titleEn) ? (
            <p className="mt-1 text-xs text-slate-500">{[row.original.titleTh, row.original.titleEn].filter(Boolean).join(" / ")}</p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill value={row.original.status} />,
    },
    {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => <span>{row.original.variants.length}</span>,
    },
    {
      id: "priceStock",
      header: "Price / stock",
      cell: ({ row }) => (
        <div className="min-w-36 text-sm">
          <p>{getVariantPriceContext(row.original)}</p>
          <p className="text-xs text-slate-500">{getVariantStockContext(row.original)}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={`Edit ${row.original.title}`} onClick={() => openEditDialog(row.original)}>
            <EditIcon className="size-4" />
            <span className="sr-only">Edit</span>
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
                  <Input
                    value={q}
                    onChange={(event) => {
                      setQ(event.target.value);
                      setCursor(undefined);
                    }}
                    placeholder="Search products"
                    aria-label="Search products"
                    className="sm:max-w-sm"
                  />
                  <Select
                    value={status || "ALL"}
                    onValueChange={(value) => {
                      setStatus(value === "ALL" ? "" : value as ProductStatus);
                      setCursor(undefined);
                    }}
                  >
                    <SelectTrigger className="sm:w-48" aria-label="Filter by product status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
                  <PlusIcon className="size-4" />
                  Create product
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
      <Dialog open={isDialogOpen} onOpenChange={requestDialogClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!dirty}>
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>Manage the product fields sellers can safely update before category, brand, image, and variant workflows are added.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitProduct}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-title">Title</Label>
                <Input id="product-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={formError ? "product-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-slug">Slug</Label>
                <Input id="product-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="optional-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea id="product-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProductStatus }))}>
                <SelectTrigger id="product-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-title-th">Thai title</Label>
                <Input id="product-title-th" value={form.titleTh} onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-title-en">English title</Label>
                <Input id="product-title-en" value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-description-th">Thai description</Label>
                <Textarea id="product-description-th" value={form.descriptionTh} onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-description-en">English description</Label>
                <Textarea id="product-description-en" value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} rows={3} />
              </div>
            </div>
            {formError ? <p id="product-form-error" className="text-sm text-red-600">{formError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestDialogClose(false)}>Cancel</Button>
              <Button type="submit" disabled={isMutatingProduct}>{isMutatingProduct ? "Saving..." : "Save product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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

export function SellerInventoryPage() {
  const query = useSellerProducts({ limit: 50 });
  const updateInventory = useUpdateSellerInventory();
  const variants = useMemo(() => (query.data?.data ?? []).flatMap((product: SellerProduct) => product.variants.map((variant) => ({ product, variant }))), [query.data]);

  return (
    <>
      <SellerPageHeader title="Inventory" description="Manage stock without touching reserved inventory." />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="px-4">Variant</TableHead><TableHead>On hand</TableHead><TableHead>Reserved</TableHead><TableHead>Available</TableHead><TableHead>Reorder</TableHead><TableHead className="text-right">Update</TableHead></TableRow></TableHeader><TableBody>
        {variants.length ? variants.map(({ product, variant }) => {
          const available = (variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.quantityReserved ?? 0);
          return (
            <TableRow key={variant.id}>
              <TableCell className="px-4"><p className="font-medium">{product.title}</p><p className="text-xs text-slate-500">{variant.sku} · {variant.title}</p></TableCell>
              <TableCell>{variant.inventory?.quantityOnHand ?? 0}</TableCell>
              <TableCell>{variant.inventory?.quantityReserved ?? 0}</TableCell>
              <TableCell className={available <= (variant.inventory?.reorderLevel ?? 0) ? "font-semibold text-red-600" : ""}>{available}</TableCell>
              <TableCell>{variant.inventory?.reorderLevel ?? 0}</TableCell>
              <TableCell><form className="flex justify-end gap-2" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); updateInventory.mutate({ variantId: variant.id, quantityOnHand: Number(formData.get("quantityOnHand")), reorderLevel: Number(formData.get("reorderLevel")) }); }}><Input name="quantityOnHand" type="number" min={0} defaultValue={variant.inventory?.quantityOnHand ?? 0} className="w-24" /><Input name="reorderLevel" type="number" min={0} defaultValue={variant.inventory?.reorderLevel ?? 0} className="w-24" /><Button type="submit" size="sm" disabled={updateInventory.isPending}>Save</Button></form></TableCell>
            </TableRow>
          );
        }) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">{query.isLoading ? "Loading inventory..." : "No variants found."}</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
    </>
  );
}

export function SellerOrdersPage() {
  const query = useSellerShipments();
  const pack = usePackShipment();
  const ship = useShipShipment();
  const deliver = useDeliverShipment();
  const rows = query.data ?? [];

  return (
    <>
      <SellerPageHeader title="Orders & Shipments" description="Process paid marketplace work by shipment, not by whole buyer order." />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <div className="grid gap-4">
        {rows.length ? rows.map((shipment: SellerShipment) => (
          <Card key={shipment.id} className="rounded-lg border-slate-200 bg-white">
            <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1fr_auto]">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{shipment.orderNo}</h3><StatusPill value={shipment.status} /></div><p className="mt-1 text-sm text-slate-500">{shipment.shippingAddress.name} · {shipment.items.length} item(s)</p><p className="mt-2 text-sm text-slate-700">{shipment.items.map((item) => `${item.productTitle} x${item.quantity}`).join(", ")}</p></div>
              <div className="flex flex-col gap-2 lg:min-w-96">
                <Button type="button" variant="outline" disabled={pack.isPending || shipment.status !== "pending_pack"} onClick={() => pack.mutate(shipment.id)}>Mark packed</Button>
                <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); ship.mutate({ shipmentId: shipment.id, carrier: String(data.get("carrier") ?? ""), trackingNo: String(data.get("trackingNo") ?? "") }); }}><Input name="carrier" placeholder="Carrier" defaultValue={shipment.carrier ?? ""} /><Input name="trackingNo" placeholder="Tracking" defaultValue={shipment.trackingNumber ?? ""} /><Button type="submit" disabled={ship.isPending || shipment.status !== "packed"}>Ship</Button></form>
                <Button type="button" variant="outline" disabled={deliver.isPending || shipment.status !== "shipped"} onClick={() => deliver.mutate(shipment.id)}>Mark delivered</Button>
              </div>
            </CardContent>
          </Card>
        )) : <EmptyState message={query.isLoading ? "Loading shipments..." : "No shipments need processing."} />}
      </div>
    </>
  );
}

export function SellerReturnsPage() {
  const query = useSellerReturns();
  const approve = useApproveReturn();
  const reject = useRejectReturn();
  const rows = query.data ?? [];
  return (
    <>
      <SellerPageHeader title="Returns" description="Approve or reject return requests for items sold by your shop." />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="px-4">Return</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((item: SellerReturn) => <TableRow key={item.id}><TableCell className="px-4"><p className="font-medium">{item.reason ?? "Return request"}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></TableCell><TableCell>{item.items.map((row) => `${row.productTitle} x${row.quantity}`).join(", ")}</TableCell><TableCell><StatusPill value={item.status} /></TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={approve.isPending || item.status !== "requested"} onClick={() => approve.mutate(item.id)}>Approve</Button><Button size="sm" variant="destructive" disabled={reject.isPending || item.status !== "requested"} onClick={() => reject.mutate(item.id)}>Reject</Button></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-slate-500">{query.isLoading ? "Loading returns..." : "No returns found."}</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
    </>
  );
}

export function SellerPromotionsPage() {
  const query = useSellerCoupons();
  const createCoupon = useCreateSellerCoupon();
  const updateCoupon = useUpdateSellerCoupon();
  const deleteCoupon = useDeleteSellerCoupon();
  const rows = query.data ?? [];
  return (
    <>
      <SellerPageHeader title="Promotions" description="Create and manage shop-scoped coupons." />
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="pt-6"><form className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px_auto]" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); createCoupon.mutate({ code: String(data.get("code") ?? ""), titleEn: String(data.get("title") ?? ""), discountType: String(data.get("discountType")) as "fixed" | "percent", discountValueCents: Math.round(Number(data.get("amount") || 0) * 100), discountPercentBps: Math.round(Number(data.get("percent") || 0) * 100), isActive: true }); }}><Input name="code" placeholder="Code" required /><Input name="title" placeholder="Title" /><Select name="discountType" defaultValue="fixed"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="percent">Percent</SelectItem></SelectContent></Select><Input name="amount" placeholder="Amount" /><Button type="submit" disabled={createCoupon.isPending}>Create</Button></form></CardContent></Card>
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="px-4">Coupon</TableHead><TableHead>Discount</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((coupon: SellerCoupon) => <TableRow key={coupon.id}><TableCell className="px-4"><p className="font-medium">{coupon.code}</p><p className="text-xs text-slate-500">{coupon.titleEn ?? coupon.titleTh ?? "Untitled"}</p></TableCell><TableCell>{coupon.discountType}</TableCell><TableCell>{coupon.isActive ? "Active" : "Inactive"}</TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={updateCoupon.isPending} onClick={() => updateCoupon.mutate({ couponId: coupon.id, isActive: !coupon.isActive })}>{coupon.isActive ? "Disable" : "Enable"}</Button><Button size="sm" variant="destructive" disabled={deleteCoupon.isPending} onClick={() => deleteCoupon.mutate(coupon.id)}>Delete</Button></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-slate-500">{query.isLoading ? "Loading coupons..." : "No coupons found."}</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
    </>
  );
}

export function SellerFinancePage() {
  const wallet = useSellerWallet();
  const transactions = useSellerTransactions();
  const payouts = useSellerPayouts();
  const createPayout = useCreateSellerPayout();
  return (
    <>
      <SellerPageHeader title="Finance" description="Review wallet balance, ledger entries, and payout requests." />
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-slate-200 bg-white md:col-span-1"><CardContent className="pt-6"><p className="text-sm text-slate-500">Available balance</p><p className="mt-2 text-3xl font-semibold">{formatMoney(wallet.data?.availableBalanceCents, wallet.data?.currency)}</p><p className="mt-1 text-sm text-slate-500">{wallet.data?.shopName ?? "Seller shop"}</p></CardContent></Card>
        <Card className="rounded-lg border-slate-200 bg-white md:col-span-2"><CardHeader><CardTitle>Request payout</CardTitle></CardHeader><CardContent><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); createPayout.mutate(Math.round(Number(data.get("amount") || 0) * 100)); }}><Input name="amount" placeholder="Amount" type="number" min="1" step="0.01" /><Button type="submit" disabled={createPayout.isPending}>Request</Button></form></CardContent></Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border-slate-200 bg-white"><CardHeader><CardTitle>Transactions</CardTitle></CardHeader><CardContent className="space-y-2">{transactions.data?.items.length ? transactions.data.items.map((item) => <div key={item.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-3"><div><p className="text-sm font-medium">{item.type}</p><p className="text-xs text-slate-500">{item.description ?? formatDate(item.createdAt)}</p></div><p className={item.amount < 0 ? "text-red-600" : "text-emerald-700"}>{formatMoney(item.amount, item.currency)}</p></div>) : <EmptyState message={transactions.isLoading ? "Loading transactions..." : "No transactions found."} />}</CardContent></Card>
        <Card className="rounded-lg border-slate-200 bg-white"><CardHeader><CardTitle>Payout history</CardTitle></CardHeader><CardContent className="space-y-2">{payouts.data?.length ? payouts.data.map((item: SellerPayout) => <div key={item.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-3"><div><p className="text-sm font-medium">{formatMoney(item.amount, item.currency)}</p><p className="text-xs text-slate-500">{formatDate(item.requestedAt)}</p></div><StatusPill value={item.status} /></div>) : <EmptyState message={payouts.isLoading ? "Loading payouts..." : "No payouts found."} />}</CardContent></Card>
      </section>
    </>
  );
}
