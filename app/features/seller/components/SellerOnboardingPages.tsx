"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, FileTextIcon, Loader2Icon, StoreIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocalePath } from "#/i18n/navigation";
import { SellerPageHeader } from "./SellerShell";

type ApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
type BusinessType = "INDIVIDUAL" | "COMPANY";
type DocumentType = "ID_CARD" | "BUSINESS_CERTIFICATE" | "BANK_BOOK" | "TAX_DOCUMENT";

interface SellerApplicationResponse {
  application: {
    id: string;
    status: ApplicationStatus;
    rejectionReason?: string | null;
    shopName?: string | null;
    shopSlug?: string | null;
    legalName?: string | null;
    businessType?: BusinessType | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    bankName?: string | null;
    bankAccountName?: string | null;
    pickupAddress?: {
      name?: string | null;
      line1?: string | null;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    documents?: Array<{ documentType: DocumentType; uploadId: string }>;
  } | null;
  shop: { id: string; name: string; slug: string; status: string } | null;
}

interface OnboardingFormState {
  businessType: BusinessType;
  shopName: string;
  shopSlug: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  nationalId: string;
  companyRegistration: string;
  taxId: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  pickupName: string;
  pickupPhone: string;
  pickupLine1: string;
  pickupLine2: string;
  pickupCity: string;
  pickupRegion: string;
  pickupPostalCode: string;
  pickupCountry: string;
  idCardUploadId: string;
  bankBookUploadId: string;
  businessCertificateUploadId: string;
  taxDocumentUploadId: string;
}

const emptyForm: OnboardingFormState = {
  businessType: "INDIVIDUAL",
  shopName: "",
  shopSlug: "",
  legalName: "",
  contactEmail: "",
  contactPhone: "",
  nationalId: "",
  companyRegistration: "",
  taxId: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  pickupName: "",
  pickupPhone: "",
  pickupLine1: "",
  pickupLine2: "",
  pickupCity: "",
  pickupRegion: "",
  pickupPostalCode: "",
  pickupCountry: "TH",
  idCardUploadId: "",
  bankBookUploadId: "",
  businessCertificateUploadId: "",
  taxDocumentUploadId: "",
};

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload?.error?.details;
    const detailText = details?.missing && Array.isArray(details.missing)
      ? ` Missing: ${details.missing.join(", ")}.`
      : "";
    const message = `${payload?.error?.message ?? payload?.message ?? "Request failed"}${detailText}`;
    throw new Error(message);
  }
  return payload as T;
}

function useSellerApplication() {
  return useQuery({
    queryKey: ["seller", "application"],
    queryFn: () => apiRequest<SellerApplicationResponse>("/api/seller/application"),
  });
}

function toInitialForm(data?: SellerApplicationResponse): OnboardingFormState {
  const application = data?.application;
  const documents = new Map(application?.documents?.map((document) => [document.documentType, document.uploadId]));
  return {
    ...emptyForm,
    businessType: application?.businessType ?? "INDIVIDUAL",
    shopName: application?.shopName ?? "",
    shopSlug: application?.shopSlug ?? "",
    legalName: application?.legalName ?? "",
    contactEmail: application?.contactEmail ?? "",
    contactPhone: application?.contactPhone ?? "",
    bankName: application?.bankName ?? "",
    bankAccountName: application?.bankAccountName ?? "",
    pickupName: application?.pickupAddress?.name ?? "",
    pickupLine1: application?.pickupAddress?.line1 ?? "",
    pickupCity: application?.pickupAddress?.city ?? "",
    pickupPostalCode: application?.pickupAddress?.postalCode ?? "",
    pickupCountry: application?.pickupAddress?.country ?? "TH",
    idCardUploadId: documents.get("ID_CARD") ?? "",
    bankBookUploadId: documents.get("BANK_BOOK") ?? "",
    businessCertificateUploadId: documents.get("BUSINESS_CERTIFICATE") ?? "",
    taxDocumentUploadId: documents.get("TAX_DOCUMENT") ?? "",
  };
}

