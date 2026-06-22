/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import type * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSellerApplicationsTable } from "./AdminSellerApplicationsTable";

const mutate = vi.fn();
const mutateDocument = vi.fn();
const reviewState: { isPending: boolean; isSuccess: boolean; error: unknown } = {
  isPending: false,
  isSuccess: false,
  error: null,
};
const reviewDocumentState: { isPending: boolean; isSuccess: boolean; error: unknown } = {
  isPending: false,
  isSuccess: false,
  error: null,
};

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      "admin.sellerApplications.approveDocument": "Approve document",
      "admin.sellerApplications.rejectDocument": "Reject document",
      "admin.sellerApplications.documentReviewSaved": "Document review saved.",
      "admin.sellerApplications.operationFailed": "Operation failed.",
      "admin.sellerApplications.unresolvedRequiredDocuments": "Required documents still need approval:",
      "admin.sellerApplications.rejectDocumentTitle": "Reject seller document",
      "admin.sellerApplications.rejectDocumentDescription": "Provide a reason for this document.",
      "admin.sellerApplications.rejectDocumentPlaceholder": "Explain what must be corrected on this document.",
      "admin.sellerApplications.rejectionReasonRequired": "Rejection reason is required.",
      "admin.cancel": "Cancel",
      "seller.kyc.documentType.idCard": "ID card",
      "seller.kyc.documentType.businessCertificate": "Business certificate",
      "seller.kyc.documentType.bankBook": "Bank book",
      "seller.kyc.documentType.taxDocument": "Tax document",
      "seller.kyc.reviewStatus.approved": "Approved",
      "seller.kyc.reviewStatus.rejected": "Rejected",
      "seller.kyc.reviewStatus.pending": "Pending",
      "seller.kyc.reviewLabel": "Review:",
      "seller.kyc.rejectionReason": "Rejection reason:",
    };
    return labels[key] ?? key;
  },
}));

vi.mock("#/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
  AlertDialogAction: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/card", () => ({
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("#/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) => <tr {...props}>{children}</tr>,
}));

vi.mock("./AdminDataShell", () => ({
  AdminDataShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock("./AdminStatusBadge", () => ({
  AdminStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("../hooks/useAdminOperations", () => ({
  useAdminSellerApplicationsList: () => ({
    data: [
      {
        id: "app_1",
        status: "SUBMITTED",
        submittedAt: "2026-05-21T08:00:00.000Z",
        user: { id: "user_1", name: "Nara Seller", email: "nara@example.com", status: "ACTIVE" },
        businessType: "INDIVIDUAL",
        shopName: "Nara Goods",
        shopSlug: "nara-goods",
        legalName: "Nara Seller",
        shopContactEmail: "shop@example.com",
        shopContactPhone: "0800000000",
        nationalIdMasked: "*********1234",
        companyRegistrationMasked: null,
        taxIdMasked: "*****6789",
        bankName: "Bangkok Bank",
        bankAccountName: "Nara Seller",
        bankAccountNumberMasked: "******4321",
        pickupAddress: {
          name: "Warehouse",
          line1: "99 Rama 9",
          line2: null,
          city: "Bangkok",
          region: "Bangkok",
          postalCode: "10310",
          country: "TH",
        },
        documents: [
          {
            id: "doc_1",
            documentType: "ID_CARD",
            side: "FRONT",
            reviewStatus: "PENDING",
            rejectionReason: null,
            uploadId: "upload_1",
            fileName: "id-card.png",
            contentType: "image/png",
            fileSize: 1024,
            status: "COMPLETED",
            completedAt: "2026-05-21T08:00:00.000Z",
          },
        ],
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useReviewSellerApplication: () => ({
    mutate,
    isPending: reviewState.isPending,
    isSuccess: reviewState.isSuccess,
    error: reviewState.error,
  }),
  useReviewSellerApplicationDocument: () => ({
    mutate: mutateDocument,
    isPending: reviewDocumentState.isPending,
    isSuccess: reviewDocumentState.isSuccess,
    error: reviewDocumentState.error,
  }),
}));

afterEach(() => {
  cleanup();
  mutate.mockClear();
  mutateDocument.mockClear();
  reviewState.isPending = false;
  reviewState.isSuccess = false;
  reviewState.error = null;
  reviewDocumentState.isPending = false;
  reviewDocumentState.isSuccess = false;
  reviewDocumentState.error = null;
});

describe("admin seller application queue smoke", () => {
  it("renders review details and approves an application", () => {
    render(<AdminSellerApplicationsTable />);

    expect(screen.getByText("Seller Application Queue")).toBeTruthy();
    expect(screen.getByText("KYC & Payout")).toBeTruthy();
    expect(screen.getByText("Pickup & Documents")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Approve$/i }));

    expect(mutate).toHaveBeenCalledWith({ id: "app_1", decision: "APPROVED" });
  });

  it("requires a rejection reason before rejecting", async () => {
    render(<AdminSellerApplicationsTable />);

    fireEvent.click(screen.getByRole("button", { name: /^Reject$/i }));

    const reason = await screen.findByPlaceholderText("Explain what must be corrected before resubmission.");
    const rejectButtons = screen.getAllByRole("button", { name: /^Reject$/i });
    const dialogRejectButton = rejectButtons[rejectButtons.length - 1];

    expect(dialogRejectButton).toHaveProperty("disabled", true);

    fireEvent.change(reason, { target: { value: "Upload a clearer bank book image." } });
    await waitFor(() => {
      expect(dialogRejectButton).toHaveProperty("disabled", false);
    });

    fireEvent.click(dialogRejectButton);

    expect(mutate).toHaveBeenCalledWith(
      { id: "app_1", decision: "REJECTED", rejectionReason: "Upload a clearer bank book image." },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("approves and rejects an individual document", async () => {
    render(<AdminSellerApplicationsTable />);

    fireEvent.click(screen.getByRole("button", { name: /approve document/i }));
    expect(mutateDocument).toHaveBeenCalledWith({
      applicationId: "app_1",
      documentId: "doc_1",
      decision: "APPROVED",
    });

    fireEvent.click(screen.getByRole("button", { name: /reject document/i }));
    const reason = await screen.findByPlaceholderText("Explain what must be corrected on this document.");
    const rejectButtons = screen.getAllByRole("button", { name: /reject document/i });
    const dialogRejectButton = rejectButtons[rejectButtons.length - 1];

    expect(dialogRejectButton).toHaveProperty("disabled", true);
    fireEvent.change(reason, { target: { value: "Image is blurry" } });

    await waitFor(() => {
      expect(dialogRejectButton).toHaveProperty("disabled", false);
    });

    fireEvent.click(dialogRejectButton);

    expect(mutateDocument).toHaveBeenCalledWith(
      {
        applicationId: "app_1",
        documentId: "doc_1",
        decision: "REJECTED",
        rejectionReason: "Image is blurry",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows unresolved required document types when approval is blocked", () => {
    reviewState.error = {
      value: {
        error: {
          code: "SELLER_DOCUMENTS_NOT_APPROVED",
          message: "Required KYC documents are not approved",
          details: {
            unresolved: [{ documentType: "BANK_BOOK" }],
          },
        },
      },
    };

    render(<AdminSellerApplicationsTable />);

    expect(screen.getByText("Required documents still need approval:")).toBeTruthy();
    expect(screen.getByText("Bank book")).toBeTruthy();
  });
});
