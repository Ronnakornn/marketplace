"use client";

import type { ReactNode } from "react";
import { RefreshCwIcon, SearchIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: number; value?: { status?: number; code?: number }; response?: { status?: number } };
  return record.status ?? record.value?.status ?? record.value?.code ?? record.response?.status ?? null;
}

export function AdminDataShell(props: {
  title: string;
  description: string;
  icon: typeof SearchIcon;
  search: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  filters?: ReactNode;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  if (props.isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-24 rounded-xl bg-white/10" />
        <Skeleton className="h-96 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (props.error) {
    const isForbidden = readErrorStatus(props.error) === 403;
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="text-sm text-red-200">
            {isForbidden ? t("state.loadErrorTitle") : t("state.loadErrorTitle")}
          </p>
          <Button variant="outline" size="sm" className="w-fit border-white/12 bg-white/5 text-slate-100" onClick={props.onRetry}>
            <RefreshCwIcon className="size-4" />
            {t("admin.common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
      <CardHeader className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <props.icon className="size-5 text-cyan-200" />
              {props.title}
            </CardTitle>
            <p className="mt-2 text-sm text-slate-400">{props.description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 md:flex-row xl:w-auto">
            <div className="relative w-full md:min-w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={props.search}
                onChange={(event) => props.onSearchChange(event.target.value)}
                placeholder={props.searchPlaceholder}
                className="border-white/10 bg-slate-950/60 pl-9 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            {props.filters}
          </div>
        </div>
      </CardHeader>
      {props.children}
    </Card>
  );
}
