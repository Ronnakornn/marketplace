"use client";

import { defaultCurrency } from "#/i18n/config";
import { requestApi } from "#/lib/api-client";

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
      quantity: number;
      unitPrice: number;
      currency: string;
    }>;
    subtotal: number;
  }>;
  subtotal: number;
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
    shopId: string;
    productTitle: string;
    variantTitle: string;
    quantity: number;
    lineTotal: number;
    shopName: string;
    fulfillmentStatus: string;
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

export interface BuyerCoupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValueCents: number | null;
  discountPercentBps: number | null;
  minOrderCents: number | null;
  maxDiscountCents: number | null;
  endsAt: string | null;
  claimed: boolean;
  claimedAt: string | null;
}

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

export interface BuyerFavoriteProduct {
  id: string;
  productId: string;
  title: string;
  price: number;
  currency: string;
  status: string;
  imageUrls: string[];
  shop: { id: string; name: string; slug: string; status: string };
  purchaseVariant: {
    id: string;
    title: string;
    stock: number;
    currency: string;
    price: number;
  } | null;
  createdAt: string;
}

export interface BuyerFollowedShop {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  followerCount: number;
  productCount: number;
  products: Array<{ id: string; title: string; price: number; currency: string }>;
  createdAt: string;
}

export interface CheckoutInput {
  cartId: string;
  cartItemIds: string[];
  addressId: string;
  couponCode?: string;
  paymentMethod: string;
  shippingMethod?: string;
  locale?: string;
}

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

export interface ReturnRequestInput {
  orderId: string;
  orderItemId: string;
  reason: string;
  description?: string;
  uploadIds?: string[];
}

export interface CheckoutResult {
  orderId: string;
  orderNo: string;
  paymentStatus: string;
  totalCents: number;
  paymentUrl: string;
}

export interface CheckoutQuoteInput {
  cartId: string;
  cartItemIds: string[];
  couponCode?: string;
}

export type CheckoutCouponOutcome =
  | { code: string; applied: true }
  | { code: string; applied: false; reason: string };

export interface CheckoutQuote {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  coupon: CheckoutCouponOutcome | null;
}

export async function fetchCoupons(locale?: string): Promise<BuyerCoupon[]> {
  const response = await apiFetch(`/api/me/coupons${toQuery({ locale })}`);
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id, readString(record.code)),
      code: readString(record.code, "DEAL"),
      title: readString(record.title, readString(record.code, "Deal")),
      description: optionalString(record.description),
      discountType: readString(record.discountType, "fixed"),
      discountValueCents: optionalNumber(record.discountValueCents),
      discountPercentBps: optionalNumber(record.discountPercentBps),
      minOrderCents: optionalNumber(record.minOrderCents),
      maxDiscountCents: optionalNumber(record.maxDiscountCents),
      endsAt: optionalString(record.endsAt),
      claimed: Boolean(record.claimed),
      claimedAt: optionalString(record.claimedAt),
    };
  });
}

export async function claimCoupon(couponId: string, locale?: string): Promise<BuyerCoupon> {
  const response = await apiFetch(`/api/coupons/${couponId}/claim${toQuery({ locale })}`, { method: "POST" });
  const record = toRecord(response);
  return {
    id: readString(record.id),
    code: readString(record.code),
    title: readString(record.title, readString(record.code)),
    description: optionalString(record.description),
    discountType: readString(record.discountType),
    discountValueCents: optionalNumber(record.discountValueCents),
    discountPercentBps: optionalNumber(record.discountPercentBps),
    minOrderCents: optionalNumber(record.minOrderCents),
    maxDiscountCents: optionalNumber(record.maxDiscountCents),
    endsAt: optionalString(record.endsAt),
    claimed: Boolean(record.claimed),
    claimedAt: optionalString(record.claimedAt),
  };
}

export async function fetchFavoriteProducts(): Promise<BuyerFavoriteProduct[]> {
  const response = await apiFetch("/api/me/favorites");
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    const shop = toRecord(record.shop);
    const purchaseVariant = toRecord(record.purchaseVariant);
    const purchaseVariantId = readString(purchaseVariant.id);
    return {
      id: readString(record.id),
      productId: readString(record.productId),
      title: readString(record.title, "Product"),
      price: readNumber(record.price),
      currency: readString(record.currency, defaultCurrency),
      status: readString(record.status, "ACTIVE"),
      imageUrls: readArray(record.imageUrls).map((image) => readString(image)).filter(Boolean),
      shop: {
        id: readString(shop.id),
        name: readString(shop.name, "Shop"),
        slug: readString(shop.slug),
        status: readString(shop.status, "ACTIVE"),
      },
      purchaseVariant: purchaseVariantId ? {
        id: purchaseVariantId,
        title: readString(purchaseVariant.title, "Default"),
        stock: readNumber(purchaseVariant.stock),
        currency: readString(purchaseVariant.currency, readString(record.currency, defaultCurrency)),
        price: readNumber(purchaseVariant.price, readNumber(record.price)),
      } : null,
      createdAt: readString(record.createdAt, new Date().toISOString()),
    };
  });
}

