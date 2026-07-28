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
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const value = "value" in error ? error.value : error;
    if (value && typeof value === "object") {
      const errorBody = "error" in value ? value.error : value;
      if (errorBody && typeof errorBody === "object" && "message" in errorBody && typeof errorBody.message === "string") {
        return new Error(errorBody.message);
      }
    }
  }
  return new Error("Payment request failed");
}
