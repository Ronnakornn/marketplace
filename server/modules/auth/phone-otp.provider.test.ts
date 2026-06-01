import { describe, expect, it } from "vitest";
import {
  createDeterministicPhoneOtp,
  createOtpHash,
  createPhoneOtpProvider,
  DeterministicPhoneOtpProvider,
  normalizePhoneNumber,
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
});
