"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, FileTextIcon, Loader2Icon, StoreIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { SellerPageHeader } from "./SellerShell";

type ApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
type BusinessType = "INDIVIDUAL" | "COMPANY";
type DocumentType = "ID_CARD" | "BUSINESS_CERTIFICATE" | "BANK_BOOK" | "TAX_DOCUMENT";
type DocumentReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RegisterStep = "account" | "shop" | "kyc" | "terms";

interface RegisterStepConfig {
  slug: RegisterStep;
  title: string;
  description: string;
}

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
    nationalIdLast4?: string | null;
    nationalIdMasked?: string | null;
    companyRegistrationLast4?: string | null;
    companyRegistrationMasked?: string | null;
    taxIdLast4?: string | null;
    taxIdMasked?: string | null;
    bankName?: string | null;
    bankAccountName?: string | null;
    pickupAddress?: {
      name?: string | null;
      phone?: string | null;
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    documents?: Array<{
      id: string;
      documentType: DocumentType;
      uploadId: string;
      reviewStatus?: DocumentReviewStatus;
      rejectionReason?: string | null;
    }>;
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
  companyRegisteredAddress: string;
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
  businessCertificateUploadId: string;
  taxDocumentUploadId: string;
  bankBookUploadId: string;
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
  companyRegisteredAddress: "",
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
  businessCertificateUploadId: "",
  taxDocumentUploadId: "",
  bankBookUploadId: "",
};

const registerSteps: RegisterStepConfig[] = [
  { slug: "account", title: "สร้างบัญชีผู้ขาย", description: "ข้อมูลติดต่อผู้สมัคร" },
  { slug: "shop", title: "ข้อมูลร้านและประเภทผู้ขาย", description: "ชื่อร้านและประเภทบุคคล" },
  { slug: "kyc", title: "KYC", description: "กรอกและอัปโหลดเอกสารยืนยันตัวตน" },
  { slug: "terms", title: "ยืนยันข้อมูล", description: "ตรวจสอบข้อมูลและส่งคำขอ" },
];

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const requiredDocumentsByBusinessType: Record<BusinessType, DocumentType[]> = {
  INDIVIDUAL: ["ID_CARD", "TAX_DOCUMENT"],
  COMPANY: ["BUSINESS_CERTIFICATE", "ID_CARD", "TAX_DOCUMENT"],
};

const documentLabels: Record<DocumentType, string> = {
  ID_CARD: "บัตรประชาชนหรือหนังสือเดินทาง",
  BUSINESS_CERTIFICATE: "สำเนารับรองบริษัท",
  BANK_BOOK: "สมุดบัญชีธนาคาร",
  TAX_DOCUMENT: "กรรมการผู้ลงนามรับรองบริษัท / ยืนยันด้วยใบหน้า",
};

function normalizeStep(step?: string): RegisterStep {
  if (step === "account" || step === "shop" || step === "kyc" || step === "terms") return step;
  return "account";
}

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
    companyRegisteredAddress: application?.pickupAddress?.line1 ?? "",
    pickupName: application?.pickupAddress?.name ?? "",
    pickupPhone: application?.pickupAddress?.phone ?? "",
    pickupLine1: application?.pickupAddress?.line1 ?? "",
    pickupLine2: application?.pickupAddress?.line2 ?? "",
    pickupCity: application?.pickupAddress?.city ?? "",
    pickupRegion: application?.pickupAddress?.region ?? "",
    pickupPostalCode: application?.pickupAddress?.postalCode ?? "",
    pickupCountry: application?.pickupAddress?.country ?? "TH",
    idCardUploadId: documents.get("ID_CARD") ?? "",
    businessCertificateUploadId: documents.get("BUSINESS_CERTIFICATE") ?? "",
    taxDocumentUploadId: documents.get("TAX_DOCUMENT") ?? "",
    bankBookUploadId: documents.get("BANK_BOOK") ?? "",
  };
}

