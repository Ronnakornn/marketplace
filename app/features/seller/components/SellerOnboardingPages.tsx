"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, FileTextIcon, Loader2Icon, StoreIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { requestApi } from "#/lib/api-client";
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
    bankAccountNumberLast4?: string | null;
    bankAccountNumberMasked?: string | null;
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

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const requiredDocumentsByBusinessType: Record<BusinessType, DocumentType[]> = {
  INDIVIDUAL: ["ID_CARD", "TAX_DOCUMENT", "BANK_BOOK"],
  COMPANY: ["BUSINESS_CERTIFICATE", "ID_CARD", "TAX_DOCUMENT", "BANK_BOOK"],
};

function normalizeStep(step?: string): RegisterStep {
  if (step === "account" || step === "shop" || step === "kyc" || step === "terms") return step;
  return "account";
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
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
  const t = useTranslations();
  const router = useRouter();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const applicationQuery = useSellerApplication();
  const activeStep = normalizeStep(step);
  const registerSteps: RegisterStepConfig[] = [
    { slug: "account", title: t("seller.onboarding.steps.account.title"), description: t("seller.onboarding.steps.account.description") },
    { slug: "shop", title: t("seller.onboarding.steps.shop.title"), description: t("seller.onboarding.steps.shop.description") },
    { slug: "kyc", title: t("seller.onboarding.steps.kyc.title"), description: t("seller.onboarding.steps.kyc.description") },
    { slug: "terms", title: t("seller.onboarding.steps.terms.title"), description: t("seller.onboarding.steps.terms.description") },
  ];
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
  const error = draftMutation.isError
    ? t("seller.onboarding.errors.saveDraft")
    : submitMutation.isError
      ? t("seller.onboarding.errors.submit")
      : null;
  const isLocked = application?.status === "SUBMITTED";
  const isSaving = draftMutation.isPending || submitMutation.isPending || navigationPending;
  const isResubmission = application?.status === "REJECTED";
  const currentStepIndex = Math.max(registerSteps.findIndex((item) => item.slug === activeStep), 0);
  const currentStep = registerSteps[currentStepIndex] ?? registerSteps[0];
  const isLastStep = currentStepIndex === registerSteps.length - 1;
  const requiredDocuments = requiredDocumentsByBusinessType[form.businessType];
  const existingDocuments = new Map((application?.documents ?? []).map((document) => [document.documentType, document]));
  const documentLabels: Record<DocumentType, string> = {
    ID_CARD: t("seller.kyc.documentType.idCard"),
    BUSINESS_CERTIFICATE: t("seller.kyc.documentType.businessCertificate"),
    BANK_BOOK: t("seller.kyc.documentType.bankBook"),
    TAX_DOCUMENT: t("seller.kyc.documentType.taxDocument"),
  };
  const requiredDocumentLabelsByType: Partial<Record<DocumentType, string>> = form.businessType === "COMPANY"
    ? {
        BUSINESS_CERTIFICATE: t("seller.kyc.documentType.businessCertificate"),
        ID_CARD: t("seller.kyc.documentType.companyDirectorIdCard"),
        TAX_DOCUMENT: t("seller.kyc.documentType.authorizedCompanySignatory"),
      }
    : {
        ID_CARD: t("seller.kyc.documentType.idCard"),
        TAX_DOCUMENT: t("seller.kyc.documentType.faceVerification"),
      };

  function uploadIdForDocument(type: DocumentType): string {
    if (type === "ID_CARD") return form.idCardUploadId;
    if (type === "BUSINESS_CERTIFICATE") return form.businessCertificateUploadId;
    if (type === "BANK_BOOK") return form.bankBookUploadId;
    return form.taxDocumentUploadId;
  }

  function documentLabel(type: DocumentType): string {
    return requiredDocumentLabelsByType[type] ?? documentLabels[type];
  }

  const missingRequiredDocuments = requiredDocuments.filter((type) => !uploadIdForDocument(type));
  const documentsReady = missingRequiredDocuments.length === 0;
  const hasSavedNationalId = Boolean(application?.nationalIdLast4 || application?.nationalIdMasked);
  const hasSavedCompanyRegistration = Boolean(application?.companyRegistrationLast4 || application?.companyRegistrationMasked);
  const hasSavedTaxId = Boolean(application?.taxIdLast4 || application?.taxIdMasked);
  const hasSavedBankAccount = Boolean(application?.bankAccountNumberLast4 || application?.bankAccountNumberMasked);

  const accountReady = [form.legalName, form.contactEmail, form.contactPhone]
    .every((value) => value.trim().length > 0);

  const shopReady = [form.shopName, form.shopSlug].every((value) => value.trim().length > 0)
    && [form.pickupName, form.pickupLine1, form.pickupCity, form.pickupPostalCode, form.pickupCountry]
      .every((value) => value.trim().length > 0)
    && (form.businessType === "INDIVIDUAL"
      ? true
      : (form.companyRegistration.trim().length > 0 || hasSavedCompanyRegistration) && form.companyRegisteredAddress.trim().length > 0);

  const kycInfoReady = form.businessType === "INDIVIDUAL"
    ? (form.nationalId.trim().length > 0 || hasSavedNationalId) && (form.taxId.trim().length > 0 || hasSavedTaxId)
    : (form.companyRegistration.trim().length > 0 || hasSavedCompanyRegistration) && (form.taxId.trim().length > 0 || hasSavedTaxId);
  const payoutReady = [form.bankName, form.bankAccountName].every((value) => value.trim().length > 0)
    && (form.bankAccountNumber.trim().length > 0 || hasSavedBankAccount);

  const termsDataReady = true;

  const reviewReady = accountReady && shopReady && kycInfoReady && payoutReady && documentsReady && termsDataReady && acceptedTerms;

  const stepCompletion: Record<RegisterStep, boolean> = {
    account: accountReady,
    shop: shopReady,
    kyc: kycInfoReady && payoutReady && documentsReady,
    terms: reviewReady,
  };

  const currentStepReady = stepCompletion[currentStep.slug];

  async function persistDraft(showMessage = true): Promise<boolean> {
    if (isLocked) return true;
    try {
      await draftMutation.mutateAsync(toPayload(form));
      await queryClient.invalidateQueries({ queryKey: ["seller", "application"] });
      if (showMessage) setMessage(t("seller.onboarding.messages.draftSaved"));
      return true;
    } catch {
      return false;
    }
  }

  async function goToStep(index: number) {
    if (index < 0 || index >= registerSteps.length || index === currentStepIndex) return;
    if (!isLocked && index > currentStepIndex && !currentStepReady) {
      setMessage(t("seller.onboarding.messages.completeCurrentStep"));
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
      setMessage(t("seller.onboarding.messages.completeBeforeSubmit"));
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
          <TextField label={t("seller.onboarding.fields.legalName")} value={form.legalName} onChange={(value) => update("legalName", value)} />
          <TextField label={t("seller.onboarding.fields.contactEmail")} value={form.contactEmail} onChange={(value) => update("contactEmail", value)} />
          <TextField label={t("seller.onboarding.fields.contactPhone")} value={form.contactPhone} onChange={(value) => update("contactPhone", value)} />
        </Section>
      );
    }

    if (currentStep.slug === "shop") {
      return (
        <Section>
          <TextField label={t("seller.onboarding.fields.shopName")} value={form.shopName} onChange={(value) => update("shopName", value)} />
          <TextField label={t("seller.onboarding.fields.shopSlug")} value={form.shopSlug} onChange={(value) => update("shopSlug", value)} />
          <label className="space-y-1">
            <span className={labelClass}>{t("seller.onboarding.fields.businessType")}</span>
            <select value={form.businessType} onChange={(event) => update("businessType", event.target.value as BusinessType)} className={inputClass}>
              <option value="INDIVIDUAL">{t("seller.onboarding.businessType.individual")}</option>
              <option value="COMPANY">{t("seller.onboarding.businessType.company")}</option>
            </select>
          </label>

          {form.businessType === "COMPANY" ? (
            <>
              <TextField label={t("seller.onboarding.fields.companyName")} value={form.legalName} onChange={(value) => update("legalName", value)} />
              <TextField label={t("seller.onboarding.fields.companyRegistration")} value={form.companyRegistration} onChange={(value) => update("companyRegistration", value)} />
              <TextField label={t("seller.onboarding.fields.companyRegisteredAddress")} value={form.companyRegisteredAddress} onChange={(value) => {
                update("companyRegisteredAddress", value);
                if (!form.pickupLine1) update("pickupLine1", value);
              }} />
            </>
          ) : null}
          <div className="mt-2 border-t border-slate-200 pt-4 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-slate-900">{t("seller.onboarding.sections.pickup")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label={t("seller.onboarding.fields.pickupName")} value={form.pickupName} onChange={(value) => update("pickupName", value)} />
              <TextField label={t("seller.onboarding.fields.pickupPhone")} value={form.pickupPhone} onChange={(value) => update("pickupPhone", value)} />
              <TextField label={t("seller.onboarding.fields.pickupLine1")} value={form.pickupLine1} onChange={(value) => update("pickupLine1", value)} />
              <TextField label={t("seller.onboarding.fields.pickupLine2")} value={form.pickupLine2} onChange={(value) => update("pickupLine2", value)} />
              <TextField label={t("seller.onboarding.fields.pickupCity")} value={form.pickupCity} onChange={(value) => update("pickupCity", value)} />
              <TextField label={t("seller.onboarding.fields.pickupRegion")} value={form.pickupRegion} onChange={(value) => update("pickupRegion", value)} />
              <TextField label={t("seller.onboarding.fields.pickupPostalCode")} value={form.pickupPostalCode} onChange={(value) => update("pickupPostalCode", value)} />
              <TextField label={t("seller.onboarding.fields.pickupCountry")} value={form.pickupCountry} onChange={(value) => update("pickupCountry", value)} />
            </div>
          </div>
        </Section>
      );
    }

    if (currentStep.slug === "kyc") {
      return (
        <Section>
          {form.businessType === "INDIVIDUAL" ? (
            <TextField label={t("seller.onboarding.fields.nationalId")} value={form.nationalId} onChange={(value) => update("nationalId", value)} />
          ) : (
            <TextField label={t("seller.onboarding.fields.companyRegistration")} value={form.companyRegistration} onChange={(value) => update("companyRegistration", value)} />
          )}
          <TextField label={t("seller.onboarding.fields.taxId")} value={form.taxId} onChange={(value) => update("taxId", value)} />
          <TextField label={t("seller.onboarding.fields.bankName")} value={form.bankName} onChange={(value) => update("bankName", value)} />
          <TextField label={t("seller.onboarding.fields.bankAccountName")} value={form.bankAccountName} onChange={(value) => update("bankAccountName", value)} />
          <TextField label={t("seller.onboarding.fields.bankAccountNumber")} value={form.bankAccountNumber} onChange={(value) => update("bankAccountNumber", value)} />

          {form.businessType === "COMPANY" ? (
            <>
              <DocumentUpload
                label={documentLabel("BUSINESS_CERTIFICATE")}
                required={requiredDocuments.includes("BUSINESS_CERTIFICATE")}
                value={form.businessCertificateUploadId}
                reviewStatus={existingDocuments.get("BUSINESS_CERTIFICATE")?.reviewStatus}
                rejectionReason={existingDocuments.get("BUSINESS_CERTIFICATE")?.rejectionReason}
                onChange={(value) => update("businessCertificateUploadId", value)}
              />
              <DocumentUpload
                label={documentLabel("ID_CARD")}
                required={requiredDocuments.includes("ID_CARD")}
                value={form.idCardUploadId}
                reviewStatus={existingDocuments.get("ID_CARD")?.reviewStatus}
                rejectionReason={existingDocuments.get("ID_CARD")?.rejectionReason}
                onChange={(value) => update("idCardUploadId", value)}
              />
              <DocumentUpload
                label={documentLabel("TAX_DOCUMENT")}
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
                label={documentLabel("ID_CARD")}
                required={requiredDocuments.includes("ID_CARD")}
                value={form.idCardUploadId}
                reviewStatus={existingDocuments.get("ID_CARD")?.reviewStatus}
                rejectionReason={existingDocuments.get("ID_CARD")?.rejectionReason}
                onChange={(value) => update("idCardUploadId", value)}
              />
              <DocumentUpload
                label={documentLabel("TAX_DOCUMENT")}
                required={requiredDocuments.includes("TAX_DOCUMENT")}
                value={form.taxDocumentUploadId}
                reviewStatus={existingDocuments.get("TAX_DOCUMENT")?.reviewStatus}
                rejectionReason={existingDocuments.get("TAX_DOCUMENT")?.rejectionReason}
                onChange={(value) => update("taxDocumentUploadId", value)}
              />
            </>
          )}

          <DocumentUpload
            label={documentLabel("BANK_BOOK")}
            required
            value={form.bankBookUploadId}
            reviewStatus={existingDocuments.get("BANK_BOOK")?.reviewStatus}
            rejectionReason={existingDocuments.get("BANK_BOOK")?.rejectionReason}
            onChange={(value) => update("bankBookUploadId", value)}
          />

          <p className="text-xs text-slate-500 md:col-span-2">
            {t("seller.onboarding.documentsRequired")} {requiredDocuments.map(documentLabel).join(", ")}
          </p>
        </Section>
      );
    }

    return (
      <section className="space-y-4 rounded-lg bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-950">{t("seller.onboarding.review.title")}</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryItem label={t("seller.onboarding.review.shopName")} value={form.shopName} />
          <SummaryItem label={t("seller.onboarding.review.businessType")} value={form.businessType === "COMPANY" ? t("seller.onboarding.businessType.company") : t("seller.onboarding.businessType.individual")} />
          <SummaryItem label={t("seller.onboarding.review.contact")} value={[form.contactEmail, form.contactPhone].filter(Boolean).join(" / ")} />
          <SummaryItem label={t("seller.onboarding.review.bankAccount")} value={[form.bankName, form.bankAccountName].filter(Boolean).join(" / ")} />
          <SummaryItem label={t("seller.onboarding.review.pickupAddress")} value={[form.pickupLine1, form.pickupCity, form.pickupPostalCode].filter(Boolean).join(", ")} />
          <SummaryItem
            label={t("seller.onboarding.review.kycDocuments")}
            value={missingRequiredDocuments.length > 0
              ? t("seller.onboarding.review.missingCount").replace("{count}", String(missingRequiredDocuments.length))
              : t("seller.onboarding.review.complete")}
          />
        </div>

        {missingRequiredDocuments.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("seller.onboarding.review.missingDocuments")} {missingRequiredDocuments.map(documentLabel).join(", ")}
          </div>
        ) : null}

        <label className="flex items-start gap-2 px-1 py-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 size-4"
          />
          <span>{t("seller.onboarding.review.confirmation")}</span>
        </label>
      </section>
    );
  }

  return (
    <>
      <SellerPageHeader title={t("seller.onboarding.header.title")} description={t("seller.onboarding.header.description")} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          {application ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.onboarding.currentApplication")}</span>
                <StatusBadge status={application.status} />
              </div>
              {isResubmission ? (
                <p className="mt-2 text-sm text-red-700">
                  {t("seller.onboarding.messages.previousRejected")}
                </p>
              ) : null}
            </div>
          ) : null}

          {isLocked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {t("seller.onboarding.messages.applicationLocked")}
            </p>
          ) : null}

          {application?.status === "REJECTED" && application.rejectionReason ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {t("seller.onboarding.rejectionReason")} {application.rejectionReason}
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {t("seller.onboarding.stepLabel").replace("{step}", String(index + 1))}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{stepItem.title}</p>
                  <p className="text-xs text-slate-500">{stepItem.description}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.onboarding.currentStep")}</p>
                <h2 className="text-base font-semibold text-slate-950">{currentStep.title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {currentStepIndex + 1} / {registerSteps.length}
              </span>
            </div>

            {renderCurrentStep()}

            {!isLocked && !currentStepReady && !isLastStep ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("seller.onboarding.messages.completeCurrentStep")}
              </p>
            ) : null}
          </div>

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
          {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void goToStep(currentStepIndex - 1)}
                disabled={currentStepIndex === 0 || isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("seller.onboarding.actions.back")}
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => void goToStep(currentStepIndex + 1)}
                  disabled={isSaving || (!isLocked && !currentStepReady)}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("seller.onboarding.actions.next")}
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
                {t("seller.onboarding.actions.saveDraft")}
              </button>
              <button
                type="button"
                disabled={isLocked || isSaving || !reviewReady || !isLastStep}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {isResubmission ? t("seller.onboarding.actions.resubmit") : t("seller.onboarding.actions.submit")}
              </button>
            </div>
          </div>
        </form>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">{t("seller.onboarding.checklist.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("seller.onboarding.checklist.uploads")} {requiredDocuments.length - missingRequiredDocuments.length}/{requiredDocuments.length}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <ChecklistItem icon={<StoreIcon className="mt-0.5 size-4" />} done={accountReady && shopReady}>
              {t("seller.onboarding.checklist.accountAndShop")}
            </ChecklistItem>
            <ChecklistItem icon={<FileTextIcon className="mt-0.5 size-4" />} done={documentsReady && kycInfoReady}>
              {t("seller.onboarding.checklist.kyc")}
            </ChecklistItem>
            <ChecklistItem icon={<FileTextIcon className="mt-0.5 size-4" />} done={acceptedTerms}>
              {t("seller.onboarding.checklist.terms")}
            </ChecklistItem>
            <ChecklistItem icon={<CheckCircleIcon className="mt-0.5 size-4" />} done={Boolean(application?.status === "APPROVED")}>
              {t("seller.onboarding.checklist.adminApproval")}
            </ChecklistItem>
          </ul>
        </aside>
      </div>
    </>
  );
}

