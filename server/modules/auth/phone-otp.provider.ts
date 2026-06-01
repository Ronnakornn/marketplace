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

export interface HttpPhoneOtpProviderConfig {
  url: string;
  bearerToken?: string;
  timeoutMs: number;
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

export class HttpPhoneOtpProvider implements PhoneOtpProvider {
  readonly provider = "http";

  constructor(private readonly config: HttpPhoneOtpProviderConfig) {}

  async send(input: SendPhoneOtpInput): Promise<SendPhoneOtpResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.bearerToken ? { authorization: `Bearer ${this.config.bearerToken}` } : {}),
        },
        body: JSON.stringify({
          phone: normalizePhoneNumber(input.phone),
          purpose: input.purpose,
          otp: input.otp,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PhoneOtpProviderError();
      }

      const body = await readJsonObject(response);
      const messageId = typeof body?.["messageId"] === "string" && body["messageId"].trim()
        ? body["messageId"]
        : `http_${Date.now()}`;

      return {
        provider: this.provider,
        messageId,
      };
    } catch (error) {
      if (error instanceof PhoneOtpProviderError) throw error;
      throw new PhoneOtpProviderError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPhoneOtpProvider(env: NodeJS.ProcessEnv = process.env): PhoneOtpProvider {
  const provider = env.PHONE_OTP_PROVIDER?.trim() || "deterministic-dev";

  if (provider === "http") {
    return new HttpPhoneOtpProvider(readHttpPhoneOtpProviderConfig(env));
  }

  if (provider === "deterministic-dev" && env.NODE_ENV !== "production") {
    return new DeterministicPhoneOtpProvider();
  }

  throw new PhoneOtpProviderError("Phone OTP provider is not configured");
}

export function readHttpPhoneOtpProviderConfig(env: NodeJS.ProcessEnv = process.env): HttpPhoneOtpProviderConfig {
  const url = env.PHONE_OTP_HTTP_URL?.trim();
  if (!url) {
    throw new PhoneOtpProviderError("Phone OTP HTTP provider URL is not configured");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new PhoneOtpProviderError("Phone OTP HTTP provider URL is invalid");
  }

  if (env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new PhoneOtpProviderError("Phone OTP HTTP provider URL must use https in production");
  }

  const timeoutMs = Number.parseInt(env.PHONE_OTP_HTTP_TIMEOUT_MS ?? "5000", 10);
  return {
    url,
    bearerToken: env.PHONE_OTP_HTTP_BEARER_TOKEN?.trim() || undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
  };
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    const body = JSON.parse(text) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
