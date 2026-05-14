"use client";

export interface BuyerProduct {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  rating: number;
  soldCount: number;
  stock: number;
  shop: {
    id: string;
    name: string;
    location: string;
  };
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    priceCents: number;
    currency: string;
    stock: number;
  }>;
  images: string[];
}

export interface BuyerCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface BuyerCart {
  id: string | null;
  shops: Array<{
    shopId: string;
    shopName: string;
    items: Array<{
      id: string;
      variantId: string;
      productId: string;
      title: string;
      variantTitle: string;
      quantity: number;
      unitPriceCents: number;
      currency: string;
    }>;
    subtotalCents: number;
  }>;
  subtotalCents: number;
  currency: string;
}

export interface BuyerOrder {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    quantity: number;
    lineTotalCents: number;
    shopName: string;
  }>;
  shipments: Array<{
    id: string;
    shopId: string;
    shopName: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    timeline: Array<{ label: string; status: string; timestamp: string }>;
  }>;
}

export interface BuyerNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  image?: string | null;
}

export interface CheckoutInput {
  cartId: string;
  addressId: string;
  couponCode?: string;
  paymentMethod: string;
  shippingMethod?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNo: string;
  paymentStatus: string;
  totalCents: number;
  paymentUrl?: string;
}

export async function fetchProducts(params: Record<string, string | number | undefined> = {}): Promise<BuyerProduct[]> {
  const query = toQuery(params);
  const response = await apiFetch(`/api/products${query}`);
  const record = toRecord(response);
  const rawItems = Array.isArray(response) ? response : readArray(record.data).length ? readArray(record.data) : readArray(record.items);
  return rawItems.map(normalizeProduct);
}

export async function fetchCategories(): Promise<BuyerCategory[]> {
  const response = await apiFetch("/api/categories");
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id, readString(record.slug)),
      slug: readString(record.slug),
      name: readString(record.name, "Category"),
      sortOrder: readNumber(record.sortOrder),
    };
  }).filter((category) => category.slug);
}

export async function fetchProduct(productId: string): Promise<BuyerProduct> {
  return normalizeProduct(await apiFetch(`/api/products/${productId}`));
}

export async function fetchCart(): Promise<BuyerCart> {
  return normalizeCart(await apiFetch("/api/cart"));
}

export async function addCartItem(variantId: string, quantity: number): Promise<BuyerCart> {
  return normalizeCart(await apiFetch("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ variantId, quantity }),
  }));
}

export async function updateCartItem(itemId: string, quantity: number): Promise<BuyerCart> {
  return normalizeCart(await apiFetch(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  }));
}

export async function removeCartItem(itemId: string): Promise<void> {
  await apiFetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const response = await apiFetch("/api/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  }) as Record<string, unknown>;
  return {
    orderId: readString(response.orderId),
    orderNo: readString(response.orderNo),
    paymentStatus: readString(response.paymentStatus, "pending"),
    totalCents: readNumber(response.totalCents),
    paymentUrl: optionalString(response.paymentUrl) ?? undefined,
  };
}

export async function fetchOrders(): Promise<BuyerOrder[]> {
  const response = await apiFetch("/api/orders");
  const rawItems = Array.isArray(response) ? response : readArray((response as Record<string, unknown>)?.items);
  return rawItems.map(normalizeOrder);
}

export async function fetchOrder(orderId: string): Promise<BuyerOrder> {
  return normalizeOrder(await apiFetch(`/api/orders/${orderId}`));
}

export async function fetchOrderTracking(orderId: string): Promise<BuyerOrder> {
  return normalizeOrder(await apiFetch(`/api/orders/${orderId}/tracking`));
}

export async function fetchNotifications(): Promise<BuyerNotification[]> {
  const response = await apiFetch("/api/notifications");
  const rawItems = Array.isArray(response) ? response : readArray((response as Record<string, unknown>)?.items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      type: readString(record.type, "notification"),
      title: readString(record.title, "Notification"),
      body: optionalString(record.body),
      readAt: optionalString(record.readAt),
      createdAt: readString(record.createdAt, new Date().toISOString()),
    };
  });
}

export async function fetchProfile(): Promise<BuyerProfile> {
  const response = toRecord(await apiFetch("/api/me"));
  return {
    id: readString(response.id),
    name: readString(response.name, "Buyer"),
    email: readString(response.email),
    role: readString(response.role, "USER"),
    status: readString(response.status, "ACTIVE"),
    image: optionalString(response.image),
  };
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    credentials: "include",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    const message = readString(toRecord(toRecord(body).error).message, readString(toRecord(body).message, "Request failed"));
    throw new Error(message);
  }
  return body;
}

