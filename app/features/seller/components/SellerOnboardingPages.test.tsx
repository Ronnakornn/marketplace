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
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => path,
}));

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      "seller.kyc.required": "Required",
      "seller.kyc.optional": "Optional",
      "seller.kyc.uploading": "Uploading...",
      "seller.kyc.uploadId": "Upload ID:",
      "seller.kyc.reviewLabel": "Review:",
      "seller.kyc.rejectionReason": "Reason:",
      "seller.kyc.requiredBeforeSubmit": "This document is required before submit.",
      "seller.kyc.reviewStatus.pending": "Pending",
      "seller.kyc.reviewStatus.approved": "Approved",
      "seller.kyc.reviewStatus.rejected": "Rejected",
    };
    return labels[key] ?? key;
  },
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

    await screen.findByLabelText("ชื่อผู้สมัคร / ชื่อนิติบุคคล");

    fireEvent.change(screen.getByLabelText("ชื่อผู้สมัคร / ชื่อนิติบุคคล"), { target: { value: "Fashion Seller" } });
    fireEvent.change(screen.getByLabelText("อีเมลเพื่อยืนยันตัวตน"), { target: { value: "seller@example.com" } });
    fireEvent.change(screen.getByLabelText("เบอร์โทร"), { target: { value: "0800000000" } });
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

    await screen.findByLabelText("ชื่อผู้สมัคร / ชื่อนิติบุคคล");
    fireEvent.change(screen.getByLabelText("ชื่อผู้สมัคร / ชื่อนิติบุคคล"), { target: { value: "Fashion Seller" } });
    fireEvent.change(screen.getByLabelText("อีเมลเพื่อยืนยันตัวตน"), { target: { value: "seller@example.com" } });
    fireEvent.change(screen.getByLabelText("เบอร์โทร"), { target: { value: "0800000000" } });

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
            documents: [
              { id: "doc_1", documentType: "ID_CARD", uploadId: "upload_id_card" },
              { id: "doc_2", documentType: "TAX_DOCUMENT", uploadId: "upload_tax" },
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
