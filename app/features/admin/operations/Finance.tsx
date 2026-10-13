"use client";

import { AdminTable } from "../components/AdminTable";
import { AdminActionDialog } from "../components/AdminActionDialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { api } from "#/lib/eden";
import { useTranslations, useFormatters } from "#/i18n/client";
import {
  operationsApi,
  useOperationMutation,
  useOperationQuery,
  unwrap,
  type EvidenceInput,
  type EvidenceRow,
  type StatementFileInput,
  type StatementFilePreview,
  type CycleRows,
} from "./api";
import {
  Editor,
  Field,
  OperationsFrame,
  SelectField,
  dateInput,
  toDateInput,
  operationError,
} from "./shared";

const blankEvidence: EvidenceInput = {
  kind: "BANK_STATEMENT",
  sourceKey: "",
  amount: "",
  currency: "THB",
  externalReference: "",
  occurredAt: null,
  reason: "",
};

export function AdminReconciliation() {
  const t = useTranslations();
  const { currency } = useFormatters();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankEvidence);
  const [targetId, setTargetId] = useState("");
  const [targetType, setTargetType] = useState<"PAYMENT" | "PAYOUT" | "REFUND">(
    "PAYMENT",
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reviewing, setReviewing] = useState<EvidenceRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewTargetId, setReviewTargetId] = useState("");
  const [reviewTargetType, setReviewTargetType] = useState<
    "PAYMENT" | "PAYOUT" | "REFUND"
  >("PAYMENT");
  const rows = useOperationQuery(["reconciliation", page], () =>
    operationsApi.finance.reconciliation.get({ query: { page, limit: 20 } }),
  );
  const create = useOperationMutation((body: EvidenceInput) =>
    operationsApi.finance.reconciliation.post(body),
  );
  const match = useOperationMutation(
    (input: {
      row: EvidenceRow;
      reject: boolean;
      reason: string;
      targetId: string;
      targetType: "PAYMENT" | "PAYOUT" | "REFUND";
    }) =>
      operationsApi.finance.reconciliation({ id: input.row.id }).match.post({
        expectedVersion: input.row.version,
        reason: input.reason,
        reject: input.reject,
        ...(input.row.kind !== "OPERATING_EXPENSE" && input.targetId
          ? input.targetType === "PAYMENT"
            ? { paymentId: input.targetId }
            : input.targetType === "PAYOUT"
              ? { payoutId: input.targetId }
              : { refundId: input.targetId }
          : {}),
      }),
  );
  async function saveEvidence() {
    try {
      setUploadError(null);
      let uploadId = form.uploadId;
      if (file) {
        setUploading(true);
        const signed = unwrap(
          await api.api.uploads["presigned-url"].post({
            usage: "finance_evidence",
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        );
        const put = await fetch(signed.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": file.type || "application/octet-stream" },
        });
        if (!put.ok) throw new Error("UPLOAD_FAILED");
        const completed = unwrap(
          await api.api.uploads.complete.post({ fileId: signed.fileId }),
        );
        uploadId = completed.id;
      }
      const target =
        form.kind !== "OPERATING_EXPENSE" && targetId
          ? targetType === "PAYMENT"
            ? { paymentId: targetId }
            : targetType === "PAYOUT"
              ? { payoutId: targetId }
              : { refundId: targetId }
          : {};
      await create.mutateAsync({
        ...form,
        externalReference:
          form.kind === "OPERATING_EXPENSE"
            ? form.sourceKey
            : form.externalReference,
        ...target,
        ...(uploadId ? { uploadId } : {}),
      });
      setForm(blankEvidence);
      setTargetId("");
      setTargetType("PAYMENT");
      setFile(null);
      setEvidenceOpen(false);
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  }
  async function download(row: EvidenceRow) {
    try {
      setUploadError(null);
      const data = unwrap(
        await operationsApi.finance
          .reconciliation({ id: row.id })
          .download.get(),
      );
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setUploadError(error);
    }
  }
  return (
    <OperationsFrame
      area="reconciliation"
      loading={rows.isLoading}
      error={create.error ?? match.error ?? uploadError ?? rows.error}
    >
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        {t("admin.operations.evidenceOnly")}
      </p>
      <AdminTable
        isLoading={rows.isLoading}
        data={rows.data?.items ?? []}
        columns={[
          {
            id: "sourceKey",
            header: t("admin.operations.fields.sourceKey"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <span className="break-all">{row.sourceKey}</span>
              </>
            ),
          },
          {
            id: "kind",
            header: t("admin.operations.fields.kind"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.kind}`)}</>
            ),
          },
          {
            id: "amount",
            header: t("admin.operations.fields.amount"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {currency(row.amount)} {row.currency}
              </>
            ),
          },
          {
            id: "externalReference",
            header: t("admin.operations.fields.externalReference"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.externalReference}</>,
          },
          {
            id: "status",
            header: t("admin.operations.fields.status"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.status}`)}</>
            ),
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReviewing(row);
                      setReviewTargetId(
                        row.paymentId ?? row.payoutId ?? row.refundId ?? "",
                      );
                      setReviewTargetType(
                        row.payoutId
                          ? "PAYOUT"
                          : row.refundId
                            ? "REFUND"
                            : "PAYMENT",
                      );
                      setReviewReason("");
                    }}
                  >
                    {t("admin.operations.review")}
                  </Button>
                  {row.uploadId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void download(row)}
                    >
                      {t("admin.operations.viewEvidence")}
                    </Button>
                  ) : null}
                </div>
              </>
            ),
          },
        ]}
        pagination={{
          pageIndex: page - 1,
          pageSize: 20,
          totalRows: rows.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize: 20 })
                : updater;
            setPage(next.pageIndex + 1);
          },
        }}
      />
      {reviewing ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !match.isPending) setReviewing(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="max-h-[90dvh] overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle className="break-words">
                {t("admin.operations.review")}: {reviewing.sourceKey}
              </DialogTitle>
              <DialogDescription>
                {t("admin.operations.evidenceOnly")}
              </DialogDescription>
            </DialogHeader>
            {match.error ? (
              <p role="alert" className="text-sm text-destructive">
                {operationError(match.error, t)}
              </p>
            ) : null}
            <p>
              {currency(reviewing.amount, reviewing.currency)} ·{" "}
              {reviewing.externalReference}
            </p>
            <fieldset disabled={match.isPending} className="grid min-w-0 gap-4">
              <SelectField
                label="targetType"
                value={reviewTargetType}
                values={["PAYMENT", "PAYOUT", "REFUND"]}
                onChange={(value) => {
                  setReviewTargetType(value);
                  setReviewTargetId("");
                }}
              />
              <Field
                label="targetId"
                value={reviewTargetId}
                onChange={setReviewTargetId}
              />
              <Field
                label="reason"
                value={reviewReason}
                required
                onChange={setReviewReason}
              />
              <div className="flex gap-2">
                <Button
                  disabled={match.isPending || reviewReason.trim().length < 3}
                  onClick={() =>
                    match.mutate(
                      {
                        row: reviewing,
                        reject: false,
                        reason: reviewReason,
                        targetId: reviewTargetId,
                        targetType: reviewTargetType,
                      },
                      { onSuccess: () => setReviewing(null) },
                    )
                  }
                >
                  {t("admin.operations.match")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={match.isPending || reviewReason.trim().length < 3}
                  onClick={() =>
                    match.mutate(
                      {
                        row: reviewing,
                        reject: true,
                        reason: reviewReason,
                        targetId: reviewTargetId,
                        targetType: reviewTargetType,
                      },
                      { onSuccess: () => setReviewing(null) },
                    )
                  }
                >
                  {t("admin.operations.reject")}
                </Button>
                <Button
                  variant="outline"
                  disabled={match.isPending}
                  onClick={() => setReviewing(null)}
                >
                  {t("admin.operations.cancel")}
                </Button>
              </div>
            </fieldset>
          </DialogContent>
        </Dialog>
      ) : null}
      <Editor
        title="createEvidence"
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        error={create.error ?? uploadError}
        onCancel={() => {
          setForm(blankEvidence);
          setTargetId("");
          setTargetType("PAYMENT");
          setFile(null);
          setUploadError(null);
        }}
        busy={uploading || create.isPending}
        onSubmit={saveEvidence}
      >
        <SelectField
          label="kind"
          value={form.kind}
          values={[
            "BANK_STATEMENT",
            "PAYMENT_EVIDENCE",
            "PAYOUT_EVIDENCE",
            "REFUND_EVIDENCE",
            "OPERATING_EXPENSE",
          ]}
          onChange={(value) => {
            setForm({ ...form, kind: value });
            setTargetId("");
            setTargetType(
              value === "PAYOUT_EVIDENCE"
                ? "PAYOUT"
                : value === "REFUND_EVIDENCE"
                  ? "REFUND"
                  : "PAYMENT",
            );
          }}
        />
        <Field
          label="sourceKey"
          value={form.sourceKey}
          required
          onChange={(value) => setForm({ ...form, sourceKey: value })}
        />
        <Field
          label="amount"
          value={form.amount}
          required
          onChange={(value) => setForm({ ...form, amount: value })}
        />
        <Field
          label="currency"
          value={form.currency}
          onChange={(value) =>
            setForm({ ...form, currency: value.toUpperCase() })
          }
        />
        <Field
          label="externalReference"
          value={form.externalReference}
          required
          onChange={(value) => setForm({ ...form, externalReference: value })}
        />
        <Field
          label="occurredAt"
          type="datetime-local"
          value={toDateInput(form.occurredAt)}
          onChange={(value) =>
            setForm({ ...form, occurredAt: dateInput(value) })
          }
        />
        <SelectField
          label="targetType"
          value={targetType}
          values={["PAYMENT", "PAYOUT", "REFUND"]}
          onChange={(value) => {
            setTargetType(value);
            setTargetId("");
          }}
        />
        <Field label="targetId" value={targetId} onChange={setTargetId} />
        <label className="grid gap-2 text-sm">
          <span>{t("admin.operations.fields.upload")}</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Field
          label="reason"
          value={form.reason}
          required
          onChange={(value) => setForm({ ...form, reason: value })}
        />
      </Editor>
      <StatementImport />
    </OperationsFrame>
  );
}