export async function fetchFavoriteStatus(productId: string): Promise<boolean> {
  const response = toRecord(await apiFetch(`/api/me/favorites/${productId}`));
  return Boolean(response.favorited);
}

export async function addFavoriteProduct(productId: string): Promise<void> {
  await apiFetch(`/api/me/favorites/${productId}`, { method: "PUT" });
}

export async function removeFavoriteProduct(productId: string): Promise<void> {
  await apiFetch(`/api/me/favorites/${productId}`, { method: "DELETE" });
}

export async function fetchFollowedShops(): Promise<BuyerFollowedShop[]> {
  const response = await apiFetch("/api/me/followed-shops");
  const rawItems = Array.isArray(response) ? response : readArray(toRecord(response).items);
  return rawItems.map((item) => {
    const record = toRecord(item);
    return {
      id: readString(record.id),
      shopId: readString(record.shopId),
      name: readString(record.name, "Shop"),
      slug: readString(record.slug),
      followerCount: readNumber(record.followerCount),
      productCount: readNumber(record.productCount),
      products: readArray(record.products).map((productInput) => {
        const product = toRecord(productInput);
        return {
          id: readString(product.id),
          title: readString(product.title, "Product"),
          price: readNumber(product.price),
          currency: readString(product.currency, defaultCurrency),
        };
      }),
      createdAt: readString(record.createdAt, new Date().toISOString()),
    };
  });
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
    paymentUrl: readString(response.paymentUrl),
  };
}

export async function quoteCheckout(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
  const response = await apiFetch("/api/checkout/quote", {
    method: "POST",
    body: JSON.stringify(input),
  }) as Record<string, unknown>;
  const couponRecord = response.coupon && typeof response.coupon === "object" ? response.coupon as Record<string, unknown> : null;
  const coupon: CheckoutCouponOutcome | null = couponRecord
    ? (couponRecord.applied
      ? { code: readString(couponRecord.code), applied: true }
      : { code: readString(couponRecord.code), applied: false, reason: readString(couponRecord.reason) })
    : null;
  return {
    subtotal: readNumber(response.subtotal),
    discountTotal: readNumber(response.discountTotal),
    shippingTotal: readNumber(response.shippingTotal),
    taxTotal: readNumber(response.taxTotal),
    grandTotal: readNumber(response.grandTotal),
    currency: readString(response.currency, defaultCurrency),
    coupon,
  };
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

export async function fetchNotifications(scope: "all" | "seller" = "all"): Promise<BuyerNotification[]> {
  const response = await apiFetch(`/api/notifications${scope === "seller" ? "?scope=seller" : ""}`);
  const rawItems = Array.isArray(response) ? response : readArray((response as Record<string, unknown>)?.items);
  return rawItems.map((item) => {
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
  return requestApi(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
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
        quantity: readNumber(item.quantity, 1),
        unitPrice: readNumber(item.unitPrice, readNumber(variant.price)),
        currency: readString(item.currency, readString(variant.currency, defaultCurrency)),
      };
    });
    return {
      shopId: readString(shop.shopId, readString(shop.id, readString(shopDetail.id))),
      shopName: readString(shop.shopName, readString(shop.name, readString(shopDetail.name, "Shop"))),
      items,
      subtotal: readNumber(shop.subtotal, items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
    };
  });
  return {
    id: optionalString(record.id),
    shops,
    subtotal: readNumber(record.subtotal, shops.reduce((sum, shop) => sum + shop.subtotal, 0)),
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
      lineTotal: readNumber(item.lineTotal),
      shopName: readString(item.shopName, "Shop"),
      fulfillmentStatus: readString(item.fulfillmentStatus, "pending"),
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
    totalCents: readNumber(record.totalCents, readNumber(record.grandTotal, readNumber(toRecord(record.totals).grandTotal))),
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

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatMoney(cents: number, _currency = defaultCurrency): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: defaultCurrency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
