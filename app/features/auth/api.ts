"use client";

import { requestApi } from "#/lib/api-client";

export type SocialProviderAvailability = {
  google: boolean;
  facebook: boolean;
};

export async function getSocialProviderAvailability(): Promise<SocialProviderAvailability> {
  const body = await requestApi<unknown>("/api/auth/provider-availability");
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

export type PhoneOtpRequestResult = {
  success: boolean;
  challengeId: string;
  resendAvailableAt: string;
  expiresAt: string;
};

export type PhoneOtpVerifyResult = {
  success: boolean;
  state: "LOGIN_READY" | "SIGNUP_REQUIRED" | "PHONE_LINKED";
  phone: string;
  pendingSignupToken?: string;
  expiresAt?: string;
};

export async function requestPhoneAuthOtp(phone: string): Promise<PhoneOtpRequestResult> {
  return authFetchJson<PhoneOtpRequestResult>("/api/auth/phone/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneAuthOtp(input: { phone: string; otp: string }): Promise<PhoneOtpVerifyResult> {
  return authFetchJson<PhoneOtpVerifyResult>("/api/auth/phone/verify-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completePhoneSignup(input: {
  phone: string;
  pendingSignupToken: string;
  email: string;
  name: string;
  password: string;
}): Promise<void> {
  await authFetch("/api/auth/phone/complete-signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function authFetch(path: string, init: RequestInit): Promise<void> {
  await authFetchJson<unknown>(path, init);
}

async function authFetchJson<T>(path: string, init: RequestInit): Promise<T> {
  return requestApi<T>(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
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