export function StatementImport() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [batchKey, setBatchKey] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [preview, setPreview] = useState<StatementFilePreview>(null);
  const [parsedFile, setParsedFile] = useState<StatementFileInput | null>(null);
  const cache = useQueryClient();
  const importing = useMutation({
    mutationFn: async () => {
      if (!parsedFile) throw new Error("PREVIEW_REQUIRED");
      return unwrap(
        await operationsApi.finance.statements["file-import"].post(parsedFile),
      );
    },
    onSuccess: () => {
      setPreview(null);
      setParsedFile(null);
      return cache.invalidateQueries({ queryKey: ["admin-operations"] });
    },
  });
  async function inspect() {
    if (!file) return;
    try {
      setError(null);
      setPreview(null);
      setParsedFile(null);
      if (file.size > 2_000_000) throw new Error("FILE_TOO_LARGE");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const payload = {
        fileName: file.name,
        base64: btoa(binary),
        reason,
        batchKey,
      };
      const result = unwrap(
        await operationsApi.finance.statements["file-preview"].post(payload),
      );
      setParsedFile({ ...payload, expectedFingerprint: result.fingerprint });
      setPreview(result);
    } catch (failure) {
      setError(failure);
    }
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" type="button">
          {t("admin.operations.statement.title")}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <OperationsFrame area="statement" error={error ?? importing.error}>
          <section className="admin-panel grid gap-4 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">
              {t("admin.operations.statementHelp")}
            </p>
            <Field
              label="batchKey"
              value={batchKey}
              required
              onChange={(value) => {
                setBatchKey(value);
                setPreview(null);
              }}
            />
            <Field
              label="reason"
              value={reason}
              required
              onChange={(value) => {
                setReason(value);
                setPreview(null);
              }}
            />
            <label className="grid gap-2 text-sm">
              <span>{t("admin.operations.fields.upload")}</span>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
            </label>
            <Button
              variant="outline"
              disabled={!file || reason.trim().length < 3 || !batchKey}
              onClick={() => void inspect()}
            >
              {t("admin.operations.preview")}
            </Button>
            {preview ? (
              <>
                <AdminTable
                  data={preview.rows ?? []}
                  columns={[
                    {
                      id: "row",
                      header: t("admin.operations.fields.row"),
                      enableSorting: false,
                      cell: ({ row: { original: row } }) => <>{row.row}</>,
                    },
                    {
                      id: "sourceKey",
                      header: t("admin.operations.fields.sourceKey"),
                      enableSorting: false,
                      cell: ({ row: { original: row } }) => (
                        <>{row.sourceKey}</>
                      ),
                    },
                    {
                      id: "valid",
                      header: t("admin.operations.fields.valid"),
                      enableSorting: false,
                      cell: ({ row: { original: row } }) => (
                        <>
                          {t(
                            row.valid
                              ? "admin.operations.yes"
                              : "admin.operations.no",
                          )}
                        </>
                      ),
                    },
                    {
                      id: "error",
                      header: t("admin.operations.fields.error"),
                      enableSorting: false,
                      cell: ({ row: { original: row } }) => (
                        <>
                          {row.error
                            ? t(
                                `admin.operations.errors.${row.errorCode ?? "ADMIN_OPERATIONS_INVALID"}`,
                              )
                            : null}
                        </>
                      ),
                    },
                  ]}
                />
                <Button
                  disabled={!preview.valid || importing.isPending}
                  onClick={() => importing.mutate()}
                >
                  {t("admin.operations.import")}
                </Button>
              </>
            ) : null}
          </section>
        </OperationsFrame>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AdminFinance() {
  const t = useTranslations();
  const { currency } = useFormatters();
  const [page, setPage] = useState(1);
  const [evidenceId, setEvidenceId] = useState("");
  const [reference, setReference] = useState("");
  const [payoutTarget, setPayoutTarget] = useState<
    NonNullable<CycleRows>["items"][number] | null
  >(null);
  const [approvalTarget, setApprovalTarget] = useState<
    NonNullable<CycleRows>["items"][number] | null
  >(null);
  const channels = useOperationQuery(["channels"], () =>
    operationsApi.finance.channels.get(),
  );
  const cycles = useOperationQuery(["cycles", page], () =>
    operationsApi.finance.cycles.get({ query: { page, limit: 20 } }),
  );
  const prepare = useOperationMutation(() =>
    operationsApi.finance.cycles.prepare.post(),
  );
  const record = useOperationMutation(
    (input: {
      payoutId: string;
      evidenceId: string;
      externalReference: string;
    }) =>
      operationsApi.finance
        .payouts({ id: input.payoutId })
        .record.post({
          evidenceId: input.evidenceId,
          externalReference: input.externalReference,
        }),
  );
  const approve = useOperationMutation((id: string) =>
    api.api.admin.payouts({ payoutId: id }).approve.patch(),
  );
  return (
    <OperationsFrame
      area="finance"
      loading={channels.isLoading || cycles.isLoading}
      error={
        prepare.error ??
        record.error ??
        approve.error ??
        channels.error ??
        cycles.error
      }
    >
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-medium">
          {t("admin.operations.paymentBridge")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <dt>{t("admin.operations.fields.providerId")}</dt>
          <dd>{channels.data?.provider}</dd>
          <dt>{t("admin.operations.fields.mode")}</dt>
          <dd>
            {t(
              `admin.operations.values.${channels.data?.mode ?? "UNAVAILABLE"}`,
            )}
          </dd>
          <dt>{t("admin.operations.checkoutReady")}</dt>
          <dd>
            {t(
              channels.data?.checkoutReady
                ? "admin.operations.yes"
                : "admin.operations.no",
            )}
          </dd>
          <dt>{t("admin.operations.webhookReady")}</dt>
          <dd>
            {t(
              channels.data?.webhookReady
                ? "admin.operations.yes"
                : "admin.operations.no",
            )}
          </dd>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("admin.operations.channelsHelp")}
        </p>
      </section>
      <section className="admin-panel rounded-xl p-5">
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.operations.cyclesHelp")}
        </p>
        <Button
          disabled={prepare.isPending}
          onClick={() => prepare.mutate(undefined)}
        >
          {t("admin.operations.prepareCycles")}
        </Button>
      </section>
      <AdminTable
        isLoading={cycles.isLoading}
        data={cycles.data?.items ?? []}
        columns={[
          {
            id: "name",
            header: t("admin.operations.fields.name"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.shop.name}</>,
          },
          {
            id: "cycleKey",
            header: t("admin.operations.fields.cycleKey"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.cycleKey}</>,
          },
          {
            id: "amount",
            header: t("admin.operations.fields.amount"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {currency(row.amount)} {row.currency}
              </>
            ),
          },
          {
            id: "status",
            header: t("admin.operations.fields.status"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.status}`)}</>
            ),
          },
          {
            id: "externalReference",
            header: t("admin.operations.fields.externalReference"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.externalReference}</>,
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <div className="flex flex-wrap gap-2">
                  {row.status === "requested" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approve.isPending}
                      onClick={() => setApprovalTarget(row)}
                    >
                      {t("admin.operations.approve")}
                    </Button>
                  ) : null}
                  {row.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEvidenceId("");
                        setReference("");
                        setPayoutTarget(row);
                      }}
                    >
                      {t("admin.operations.recordPaid")}
                    </Button>
                  ) : null}
                  {row.evidenceUploadId ? (
                    <a
                      className="underline"
                      href={`/api/uploads/${row.evidenceUploadId}/content`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("admin.operations.viewSlip")}
                    </a>
                  ) : null}
                </div>
              </>
            ),
          },
        ]}
        pagination={{
          pageIndex: page - 1,
          pageSize: 20,
          totalRows: cycles.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize: 20 })
                : updater;
            setPage(next.pageIndex + 1);
          },
        }}
      />
      {payoutTarget ? (
        <Editor
          title="recordPaid"
          open
          onOpenChange={(open) => {
            if (!open) setPayoutTarget(null);
          }}
          error={record.error}
          busy={record.isPending}
          onCancel={() => setPayoutTarget(null)}
          onSubmit={async () => {
            await record.mutateAsync({
              payoutId: payoutTarget.id,
              evidenceId,
              externalReference: reference,
            });
            setPayoutTarget(null);
          }}
        >
          <dl className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:col-span-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("admin.financialAction.target")}
              </dt>
              <dd className="font-medium">{payoutTarget.shop.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("admin.financialAction.amount")}
              </dt>
              <dd className="font-semibold tabular-nums">
                {currency(payoutTarget.amount, payoutTarget.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("admin.financialAction.recordId")}
              </dt>
              <dd className="break-all font-mono text-xs">{payoutTarget.id}</dd>
            </div>
          </dl>
          <Field
            label="evidenceId"
            value={evidenceId}
            required
            onChange={setEvidenceId}
          />
          <Field
            label="externalReference"
            value={reference}
            required
            onChange={setReference}
          />
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            {t("admin.operations.twoPersonHelp")}
          </p>
        </Editor>
      ) : null}
      {approvalTarget ? (
        <AdminActionDialog
          action={t("admin.operations.approve")}
          description={t("admin.financialAction.approvePayoutHint")}
          target={approvalTarget.shop.name}
          recordId={approvalTarget.id}
          amount={currency(approvalTarget.amount, approvalTarget.currency)}
          currency={approvalTarget.currency}
          isPending={approve.isPending}
          onConfirm={() => approve.mutateAsync(approvalTarget.id)}
          onClose={() => setApprovalTarget(null)}
        />
      ) : null}
    </OperationsFrame>
  );
}
