"use client";

import { formatMinorCurrency, minorUnitsText, type MinorUnitValue } from "#/lib/money";

import { defaultCurrency } from "#/i18n/config";
import { ApiClientError, requestApi } from "#/lib/api-client";
import { api } from "#/lib/eden";
import type { Treaty } from "@elysiajs/eden";

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
      imageUrl?: string | null;
      productStatus?: string;
      availableQuantity?: number;
      quantity: number;
      unitPrice: MinorUnitValue;
      currency: string;
    }>;
    subtotal: MinorUnitValue;
  }>;
  subtotal: MinorUnitValue;
  currency: string;
}

type BuyerOrderResponse = NonNullable<Treaty.Data<ReturnType<ReturnType<typeof api.api.orders>["get"]>>>;
type BuyerOrderReturnRights = Pick<BuyerOrderResponse["items"][number], "remainingReturnQuantity" | "hasActiveReturn">;
export type BuyerOrderTracking = NonNullable<Treaty.Data<ReturnType<ReturnType<typeof api.api.orders>["tracking"]["get"]>>>;

export interface BuyerOrder {
  taxTotals?: Pick<BuyerOrderResponse["totals"], "taxTotal" | "includedTaxTotal" | "reportedTaxTotal">;
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalCents: MinorUnitValue;
  currency: string;
  createdAt: string;
  items: Array<{
    id: string;
    shopId: string;
    productTitle: string;
    variantTitle: string;
    quantity: number;
    lineTotal: MinorUnitValue;
    shopName: string;
    fulfillmentStatus: string;
  } & BuyerOrderReturnRights>;
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

export interface BuyerAddress {
  id: string;
  recipientName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export type BuyerCoupon = NonNullable<Treaty.Data<ReturnType<typeof api.api.me.coupons.get>>>["data"][number];

export interface BuyerNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  image?: string | null;
}

export interface SellerApplicationSummary {
  application: {
    id: string;
    status: string;
    rejectionReason?: string | null;
    shopName?: string | null;
    shopSlug?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
  } | null;
  shop: {
    id: string;
    name: string;
    slug: string;
    status: string;
    approvedAt?: string | null;
  } | null;
}

export type BuyerFavoritePage = NonNullable<Treaty.Data<ReturnType<typeof api.api.me.favorites.get>>>;
export type BuyerFavoriteProduct = BuyerFavoritePage["items"][number];
export type BuyerFollowedShopPage = NonNullable<Treaty.Data<ReturnType<typeof api.api.me["followed-shops"]["get"]>>>;
export type BuyerFollowedShop = BuyerFollowedShopPage["items"][number];

export type CheckoutInput = Parameters<typeof api.api.checkout.post>[0];

export interface AddressInput {
  recipientName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface ReviewInput {
  orderItemId: string;
  rating: number;
  comment?: string;
  uploadIds?: string[];
}

export type ReturnRequestInput = Parameters<typeof api.api.returns.post>[0];

export type CheckoutResult = NonNullable<Treaty.Data<ReturnType<typeof api.api.checkout.post>>>;
export type CheckoutQuoteInput = Parameters<typeof api.api.checkout.quote.post>[0];
export type CheckoutQuote = NonNullable<Treaty.Data<ReturnType<typeof api.api.checkout.quote.post>>>;

export type BuyerCouponListInput = NonNullable<NonNullable<Parameters<typeof api.api.me.coupons.get>[0]>["query"]>;

export async function fetchCouponPage(input: BuyerCouponListInput = {}) {
  const { data, error } = await api.api.me.coupons.get({ query: input });
  if (error) throw error;
  return data;
}

export async function fetchCoupons(locale?: string): Promise<BuyerCoupon[]> {
  return (await fetchCouponPage({ locale: locale === "en" ? "en" : "th", page: 1, limit: 8 })).data;
}

export async function claimCoupon(couponId: string, locale?: string): Promise<BuyerCoupon> {
  const { data, error } = await api.api.coupons({ couponId }).claim.post(undefined, { query: { locale: locale === "en" ? "en" : "th" } });
  if (error) throw error;
  return data;
}

export async function fetchFavoriteProducts(page = 1) {
  const { data, error } = await api.api.me.favorites.get({ query: { page, limit: 20 } });
  if (error) throw error;
  return data;
}

export async function fetchFavoriteStatus(productId: string): Promise<boolean> {
  const response = toRecord(await apiFetch(`/api/me/favorites/${productId}`));
  return Boolean(response.favorited);
}

export async function fetchFavoriteStatuses(productIds: string[]) {
  const { data, error } = await api.api.me.favorites.statuses.post({ productIds });
  if (error) throw error;
  return data;
}

export async function addFavoriteProduct(productId: string): Promise<void> {
  await apiFetch(`/api/me/favorites/${productId}`, { method: "PUT" });
}

export async function removeFavoriteProduct(productId: string): Promise<void> {
  await apiFetch(`/api/me/favorites/${productId}`, { method: "DELETE" });
}

export async function fetchFollowedShops(page = 1) {
  const { data, error } = await api.api.me["followed-shops"].get({ query: { page, limit: 20 } });
  if (error) throw error;
  return data;
}

export async function fetchShopFollowStatus(shopId: string): Promise<boolean> {
  const response = toRecord(await apiFetch(`/api/shops/${shopId}/follow`));
  return Boolean(response.following);
}

export async function followShop(shopId: string): Promise<void> {
  await apiFetch(`/api/shops/${shopId}/follow`, { method: "PUT" });
}

export async function unfollowShop(shopId: string): Promise<void> {
  await apiFetch(`/api/shops/${shopId}/follow`, { method: "DELETE" });
}

export async function fetchCart(locale?: string): Promise<BuyerCart> {
  return normalizeCart(await apiFetch(`/api/cart${toQuery({ locale })}`));
}

export async function addCartItem(variantId: string, quantity: number): Promise<BuyerCart> {
  return normalizeCart(await apiFetch("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ variantId, quantity }),
  }));
}

export type GuestCartMergeResult = NonNullable<Treaty.Data<ReturnType<typeof api.api.cart["guest-items"]["post"]>>>;

export async function mergeGuestCartItem(userId: string, variantId: string, quantity: number): Promise<GuestCartMergeResult> {
  return requestApi<GuestCartMergeResult>("/api/cart/guest-items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, variantId, quantity }),
  });
}