function normalizeProduct(input: unknown, index = 0): BuyerProduct {
  const record = toRecord(input);
  const shop = toRecord(record.shop);
  const variants = readArray(record.variants).map((variantInput, variantIndex) => {
    const variant = toRecord(variantInput);
    const inventory = toRecord(variant.inventory);
    return {
      id: readString(variant.id, `${readString(record.id)}-variant-${variantIndex}`),
      title: readString(variant.title, "Default"),
      sku: readString(variant.sku),
      priceCents: readNumber(variant.priceCents, readNumber(record.priceCents, 0)),
      currency: readString(variant.currency, readString(record.currency, "USD")),
      stock: readNumber(inventory.quantityOnHand, readNumber(variant.stock, 0)),
    };
  });
  const firstVariant = variants[0];
  return {
    id: readString(record.id, `product-${index}`),
    title: readString(record.title, "Untitled product"),
    description: optionalString(record.description),
    priceCents: firstVariant?.priceCents ?? readNumber(record.priceCents),
    currency: firstVariant?.currency ?? readString(record.currency, "USD"),
    rating: readNumber(record.rating, 4.7),
    soldCount: readNumber(record.soldCount, readNumber(record.sold, 0)),
    stock: firstVariant?.stock ?? readNumber(record.stock),
    shop: {
      id: readString(shop.id),
      name: readString(shop.name, "Marketplace shop"),
      location: readString(shop.location, readString(shop.city, "Local")),
    },
    variants,
    images: readArray(record.images).map((image) => String(image)).filter(Boolean),
  };
}

function normalizeCart(input: unknown): BuyerCart {
  const record = toRecord(input);
  const shops = readArray(record.shops).map((shopInput) => {
    const shop = toRecord(shopInput);
    const shopDetail = toRecord(shop.shop);
    const items = readArray(shop.items).map((itemInput) => {
      const item = toRecord(itemInput);
      const variant = toRecord(item.variant);
      const product = toRecord(variant.product);
      return {
        id: readString(item.id),
        variantId: readString(item.variantId, readString(variant.id)),
        productId: readString(product.id),
        title: readString(product.title, readString(item.productTitle, "Product")),
        variantTitle: readString(variant.title, readString(item.variantTitle, "Default")),
        quantity: readNumber(item.quantity, 1),
        unitPriceCents: readNumber(item.unitPriceCents, readNumber(variant.priceCents)),
        currency: readString(item.currency, readString(variant.currency, "USD")),
      };
    });
    return {
      shopId: readString(shop.shopId, readString(shop.id, readString(shopDetail.id))),
      shopName: readString(shop.shopName, readString(shop.name, readString(shopDetail.name, "Shop"))),
      items,
      subtotalCents: readNumber(shop.subtotalCents, items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)),
    };
  });
  return {
    id: optionalString(record.id),
    shops,
    subtotalCents: readNumber(record.subtotalCents, shops.reduce((sum, shop) => sum + shop.subtotalCents, 0)),
    currency: readString(record.currency, shops[0]?.items[0]?.currency ?? "USD"),
  };
}

function normalizeOrder(input: unknown): BuyerOrder {
  const record = toRecord(input);
  const items = readArray(record.items).map((itemInput) => {
    const item = toRecord(itemInput);
    return {
      id: readString(item.id),
      productTitle: readString(item.productTitle, "Product"),
      variantTitle: readString(item.variantTitle, "Default"),
      quantity: readNumber(item.quantity, 1),
      lineTotalCents: readNumber(item.lineTotalCents),
      shopName: readString(item.shopName, "Shop"),
    };
  });
  const shipments = readArray(record.shipments).map((shipmentInput) => {
    const shipment = toRecord(shipmentInput);
    return {
      id: readString(shipment.id, readString(shipment.shipmentId)),
      shopId: readString(shipment.shopId),
      shopName: readString(shipment.shopName, "Shop"),
      status: readString(shipment.status, "pending"),
      carrier: optionalString(shipment.carrier),
      trackingNumber: optionalString(shipment.trackingNumber ?? shipment.trackingNo),
      timeline: readArray(shipment.timeline).map((stepInput) => {
        const step = toRecord(stepInput);
        return {
          label: readString(step.label, readString(step.status, "Updated")),
          status: readString(step.status, "pending"),
          timestamp: readString(step.timestamp, new Date().toISOString()),
        };
      }),
    };
  });
  return {
    id: readString(record.id, readString(record.orderId)),
    orderNo: readString(record.orderNo, readString(record.orderNumber, "Order")),
    status: readString(record.status, "pending"),
    paymentStatus: readString(record.paymentStatus, "pending"),
    totalCents: readNumber(record.totalCents, readNumber(record.grandTotalCents)),
    currency: readString(record.currency, "USD"),
    createdAt: readString(record.createdAt, new Date().toISOString()),
    items,
    shipments,
  };
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
