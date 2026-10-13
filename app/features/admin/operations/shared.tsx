"use client";

import { useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "#/components/ui/native-select";
import { Checkbox } from "#/components/ui/checkbox";
import { Textarea } from "#/components/ui/textarea";
import { useTranslations } from "#/i18n/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "#/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

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
  minLength?: number;
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
        minLength={props.minLength}
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
      <NativeSelect
        value={props.value}
        onChange={(event) => {
          const value = props.values.find(
            (item) => item === event.target.value,
          );
          if (value) props.onChange(value);
        }}
      >
        {props.values.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {t(`admin.operations.values.${value}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
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
      <Checkbox
        checked={props.checked}
        onCheckedChange={(checked) => props.onChange(checked === true)}
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
      <Textarea
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
  onSubmit: () => void | Promise<unknown>;
  busy?: boolean;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  error?: unknown;
  triggerLabel?: string;
  submitLabel?: string;
  description?: string;
}) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const submittingRef = useRef(false);
  const isBusy = Boolean(props.busy || submitting);
  function changeOpen(open: boolean) {
    if (isBusy || submittingRef.current) return;
    setSubmitError(null);
    setInternalOpen(open);
    props.onOpenChange?.(open);
    if (!open) props.onCancel?.();
  }
  return (
    <Sheet open={props.open ?? internalOpen} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button type="button" className="w-fit" disabled={isBusy}>
          <Plus className="size-4" aria-hidden="true" />
          {t(`admin.operations.${props.triggerLabel ?? props.title}`)}
        </Button>
      </SheetTrigger>
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b px-5 py-5 pr-14">
          <SheetTitle className="text-xl">
            {t(`admin.operations.${props.title}`)}
          </SheetTitle>
          <SheetDescription>
            {t(`admin.operations.${props.description ?? "editorDescription"}`)}
          </SheetDescription>
        </SheetHeader>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          aria-label={t("admin.operations.cancel")}
          disabled={isBusy}
          onClick={() => changeOpen(false)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            if (isBusy || submittingRef.current) return;
            submittingRef.current = true;
            setSubmitting(true);
            setSubmitError(null);
            try {
              await props.onSubmit();
            } catch (error) {
              setSubmitError(error);
            } finally {
              submittingRef.current = false;
              setSubmitting(false);
            }
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {props.error || submitError ? (
              <p
                role="alert"
                className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
              >
                {operationError(props.error ?? submitError, t)}
              </p>
            ) : null}
            <fieldset
              disabled={isBusy}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              {props.children}
            </fieldset>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => changeOpen(false)}
            >
              {t("admin.operations.cancel")}
            </Button>
            <Button type="submit" disabled={isBusy}>
              {t(
                `admin.operations.${isBusy ? "saving" : (props.submitLabel ?? "save")}`,
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
export function OperationConfirmation(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  target: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: unknown;
  destructive?: boolean;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!props.busy) props.onOpenChange(open);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="motion-reduce:animate-none"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          aria-label={t("admin.operations.cancel")}
          disabled={props.busy}
          onClick={() => props.onOpenChange(false)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
        <DialogHeader>
          <DialogTitle>{t(`admin.operations.${props.title}`)}</DialogTitle>
          <DialogDescription>
            {t("admin.operations.confirmDescription")}
          </DialogDescription>
        </DialogHeader>
        <p className="break-words font-medium">{props.target}</p>
        {props.error ? (
          <p role="alert" className="text-sm text-destructive">
            {operationError(props.error, t)}
          </p>
        ) : null}
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!props.busy && props.reason.trim().length >= 3)
              props.onConfirm();
          }}
        >
          <Field
            label="reason"
            value={props.reason}
            required
            minLength={3}
            onChange={props.onReasonChange}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={props.busy}
              onClick={() => props.onOpenChange(false)}
            >
              {t("admin.operations.cancel")}
            </Button>
            <Button
              type="submit"
              variant={props.destructive ? "destructive" : "default"}
              disabled={props.busy || props.reason.trim().length < 3}
            >
              {t(`admin.operations.${props.busy ? "saving" : props.title}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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
