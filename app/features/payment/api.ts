"use client";

import { api } from "#/lib/eden";

export type MockPaymentEventType = "payment.paid" | "payment.failed";

export async function fetchBuyerMockPayment(paymentId: string) {
  const { data, error } = await api.api.payments.mock({ paymentId }).get();
  if (error) throw toApiError(error);
  return data;
}

export async function createBuyerMockPaymentEvent(paymentId: string, eventType: MockPaymentEventType) {
  const { data, error } = await api.api.payments.mock({ paymentId }).events.post({ eventType });
  if (error) throw toApiError(error);
  return data;
}

function toApiError(error: unknown): Error {
  return new Error(readApiErrorMessage(error) ?? "Payment request failed");
}

function readApiErrorMessage(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (typeof value === "string") {
    const message = value.trim();
    return message && message !== "[object Object]" ? message : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["value", "error", "body", "data", "message"] as const) {
    if (key in record) {
      const message = readApiErrorMessage(record[key], depth + 1);
      if (message) return message;
    }
  }
  return null;
}
