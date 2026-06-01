/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { signIn } from "#/lib/auth-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("#/lib/auth-client", () => ({
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(providerAvailabilityResponse({ google: true, facebook: true }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null } as never);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("social sign-in buttons", () => {
  it("shows Google and Facebook actions on the login form when providers are available", async () => {
    render(<LoginForm nextPath="/checkout" />);

    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("shows Google and Facebook actions on the signup form when providers are available", async () => {
    render(<SignupForm nextPath="/seller" />);

    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("starts Better Auth social sign-in with the sanitized next path", async () => {
    render(<LoginForm nextPath="/checkout?step=payment" />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/checkout?step=payment",
    }));
  });

  it("falls back to the default redirect when next is unsafe", async () => {
    render(<SignupForm nextPath="https://evil.example/phish" />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Facebook" }));

    await waitFor(() => expect(signIn.social).toHaveBeenCalledWith({
      provider: "facebook",
      callbackURL: "/",
    }));
  });

  it("hides unavailable providers and keeps email forms usable", async () => {
    fetchMock.mockResolvedValue(providerAvailabilityResponse({ google: false, facebook: false }));

    render(<LoginForm nextPath="/checkout" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/provider-availability", {
      credentials: "include",
    }));
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue with Facebook" })).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });
});

function providerAvailabilityResponse(body: { google: boolean; facebook: boolean }) {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  };
}
