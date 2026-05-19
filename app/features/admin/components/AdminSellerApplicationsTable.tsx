"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ClipboardCheckIcon, XIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";

type SellerApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

interface AdminSellerApplication {
  id: string;
  status: SellerApplicationStatus;
  businessType: string | null;
  shopName: string | null;
  shopSlug: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  nationalIdLast4?: string | null;
  nationalIdMasked?: string | null;
  companyRegistrationLast4?: string | null;
  companyRegistrationMasked?: string | null;
  taxIdLast4?: string | null;
  taxIdMasked?: string | null;
  bankAccountNumberLast4?: string | null;
  bankAccountNumberMasked?: string | null;
  user: { id: string; name: string; email: string };
  documents: Array<{ id: string; documentType: string; uploadId: string; fileName: string; contentType: string; fileSize: number; completedAt?: string | null }>;
  submittedAt?: string | null;
  rejectionReason?: string | null;
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? "Request failed");
  }
  return payload as T;
}

export function AdminSellerApplicationsTable() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "seller-applications"],
    queryFn: () => adminRequest<AdminSellerApplication[]>("/api/admin/seller-applications?status=SUBMITTED"),
  });
  const review = useMutation({
    mutationFn: ({ id, decision, rejectionReason }: { id: string; decision: "APPROVED" | "REJECTED"; rejectionReason?: string }) =>
      adminRequest(`/api/admin/seller-applications/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, rejectionReason }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <AdminDataShell
      title="Seller Applications"
      description="Review KYC summaries and approve shops before seller tools unlock."
      icon={ClipboardCheckIcon}
      search=""
      searchPlaceholder="Search applications"
      onSearchChange={() => undefined}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">Applicant</TableHead>
              <TableHead className="text-slate-300">Shop</TableHead>
              <TableHead className="text-slate-300">KYC</TableHead>
              <TableHead className="text-slate-300">Documents</TableHead>
              <TableHead className="text-right text-slate-300">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data ?? []).length ? (query.data ?? []).map((application) => (
              <TableRow key={application.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4">
                  <p className="font-medium text-white">{application.user.name}</p>
                  <p className="text-xs text-slate-500">{application.user.email}</p>
                  <div className="mt-2"><AdminStatusBadge status={application.status} /></div>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-slate-100">{application.shopName}</p>
                  <p className="text-xs text-slate-500">{application.shopSlug}</p>
                  <p className="mt-1 text-xs text-slate-400">{application.businessType} / {application.legalName}</p>
                </TableCell>
                <TableCell className="text-xs text-slate-300">
                  <p>ID: {application.nationalIdMasked ?? "-"}</p>
                  <p>Company: {application.companyRegistrationMasked ?? "-"}</p>
                  <p>Tax: {application.taxIdMasked ?? "-"}</p>
                  <p>Bank: {application.bankAccountNumberMasked ?? "-"}</p>
                </TableCell>
                <TableCell className="text-xs text-slate-300">
                  {application.documents.map((document) => (
                    <p key={document.id}>{document.documentType}: {document.fileName}</p>
                  ))}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" disabled={review.isPending} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => review.mutate({ id: application.id, decision: "APPROVED" })}>
                      <CheckIcon className="size-4" />
                      Approve
                    </Button>
                    <Button type="button" size="sm" disabled={review.isPending} variant="outline" className="border-red-400/30 bg-red-500/10 text-red-200" onClick={() => {
                      const reason = window.prompt("Rejection reason")?.trim();
                      if (reason) review.mutate({ id: application.id, decision: "REJECTED", rejectionReason: reason });
                    }}>
                      <XIcon className="size-4" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-slate-400">No submitted seller applications.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {review.error ? <p className="px-5 py-3 text-sm text-red-300">{review.error.message}</p> : null}
      </CardContent>
    </AdminDataShell>
  );
}
