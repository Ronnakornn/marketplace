import { createHash, timingSafeEqual } from "node:crypto";

export const PHONE_OTP_LENGTH = 6;
export const PHONE_OTP_TTL_SECONDS = 5 * 60;
export const PHONE_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
export const PHONE_OTP_MAX_REQUESTS_PER_WINDOW = 5;

export type PhoneOtpPurpose = "PHONE_LOGIN" | "PHONE_SIGNUP" | "PHONE_LINK";

export interface SendPhoneOtpInput {
  phone: string;
  purpose: PhoneOtpPurpose;
  otp: string;
}

export interface SendPhoneOtpResult {
  provider: string;
  messageId: string;
}

export interface PhoneOtpProvider {
  send(input: SendPhoneOtpInput): Promise<SendPhoneOtpResult>;
}

export class PhoneOtpProviderError extends Error {
  constructor(message = "Unable to send phone verification code") {
    super(message);
    this.name = "PhoneOtpProviderError";
  }
}

export function normalizePhoneNumber(phone: string): string {
  const compact = phone.trim().replace(/[\s().-]/g, "");

  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }

  return compact.replace(/\D/g, "");
}

export function createOtpHash(otp: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${otp}`).digest("hex");
}

export function verifyOtpHash(otp: string, salt: string, expectedHash: string): boolean {
  const actualHash = createOtpHash(otp, salt);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createDeterministicPhoneOtp(phone: string, purpose: PhoneOtpPurpose): string {
  const normalizedPhone = normalizePhoneNumber(phone);
  const digest = createHash("sha256").update(`${purpose}:${normalizedPhone}`).digest("hex");
  const value = Number.parseInt(digest.slice(0, 12), 16) % 10 ** PHONE_OTP_LENGTH;

  return value.toString().padStart(PHONE_OTP_LENGTH, "0");
}

export class DeterministicPhoneOtpProvider implements PhoneOtpProvider {
  readonly provider = "deterministic-dev";
  readonly sentMessages: SendPhoneOtpInput[] = [];

  async send(input: SendPhoneOtpInput): Promise<SendPhoneOtpResult> {
    this.sentMessages.push({
      ...input,
      phone: normalizePhoneNumber(input.phone),
    });

    const digest = createHash("sha256")
      .update(`${this.provider}:${input.purpose}:${normalizePhoneNumber(input.phone)}`)
      .digest("hex")
      .slice(0, 24);

    return {
      provider: this.provider,
      messageId: `mock_${digest}`,
    };
  }
}

export function createPhoneOtpProvider(env: NodeJS.ProcessEnv = process.env): PhoneOtpProvider {
  if (env.NODE_ENV === "production" && env.PHONE_OTP_PROVIDER !== "deterministic-dev") {
    throw new PhoneOtpProviderError("Phone OTP provider is not configured");
  }

  return new DeterministicPhoneOtpProvider();
}