export function SellerStatusPage() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const applicationQuery = useSellerApplication();
  const application = applicationQuery.data?.application;
  const shop = applicationQuery.data?.shop;
  const shopStatusLabels: Record<string, string> = {
    PENDING: t("seller.onboarding.shopStatus.pending"),
    ACTIVE: t("seller.onboarding.shopStatus.active"),
    SUSPENDED: t("seller.onboarding.shopStatus.suspended"),
    REJECTED: t("seller.onboarding.shopStatus.rejected"),
    BANNED: t("seller.onboarding.shopStatus.banned"),
    VACATION: t("seller.onboarding.shopStatus.vacation"),
  };

  return (
    <>
      <SellerPageHeader title={t("seller.onboarding.status.title")} description={t("seller.onboarding.status.description")} />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {applicationQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2Icon className="size-4 animate-spin" /> {t("seller.onboarding.status.loading")}</div>
        ) : applicationQuery.isError ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {t("seller.onboarding.status.loadError")}
          </p>
        ) : application ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={application.status} />
              {shop ? <span className="text-sm text-slate-500">{shop.name} / {shopStatusLabels[shop.status] ?? shop.status.replaceAll("_", " ")}</span> : null}
            </div>
            {application.status === "REJECTED" ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">{t("seller.onboarding.status.rejected")}</p>
                <p className="mt-1">{application.rejectionReason ?? t("seller.onboarding.status.rejectedFallback")}</p>
                <Link href={localePath("/seller/register/account")} className="mt-3 inline-flex rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white no-underline">{t("seller.onboarding.status.editApplication")}</Link>
              </div>
            ) : null}
            {application.status === "SUBMITTED" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                {t("seller.onboarding.status.submitted")}
              </p>
            ) : null}
            {application.status === "DRAFT" ? (
              <Link href={localePath("/seller/register/account")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">{t("seller.onboarding.status.continueRegistration")}</Link>
            ) : null}
            {application.status === "CANCELLED" ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">{t("seller.onboarding.status.cancelled")}</p>
                <p className="mt-1">{t("seller.onboarding.status.cancelledDescription")}</p>
                <Link href={localePath("/seller/register/account")} className="mt-3 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">{t("seller.onboarding.status.startAgain")}</Link>
              </div>
            ) : null}
          </div>
        ) : (
          <Link href={localePath("/seller/register/account")} className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline">{t("seller.onboarding.status.startRegistration")}</Link>
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
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
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
      if (!uploadResponse.ok) throw new Error("upload_failed");
      await apiRequest("/api/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ fileId: presigned.fileId }),
      });
      return presigned.fileId;
    },
    onSuccess: onChange,
  });
  const error = uploadMutation.isError ? t("seller.kyc.uploadFailed") : null;

  function reviewStatusLabel(status: DocumentReviewStatus) {
    if (status === "APPROVED") return t("seller.kyc.reviewStatus.approved");
    if (status === "REJECTED") return t("seller.kyc.reviewStatus.rejected");
    return t("seller.kyc.reviewStatus.pending");
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    uploadMutation.mutate(file);
  }

  return (
    <label className="space-y-1">
      <span className="flex items-center gap-2">
        <span className={labelClass}>{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${required ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {required ? t("seller.kyc.required") : t("seller.kyc.optional")}
        </span>
      </span>
      <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploadMutation.isPending} onChange={(event) => handleFile(event.target.files?.[0])} className={inputClass} />
      {uploadMutation.isPending ? <span className="text-xs text-slate-500">{t("seller.kyc.uploading")}</span> : null}
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
  const t = useTranslations();
  const rejected = status === "REJECTED";
  const approved = status === "APPROVED";
  const cancelled = status === "CANCELLED";
  const statusLabels: Record<ApplicationStatus, string> = {
    DRAFT: t("seller.onboarding.applicationStatus.draft"),
    SUBMITTED: t("seller.onboarding.applicationStatus.submitted"),
    APPROVED: t("seller.onboarding.applicationStatus.approved"),
    REJECTED: t("seller.onboarding.applicationStatus.rejected"),
    CANCELLED: t("seller.onboarding.applicationStatus.cancelled"),
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-700" : rejected ? "bg-red-50 text-red-700" : cancelled ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>
      {rejected ? <XCircleIcon className="size-3.5" /> : <CheckCircleIcon className="size-3.5" />}
      {statusLabels[status]}
    </span>
  );
}
