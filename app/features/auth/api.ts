"use client";

export type SocialProviderAvailability = {
  google: boolean;
  facebook: boolean;
};

export async function getSocialProviderAvailability(): Promise<SocialProviderAvailability> {
  const response = await fetch("/api/auth/provider-availability", {
    credentials: "include",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    throw new Error(readErrorMessage(body));
  }
  return readProviderAvailability(body);
}

export async function resendEmailVerification(): Promise<void> {
  await authFetch("/api/auth/resend-email-verification", { method: "POST" });
}

export async function verifyEmailOtp(input: { email: string; otp: string }): Promise<void> {
  await authFetch("/api/auth/verify-email-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestPasswordResetOtp(email: string): Promise<void> {
  await authFetch("/api/auth/request-password-reset-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function completePasswordReset(input: { email: string; otp: string; newPassword: string }): Promise<void> {
  await authFetch("/api/auth/complete-password-reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  await authFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function authFetch(path: string, init: RequestInit): Promise<void> {
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
    throw new Error(readErrorMessage(body));
  }
}

function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request failed";
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return typeof record.message === "string" && record.message.trim() ? record.message : "Request failed";
}

function readProviderAvailability(body: unknown): SocialProviderAvailability {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { google: false, facebook: false };
  }
  const record = body as Record<string, unknown>;
  return {
    google: record.google === true,
    facebook: record.facebook === true,
  };
}
