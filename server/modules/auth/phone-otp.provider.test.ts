import { describe, expect, it, vi } from "vitest";
import {
  createDeterministicPhoneOtp,
  createOtpHash,
  createPhoneOtpProvider,
  DeterministicPhoneOtpProvider,
  DisabledPhoneOtpProvider,
  HttpPhoneOtpProvider,
  normalizePhoneNumber,
  readHttpPhoneOtpProviderConfig,
  verifyOtpHash,
} from "./phone-otp.provider.ts";

describe("phone OTP provider foundation", () => {
  it("normalizes phone numbers before deterministic OTP generation", () => {
    expect(normalizePhoneNumber(" +66 81-234-5678 ")).toBe("+66812345678");
    expect(normalizePhoneNumber("081 234 5678")).toBe("0812345678");
  });

  it("generates deterministic six digit OTPs by phone and purpose", () => {
    const loginOtp = createDeterministicPhoneOtp("+66812345678", "PHONE_LOGIN");
    const repeatedLoginOtp = createDeterministicPhoneOtp("+66 81 234 5678", "PHONE_LOGIN");
    const signupOtp = createDeterministicPhoneOtp("+66812345678", "PHONE_SIGNUP");

    expect(loginOtp).toMatch(/^\d{6}$/);
    expect(repeatedLoginOtp).toBe(loginOtp);
    expect(signupOtp).not.toBe(loginOtp);
  });

  it("verifies OTP hashes without storing plaintext OTP values", () => {
    const hash = createOtpHash("123456", "challenge-id");

    expect(hash).not.toContain("123456");
    expect(verifyOtpHash("123456", "challenge-id", hash)).toBe(true);
    expect(verifyOtpHash("654321", "challenge-id", hash)).toBe(false);
  });

  it("records deterministic dev sends without logging or external network calls", async () => {
    const provider = new DeterministicPhoneOtpProvider();
    const result = await provider.send({
      phone: "+66 81 234 5678",
      purpose: "PHONE_LINK",
      otp: "123456",
    });

    expect(result).toEqual({
      provider: "deterministic-dev",
      messageId: expect.stringMatching(/^mock_[a-f0-9]{24}$/),
    });
    expect(provider.sentMessages).toEqual([
      {
        phone: "+66812345678",
        purpose: "PHONE_LINK",
        otp: "123456",
      },
    ]);
  });

  it("fails closed in production when no production provider is configured", () => {
    expect(() => createPhoneOtpProvider({ NODE_ENV: "production" })).toThrow("Phone OTP provider is not configured");
  });

  it("can disable phone OTP without requiring a delivery provider", async () => {
    const provider = createPhoneOtpProvider({
      NODE_ENV: "production",
      PHONE_OTP_ENABLED: "false",
    });

    expect(provider).toBeInstanceOf(DisabledPhoneOtpProvider);
    await expect(provider.send({
      phone: "+66812345678",
      purpose: "PHONE_LOGIN",
      otp: "123456",
    })).rejects.toThrow("Phone OTP is disabled");
  });

  it("uses the deterministic provider only outside production", () => {
    expect(createPhoneOtpProvider({ NODE_ENV: "development" })).toBeInstanceOf(DeterministicPhoneOtpProvider);
    expect(createPhoneOtpProvider({ NODE_ENV: "test", PHONE_OTP_PROVIDER: "deterministic-dev" })).toBeInstanceOf(DeterministicPhoneOtpProvider);
  });

  it("allows deterministic OTP in production only when explicitly enabled", () => {
    expect(createPhoneOtpProvider({
      NODE_ENV: "production",
      PHONE_OTP_PROVIDER: "deterministic-dev",
      ALLOW_DETERMINISTIC_OTP: "true",
    })).toBeInstanceOf(DeterministicPhoneOtpProvider);
  });

  it("reads HTTP provider configuration from environment", () => {
    expect(readHttpPhoneOtpProviderConfig({
      NODE_ENV: "production",
      PHONE_OTP_HTTP_URL: "https://sms.example/send",
      PHONE_OTP_HTTP_BEARER_TOKEN: "secret-token",
      PHONE_OTP_HTTP_TIMEOUT_MS: "2500",
    })).toEqual({
      url: "https://sms.example/send",
      bearerToken: "secret-token",
      timeoutMs: 2500,
    });
  });

  it("requires HTTPS HTTP provider URL in production", () => {
    expect(() => readHttpPhoneOtpProviderConfig({
      NODE_ENV: "production",
      PHONE_OTP_HTTP_URL: "http://sms.example/send",
    })).toThrow("Phone OTP HTTP provider URL must use https in production");
  });

  it("creates the HTTP provider when configured", () => {
    expect(createPhoneOtpProvider({
      NODE_ENV: "production",
      PHONE_OTP_PROVIDER: "http",
      PHONE_OTP_HTTP_URL: "https://sms.example/send",
    })).toBeInstanceOf(HttpPhoneOtpProvider);
  });

  it("sends normalized OTP payloads through the HTTP provider without exposing internals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ messageId: "sms-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HttpPhoneOtpProvider({
      url: "https://sms.example/send",
      bearerToken: "secret-token",
      timeoutMs: 5000,
    });

    await expect(provider.send({
      phone: "+66 81 234 5678",
      purpose: "PHONE_LOGIN",
      otp: "123456",
    })).resolves.toEqual({
      provider: "http",
      messageId: "sms-123",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://sms.example/send", expect.objectContaining({
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        phone: "+66812345678",
        purpose: "PHONE_LOGIN",
        otp: "123456",
      }),
    }));

    vi.unstubAllGlobals();
  });
});
