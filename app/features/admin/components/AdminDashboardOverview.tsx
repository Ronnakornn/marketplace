"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRightIcon,
  Building2Icon,
  BanknoteIcon,
  PackageSearchIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  UsersIcon,
  Undo2Icon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { useAdminDashboard } from "../hooks/useAdminOperations";
import { AdminPageIntro } from "./AdminPageIntro";
import { useTranslations } from "#/i18n/client";

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
  { key: "pendingPayments", title: "pendingPayments", href: "/admin/orders", icon: ReceiptTextIcon },
  { key: "failedPayments", title: "failedPayments", href: "/admin/orders", icon: ReceiptTextIcon },
  { key: "delayedShipments", title: "delayedShipments", href: "/admin/orders", icon: PackageSearchIcon },
  { key: "returnEscalations", title: "returnEscalations", href: "/admin/returns", icon: Undo2Icon },
  { key: "refundEscalations", title: "refundEscalations", href: "/admin/refunds", icon: RotateCcwIcon },
  { key: "payoutApprovals", title: "payoutApprovals", href: "/admin/payouts", icon: BanknoteIcon },
  { key: "fraudOpen", title: "openFraudCases", href: "/admin/fraud", icon: ShieldAlertIcon },
] as const;

function AdminDashboardLinkSkeleton() {
  return (
    <div className="admin-panel rounded-2xl px-5 py-5">
      <Skeleton className="mb-4 h-11 w-11 rounded-xl bg-cyan-300/12" />
      <Skeleton className="h-6 w-36 bg-white/12" />
      <Skeleton className="mt-3 h-4 w-full bg-white/10" />
      <Skeleton className="mt-2 h-4 w-4/5 bg-white/10" />
      <Skeleton className="mt-5 h-4 w-16 bg-cyan-300/12" />
    </div>
  );
}

export function AdminDashboardOverview({
  userName,
  heroVisual,
}: AdminDashboardOverviewProps) {
  const t = useTranslations();
  const { data: dashboard, isLoading, error } = useAdminDashboard();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow={t("admin.overview.eyebrow")}
        title={t("admin.overview.welcome").replace("{name}", userName)}
        description={t("admin.overview.description")}
      >
        {heroVisual}
      </AdminPageIntro>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {exceptionCards.map((item, index) => {
          const value = dashboard?.exceptions?.[item.key] ?? 0;
          return (
            <motion.div
              key={item.key}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { duration: 0.35, delay: index * 0.03 }}
            >
              <Link href={item.href} className="admin-panel block rounded-lg border border-white/10 bg-white/5 px-4 py-4 no-underline">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{t(`admin.overview.${item.title}` as Parameters<typeof t>[0])}</p>
                    {isLoading ? <Skeleton className="mt-3 h-8 w-16 bg-white/12" /> : <p className="mt-2 text-3xl font-semibold text-white">{value}</p>}
                  </div>
                  <item.icon className="size-5 text-cyan-200" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((item, index) => {
          const value = item.key === "refunds" ? dashboard?.refunds.pending : dashboard?.[item.key].total;
          return (
            <motion.div
              key={item.key}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { duration: 0.45, delay: 0.08 + index * 0.04 }}
            >
              <Card className="admin-panel rounded-lg border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <item.icon className="size-5" />
                    {t(`admin.overview.${item.title}` as Parameters<typeof t>[0])}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-10 w-20 bg-white/12" />
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-white">{value ?? 0}</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {error ? t("admin.overview.unableToLoad") : t("admin.overview.marketplaceTotal")}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? quickLinks.map((item) => (
              <AdminDashboardLinkSkeleton key={item.href} />
            ))
          : quickLinks.map((item, index) => (
              <motion.div
                key={item.href}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 0.4, delay: 0.18 + index * 0.05 }
                }
              >
                <Link
                  href={item.href}
                  className="admin-panel group block rounded-2xl px-5 py-5 no-underline"
                >
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-200">
                    <item.icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{t(`admin.overview.${item.title}` as Parameters<typeof t>[0])}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {t(`admin.overview.${item.description}` as Parameters<typeof t>[0])}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-200 transition group-hover:translate-x-1">
                    {t("admin.common.open")}
                    <ArrowRightIcon className="size-4" />
                  </span>
                </Link>
              </motion.div>
            ))}
      </section>
    </div>
  );
}
