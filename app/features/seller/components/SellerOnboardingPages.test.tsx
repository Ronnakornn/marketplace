/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../messages/en.json";
import thMessages from "../../../../messages/th.json";
import { I18nProvider } from "#/i18n/client";
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

function renderWithClient(ui: ReactNode, locale: "en" | "th" = "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const messages = locale === "th" ? thMessages : enMessages;
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale={locale} messages={messages} fallbackMessages={enMessages}>
        {ui}
      </I18nProvider>
    </QueryClientProvider>,
  );
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
  it("renders account step and saves draft", async () => {
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

    renderWithClient(<SellerRegisterPage step="account" />);

    await screen.findByLabelText("Applicant or legal entity name");

    fireEvent.change(screen.getByLabelText("Applicant or legal entity name"), { target: { value: "Fashion Seller" } });
    fireEvent.change(screen.getByLabelText("Verification email"), { target: { value: "seller@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0800000000" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/seller/application/draft",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("moves to next route when current step is complete", async () => {
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

    renderWithClient(<SellerRegisterPage step="account" />);

    await screen.findByLabelText("Applicant or legal entity name");
    fireEvent.change(screen.getByLabelText("Applicant or legal entity name"), { target: { value: "Fashion Seller" } });
    fireEvent.change(screen.getByLabelText("Verification email"), { target: { value: "seller@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0800000000" } });

    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/seller/register/shop");
    });
  });

  it("renders rejected status with edit path to account step", async () => {
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
    expect(editLink.getAttribute("href")).toBe("/seller/register/account");
  });

  it("renders the registration flow in Thai", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ application: null, shop: null })));

    renderWithClient(<SellerRegisterPage step="account" />, "th");

    await screen.findByRole("heading", { name: "เริ่มขายสินค้า" });
    expect(screen.getByLabelText("ชื่อผู้สมัครหรือชื่อนิติบุคคล")).toBeDefined();
    expect(screen.getByRole("button", { name: "บันทึกร่าง" })).toBeDefined();
    expect(screen.queryByText("Start selling")).toBeNull();
  });

  it("submits successfully on terms step when KYC is already saved", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/seller/application" && !init?.method) {
        return jsonResponse({
          application: {
            id: "app_1",
            status: "DRAFT",
            businessType: "INDIVIDUAL",
            shopName: "Green Market",
            shopSlug: "green-market",
            legalName: "Fashion Seller",
            contactEmail: "seller@example.com",
            contactPhone: "0800000000",
            nationalIdLast4: "1234",
            taxIdLast4: "5678",
            bankName: "Kasikorn",
            bankAccountName: "Fashion Seller",
            bankAccountNumberLast4: "9999",
            pickupAddress: {
              name: "Fashion Seller",
              phone: "0800000000",
              line1: "99 Rama 1",
              line2: null,
              city: "Bangkok",
              region: "Bangkok",
              postalCode: "10330",
              country: "TH",
            },
            documents: [
              { id: "doc_1", documentType: "ID_CARD", uploadId: "upload_id_card" },
              { id: "doc_2", documentType: "TAX_DOCUMENT", uploadId: "upload_tax" },
              { id: "doc_3", documentType: "BANK_BOOK", uploadId: "upload_bank" },
            ],
          },
          shop: null,
        });
      }
      if (String(input) === "/api/seller/application/submit" && init?.method === "POST") {
        return jsonResponse({ application: { id: "app_1", status: "SUBMITTED" }, shop: null });
      }
      return jsonResponse({ error: { message: "Unexpected request" } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<SellerRegisterPage step="terms" />);

    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/seller/application/submit",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/seller/status");
    });
  });
});
