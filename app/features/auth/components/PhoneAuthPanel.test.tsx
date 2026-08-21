/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render as testingRender, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completePhoneSignup, requestPhoneAuthOtp, verifyPhoneAuthOtp } from "#/features/auth/api";
import { PhoneAuthPanel } from "./PhoneAuthPanel";
import { I18nProvider } from "#/i18n/client";
import enMessages from "../../../../messages/en.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("#/features/auth/api", () => ({
  completePhoneSignup: vi.fn(),
  requestPhoneAuthOtp: vi.fn(),
  verifyPhoneAuthOtp: vi.fn(),
}));

function render(ui: ReactElement) {
  return testingRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}>{ui}</I18nProvider></QueryClientProvider>);
}

afterEach(() => cleanup());

describe("PhoneAuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a phone OTP and shows the verification step", async () => {
    vi.mocked(requestPhoneAuthOtp).mockResolvedValue({
      success: true,
      challengeId: "challenge-1",
      resendAvailableAt: "2026-06-01T12:00:00.000Z",
      expiresAt: "2026-06-01T12:05:00.000Z",
    });
    render(<PhoneAuthPanel mode="login" nextPath="/profile" />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+66812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send phone code" }));

    expect(await screen.findByText("Verification code sent.")).toBeTruthy();
    expect(screen.getByLabelText("Phone code")).toBeTruthy();
    expect(requestPhoneAuthOtp).toHaveBeenCalledWith("+66812345678");
  });

  it("preserves OTP input and shows verification errors", async () => {
    vi.mocked(requestPhoneAuthOtp).mockResolvedValue({
      success: true,
      challengeId: "challenge-1",
      resendAvailableAt: "2026-06-01T12:00:00.000Z",
      expiresAt: "2026-06-01T12:05:00.000Z",
    });
    vi.mocked(verifyPhoneAuthOtp).mockRejectedValue(new Error("Invalid or expired phone verification code"));
    render(<PhoneAuthPanel mode="login" />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+66812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send phone code" }));
    await screen.findByLabelText("Phone code");
    fireEvent.change(screen.getByLabelText("Phone code"), { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify phone code" }));

    expect(await screen.findByText("Invalid or expired phone verification code")).toBeTruthy();
    expect(screen.getByLabelText("Phone code")).toHaveProperty("value", "111111");
  });

  it("moves pending signup phones to completion fields", async () => {
    vi.mocked(requestPhoneAuthOtp).mockResolvedValue({
      success: true,
      challengeId: "challenge-1",
      resendAvailableAt: "2026-06-01T12:00:00.000Z",
      expiresAt: "2026-06-01T12:05:00.000Z",
    });
    vi.mocked(verifyPhoneAuthOtp).mockResolvedValue({
      success: true,
      state: "SIGNUP_REQUIRED",
      phone: "+66812345678",
      pendingSignupToken: "pending-token",
    });
    render(<PhoneAuthPanel mode="signup" />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+66812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send phone code" }));
    await screen.findByLabelText("Phone code");
    fireEvent.change(screen.getByLabelText("Phone code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify phone code" }));

    expect(await screen.findByText("Phone verified. Complete your account with email and password.")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("requires complete signup fields before submission", async () => {
    vi.mocked(requestPhoneAuthOtp).mockResolvedValue({
      success: true,
      challengeId: "challenge-1",
      resendAvailableAt: "2026-06-01T12:00:00.000Z",
      expiresAt: "2026-06-01T12:05:00.000Z",
    });
    vi.mocked(verifyPhoneAuthOtp).mockResolvedValue({
      success: true,
      state: "SIGNUP_REQUIRED",
      phone: "+66812345678",
      pendingSignupToken: "pending-token",
    });
    vi.mocked(completePhoneSignup).mockResolvedValue();
    render(<PhoneAuthPanel mode="signup" nextPath="/orders" />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+66812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send phone code" }));
    await screen.findByLabelText("Phone code");
    fireEvent.change(screen.getByLabelText("Phone code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify phone code" }));
    const submit = await screen.findByRole("button", { name: "Complete phone signup" });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Buyer One" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(submit);

    await waitFor(() => expect(completePhoneSignup).toHaveBeenCalledWith({
      phone: "+66812345678",
      pendingSignupToken: "pending-token",
      email: "buyer@example.com",
      name: "Buyer One",
      password: "password123",
    }));
    expect(push).toHaveBeenCalledWith("/orders");
  });
});
