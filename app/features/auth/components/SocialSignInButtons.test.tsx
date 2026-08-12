/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { I18nProvider } from "#/i18n/client";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { signIn } from "#/lib/auth-client";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
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
    renderAuth(<LoginForm nextPath="/checkout" />);

    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText("Continue with phone")).toBeNull();
  });

  it("shows Google and Facebook actions on the signup form when providers are available", async () => {
    renderAuth(<SignupForm nextPath="/seller" />);

    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    expect(screen.queryByText("Continue with phone")).toBeNull();
  });

  it("starts Better Auth social sign-in with the sanitized next path", async () => {
    renderAuth(<LoginForm nextPath="/checkout?step=payment" />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/checkout?step=payment",
    }));
  });

  it("falls back to the default redirect when next is unsafe", async () => {
    renderAuth(<SignupForm nextPath="https://evil.example/phish" />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Facebook" }));

    await waitFor(() => expect(signIn.social).toHaveBeenCalledWith({
      provider: "facebook",
      callbackURL: "/",
    }));
  });

  it("shows unavailable providers as disabled and keeps email forms usable", async () => {
    fetchMock.mockResolvedValue(providerAvailabilityResponse({ google: false, facebook: false }));

    renderAuth(<LoginForm nextPath="/checkout" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/provider-availability",
      expect.objectContaining({ credentials: "include" }),
    ));
    const googleButton = await screen.findByRole("button", { name: "Google sign-in is not configured" });
    const facebookButton = screen.getByRole("button", { name: "Facebook sign-in is not configured" });
    expect(googleButton.hasAttribute("disabled")).toBe(true);
    expect(facebookButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Google and Facebook sign-in need OAuth credentials.")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("does not start social sign-in for an unavailable provider", async () => {
    fetchMock.mockResolvedValue(providerAvailabilityResponse({ google: false, facebook: true }));

    renderAuth(<LoginForm nextPath="/checkout" />);

    fireEvent.click(await screen.findByRole("button", { name: "Google sign-in is not configured" }));

    expect(signIn.social).not.toHaveBeenCalled();
  });
});

function providerAvailabilityResponse(body: { google: boolean; facebook: boolean }) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(body),
  };
}

function renderAuth(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><I18nProvider locale="en" messages={en} fallbackMessages={en}>{children}</I18nProvider></QueryClientProvider>);
}
