/**
 * @vitest-environment jsdom
 */
import { type ReactElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render as testingRender, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm, ForgotPasswordForm, ResetPasswordForm, VerifyEmailForm } from "./AuthV1Forms";
import { changePassword, completePasswordReset, requestPasswordResetOtp, verifyEmailOtp } from "#/features/auth/api";
import { I18nProvider } from "#/i18n/client";
import enMessages from "../../../../messages/en.json";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("email=user@example.com"),
}));

vi.mock("#/features/auth/api", () => ({
  changePassword: vi.fn(),
  completePasswordReset: vi.fn(),
  requestPasswordResetOtp: vi.fn(),
  resendEmailVerification: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

function render(ui: ReactElement) {
  return testingRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}>{ui}</I18nProvider></QueryClientProvider>);
}

afterEach(() => cleanup());

describe("Auth v1 forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["verify email", VerifyEmailForm],
    ["forgot password", ForgotPasswordForm],
  ])("uses the shared auth theme for %s", (_name, Form) => {
    render(<Form />);

    expect(document.querySelector(".auth-page")).toBeTruthy();
    expect(document.querySelector(".auth-card")).toBeTruthy();
  });

  it("preserves OTP form input and shows verification errors", async () => {
    vi.mocked(verifyEmailOtp).mockRejectedValue(new Error("Invalid or expired verification code"));
    render(<VerifyEmailForm />);

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByText("Invalid or expired verification code")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "user@example.com");
    expect(screen.getByLabelText("Verification code")).toHaveProperty("value", "123456");
  });

  it("uses non-enumerating copy for forgot password requests", async () => {
    vi.mocked(requestPasswordResetOtp).mockResolvedValue();
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "missing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(await screen.findByText("If that email has an account, a reset code has been sent.")).toBeTruthy();
    expect(requestPasswordResetOtp).toHaveBeenCalledWith("missing@example.com");
  });

  it("submits reset password OTP and redirects after success", async () => {
    vi.mocked(completePasswordReset).mockResolvedValue();
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText("Reset code"), { target: { value: "456789" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(completePasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      otp: "456789",
      newPassword: "new-password",
    });
  });

  it("preserves change password values when current password validation fails", async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error("Current password is invalid"));
    render(<ChangePasswordForm />);

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is invalid")).toBeTruthy();
    expect(screen.getByLabelText("Current password")).toHaveProperty("value", "old-password");
    expect(screen.getByLabelText("New password")).toHaveProperty("value", "new-password");
  });
});
