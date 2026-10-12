"use client";

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
} from "./api";
import {
  Cell,
  DataTable,
  Editor,
  Field,
  OperationsFrame,
  Pager,
  SelectField,
  dateInput,
  toDateInput,
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
  const [reviewing, setReviewing] = useState<EvidenceRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const rows = useOperationQuery(["reconciliation", page], () =>
    operationsApi.finance.reconciliation.get({ query: { page, limit: 20 } }),
  );
  const create = useOperationMutation((body: EvidenceInput) =>
    operationsApi.finance.reconciliation.post(body),
  );
  const match = useOperationMutation(
    (input: { row: EvidenceRow; reject: boolean }) =>
      operationsApi.finance.reconciliation({ id: input.row.id }).match.post({
        expectedVersion: input.row.version,
        reason: reviewReason,
        reject: input.reject,
        ...(input.row.kind !== "OPERATING_EXPENSE" && targetId
          ? targetType === "PAYMENT"
            ? { paymentId: targetId }
            : targetType === "PAYOUT"
              ? { payoutId: targetId }
              : { refundId: targetId }
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
      setFile(null);
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
      <DataTable
        headings={[
          "sourceKey",
          "kind",
          "amount",
          "externalReference",
          "status",
          "actions",
        ]}
      >
        {rows.data?.items.map((row) => (
          <tr key={row.id}>
            <Cell>
              <span className="break-all">{row.sourceKey}</span>
            </Cell>
            <Cell>{t(`admin.operations.values.${row.kind}`)}</Cell>
            <Cell>
              {currency(row.amount)} {row.currency}
            </Cell>
            <Cell>{row.externalReference}</Cell>
            <Cell>{t(`admin.operations.values.${row.status}`)}</Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewing(row);
                    setTargetId(
                      row.paymentId ?? row.payoutId ?? row.refundId ?? "",
                    );
                    setTargetType(
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
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pager page={page} total={rows.data?.total ?? 0} onPage={setPage} />
      {reviewing ? (
        <section className="admin-panel grid gap-4 rounded-xl p-5">
          <h2 className="text-lg font-medium">
            {t("admin.operations.review")}: {reviewing.sourceKey}
          </h2>
          <p>
            {currency(reviewing.amount)} {reviewing.currency} ·{" "}
            {reviewing.externalReference}
          </p>
          <SelectField
            label="targetType"
            value={targetType}
            values={["PAYMENT", "PAYOUT", "REFUND"]}
            onChange={setTargetType}
          />
          <Field label="targetId" value={targetId} onChange={setTargetId} />
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
                  { row: reviewing, reject: false },
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
                  { row: reviewing, reject: true },
                  { onSuccess: () => setReviewing(null) },
                )
              }
            >
              {t("admin.operations.reject")}
            </Button>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              {t("admin.operations.cancel")}
            </Button>
          </div>
        </section>
      ) : null}
      <Editor
        title="createEvidence"
        busy={uploading || create.isPending}
        onSubmit={() => void saveEvidence()}
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
          onChange={setTargetType}
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
          <input
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
            <DataTable headings={["row", "sourceKey", "valid", "error"]}>
              {preview.rows.map((row) => (
                <tr key={row.row}>
                  <Cell>{row.row}</Cell>
                  <Cell>{row.sourceKey}</Cell>
                  <Cell>
                    {t(
                      row.valid
                        ? "admin.operations.yes"
                        : "admin.operations.no",
                    )}
                  </Cell>
                  <Cell>
                    {row.error
                      ? t(
                          `admin.operations.errors.${row.errorCode ?? "ADMIN_OPERATIONS_INVALID"}`,
                        )
                      : null}
                  </Cell>
                </tr>
              ))}
            </DataTable>
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
  );
}

export function AdminFinance() {
  const t = useTranslations();
  const { currency } = useFormatters();
  const [page, setPage] = useState(1);
  const [evidenceId, setEvidenceId] = useState("");
  const [reference, setReference] = useState("");
  const [payoutId, setPayoutId] = useState("");
  const channels = useOperationQuery(["channels"], () =>
    operationsApi.finance.channels.get(),
  );
  const cycles = useOperationQuery(["cycles", page], () =>
    operationsApi.finance.cycles.get({ query: { page, limit: 20 } }),
  );
  const prepare = useOperationMutation(() =>
    operationsApi.finance.cycles.prepare.post(),
  );
  const record = useOperationMutation(() =>
    operationsApi.finance
      .payouts({ id: payoutId })
      .record.post({ evidenceId, externalReference: reference }),
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
      <DataTable
        headings={[
          "name",
          "cycleKey",
          "amount",
          "status",
          "externalReference",
          "actions",
        ]}
      >
        {cycles.data?.items.map((row) => (
          <tr key={row.id}>
            <Cell>{row.shop.name}</Cell>
            <Cell>{row.cycleKey}</Cell>
            <Cell>
              {currency(row.amount)} {row.currency}
            </Cell>
            <Cell>{t(`admin.operations.values.${row.status}`)}</Cell>
            <Cell>{row.externalReference}</Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                {row.status === "requested" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(row.id)}
                  >
                    {t("admin.operations.approve")}
                  </Button>
                ) : null}
                {row.status === "approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPayoutId(row.id)}
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
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pager page={page} total={cycles.data?.total ?? 0} onPage={setPage} />
      {payoutId ? (
        <Editor
          title="recordPaid"
          busy={record.isPending}
          onCancel={() => setPayoutId("")}
          onSubmit={() =>
            record.mutate(undefined, { onSuccess: () => setPayoutId("") })
          }
        >
          <p className="sm:col-span-2 break-all text-sm">{payoutId}</p>
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
    </OperationsFrame>
  );
}
