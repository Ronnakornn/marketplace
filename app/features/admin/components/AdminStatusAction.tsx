"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { useTranslations } from "#/i18n/client";

export function AdminStatusAction(props: {
  label: string;
  currentStatus: string;
  options: readonly string[];
  disabled?: boolean;
  isPending: boolean;
  onConfirm: (status: string) => void;
}) {
  const t = useTranslations();
  const [nextStatus, setNextStatus] = useState("");
  const [open, setOpen] = useState(false);

  const selectable = props.options.filter((status) => status !== props.currentStatus);

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={nextStatus}
          onValueChange={(value) => {
            setNextStatus(value);
            setOpen(true);
          }}
          disabled={props.disabled || props.isPending}
        >
          <SelectTrigger className="h-9 w-36 border-white/10 bg-slate-950/60 text-slate-100">
            <SelectValue placeholder={t("admin.common.update")} />
          </SelectTrigger>
          <SelectContent>
            {selectable.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`admin.statuses.${status}` as Parameters<typeof t>[0]) === `admin.statuses.${status}` ? status.replaceAll("_", " ") : t(`admin.statuses.${status}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {props.isPending ? <Loader2Icon className="size-4 animate-spin text-cyan-200" /> : null}
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmStatusChange")}</AlertDialogTitle>
            <AlertDialogDescription>
              Change {props.label} from {props.currentStatus.replaceAll("_", " ")} to {nextStatus.replaceAll("_", " ")}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNextStatus("")}>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  props.onConfirm(nextStatus);
                  setOpen(false);
                  setNextStatus("");
                }}
                disabled={!nextStatus || props.isPending}
              >
                {t("admin.common.confirm")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
