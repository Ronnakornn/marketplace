"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "./AdminTable";

import { useMemo, useState } from "react";
import { CheckIcon, ClipboardCheckIcon, FileTextIcon, LandmarkIcon, MapPinIcon, XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Textarea } from "#/components/ui/textarea";

import { useFormatters, useTranslations } from "#/i18n/client";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";
import {
  type AdminSellerApplication,
  useAdminSellerApplicationsList,
  useReviewSellerApplication,
  useReviewSellerApplicationDocument,
} from "../hooks/useAdminOperations";

interface ParsedApiError {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface DocumentRejectTarget {
  applicationId: string;
  shopName: string;
  documentId: string;
  documentType: string;
  documentSide: string | null | undefined;
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readApiError(error: unknown): ParsedApiError | null {
  if (error && typeof error === "object") {
    const record = error as {
      value?: { error?: ParsedApiError };
      error?: ParsedApiError;
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    };

    if (record.value?.error) return record.value.error;
    if (record.error) return record.error;
    if (record.code || record.message || record.details) {
      return {
        code: record.code,
        message: record.message,
        details: record.details,
      };
    }
  }
  if (error instanceof Error) return { message: error.message };
  return null;
}

function readErrorMessage(error: unknown, fallback: string) {
  return readApiError(error)?.message ?? fallback;
}

function readUnresolvedDocumentTypes(error: unknown): string[] {
  const payload = readApiError(error);
  if (!payload || payload.code !== "SELLER_DOCUMENTS_NOT_APPROVED") return [];

  const unresolved = (payload.details as { unresolved?: Array<{ documentType?: unknown }> } | undefined)
    ?.unresolved;
  if (!Array.isArray(unresolved)) return [];

  return unresolved
    .map((item) => item?.documentType)
    .filter((value): value is string => typeof value === "string");
}

function textMatch(application: AdminSellerApplication, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    application.user.name,
    application.user.email,
    application.shopName,
    application.shopSlug,
    application.legalName,
    application.businessType,
    application.bankName,
  ].some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(needle),
  );
}

function DetailLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value || "-"}</span>
    </p>
  );
}

