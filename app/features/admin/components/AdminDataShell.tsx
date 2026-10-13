"use client";

import { useId, useRef, type ReactNode } from "react";
import { RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as {
    status?: number;
    value?: { status?: number; code?: number };
    response?: { status?: number };
  };
  return (
    record.status ?? record.value?.status ?? record.value?.code ?? record.response?.status ?? null
  );
}

export function AdminDataShell(props: {
  title: string;
  description: string;
  icon: typeof SearchIcon;
  search: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  searchHint?: string;
  filters?: ReactNode;
  activeFilters?: ReadonlyArray<{
    id: string;
    label: string;
    value: string;
    onRemove: () => void;
  }>;
  onResetFilters?: () => void;
  isLoading: boolean;
  isFetching?: boolean;
  hasData?: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const searchHintId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const errorStatus = readErrorStatus(props.error);
  const isForbidden = errorStatus === 403;
  const activeFilters = (props.activeFilters ?? []).filter((filter) => filter.value.trim());
  const hasFilters = props.search.trim().length > 0 || activeFilters.length > 0;
  const isRefreshing = props.isFetching && !props.isLoading;
  const showStaleData = props.hasData && props.error && errorStatus !== 401 && !isForbidden;

  return (
    <Card className="admin-panel gap-0 overflow-hidden rounded-xl py-0">
      <CardHeader className="border-b p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <props.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {props.title}
              </CardTitle>
              <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
                {props.description}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={props.isLoading || props.isFetching}
              onClick={props.onRetry}
              aria-label={t("admin.workspace.refresh")}
              className="shrink-0"
            >
              <RefreshCwIcon
                className={isRefreshing ? "size-4 motion-safe:animate-spin" : "size-4"}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{t("admin.workspace.refresh")}</span>
              <span className="sr-only sm:hidden">{t("admin.workspace.refresh")}</span>
            </Button>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative w-full sm:max-w-sm sm:flex-1">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={props.search}
                onChange={(event) => props.onSearchChange(event.target.value)}
                placeholder={props.searchPlaceholder}
                aria-label={props.searchPlaceholder}
                aria-describedby={props.searchHint ? searchHintId : undefined}
                className="h-9 bg-background pl-9 pr-9"
              />
              {props.search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2"
                  onClick={() => {
                    props.onSearchChange("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label={t("admin.table.clearSearch")}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {props.filters}
          </div>
          {props.searchHint ? (
            <p id={searchHintId} className="text-xs text-muted-foreground">
              {props.searchHint}
            </p>
          ) : null}
          {hasFilters ? (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("admin.table.activeFilters")}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {t("admin.table.activeFilters")}
              </span>
              {activeFilters.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-auto max-w-full gap-1.5 rounded-md px-2.5 py-1 text-xs"
                  onClick={() => {
                    filter.onRemove();
                    searchInputRef.current?.focus();
                  }}
                  aria-label={t("admin.table.removeFilter").replace("{filter}", filter.label)}
                >
                  <span className="truncate">
                    {filter.label}: {filter.value}
                  </span>
                  <XIcon className="size-3 shrink-0" aria-hidden="true" />
                </Button>
              ))}
              {props.search.trim() ? (
                <span className="max-w-full truncate rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {props.searchPlaceholder}: {props.search.trim()}
                </span>
              ) : null}
              {props.onResetFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    props.onResetFilters?.();
                    searchInputRef.current?.focus();
                  }}
                >
                  {t("admin.table.resetFilters")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {isRefreshing ? (
            <p className="text-xs text-muted-foreground" role="status">
              {t("admin.table.refreshing")}
            </p>
          ) : null}
        </div>
      </CardHeader>
      {showStaleData ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/10 px-5 py-3"
          role="alert"
        >
          <p className="text-sm text-foreground">{t("admin.table.refreshFailed")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.isFetching}
            onClick={props.onRetry}
          >
            {t("admin.common.retry")}
          </Button>
        </div>
      ) : null}
      {props.isLoading ? (
        <CardContent className="space-y-4 p-5" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full bg-muted" />
          ))}
        </CardContent>
      ) : props.error && !showStaleData ? (
        <CardContent className="flex flex-col items-start gap-3 p-6" role="alert">
          <p className="text-sm text-destructive">
            {isForbidden ? t("admin.operations.forbidden") : t("state.loadErrorTitle")}
          </p>
          <Button variant="outline" size="sm" onClick={props.onRetry}>
            <RefreshCwIcon className="size-4" />
            {t("admin.common.retry")}
          </Button>
        </CardContent>
      ) : (
        props.children
      )}
    </Card>
  );
}
