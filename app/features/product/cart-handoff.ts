"use client";

import { toast } from "sonner";

export interface ProductCartHandoffContext {
  productTitle?: string | null;
  variantTitle?: string | null;
}

export interface ShowAddToCartSuccessOptions {
  context?: ProductCartHandoffContext;
  copy: {
    successTitle: string;
    successDescription: string;
    viewCart: string;
    continueShopping: string;
  };
  onViewCart?: () => void;
  onContinueShopping?: () => void;
}

export interface ShowAddToCartErrorOptions {
  error: unknown;
  copy: {
    errorTitle: string;
    errorDescription: string;
  };
  fallbackMessage?: string;
}

export function showAddToCartSuccess(options: ShowAddToCartSuccessOptions) {
  const description = buildSuccessDescription(options.context, options.copy.successDescription);

  return toast.success(options.copy.successTitle, {
    description,
    action: options.onViewCart
      ? {
          label: options.copy.viewCart,
          onClick: options.onViewCart,
        }
      : undefined,
    cancel: {
      label: options.copy.continueShopping,
      onClick: options.onContinueShopping ?? (() => toast.dismiss()),
    },
  });
}

export function showAddToCartError(options: ShowAddToCartErrorOptions) {
  return toast.error(options.copy.errorTitle, {
    description: normalizeAddToCartError(options.error, options.fallbackMessage ?? options.copy.errorDescription),
  });
}

export function normalizeAddToCartError(error: unknown, fallbackMessage: string): string {
  if (typeof error === "string") return cleanMessage(error, fallbackMessage);
  if (error instanceof Error) return cleanMessage(error.message, fallbackMessage);
  if (!error || typeof error !== "object") return fallbackMessage;

  return (
    findStringValue(error, ["message", "error", "detail", "reason", "statusText"]) ??
    findNestedStringValue(error, ["body", "data", "response", "cause"]) ??
    fallbackMessage
  );
}

function buildSuccessDescription(context: ProductCartHandoffContext | undefined, fallbackDescription: string): string {
  const productTitle = cleanOptionalMessage(context?.productTitle);
  const variantTitle = cleanOptionalMessage(context?.variantTitle);

  if (productTitle && variantTitle && variantTitle !== productTitle) {
    return `${productTitle} - ${variantTitle}`;
  }

  return productTitle ?? variantTitle ?? fallbackDescription;
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