function toPayload(form: OnboardingFormState) {
  const documents: Array<{ uploadId: string; documentType: DocumentType }> = [];
  if (form.idCardUploadId) documents.push({ uploadId: form.idCardUploadId, documentType: "ID_CARD" });
  if (form.bankBookUploadId) documents.push({ uploadId: form.bankBookUploadId, documentType: "BANK_BOOK" });
  if (form.businessCertificateUploadId) documents.push({ uploadId: form.businessCertificateUploadId, documentType: "BUSINESS_CERTIFICATE" });
  if (form.taxDocumentUploadId) documents.push({ uploadId: form.taxDocumentUploadId, documentType: "TAX_DOCUMENT" });

  return {
    businessType: form.businessType,
    shopName: form.shopName,
    shopSlug: form.shopSlug,
    shopContactEmail: form.contactEmail,
    shopContactPhone: form.contactPhone,
    legalName: form.legalName,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    nationalId: form.nationalId || null,
    companyRegistration: form.companyRegistration || null,
    taxId: form.taxId || null,
    bankName: form.bankName,
    bankAccountName: form.bankAccountName,
    bankAccountNumber: form.bankAccountNumber,
    pickupName: form.pickupName,
    pickupPhone: form.pickupPhone || null,
    pickupLine1: form.pickupLine1,
    pickupLine2: form.pickupLine2 || null,
    pickupCity: form.pickupCity,
    pickupRegion: form.pickupRegion || null,
    pickupPostalCode: form.pickupPostalCode,
    pickupCountry: form.pickupCountry,
    documents,
  };
}