export function AdminSellerApplicationsTable() {
  const t = useTranslations();
  const formatters = useFormatters();
  const formatDate = (value: string | Date | null | undefined) =>
    value ? formatters.date(value) : t("admin.sellerApplications.notSet");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdminSellerApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectDocumentTarget, setRejectDocumentTarget] = useState<DocumentRejectTarget | null>(null);
  const [documentRejectionReason, setDocumentRejectionReason] = useState("");
  const query = useAdminSellerApplicationsList("SUBMITTED");
  const review = useReviewSellerApplication();
  const reviewDocument = useReviewSellerApplicationDocument();
  const rows = useMemo(
    () => (query.data ?? []).filter((application) => textMatch(application, search)),
    [query.data, search],
  );
  const rejectionReasonError = rejectTarget && rejectionReason.trim().length === 0;
  const documentRejectionReasonError = rejectDocumentTarget && documentRejectionReason.trim().length === 0;
  const unresolvedRequiredDocuments = useMemo(
    () => readUnresolvedDocumentTypes(review.error),
    [review.error],
  );
  const isMutating = review.isPending || reviewDocument.isPending;

  function closeRejectDialog() {
    setRejectTarget(null);
    setRejectionReason("");
  }

  function closeRejectDocumentDialog() {
    setRejectDocumentTarget(null);
    setDocumentRejectionReason("");
  }

  function documentTypeLabel(documentType: string) {
    if (documentType === "ID_CARD") return t("seller.kyc.documentType.idCard");
    if (documentType === "BUSINESS_CERTIFICATE") return t("seller.kyc.documentType.businessCertificate");
    if (documentType === "BANK_BOOK") return t("seller.kyc.documentType.bankBook");
    if (documentType === "TAX_DOCUMENT") return t("seller.kyc.documentType.taxDocument");
    return documentType;
  }

  function documentReviewStatusLabel(status: string | null | undefined) {
    if (status === "APPROVED") return t("seller.kyc.reviewStatus.approved");
    if (status === "REJECTED") return t("seller.kyc.reviewStatus.rejected");
    return t("seller.kyc.reviewStatus.pending");
  }

  const columns: ColumnDef<AdminSellerApplication>[] = [
    {
      id: "applicant",
      header: t("admin.ui.applicant"),
      accessorFn: (item) => item.user.name,
      enableSorting: true,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="align-top">
            <p className="font-medium text-foreground">{application.user.name}</p>
            <p className="text-xs text-muted-foreground">{application.user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AdminStatusBadge status={application.status} />
              <AdminStatusBadge status={application.user.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("admin.sellerApplications.submitted")} {formatDate(application.submittedAt)}
            </p>
          </div>
        );
      },
    },
    {
      id: "shopProfile",
      header: t("admin.ui.shopProfile"),
      accessorFn: (item) => item.shopName,
      enableSorting: true,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="align-top">
            <p className="text-sm font-medium text-foreground">{application.shopName}</p>
            <p className="text-xs text-muted-foreground">{application.shopSlug}</p>
            <div className="mt-2 space-y-1 text-xs">
              <DetailLine label={t("admin.sellerApplications.business")} value={application.businessType} />
              <DetailLine label={t("admin.sellerApplications.legalName")} value={application.legalName} />
              <DetailLine label={t("admin.sellerApplications.email")} value={application.shopContactEmail} />
              <DetailLine label={t("admin.sellerApplications.phone")} value={application.shopContactPhone} />
            </div>
          </div>
        );
      },
    },
    {
      id: "kycPayout",
      header: t("admin.ui.kycPayout"),
      enableSorting: false,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="align-top text-xs">
            <div className="space-y-1">
              <DetailLine
                label={t("admin.sellerApplications.nationalId")}
                value={application.nationalIdMasked}
              />
              <DetailLine
                label={t("admin.sellerApplications.company")}
                value={application.companyRegistrationMasked}
              />
              <DetailLine label={t("admin.sellerApplications.taxId")} value={application.taxIdMasked} />
              <DetailLine
                label={t("admin.sellerApplications.bankAccount")}
                value={application.bankAccountNumberMasked}
              />
            </div>
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <LandmarkIcon className="size-3.5 text-cyan-300" />
                {application.bankName}
              </p>
              <p className="mt-1 text-muted-foreground">{application.bankAccountName}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "pickupDocuments",
      header: t("admin.ui.pickupDocuments"),
      enableSorting: false,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="max-w-md align-top text-xs">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MapPinIcon className="size-3.5 text-cyan-300" />
                {application.pickupAddress.name}
              </p>
              <p className="mt-1 text-muted-foreground">
                {[
                  application.pickupAddress.line1,
                  application.pickupAddress.line2,
                  application.pickupAddress.city,
                  application.pickupAddress.region,
                  application.pickupAddress.postalCode,
                  application.pickupAddress.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {application.documents.length ? (
                application.documents.map((document) => (
                  <div key={document.id} className="rounded-md border border-border bg-background p-2">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <FileTextIcon className="size-3.5 text-cyan-300" />
                      {documentTypeLabel(document.documentType)} / {document.side}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <AdminStatusBadge status={document.reviewStatus ?? "PENDING"} />
                      <p className="text-muted-foreground">
                        {t("seller.kyc.reviewLabel")} {documentReviewStatusLabel(document.reviewStatus)}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground">
                      {document.fileName} / {document.contentType} / {formatFileSize(document.fileSize)}
                    </p>
                    <p className="text-muted-foreground">
                      {t("admin.sellerApplications.upload")} {document.uploadId} / {document.status} /{" "}
                      {formatDate(document.completedAt)}
                    </p>
                    {document.reviewStatus === "REJECTED" && document.rejectionReason ? (
                      <p className="mt-1 rounded border border-red-400/30 bg-red-500/10 px-2 py-1 text-destructive">
                        {t("seller.kyc.rejectionReason")} {document.rejectionReason}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button
                        asChild
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-cyan-300/40 text-primary hover:bg-cyan-300/10"
                      >
                        <a
                          href={`/api/uploads/${document.uploadId}/content`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <FileTextIcon className="size-4" />
                          {t("admin.sellerApplications.viewDocument")}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isMutating}
                        className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                        onClick={() =>
                          reviewDocument.mutate({
                            applicationId: application.id,
                            documentId: document.id,
                            decision: "APPROVED",
                          })
                        }
                      >
                        <CheckIcon className="size-4" />
                        {t("admin.sellerApplications.approveDocument")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isMutating}
                        className="border-red-400/30 bg-red-500/10 text-destructive hover:bg-red-500/20 hover:text-destructive"
                        onClick={() => {
                          setRejectDocumentTarget({
                            applicationId: application.id,
                            shopName: application.shopName,
                            documentId: document.id,
                            documentType: document.documentType,
                            documentSide: document.side,
                          });
                        }}
                      >
                        <XIcon className="size-4" />
                        {t("admin.sellerApplications.rejectDocument")}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">{t("admin.ui.noDocuments")}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "review",
      header: t("admin.ui.review"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="align-top">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isMutating}
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => review.mutate({ id: application.id, decision: "APPROVED" })}
              >
                <CheckIcon className="size-4" />
                {t("admin.ui.approve")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isMutating}
                variant="outline"
                className="border-red-400/30 bg-red-500/10 text-destructive hover:bg-red-500/20 hover:text-destructive"
                onClick={() => setRejectTarget(application)}
              >
                <XIcon className="size-4" />
                {t("admin.ui.reject")}
              </Button>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.sellerApplications.title")}
      description={t("admin.sellerApplications.description")}
      icon={ClipboardCheckIcon}
      search={search}
      searchPlaceholder={t("admin.search.applications")}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={null}
    >
      <CardContent className="p-0">
        <AdminTable
          columns={columns}
          data={rows}
          isLoading={query.isLoading}
          emptyMessage={t("admin.ui.noRecords")}
          getRowId={(item) => item.id}
        />
        {review.isSuccess ? (
          <p className="px-5 py-3 text-sm text-emerald-300">
            {t("admin.sellerApplications.applicationReviewSaved")}
          </p>
        ) : null}
        {reviewDocument.isSuccess ? (
          <p className="px-5 py-3 text-sm text-emerald-300">
            {t("admin.sellerApplications.documentReviewSaved")}
          </p>
        ) : null}
        {review.error ? (
          <p className="px-5 py-3 text-sm text-destructive">
            {readErrorMessage(review.error, t("admin.sellerApplications.operationFailed"))}
          </p>
        ) : null}
        {reviewDocument.error ? (
          <p className="px-5 py-3 text-sm text-destructive">
            {readErrorMessage(reviewDocument.error, t("admin.sellerApplications.operationFailed"))}
          </p>
        ) : null}
        {unresolvedRequiredDocuments.length ? (
          <div className="mx-5 mb-4 rounded border border-amber-300/40 bg-amber-100/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-semibold">{t("admin.sellerApplications.unresolvedRequiredDocuments")}</p>
            <ul className="mt-1 list-disc pl-5">
              {Array.from(new Set(unresolvedRequiredDocuments)).map((documentType) => (
                <li key={documentType}>{documentTypeLabel(documentType)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
      <AlertDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.sellerApplications.rejectApplicationTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.sellerApplications.rejectApplicationDescription").replace(
                "{shop}",
                rejectTarget?.shopName ?? "-",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder={t("admin.sellerApplications.rejectApplicationPlaceholder")}
              className="min-h-28"
            />
            {rejectionReasonError ? (
              <p className="text-sm font-medium text-red-600">
                {t("admin.sellerApplications.rejectionReasonRequired")}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.ui.cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={!rejectTarget || rejectionReason.trim().length === 0 || isMutating}
                onClick={() => {
                  if (!rejectTarget) return;
                  review.mutate(
                    { id: rejectTarget.id, decision: "REJECTED", rejectionReason: rejectionReason.trim() },
                    { onSuccess: closeRejectDialog },
                  );
                }}
              >
                {t("admin.ui.reject")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(rejectDocumentTarget)}
        onOpenChange={(open) => {
          if (!open) closeRejectDocumentDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.sellerApplications.rejectDocumentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.sellerApplications.rejectDocumentDescription")} {rejectDocumentTarget?.shopName} (
              {rejectDocumentTarget ? documentTypeLabel(rejectDocumentTarget.documentType) : "-"} /{" "}
              {rejectDocumentTarget?.documentSide}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Textarea
              value={documentRejectionReason}
              onChange={(event) => setDocumentRejectionReason(event.target.value)}
              placeholder={t("admin.sellerApplications.rejectDocumentPlaceholder")}
              className="min-h-28"
            />
            {documentRejectionReasonError ? (
              <p className="text-sm font-medium text-red-600">
                {t("admin.sellerApplications.rejectionReasonRequired")}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={!rejectDocumentTarget || documentRejectionReason.trim().length === 0 || isMutating}
                onClick={() => {
                  if (!rejectDocumentTarget) return;
                  reviewDocument.mutate(
                    {
                      applicationId: rejectDocumentTarget.applicationId,
                      documentId: rejectDocumentTarget.documentId,
                      decision: "REJECTED",
                      rejectionReason: documentRejectionReason.trim(),
                    },
                    { onSuccess: closeRejectDocumentDialog },
                  );
                }}
              >
                {t("admin.sellerApplications.rejectDocument")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDataShell>
  );
}