function toPayload(form: OnboardingFormState) {
  const documents: Array<{ uploadId: string; documentType: DocumentType }> = [];
  if (form.idCardUploadId) documents.push({ uploadId: form.idCardUploadId, documentType: "ID_CARD" });
  if (form.businessCertificateUploadId) documents.push({ uploadId: form.businessCertificateUploadId, documentType: "BUSINESS_CERTIFICATE" });
  if (form.taxDocumentUploadId) documents.push({ uploadId: form.taxDocumentUploadId, documentType: "TAX_DOCUMENT" });
  if (form.bankBookUploadId) documents.push({ uploadId: form.bankBookUploadId, documentType: "BANK_BOOK" });

  const nationalId = form.nationalId.trim();
  const companyRegistration = form.companyRegistration.trim();
  const taxId = form.taxId.trim();

  return {
    businessType: form.businessType,
    shopName: form.shopName,
    shopSlug: form.shopSlug,
    shopContactEmail: form.contactEmail,
    shopContactPhone: form.contactPhone,
    legalName: form.legalName,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    ...(nationalId ? { nationalId } : {}),
    ...(companyRegistration ? { companyRegistration } : {}),
    ...(taxId ? { taxId } : {}),
    bankName: form.bankName,
    bankAccountName: form.bankAccountName,
    bankAccountNumber: form.bankAccountNumber,
    pickupName: form.pickupName || form.legalName || form.shopName,
    pickupPhone: form.pickupPhone || form.contactPhone || null,
    pickupLine1: form.pickupLine1 || form.companyRegisteredAddress,
    pickupLine2: form.pickupLine2 || null,
    pickupCity: form.pickupCity,
    pickupRegion: form.pickupRegion || null,
    pickupPostalCode: form.pickupPostalCode,
    pickupCountry: form.pickupCountry,
    documents,
  };
}

