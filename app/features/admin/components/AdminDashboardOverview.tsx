"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  RefreshCwIcon,
  Building2Icon,
  BanknoteIcon,
  PackageSearchIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  UsersIcon,
  Undo2Icon,
} from "lucide-react";
import { Card, CardContent } from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { useAdminDashboard } from "../hooks/useAdminOperations";
import { AdminPageIntro } from "./AdminPageIntro";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useAdminAccess } from "#/features/admin/access/useAdminAccess";
import { canVisitAdminPath } from "#/features/admin/operations/navigation";
import { useLocalePath } from "#/i18n/navigation";
import { AdminAnalytics } from "../reporting/AdminAnalytics";

interface AdminDashboardOverviewProps {
  userName: string;
  heroVisual?: ReactNode;
}

const quickLinks = [
  {
    title: "manageUsers",
    description: "manageUsersDescription",
    href: "/admin/users",
    icon: UsersIcon,
  },
  {
    title: "moderateProducts",
    description: "moderateProductsDescription",
    href: "/admin/products",
    icon: PackageSearchIcon,
  },
  {
    title: "monitorOrders",
    description: "monitorOrdersDescription",
    href: "/admin/orders",
    icon: ReceiptTextIcon,
  },
  {
    title: "resolveReturns",
    description: "resolveReturnsDescription",
    href: "/admin/returns",
    icon: Undo2Icon,
  },
  {
    title: "approvePayouts",
    description: "approvePayoutsDescription",
    href: "/admin/payouts",
    icon: BanknoteIcon,
  },
  {
    title: "reviewFraud",
    description: "reviewFraudDescription",
    href: "/admin/fraud",
    icon: ShieldAlertIcon,
  },
] as const;

const summaryCards = [
  { key: "users", title: "users", icon: UsersIcon },
  { key: "shops", title: "shops", icon: Building2Icon },
  { key: "products", title: "products", icon: PackageSearchIcon },
  { key: "orders", title: "orders", icon: ReceiptTextIcon },
  { key: "refunds", title: "pendingRefunds", icon: RotateCcwIcon },
] as const;

const exceptionCards = [
  {
    key: "pendingPayments",
    title: "pendingPayments",
    href: "/admin/orders?paymentState=PENDING",
    icon: ReceiptTextIcon,
  },
  {
    key: "failedPayments",
    title: "failedPayments",
    href: "/admin/orders?paymentState=FAILED",
    icon: ReceiptTextIcon,
  },
  {
    key: "delayedShipments",
    title: "delayedShipments",
    href: "/admin/orders?shipmentState=DELAYED",
    icon: PackageSearchIcon,
  },
  {
    key: "returnEscalations",
    title: "returnEscalations",
    href: "/admin/returns",
    icon: Undo2Icon,
  },
  {
    key: "refundEscalations",
    title: "refundEscalations",
    href: "/admin/refunds",
    icon: RotateCcwIcon,
  },
  {
    key: "payoutApprovals",
    title: "payoutApprovals",
    href: "/admin/payouts",
    icon: BanknoteIcon,
  },
  {
    key: "fraudOpen",
    title: "openFraudCases",
    href: "/admin/fraud",
    icon: ShieldAlertIcon,
  },
] as const;

export function AdminDashboardOverview({
  userName,
  heroVisual,
}: AdminDashboardOverviewProps) {
  const t = useTranslations();
  const format = useFormatters();
  const access = useAdminAccess();
  const localePath = useLocalePath();
  const permittedLinks = quickLinks.filter((item) =>
    canVisitAdminPath(access.data?.permissions, item.href),
  );
  const permittedExceptions = exceptionCards.filter((item) =>
    canVisitAdminPath(access.data?.permissions, item.href),
  );
  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useAdminDashboard();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow={t("admin.overview.eyebrow")}
        title={t("admin.overview.welcome").replace("{name}", userName)}
        description={t("admin.workspace.dashboardDescription")}
      >
        {heroVisual}
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || isRefetching}
          onClick={() => void refetch()}
        >
          <RefreshCwIcon
            className={isRefetching ? "size-4 animate-spin" : "size-4"}
          />
          {t("admin.workspace.refresh")}
        </Button>
      </AdminPageIntro>

      {error ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {t("admin.overview.unableToLoad")}
        </div>
      ) : null}

      {permittedExceptions.length > 0 ? (
        <section aria-labelledby="admin-work-queue">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2
              id="admin-work-queue"
              className="text-base font-semibold text-foreground"
            >
              {t("admin.workspace.attention")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.workspace.attentionDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {permittedExceptions.map((item) => {
              const value = dashboard?.exceptions?.[item.key];
              const hasItems = !error && value !== undefined && value > 0;
              return (
                <Link
                  key={item.key}
                  href={localePath(item.href)}
                  className={`admin-panel group rounded-xl p-4 no-underline transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${hasItems ? "admin-attention-card" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <item.icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <ArrowRightIcon
                      className="size-3.5 text-muted-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`admin.overview.${item.title}`)}
                  </p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-16 bg-muted" />
                  ) : (
                    <p
                      className={`mt-1 text-2xl font-semibold tabular-nums ${hasItems ? "text-primary" : "text-foreground"}`}
                    >
                      {error || value === undefined
                        ? t("admin.workspace.unavailable")
                        : format.number(value)}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="admin-marketplace-summary">
        <h2
          id="admin-marketplace-summary"
          className="mb-3 text-base font-semibold text-foreground"
        >
          {t("admin.workspace.summary")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((item) => {
            const value =
              item.key === "refunds"
                ? dashboard?.refunds.pending
                : dashboard?.[item.key].total;
            return (
              <Card
                key={item.key}
                className="admin-panel gap-0 rounded-xl py-0"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t(`admin.overview.${item.title}`)}
                    </p>
                    <item.icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  {isLoading ? (
                    <Skeleton className="mt-3 h-8 w-20 bg-muted" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                      {error || value === undefined
                        ? t("admin.workspace.unavailable")
                        : format.number(value)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("admin.overview.marketplaceTotal")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {access.data?.permissions.includes("reports.read") ? (
        <AdminAnalytics compact />
      ) : null}

      {permittedLinks.length > 0 ? (
        <section aria-labelledby="admin-quick-links">
          <h2
            id="admin-quick-links"
            className="mb-3 text-base font-semibold text-foreground"
          >
            {t("admin.workspace.quickLinks")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {permittedLinks.map((item) => (
              <Link
                key={item.href}
                href={localePath(item.href)}
                className="admin-panel group flex items-start gap-3 rounded-xl p-4 no-underline hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground">
                    {t(`admin.overview.${item.title}`)}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t(`admin.overview.${item.description}`)}
                  </p>
                </div>
                <ArrowRightIcon
                  className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