export function SellerRegisterPage() {
  const router = useRouter();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const applicationQuery = useSellerApplication();
  const [form, setForm] = useState<OnboardingFormState>(() => toInitialForm(applicationQuery.data));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (applicationQuery.data) setForm(toInitialForm(applicationQuery.data));
  }, [applicationQuery.data]);

  const draftMutation = useMutation({
    mutationFn: () => apiRequest("/api/seller/application/draft", {
      method: "POST",
      body: JSON.stringify(toPayload(form)),
    }),
    onSuccess: async () => {
      setMessage("Draft saved");
      await queryClient.invalidateQueries({ queryKey: ["seller", "application"] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("/api/seller/application/submit", {
      method: "POST",
      body: JSON.stringify(toPayload(form)),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller", "application"] });
      router.push(localePath("/seller/status"));
    },
  });

  function update<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const error = draftMutation.error ?? submitMutation.error;
  const isLocked = applicationQuery.data?.application?.status === "SUBMITTED";
  const isSaving = draftMutation.isPending || submitMutation.isPending;

  return (
    <>
      <SellerPageHeader title="Start Selling" description="Register your shop, submit Thailand KYC, and wait for admin approval before seller tools unlock." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          {isLocked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              This application is already submitted. You can edit it only if admin rejects it.
            </p>
          ) : null}
          <Section title="Shop profile">
            <label className={labelClass}>Business type</label>
            <select value={form.businessType} onChange={(event) => update("businessType", event.target.value as BusinessType)} className={inputClass}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMPANY">Company</option>
            </select>
            <TextField label="Shop name" value={form.shopName} onChange={(value) => update("shopName", value)} />
            <TextField label="Shop slug" value={form.shopSlug} onChange={(value) => update("shopSlug", value)} />
            <TextField label="Legal name" value={form.legalName} onChange={(value) => update("legalName", value)} />
            <TextField label="Contact email" value={form.contactEmail} onChange={(value) => update("contactEmail", value)} />
            <TextField label="Contact phone" value={form.contactPhone} onChange={(value) => update("contactPhone", value)} />
          </Section>
          <Section title="KYC">
            <TextField label="Thai ID" value={form.nationalId} onChange={(value) => update("nationalId", value)} />
            <TextField label="Company registration" value={form.companyRegistration} onChange={(value) => update("companyRegistration", value)} />
            <TextField label="Tax ID" value={form.taxId} onChange={(value) => update("taxId", value)} />
          </Section>
          <Section title="Pickup address">
            <TextField label="Pickup name" value={form.pickupName} onChange={(value) => update("pickupName", value)} />
            <TextField label="Pickup phone" value={form.pickupPhone} onChange={(value) => update("pickupPhone", value)} />
            <TextField label="Address line 1" value={form.pickupLine1} onChange={(value) => update("pickupLine1", value)} />
            <TextField label="Address line 2" value={form.pickupLine2} onChange={(value) => update("pickupLine2", value)} />
            <TextField label="City" value={form.pickupCity} onChange={(value) => update("pickupCity", value)} />
            <TextField label="Region" value={form.pickupRegion} onChange={(value) => update("pickupRegion", value)} />
            <TextField label="Postal code" value={form.pickupPostalCode} onChange={(value) => update("pickupPostalCode", value)} />
            <TextField label="Country" value={form.pickupCountry} onChange={(value) => update("pickupCountry", value)} />
          </Section>
          <Section title="Bank and payout">
            <TextField label="Bank name" value={form.bankName} onChange={(value) => update("bankName", value)} />
            <TextField label="Account name" value={form.bankAccountName} onChange={(value) => update("bankAccountName", value)} />
            <TextField label="Account number" value={form.bankAccountNumber} onChange={(value) => update("bankAccountNumber", value)} />
          </Section>
          <Section title="Documents">
            <DocumentUpload label="ID card" value={form.idCardUploadId} onChange={(value) => update("idCardUploadId", value)} />
            <DocumentUpload label="Bank book" value={form.bankBookUploadId} onChange={(value) => update("bankBookUploadId", value)} />
            <DocumentUpload label="Business certificate" value={form.businessCertificateUploadId} onChange={(value) => update("businessCertificateUploadId", value)} />
            <DocumentUpload label="Tax document" value={form.taxDocumentUploadId} onChange={(value) => update("taxDocumentUploadId", value)} />
          </Section>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error.message}</p> : null}
          {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={isLocked || isSaving} onClick={() => draftMutation.mutate()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              {draftMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save draft
            </button>
            <button type="button" disabled={isLocked || isSaving} onClick={() => submitMutation.mutate()} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {submitMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Submit for review
            </button>
          </div>
        </form>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Approval checklist</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2"><StoreIcon className="mt-0.5 size-4 text-emerald-600" /> Shop profile and pickup address</li>
            <li className="flex gap-2"><FileTextIcon className="mt-0.5 size-4 text-emerald-600" /> ID card and bank book uploads</li>
            <li className="flex gap-2"><CheckCircleIcon className="mt-0.5 size-4 text-emerald-600" /> Admin approval before seller tools unlock</li>
          </ul>
        </aside>
      </div>
    </>
  );
}

export function SellerStatusPage() {
  const localePath = useLocalePath();
  const applicationQuery = useSellerApplication();
  const application = applicationQuery.data?.application;
  const shop = applicationQuery.data?.shop;

  return (
    <>
      <SellerPageHeader title="Seller Application Status" description="Track review progress and update rejected applications before resubmitting." />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {applicationQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2Icon className="size-4 animate-spin" /> Loading application</div>
        ) : application ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={application.status} />
              {shop ? <span className="text-sm text-slate-500">{shop.name} / {shop.status}</span> : null}
            </div>
            {application.status === "REJECTED" ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Rejected</p>
                <p className="mt-1">{application.rejectionReason ?? "Please update your application and submit again."}</p>
                <Link href={localePath("/seller/register")} className="mt-3 inline-flex rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white no-underline">Edit application</Link>
              </div>
            ) : null}
            {application.status === "SUBMITTED" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Your application is waiting for admin review. Seller operations will unlock after approval.
              </p>
            ) : null}
            {application.status === "DRAFT" ? (
              <Link href={localePath("/seller/register")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Complete application</Link>
            ) : null}
            {application.status === "CANCELLED" ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Cancelled</p>
                <p className="mt-1">This application was cancelled. Start a new draft to continue seller onboarding.</p>
                <Link href={localePath("/seller/register")} className="mt-3 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Start again</Link>
              </div>
            ) : null}
          </div>
        ) : (
          <Link href={localePath("/seller/register")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Start seller registration</Link>
        )}
      </section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-0 p-0 md:grid-cols-2">
      <legend className="mb-3 text-base font-semibold text-slate-950 md:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  );
}

function DocumentUpload({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const presigned = await apiRequest<{ fileId: string; uploadUrl: string }>("/api/uploads/presigned-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          usage: "kyc_document",
        }),
      });
      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("File upload failed");
      await apiRequest("/api/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ fileId: presigned.fileId }),
      });
      onChange(presigned.fileId);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => void handleFile(event.target.files?.[0])} className={inputClass} />
      {uploading ? <span className="text-xs text-slate-500">Uploading...</span> : null}
      {value ? <span className="text-xs font-medium text-emerald-700">Upload ID: {value}</span> : null}
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const rejected = status === "REJECTED";
  const approved = status === "APPROVED";
  const cancelled = status === "CANCELLED";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-700" : rejected ? "bg-red-50 text-red-700" : cancelled ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>
      {rejected ? <XCircleIcon className="size-3.5" /> : <CheckCircleIcon className="size-3.5" />}
      {status}
    </span>
  );
}
