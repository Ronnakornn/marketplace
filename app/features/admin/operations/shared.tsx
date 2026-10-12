"use client";

import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useTranslations } from "#/i18n/client";

export function OperationsFrame(props: {
  area: string;
  children: ReactNode;
  error?: unknown;
  loading?: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-5">
      <section className="admin-panel rounded-xl p-6">
        <h1 className="text-2xl font-semibold">
          {t(`admin.operations.${props.area}.title`)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(`admin.operations.${props.area}.description`)}
        </p>
      </section>
      {props.loading ? (
        <p role="status">{t("admin.operations.loading")}</p>
      ) : null}
      {props.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
        >
          {operationError(props.error, t)}
        </p>
      ) : null}
      {props.children}
    </div>
  );
}
export function operationError(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 403
  )
    return t("admin.operations.forbidden");
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 409
  )
    return t("admin.operations.conflict");
  return t("admin.operations.failed");
}
export function Field(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  const t = useTranslations();
  return (
    <label className="grid gap-2 text-sm">
      <span>{t(`admin.operations.fields.${props.label}`)}</span>
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        type={props.type ?? "text"}
        required={props.required}
        min={props.min}
        max={props.max}
      />
    </label>
  );
}
export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  const t = useTranslations();
  return (
    <label className="grid gap-2 text-sm">
      <span>{t(`admin.operations.fields.${props.label}`)}</span>
      <select
        className="h-9 rounded-md border bg-background px-3"
        value={props.value}
        onChange={(event) => {
          const value = props.values.find(
            (item) => item === event.target.value,
          );
          if (value) props.onChange(value);
        }}
      >
        {props.values.map((value) => (
          <option key={value} value={value}>
            {t(`admin.operations.values.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
export function CheckField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {t(`admin.operations.fields.${props.label}`)}
    </label>
  );
}
export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const t = useTranslations();
  return (
    <label className="grid gap-2 text-sm">
      <span>{t(`admin.operations.fields.${props.label}`)}</span>
      <textarea
        className="rounded-md border bg-background p-3"
        rows={props.rows ?? 5}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}
export function Editor(props: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  busy?: boolean;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  return (
    <form
      className="admin-panel grid gap-4 rounded-xl p-5"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <h2 className="text-lg font-medium">
        {t(`admin.operations.${props.title}`)}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{props.children}</div>
      <div className="flex gap-2">
        <Button type="submit" disabled={props.busy}>
          {t(props.busy ? "admin.operations.saving" : "admin.operations.save")}
        </Button>
        {props.onCancel ? (
          <Button type="button" variant="outline" onClick={props.onCancel}>
            {t("admin.operations.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
export function Pager(props: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">
        {t("admin.operations.total")}: {props.total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
        >
          {t("admin.operations.previous")}
        </Button>
        <span className="self-center text-sm">{props.page}</span>
        <Button
          variant="outline"
          disabled={props.page * 20 >= props.total}
          onClick={() => props.onPage(props.page + 1)}
        >
          {t("admin.operations.next")}
        </Button>
      </div>
    </div>
  );
}
export function DataTable(props: { headings: string[]; children: ReactNode }) {
  const t = useTranslations();
  return (
    <div className="admin-panel overflow-x-auto rounded-xl">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            {props.headings.map((label) => (
              <th key={label} className="p-3 font-medium">
                {t(`admin.operations.fields.${label}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}
export function Cell(props: { children: ReactNode }) {
  return <td className="border-b p-3 align-top">{props.children}</td>;
}
export function EditButton(props: { onClick: () => void }) {
  const t = useTranslations();
  return (
    <Button size="sm" variant="outline" onClick={props.onClick}>
      {t("admin.operations.edit")}
    </Button>
  );
}
export const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
export const optionalNumber = (value: string) =>
  value === "" ? null : Number(value);
export function toDateInput(value: string | Date | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
export function dateInput(value: string) {
  return value ? new Date(value + ":00.000Z").toISOString() : null;
}