export async function updateCartItem(itemId: string, quantity: number): Promise<BuyerCart> {
  return normalizeCart(await apiFetch(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  }));
}

export async function removeCartItem(itemId: string): Promise<void> {
  await apiFetch(`/api/cart/items/${itemId}`, { method: "DELETE", body: JSON.stringify({}) });
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const { data, error } = await api.api.checkout.post(input);
  if (error) throw checkoutApiError(error);
  if (!data) throw new Error("Checkout returned no data");
  return data;
}

export async function quoteCheckout(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
  const { data, error } = await api.api.checkout.quote.post(input);
  if (error) throw checkoutApiError(error);
  if (!data) throw new Error("Checkout quote returned no data");
  return data;
}

function checkoutApiError(error: { status: number; value: unknown }): ApiClientError {
  const payload = toRecord(error.value);
  const failure = toRecord(payload.error);
  return new ApiClientError(
    readString(failure.message, readString(payload.message, readString(error.value, "Checkout request failed"))),
    error.status,
    readString(failure.code, readString(payload.code)) || undefined,
    failure.details ?? payload.details,
  );
}

export async function fetchAddresses(): Promise<BuyerAddress[]> {
  const response = await apiFetch("/api/addresses");
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map(normalizeAddress);
}

export async function createAddress(input: AddressInput): Promise<BuyerAddress> {
  return normalizeAddress(await apiFetch("/api/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function updateAddress(addressId: string, input: Partial<AddressInput>): Promise<BuyerAddress> {
  return normalizeAddress(await apiFetch(`/api/addresses/${addressId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }));
}

export async function deleteAddress(addressId: string): Promise<void> {
  await apiFetch(`/api/addresses/${addressId}`, { method: "DELETE" });
}

export async function setDefaultAddress(addressId: string): Promise<BuyerAddress> {
  return normalizeAddress(await apiFetch(`/api/addresses/${addressId}/default`, { method: "PATCH" }));
}

export async function createReview(input: ReviewInput): Promise<unknown> {
  return apiFetch("/api/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createReturnRequest(input: ReturnRequestInput): Promise<unknown> {
  return apiFetch("/api/returns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchOrder(orderId: string): Promise<BuyerOrder> {
  return normalizeOrder(await apiFetch(`/api/orders/${orderId}`));
}

export async function cancelOrder(orderId: string): Promise<void> {
  await apiFetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
}

export async function fetchOrderTracking(orderId: string): Promise<BuyerOrderTracking> {
  return requestApi<BuyerOrderTracking>(`/api/orders/${orderId}/tracking`);
}

export type NotificationCategory = NonNullable<NonNullable<Parameters<typeof api.api.notifications.get>[0]>['query']>['category'];
export async function fetchNotificationUnreadCount(scope: "all" | "seller" = "all", options: { excludeChat?: boolean } = {}) {
  return requestApi<NonNullable<Treaty.Data<ReturnType<(typeof api.api.notifications)["unread-count"]["get"]>>>>(`/api/notifications/unread-count${toQuery({ scope, excludeChat: options.excludeChat === undefined ? undefined : String(options.excludeChat) })}`);
}

export async function fetchNotifications(scope: "all" | "seller" = "all", options: { cursor?: string; limit?: number; category?: NotificationCategory } = {}) {
  const response = toRecord(await apiFetch(`/api/notifications${toQuery({ scope, ...options })}`));
  const rawItems = readArray(response.items);
  const items = rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      type: readString(record.type, "notification"),
      title: readString(record.title, "Notification"),
      body: optionalString(record.body),
      data: record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : null,
      readAt: optionalString(record.readAt),
      createdAt: readString(record.createdAt, new Date().toISOString()),
    };
  });
  return { items, nextCursor: optionalString(response.nextCursor) };
}

export async function fetchProfile(): Promise<BuyerProfile> {
  const response = toRecord(await apiFetch("/api/me"));
  return {
    id: readString(response.id),
    name: readString(response.name, "Buyer"),
    email: readString(response.email),
    role: readString(response.role, "USER"),
    status: readString(response.status, "ACTIVE"),
    emailVerified: Boolean(response.emailVerified),
    phone: optionalString(response.phone),
    phoneVerified: Boolean(response.phoneVerified),
    image: optionalString(response.image),
  };
}

export async function updateProfile(input: { name?: string; image?: string | null; phone?: string | null }): Promise<BuyerProfile> {
  const response = toRecord(await apiFetch("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  }));
  return {
    id: readString(response.id),
    name: readString(response.name, "Buyer"),
    email: readString(response.email),
    role: readString(response.role, "USER"),
    status: readString(response.status, "ACTIVE"),
    emailVerified: Boolean(response.emailVerified),
    phone: optionalString(response.phone),
    phoneVerified: Boolean(response.phoneVerified),
    image: optionalString(response.image),
  };
}

export async function requestProfilePhoneOtp(phone: string): Promise<void> {
  await apiFetch("/api/me/phone/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyProfilePhoneOtp(input: { phone: string; otp: string }): Promise<void> {
  await apiFetch("/api/me/phone/verify-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchSellerApplicationSummary(): Promise<SellerApplicationSummary> {
  const response = toRecord(await apiFetch("/api/seller/application"));
  const application = toRecord(response.application);
  const shop = toRecord(response.shop);

  return {
    application: response.application ? {
      id: readString(application.id),
      status: readString(application.status),
      rejectionReason: optionalString(application.rejectionReason),
      shopName: optionalString(application.shopName),
      shopSlug: optionalString(application.shopSlug),
      submittedAt: optionalString(application.submittedAt),
      reviewedAt: optionalString(application.reviewedAt),
    } : null,
    shop: response.shop ? {
      id: readString(shop.id),
      name: readString(shop.name),
      slug: readString(shop.slug),
      status: readString(shop.status),
      approvedAt: optionalString(shop.approvedAt),
    } : null,
  };
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return requestApi(path, { ...init, headers });
}

export async function clearCart(): Promise<void> {
  await apiFetch("/api/cart", { method: "DELETE", body: JSON.stringify({}) });
}

function normalizeCart(input: unknown): BuyerCart {
  const record = toRecord(input);
  const shops = readArray(record.shops).map((shopInput) => {
    const shop = toRecord(shopInput);
    const shopDetail = toRecord(shop.shop);
    const items = readArray(shop.items).map((itemInput) => {
      const item = toRecord(itemInput);
      const variant = toRecord(item.variant);
      const product = toRecord(item.product);
      const variantProduct = toRecord(variant.product);
      return {
        id: readString(item.id),
        variantId: readString(item.variantId, readString(variant.id)),
        productId: readString(product.id, readString(variantProduct.id, readString(item.productId))),
        title: readString(product.title, readString(variantProduct.title, readString(item.productTitle, "Product"))),
        variantTitle: readString(variant.title, readString(item.variantTitle, "Default")),
        imageUrl: optionalString(product.imageUrl ?? variantProduct.imageUrl),
        productStatus: readString(product.status, readString(variantProduct.status, "ACTIVE")),
        availableQuantity: readNumber(item.availableQuantity, Number.MAX_SAFE_INTEGER),
        quantity: readNumber(item.quantity, 1),
        unitPrice: minorUnitsText(item.unitPrice ?? variant.price),
        currency: readString(item.currency, readString(variant.currency, defaultCurrency)),
      };
    });
    return {
      shopId: readString(shop.shopId, readString(shop.id, readString(shopDetail.id))),
      shopName: readString(shop.shopName, readString(shop.name, readString(shopDetail.name, "Shop"))),
      items,
      subtotal: minorUnitsText(shop.subtotal),
    };
  });
  return {
    id: optionalString(record.id),
    shops,
    subtotal: minorUnitsText(record.subtotal),
    currency: readString(record.currency, shops[0]?.items[0]?.currency ?? defaultCurrency),
  };
}

function normalizeAddress(input: unknown): BuyerAddress {
  const record = toRecord(input);
  return {
    id: readString(record.id),
    recipientName: readString(record.recipientName, "Recipient"),
    phone: optionalString(record.phone),
    line1: readString(record.line1),
    line2: optionalString(record.line2),
    city: readString(record.city),
    region: optionalString(record.region),
    postalCode: readString(record.postalCode),
    country: readString(record.country, "TH"),
    isDefault: Boolean(record.isDefault),
  };
}

function normalizeOrder(input: unknown): BuyerOrder {
  const record = toRecord(input);
  const items = readArray(record.items).map((itemInput) => {
    const item = toRecord(itemInput);
    return {
      id: readString(item.id),
      shopId: readString(item.shopId),
      productTitle: readString(item.productTitle, "Product"),
      variantTitle: readString(item.variantTitle, "Default"),
      quantity: readNumber(item.quantity, 1),
      lineTotal: minorUnitsText(item.lineTotal),
      shopName: readString(item.shopName, "Shop"),
      fulfillmentStatus: readString(item.fulfillmentStatus, "pending"),
      remainingReturnQuantity: typeof item.remainingReturnQuantity === "number" && Number.isInteger(item.remainingReturnQuantity)
        && item.remainingReturnQuantity >= 0 && item.remainingReturnQuantity <= 2147483647 ? item.remainingReturnQuantity : 0,
      hasActiveReturn: item.hasActiveReturn !== false,
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
    taxTotals: toRecord(record.totals).reportedTaxTotal === undefined ? undefined : {
      taxTotal: minorUnitsText(toRecord(record.totals).taxTotal),
      includedTaxTotal: minorUnitsText(toRecord(record.totals).includedTaxTotal),
      reportedTaxTotal: minorUnitsText(toRecord(record.totals).reportedTaxTotal),
    },
    totalCents: minorUnitsText(record.totalCents ?? record.grandTotal ?? toRecord(record.totals).grandTotal),
    currency: readString(record.currency, readString(toRecord(record.totals).currency, defaultCurrency)),
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

export function formatMoney(cents: MinorUnitValue, _currency = defaultCurrency): string {
  return formatMinorCurrency(cents, "th-TH", defaultCurrency);
}
