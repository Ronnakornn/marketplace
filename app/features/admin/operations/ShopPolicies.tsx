"use client";

import { AdminTable } from "../components/AdminTable";

import { useState } from "react";
import { useTranslations, useFormatters } from "#/i18n/client";
import {
  operationsApi,
  useOperationQuery,
  useOperationMutation,
  type PolicyInput,
  type PolicyRow,
} from "./api";
import {
  CheckField,
  EditButton,
  Editor,
  Field,
  OperationsFrame,
  SelectField,
} from "./shared";

export function AdminShopPolicies() {
  const t = useTranslations();
  const { currency: money } = useFormatters();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PolicyRow | null>(null);
  const [form, setForm] = useState<PolicyInput>({
    commissionBps: null,
    dispatchSlaHours: 72,
    deliverySlaHours: 168,
    payoutCadence: "MANUAL",
    payoutMinimum: "0",
    shippingRatesEnabled: false,
    expectedVersion: 0,
    reason: "",
  });
  const rows = useOperationQuery(["policies", page], () =>
    operationsApi["shop-policies"].get({ query: { page, limit: 20 } }),
  );
  const save = useOperationMutation((body: PolicyInput) =>
    operationsApi["shop-policies"]({ id: editing?.id ?? "" }).patch(body),
  );
  function edit(row: PolicyRow) {
    save.reset();
    setEditing(row);
    const policy = row.operationPolicy;
    setForm({
      commissionBps: policy?.commissionBps ?? null,
      dispatchSlaHours: policy?.dispatchSlaHours ?? 72,
      deliverySlaHours: policy?.deliverySlaHours ?? 168,
      payoutCadence:
        policy?.payoutCadence === "DAILY" ||
        policy?.payoutCadence === "WEEKLY" ||
        policy?.payoutCadence === "MONTHLY"
          ? policy.payoutCadence
          : "MANUAL",
      payoutMinimum: policy?.payoutMinimum ?? "0",
      shippingRatesEnabled: policy?.shippingRatesEnabled ?? false,
      expectedVersion: policy?.version ?? 0,
      reason: "",
    });
  }
  return (
    <OperationsFrame
      area="policies"
      loading={rows.isLoading}
      error={save.error ?? rows.error}
    >
      <AdminTable
        isLoading={rows.isLoading}
        data={rows.data?.items ?? []}
        columns={[
          {
            id: "name",
            header: t("admin.operations.fields.name"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.name}</>,
          },
          {
            id: "commissionBps",
            header: t("admin.operations.fields.commissionBps"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {row.operationPolicy?.commissionBps ??
                  t("admin.operations.default")}
              </>
            ),
          },
          {
            id: "dispatchSlaHours",
            header: t("admin.operations.fields.dispatchSlaHours"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{row.operationPolicy?.dispatchSlaHours ?? 72}</>
            ),
          },
          {
            id: "payoutCadence",
            header: t("admin.operations.fields.payoutCadence"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {t(
                  `admin.operations.values.${row.operationPolicy?.payoutCadence ?? "MANUAL"}`,
                )}
              </>
            ),
          },
          {
            id: "payoutMinimum",
            header: t("admin.operations.fields.payoutMinimum"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{money(row.operationPolicy?.payoutMinimum ?? "0", "THB")}</>
            ),
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <EditButton onClick={() => edit(row)} />
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
      {editing ? (
        <Editor
          title="editPolicy"
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          error={save.error ?? rows.error}
          busy={save.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={() =>
            save.mutateAsync(form, { onSuccess: () => setEditing(null) })
          }
        >
          <p className="sm:col-span-2">{editing.name}</p>
          <Field
            label="commissionBps"
            value={form.commissionBps ?? ""}
            type="number"
            min={0}
            max={10000}
            onChange={(value) =>
              setForm({
                ...form,
                commissionBps: value === "" ? null : Number(value),
              })
            }
          />
          <Field
            label="dispatchSlaHours"
            value={form.dispatchSlaHours}
            type="number"
            min={1}
            max={8760}
            onChange={(value) =>
              setForm({ ...form, dispatchSlaHours: Number(value) })
            }
          />
          <Field
            label="deliverySlaHours"
            value={form.deliverySlaHours}
            type="number"
            min={1}
            max={8760}
            onChange={(value) =>
              setForm({ ...form, deliverySlaHours: Number(value) })
            }
          />
          <SelectField
            label="payoutCadence"
            value={form.payoutCadence}
            values={["MANUAL", "DAILY", "WEEKLY", "MONTHLY"]}
            onChange={(value) => setForm({ ...form, payoutCadence: value })}
          />
          <Field
            label="payoutMinimum"
            value={form.payoutMinimum}
            onChange={(value) => setForm({ ...form, payoutMinimum: value })}
          />
          <CheckField
            label="shippingRatesEnabled"
            checked={form.shippingRatesEnabled}
            onChange={(value) =>
              setForm({ ...form, shippingRatesEnabled: value })
            }
          />
          <Field
            label="reason"
            required
            value={form.reason}
            onChange={(value) => setForm({ ...form, reason: value })}
          />
        </Editor>
      ) : null}
    </OperationsFrame>
  );
}
