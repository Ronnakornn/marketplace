"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { useTranslations } from "#/i18n/client";

type RequiredActionField = {
  label: string;
  helper: string;
  minLength: number;
  maxLength: number;
  multiline?: boolean;
};

function actionErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  if ("message" in error && typeof error.message === "string") return error.message;
  if ("value" in error) return actionErrorMessage(error.value, fallback);
  if ("error" in error) return actionErrorMessage(error.error, fallback);
  return fallback;
}

export function AdminActionDialog(props: {
  action: string;
  description: string;
  target: string;
  recordId: string;
  amount: string;
  currency: string;
  field?: RequiredActionField;
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: (value: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const trimmedValue = value.trim();
  const valid = !props.field || (
    trimmedValue.length >= props.field.minLength && trimmedValue.length <= props.field.maxLength
  );
  const pending = submitting || props.isPending;

  const close = () => {
    if (!submissionLock.current && !props.isPending) props.onClose();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || submissionLock.current || props.isPending) return;
    submissionLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      await props.onConfirm(trimmedValue);
      props.onClose();
    } catch (failure) {
      setError(actionErrorMessage(failure, t("admin.financialAction.failed")));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const fieldProps = props.field ? {
    id: inputId,
    value,
    required: true,
    minLength: props.field.minLength,
    maxLength: props.field.maxLength,
    disabled: Boolean(pending),
    "aria-describedby": `${inputId}-helper`,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value),
  } : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent showCloseButton={!pending} className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5" aria-busy={Boolean(pending)}>
          <DialogHeader>
            <DialogTitle>{props.action}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          <dl className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <div><dt className="text-muted-foreground">{t("admin.financialAction.target")}</dt><dd className="mt-1 break-words font-medium">{props.target}</dd></div>
            <div><dt className="text-muted-foreground">{t("admin.financialAction.recordId")}</dt><dd className="mt-1 break-all font-mono text-xs">{props.recordId}</dd></div>
            <div><dt className="text-muted-foreground">{t("admin.financialAction.amount")}</dt><dd className="mt-1 font-semibold tabular-nums">{props.amount.includes(props.currency) ? props.amount : `${props.amount} ${props.currency}`}</dd></div>
          </dl>
          {props.field && fieldProps ? (
            <div className="space-y-2">
              <Label htmlFor={inputId}>{props.field.label}</Label>
              {props.field.multiline ? <Textarea {...fieldProps} className="min-h-24" /> : <Input {...fieldProps} />}
              <p id={`${inputId}-helper`} className="text-xs text-muted-foreground">{props.field.helper}</p>
            </div>
          ) : null}
          {error ? <p role="alert" className="break-words text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={close}>{t("admin.common.cancel")}</Button>
            <Button type="submit" variant={props.destructive ? "destructive" : "default"} disabled={!valid || Boolean(pending)}>
              {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? t("admin.financialAction.confirming") : props.action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
