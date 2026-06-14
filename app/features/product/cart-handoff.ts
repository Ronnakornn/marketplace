"use client";

import { toast } from "sonner";

const DEFAULT_SUCCESS_TITLE = "Added to cart";
const DEFAULT_SUCCESS_DESCRIPTION = "Your item was added to the cart.";
const DEFAULT_ERROR_TITLE = "Could not add to cart";
const DEFAULT_ERROR_DESCRIPTION = "Please try again or review the selected options.";

export interface ProductCartHandoffContext {
  productTitle?: string | null;
  variantTitle?: string | null;
}

export interface ShowAddToCartSuccessOptions {
  context?: ProductCartHandoffContext;
  onViewCart?: () => void;
  onContinueShopping?: () => void;
}

export interface ShowAddToCartErrorOptions {
  error: unknown;
  fallbackMessage?: string;
}

export function showAddToCartSuccess(options: ShowAddToCartSuccessOptions = {}) {
  const description = buildSuccessDescription(options.context);

  return toast.success(DEFAULT_SUCCESS_TITLE, {
    description,
    action: options.onViewCart
      ? {
          label: "View cart",
          onClick: options.onViewCart,
        }
      : undefined,
    cancel: {
      label: "Continue shopping",
      onClick: options.onContinueShopping ?? (() => toast.dismiss()),
    },
  });
}

export function showAddToCartError(options: ShowAddToCartErrorOptions) {
  return toast.error(DEFAULT_ERROR_TITLE, {
    description: normalizeAddToCartError(options.error, options.fallbackMessage),
  });
}

export function normalizeAddToCartError(error: unknown, fallbackMessage = DEFAULT_ERROR_DESCRIPTION): string {
  if (typeof error === "string") return cleanMessage(error, fallbackMessage);
  if (error instanceof Error) return cleanMessage(error.message, fallbackMessage);
  if (!error || typeof error !== "object") return fallbackMessage;

  return (
    findStringValue(error, ["message", "error", "detail", "reason", "statusText"]) ??
    findNestedStringValue(error, ["body", "data", "response", "cause"]) ??
    fallbackMessage
  );
}

function buildSuccessDescription(context?: ProductCartHandoffContext): string {
  const productTitle = cleanOptionalMessage(context?.productTitle);
  const variantTitle = cleanOptionalMessage(context?.variantTitle);

  if (productTitle && variantTitle && variantTitle !== productTitle) {
    return `${productTitle} - ${variantTitle}`;
  }

  return productTitle ?? variantTitle ?? DEFAULT_SUCCESS_DESCRIPTION;
}

function cleanMessage(value: string, fallbackMessage: string): string {
  const trimmed = value.trim();
  return trimmed && trimmed !== "[object Object]" ? trimmed : fallbackMessage;
}

function cleanOptionalMessage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "[object Object]" ? trimmed : null;
}

function findStringValue(source: object, keys: string[]): string | null {
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "string") {
      const cleaned = cleanOptionalMessage(value);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function findNestedStringValue(source: object, keys: string[]): string | null {
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value && typeof value === "object") {
      const message = findStringValue(value, ["message", "error", "detail", "reason", "statusText"]);
      if (message) return message;
    }
  }

  return null;
}
