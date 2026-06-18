/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerRegisterPage, SellerStatusPage } from "./SellerOnboardingPages";

const push = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => path,
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("seller onboarding frontend smoke", () => {
  it("renders a draft onboarding form and saves a draft", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/seller/application" && !init?.method) {
        return jsonResponse({ application: null, shop: null });
      }
      if (String(input) === "/api/seller/application/draft" && init?.method === "POST") {
        return jsonResponse({ application: { id: "app_1", status: "DRAFT" }, shop: null });
      }
      return jsonResponse({ error: { message: "Unexpected request" } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithClient(<SellerRegisterPage />);

    await screen.findByText("Shop profile");
    expect(container.innerHTML).toContain("xl:grid-cols-[1fr_360px]");

    fireEvent.change(screen.getByLabelText("Shop name"), { target: { value: "Green Market" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/seller/application/draft",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows submit pending state before redirecting to status", async () => {
    let resolveSubmit: (response: Response) => void = () => undefined;
    const submitPromise = new Promise<Response>((resolve) => {
      resolveSubmit = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/seller/application" && !init?.method) {
        return Promise.resolve(jsonResponse({ application: null, shop: null }));
      }
      if (String(input) === "/api/seller/application/submit" && init?.method === "POST") {
        return submitPromise;
      }
      return Promise.resolve(jsonResponse({ error: { message: "Unexpected request" } }, 500));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<SellerRegisterPage />);

    await screen.findByText("Shop profile");
    const submitButton = screen.getByRole("button", { name: /submit for review/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toHaveProperty("disabled", true);
    });

    resolveSubmit(jsonResponse({ application: { id: "app_1", status: "SUBMITTED" }, shop: null }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/seller/status");
    });
  });

  it("renders rejected status with a resubmit path", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      application: {
        id: "app_1",
        status: "REJECTED",
        rejectionReason: "Bank book upload is unreadable.",
      },
      shop: null,
    })));

    renderWithClient(<SellerStatusPage />);

    await screen.findByText("Bank book upload is unreadable.");
    const editLink = screen.getByRole("link", { name: /edit application/i }) as HTMLAnchorElement;
    expect(editLink.getAttribute("href")).toBe("/seller/register");
  });
});
