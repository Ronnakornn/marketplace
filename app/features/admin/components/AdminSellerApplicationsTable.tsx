"use client";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";
import {
  type AdminSellerApplication,
  useAdminSellerApplicationsList,
  useReviewSellerApplication,
} from "../hooks/useAdminOperations";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as { value?: { error?: { message?: string } }; error?: { message?: string }; message?: string };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? "Operation failed.";
  }
  return "Operation failed.";
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
  ].some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function DetailLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value || "-"}</span>
    </p>
  );
}

export function AdminSellerApplicationsTable() {
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdminSellerApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const query = useAdminSellerApplicationsList("SUBMITTED");
  const review = useReviewSellerApplication();
  const rows = useMemo(() => (query.data ?? []).filter((application) => textMatch(application, search)), [query.data, search]);
  const rejectionReasonError = rejectTarget && rejectionReason.trim().length === 0;

  function closeRejectDialog() {
    setRejectTarget(null);
    setRejectionReason("");
  }

  return (
    <AdminDataShell
      title="Seller Application Queue"
      description="Review submitted seller KYC, pickup, and payout details before activating shops."
      icon={ClipboardCheckIcon}
      search={search}
      searchPlaceholder="Search applications"
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={null}
    >
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">Applicant</TableHead>
              <TableHead className="text-slate-300">Shop Profile</TableHead>
              <TableHead className="text-slate-300">KYC & Payout</TableHead>
              <TableHead className="text-slate-300">Pickup & Documents</TableHead>
              <TableHead className="text-right text-slate-300">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((application) => (
              <TableRow key={application.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4 align-top">
                  <p className="font-medium text-white">{application.user.name}</p>
                  <p className="text-xs text-slate-500">{application.user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AdminStatusBadge status={application.status} />
                    <AdminStatusBadge status={application.user.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(application.submittedAt)}</p>
                </TableCell>
                <TableCell className="align-top">
                  <p className="text-sm font-medium text-slate-100">{application.shopName}</p>
                  <p className="text-xs text-slate-500">{application.shopSlug}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <DetailLine label="Business" value={application.businessType} />
                    <DetailLine label="Legal" value={application.legalName} />
                    <DetailLine label="Email" value={application.shopContactEmail} />
                    <DetailLine label="Phone" value={application.shopContactPhone} />
                  </div>
                </TableCell>
                <TableCell className="align-top text-xs">
                  <div className="space-y-1">
                    <DetailLine label="National ID" value={application.nationalIdMasked} />
                    <DetailLine label="Company" value={application.companyRegistrationMasked} />
                    <DetailLine label="Tax" value={application.taxIdMasked} />
                    <DetailLine label="Bank account" value={application.bankAccountNumberMasked} />
                  </div>
                  <div className="mt-3 rounded-md border border-white/10 bg-slate-950/50 p-3">
                    <p className="flex items-center gap-2 font-medium text-slate-200">
                      <LandmarkIcon className="size-3.5 text-cyan-300" />
                      {application.bankName}
                    </p>
                    <p className="mt-1 text-slate-400">{application.bankAccountName}</p>
                  </div>
                </TableCell>
                <TableCell className="max-w-md align-top text-xs">
                  <div className="rounded-md border border-white/10 bg-slate-950/50 p-3">
                    <p className="flex items-center gap-2 font-medium text-slate-200">
                      <MapPinIcon className="size-3.5 text-cyan-300" />
                      {application.pickupAddress.name}
                    </p>
                    <p className="mt-1 text-slate-400">
                      {[application.pickupAddress.line1, application.pickupAddress.line2, application.pickupAddress.city, application.pickupAddress.region, application.pickupAddress.postalCode, application.pickupAddress.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {application.documents.length ? application.documents.map((document) => (
                      <div key={document.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="flex items-center gap-2 font-medium text-slate-200">
                          <FileTextIcon className="size-3.5 text-cyan-300" />
                          {document.documentType} / {document.side}
                        </p>
                        <p className="mt-1 truncate text-slate-500">{document.fileName} / {document.contentType} / {formatFileSize(document.fileSize)}</p>
                        <p className="text-slate-500">Upload {document.uploadId} / {document.status} / {formatDate(document.completedAt)}</p>
                      </div>
                    )) : <p className="text-slate-500">No documents attached.</p>}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={review.isPending}
                      className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      onClick={() => review.mutate({ id: application.id, decision: "APPROVED" })}
                    >
                      <CheckIcon className="size-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={review.isPending}
                      variant="outline"
                      className="border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                      onClick={() => setRejectTarget(application)}
                    >
                      <XIcon className="size-4" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  No submitted seller applications match the current search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {review.isSuccess ? <p className="px-5 py-3 text-sm text-emerald-300">Seller application review saved.</p> : null}
        {review.error ? <p className="px-5 py-3 text-sm text-red-300">{readErrorMessage(review.error)}</p> : null}
      </CardContent>
      <AlertDialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) closeRejectDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject seller application</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for {rejectTarget?.shopName}. The seller will see this message on their status page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Explain what must be corrected before resubmission."
              className="min-h-28"
            />
            {rejectionReasonError ? <p className="text-sm font-medium text-red-600">Rejection reason is required.</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={!rejectTarget || rejectionReason.trim().length === 0 || review.isPending}
                onClick={() => {
                  if (!rejectTarget) return;
                  review.mutate(
                    { id: rejectTarget.id, decision: "REJECTED", rejectionReason: rejectionReason.trim() },
                    { onSuccess: closeRejectDialog },
                  );
                }}
              >
                Reject
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDataShell>
  );
}