export function SellerRegisterPage({ step }: { step?: RegisterStep }) {
  const router = useRouter();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const applicationQuery = useSellerApplication();
  const activeStep = normalizeStep(step);
  const [form, setForm] = useState<OnboardingFormState>(() => toInitialForm(applicationQuery.data));
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);

  useEffect(() => {
    if (!applicationQuery.data || hydratedFromServer) return;

    if (applicationQuery.data.application) {
      setForm(toInitialForm(applicationQuery.data));
    }
    setHydratedFromServer(true);
  }, [applicationQuery.data, hydratedFromServer]);

  const draftMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) => apiRequest("/api/seller/application/draft", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) => apiRequest("/api/seller/application/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  });

  function update<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const application = applicationQuery.data?.application ?? null;
  const error = (draftMutation.error ?? submitMutation.error) as Error | null;
  const isLocked = application?.status === "SUBMITTED";
  const isSaving = draftMutation.isPending || submitMutation.isPending || navigationPending;
  const isResubmission = application?.status === "REJECTED";
  const currentStepIndex = Math.max(registerSteps.findIndex((item) => item.slug === activeStep), 0);
  const currentStep = registerSteps[currentStepIndex] ?? registerSteps[0];
  const isLastStep = currentStepIndex === registerSteps.length - 1;
  const requiredDocuments = requiredDocumentsByBusinessType[form.businessType];
  const existingDocuments = new Map((application?.documents ?? []).map((document) => [document.documentType, document]));

  const requiredDocumentLabelsByType = useMemo(() => {
    if (form.businessType === "COMPANY") {
      return {
        BUSINESS_CERTIFICATE: "สำเนารับรองบริษัท",
        ID_CARD: "สำเนาบัตรประชาชนกรรมการ",
        TAX_DOCUMENT: "กรรมการผู้ลงนามรับรองบริษัท",
      } as const;
    }
    return {
      ID_CARD: "บัตรประชาชนหรือหนังสือเดินทาง",
      TAX_DOCUMENT: "ยืนยันด้วยใบหน้า",
    } as const;
  }, [form.businessType]);

  function uploadIdForDocument(type: DocumentType): string {
    if (type === "ID_CARD") return form.idCardUploadId;
    if (type === "BUSINESS_CERTIFICATE") return form.businessCertificateUploadId;
    if (type === "BANK_BOOK") return form.bankBookUploadId;
    return form.taxDocumentUploadId;
  }

  const missingRequiredDocuments = requiredDocuments.filter((type) => !uploadIdForDocument(type));
  const documentsReady = missingRequiredDocuments.length === 0;
  const hasSavedNationalId = Boolean(application?.nationalIdLast4 || application?.nationalIdMasked);
  const hasSavedCompanyRegistration = Boolean(application?.companyRegistrationLast4 || application?.companyRegistrationMasked);
  const hasSavedTaxId = Boolean(application?.taxIdLast4 || application?.taxIdMasked);

  const accountReady = [form.legalName, form.contactEmail, form.contactPhone]
    .every((value) => value.trim().length > 0);

  const shopReady = [form.shopName, form.shopSlug].every((value) => value.trim().length > 0)
    && (form.businessType === "INDIVIDUAL"
      ? true
      : (form.companyRegistration.trim().length > 0 || hasSavedCompanyRegistration) && form.companyRegisteredAddress.trim().length > 0);

  const kycInfoReady = form.businessType === "INDIVIDUAL"
    ? (form.nationalId.trim().length > 0 || hasSavedNationalId) && (form.taxId.trim().length > 0 || hasSavedTaxId)
    : (form.companyRegistration.trim().length > 0 || hasSavedCompanyRegistration) && (form.taxId.trim().length > 0 || hasSavedTaxId);

  const termsDataReady = true;

  const reviewReady = accountReady && shopReady && kycInfoReady && documentsReady && termsDataReady && acceptedTerms;

  const stepCompletion: Record<RegisterStep, boolean> = {
    account: accountReady,
    shop: shopReady,
    kyc: kycInfoReady && documentsReady,
    terms: reviewReady,
  };

  const currentStepReady = stepCompletion[currentStep.slug];

  async function persistDraft(showMessage = true): Promise<boolean> {
    if (isLocked) return true;
    try {
      await draftMutation.mutateAsync(toPayload(form));
      await queryClient.invalidateQueries({ queryKey: ["seller", "application"] });
      if (showMessage) setMessage("Draft saved");
      return true;
    } catch {
      return false;
    }
  }

  async function goToStep(index: number) {
    if (index < 0 || index >= registerSteps.length || index === currentStepIndex) return;
    if (!isLocked && index > currentStepIndex && !currentStepReady) {
      setMessage("กรอกข้อมูลในขั้นตอนปัจจุบันให้ครบก่อน");
      return;
    }

    setNavigationPending(true);
    setMessage(null);
    const canContinue = await persistDraft(false);
    setNavigationPending(false);
    if (!canContinue) return;

    const target = registerSteps[index];
    router.push(localePath(`/seller/register/${target.slug}`));
  }

  async function handleSubmit() {
    setMessage(null);
    if (!reviewReady) {
      setMessage("กรุณากรอกข้อมูลให้ครบและยืนยันข้อมูลก่อนส่งคำขอ");
      return;
    }
    try {
      await submitMutation.mutateAsync(toPayload(form));
      await queryClient.invalidateQueries({ queryKey: ["seller", "application"] });
      router.push(localePath("/seller/status"));
    } catch {
      // error surfaced from mutation state
    }
  }

  function renderCurrentStep() {
    if (currentStep.slug === "account") {
      return (
        <Section>
          <TextField label="ชื่อผู้สมัคร / ชื่อนิติบุคคล" value={form.legalName} onChange={(value) => update("legalName", value)} />
          <TextField label="อีเมลเพื่อยืนยันตัวตน" value={form.contactEmail} onChange={(value) => update("contactEmail", value)} />
          <TextField label="เบอร์โทร" value={form.contactPhone} onChange={(value) => update("contactPhone", value)} />
        </Section>
      );
    }

    if (currentStep.slug === "shop") {
      return (
        <Section>
          <TextField label="ชื่อร้านค้า" value={form.shopName} onChange={(value) => update("shopName", value)} />
          <TextField label="Shop slug" value={form.shopSlug} onChange={(value) => update("shopSlug", value)} />
          <label className="space-y-1">
            <span className={labelClass}>ประเภทผู้ขาย</span>
            <select value={form.businessType} onChange={(event) => update("businessType", event.target.value as BusinessType)} className={inputClass}>
              <option value="INDIVIDUAL">บุคคลธรรมดา</option>
              <option value="COMPANY">นิติบุคคล</option>
            </select>
          </label>

          {form.businessType === "COMPANY" ? (
            <>
              <TextField label="ชื่อบริษัท" value={form.legalName} onChange={(value) => update("legalName", value)} />
              <TextField label="เลขจดทะเบียนนิติบุคคล" value={form.companyRegistration} onChange={(value) => update("companyRegistration", value)} />
              <TextField label="ที่อยู่ที่จดทะเบียนบริษัท" value={form.companyRegisteredAddress} onChange={(value) => {
                update("companyRegisteredAddress", value);
                if (!form.pickupLine1) update("pickupLine1", value);
              }} />
            </>
          ) : null}
        </Section>
      );
    }

    if (currentStep.slug === "kyc") {
      return (
        <Section>
          {form.businessType === "INDIVIDUAL" ? (
            <TextField label="เลขบัตรประชาชน" value={form.nationalId} onChange={(value) => update("nationalId", value)} />
          ) : (
            <TextField label="เลขจดทะเบียนนิติบุคคล" value={form.companyRegistration} onChange={(value) => update("companyRegistration", value)} />
          )}
          <TextField label="เลขประจำตัวผู้เสียภาษี" value={form.taxId} onChange={(value) => update("taxId", value)} />

          {form.businessType === "COMPANY" ? (
            <>
              <DocumentUpload
                label={requiredDocumentLabelsByType.BUSINESS_CERTIFICATE ?? "สำเนารับรองบริษัท"}
                required={requiredDocuments.includes("BUSINESS_CERTIFICATE")}
                value={form.businessCertificateUploadId}
                reviewStatus={existingDocuments.get("BUSINESS_CERTIFICATE")?.reviewStatus}
                rejectionReason={existingDocuments.get("BUSINESS_CERTIFICATE")?.rejectionReason}
                onChange={(value) => update("businessCertificateUploadId", value)}
              />
              <DocumentUpload
                label={requiredDocumentLabelsByType.ID_CARD}
                required={requiredDocuments.includes("ID_CARD")}
                value={form.idCardUploadId}
                reviewStatus={existingDocuments.get("ID_CARD")?.reviewStatus}
                rejectionReason={existingDocuments.get("ID_CARD")?.rejectionReason}
                onChange={(value) => update("idCardUploadId", value)}
              />
              <DocumentUpload
                label={requiredDocumentLabelsByType.TAX_DOCUMENT}
                required={requiredDocuments.includes("TAX_DOCUMENT")}
                value={form.taxDocumentUploadId}
                reviewStatus={existingDocuments.get("TAX_DOCUMENT")?.reviewStatus}
                rejectionReason={existingDocuments.get("TAX_DOCUMENT")?.rejectionReason}
                onChange={(value) => update("taxDocumentUploadId", value)}
              />
            </>
          ) : (
            <>
              <DocumentUpload
                label={requiredDocumentLabelsByType.ID_CARD}
                required={requiredDocuments.includes("ID_CARD")}
                value={form.idCardUploadId}
                reviewStatus={existingDocuments.get("ID_CARD")?.reviewStatus}
                rejectionReason={existingDocuments.get("ID_CARD")?.rejectionReason}
                onChange={(value) => update("idCardUploadId", value)}
              />
              <DocumentUpload
                label={requiredDocumentLabelsByType.TAX_DOCUMENT}
                required={requiredDocuments.includes("TAX_DOCUMENT")}
                value={form.taxDocumentUploadId}
                reviewStatus={existingDocuments.get("TAX_DOCUMENT")?.reviewStatus}
                rejectionReason={existingDocuments.get("TAX_DOCUMENT")?.rejectionReason}
                onChange={(value) => update("taxDocumentUploadId", value)}
              />
            </>
          )}

          <p className="text-xs text-slate-500 md:col-span-2">
            เอกสารที่ต้องใช้: {requiredDocuments.map((type) => documentLabels[type]).join(", ")}
          </p>
        </Section>
      );
    }

    return (
      <section className="space-y-4 rounded-lg bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-950">ยืนยันข้อมูลและตรวจสอบข้อมูล</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryItem label="ชื่อร้าน" value={form.shopName} />
          <SummaryItem label="ประเภทผู้ขาย" value={form.businessType === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"} />
          <SummaryItem label="ติดต่อ" value={`${form.contactEmail} / ${form.contactPhone}`} />
          <SummaryItem label="เอกสาร KYC" value={missingRequiredDocuments.length > 0 ? `ยังขาด ${missingRequiredDocuments.length} รายการ` : "ครบถ้วน"} />
        </div>

        {missingRequiredDocuments.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Missing required documents: {missingRequiredDocuments.map((type) => documentLabels[type]).join(", ")}
          </div>
        ) : null}

        <label className="flex items-start gap-2 px-1 py-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 size-4"
          />
          <span>ติ๊กยืนยันข้อมูลการเป็นผู้ขาย และยืนยันว่าข้อมูล KYC ที่ให้ไว้เป็นข้อมูลจริง</span>
        </label>
      </section>
    );
  }

  return (
    <>
      <SellerPageHeader title="Start Selling" description="Register seller account, complete KYC, and submit for review." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          {application ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current application</span>
                <StatusBadge status={application.status} />
              </div>
              {isResubmission ? (
                <p className="mt-2 text-sm text-red-700">
                  Previous submission was rejected. Update details and submit again.
                </p>
              ) : null}
            </div>
          ) : null}

          {isLocked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              This application is already submitted. You can edit it only if admin rejects it.
            </p>
          ) : null}

          {application?.status === "REJECTED" && application.rejectionReason ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Rejection reason: {application.rejectionReason}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {registerSteps.map((stepItem, index) => {
              const active = stepItem.slug === currentStep.slug;
              const done = index < currentStepIndex || stepCompletion[stepItem.slug];
              const stepLocked = index > currentStepIndex;

              return (
                <button
                  key={stepItem.slug}
                  type="button"
                  onClick={() => void goToStep(index)}
                  disabled={stepLocked || isSaving}
                  className={`rounded-lg border px-3 py-2 text-left transition ${active ? "border-emerald-500 bg-emerald-50" : done ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"} ${stepLocked ? "cursor-not-allowed opacity-50" : "hover:border-slate-300"}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                  <p className="text-sm font-semibold text-slate-900">{stepItem.title}</p>
                  <p className="text-xs text-slate-500">{stepItem.description}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current step</p>
                <h2 className="text-base font-semibold text-slate-950">{currentStep.title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {currentStepIndex + 1} / {registerSteps.length}
              </span>
            </div>

            {renderCurrentStep()}

            {!isLocked && !currentStepReady && !isLastStep ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Complete required fields in this step before continuing.
              </p>
            ) : null}
          </div>

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error.message}</p> : null}
          {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void goToStep(currentStepIndex - 1)}
                disabled={currentStepIndex === 0 || isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => void goToStep(currentStepIndex + 1)}
                  disabled={isSaving || (!isLocked && !currentStepReady)}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next step
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isLocked || isSaving}
                onClick={() => void persistDraft(true)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {draftMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Save draft
              </button>
              <button
                type="button"
                disabled={isLocked || isSaving || !reviewReady || !isLastStep}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {isResubmission ? "Resubmit for review" : "Submit for review"}
              </button>
            </div>
          </div>
        </form>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Approval checklist</h2>
          <p className="mt-1 text-xs text-slate-500">
            Required document uploads: {requiredDocuments.length - missingRequiredDocuments.length}/{requiredDocuments.length}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <ChecklistItem icon={<StoreIcon className="mt-0.5 size-4" />} done={accountReady && shopReady}>
              Seller account and shop profile completed
            </ChecklistItem>
            <ChecklistItem icon={<FileTextIcon className="mt-0.5 size-4" />} done={documentsReady && kycInfoReady}>
              Required KYC data and documents completed
            </ChecklistItem>
            <ChecklistItem icon={<FileTextIcon className="mt-0.5 size-4" />} done={acceptedTerms}>
              Terms confirmed
            </ChecklistItem>
            <ChecklistItem icon={<CheckCircleIcon className="mt-0.5 size-4" />} done={Boolean(application?.status === "APPROVED")}>
              Admin approval before seller tools unlock
            </ChecklistItem>
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
                <Link href={localePath("/seller/register/account")} className="mt-3 inline-flex rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white no-underline">Edit application</Link>
              </div>
            ) : null}
            {application.status === "SUBMITTED" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Your application is waiting for admin review. Seller operations will unlock after approval.
              </p>
            ) : null}
            {application.status === "DRAFT" ? (
              <Link href={localePath("/seller/register/account")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Continue step-by-step registration</Link>
            ) : null}
            {application.status === "CANCELLED" ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Cancelled</p>
                <p className="mt-1">This application was cancelled. Start a new draft to continue seller onboarding.</p>
                <Link href={localePath("/seller/register/account")} className="mt-3 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Start again</Link>
              </div>
            ) : null}
          </div>
        ) : (
          <Link href={localePath("/seller/register/account")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">Start seller registration</Link>
        )}
      </section>
    </>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-0 p-0 md:grid-cols-2">
      {title ? <legend className="mb-3 text-base font-semibold text-slate-950 md:col-span-2">{title}</legend> : null}
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value || "-"}</p>
    </div>
  );
}

function DocumentUpload({
  label,
  value,
  required = false,
  reviewStatus,
  rejectionReason,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  reviewStatus?: DocumentReviewStatus;
  rejectionReason?: string | null;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reviewStatusLabel(status: DocumentReviewStatus) {
    if (status === "APPROVED") return t("seller.kyc.reviewStatus.approved");
    if (status === "REJECTED") return t("seller.kyc.reviewStatus.rejected");
    return t("seller.kyc.reviewStatus.pending");
  }

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
      <span className="flex items-center gap-2">
        <span className={labelClass}>{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${required ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {required ? t("seller.kyc.required") : t("seller.kyc.optional")}
        </span>
      </span>
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => void handleFile(event.target.files?.[0])} className={inputClass} />
      {uploading ? <span className="text-xs text-slate-500">{t("seller.kyc.uploading")}</span> : null}
      {value ? <span className="text-xs font-medium text-emerald-700">{t("seller.kyc.uploadId")} {value}</span> : null}
      {reviewStatus ? (
        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${reviewStatus === "APPROVED" ? "bg-emerald-100 text-emerald-700" : reviewStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
          {t("seller.kyc.reviewLabel")} {reviewStatusLabel(reviewStatus)}
        </span>
      ) : null}
      {reviewStatus === "REJECTED" && rejectionReason ? (
        <span className="text-xs font-medium text-red-700">{t("seller.kyc.rejectionReason")} {rejectionReason}</span>
      ) : null}
      {required && !value ? <span className="text-xs text-amber-700">{t("seller.kyc.requiredBeforeSubmit")}</span> : null}
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}

function ChecklistItem({ icon, done, children }: { icon: ReactNode; done: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className={done ? "text-emerald-600" : "text-slate-400"}>{icon}</span>
      <span className={done ? "text-slate-800" : "text-slate-500"}>{children}</span>
    </li>
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
