"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRightIcon,
  PackageSearchIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { useAdminUsers } from "#/features/user";
import { isAdminRole } from "#/lib/roles";
import { AdminPageIntro } from "./AdminPageIntro";

interface AdminDashboardOverviewProps {
  userName: string;
  heroVisual?: ReactNode;
}

const quickLinks = [
  {
    title: "Manage users",
    description: "Create accounts, update roles, and remove access.",
    href: "/admin/users",
    icon: UsersIcon,
  },
  {
    title: "Manage catalog",
    description: "Create products, variants, and inventory records.",
    href: "/admin/catalog",
    icon: PackageSearchIcon,
  },
  {
    title: "Open profile",
    description: "Review the account details for the current admin.",
    href: "/admin/profile",
    icon: UserCircleIcon,
  },
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
  const { data: users = [], isLoading, error } = useAdminUsers();
  const prefersReducedMotion = useReducedMotion();

  const adminCount = users.filter((user) => isAdminRole(user.role)).length;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Mission Control"
        title={`Welcome back, ${userName}`}
        description="Track admin access and marketplace operations from a single orbital console."
      >
        {heroVisual}
      </AdminPageIntro>

      <section className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 0.45, delay: 0.08 }
          }
        >
          <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <UsersIcon className="size-5" />
                Total users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className="h-10 w-20 bg-white/12" />
                  <Skeleton className="mt-3 h-4 w-52 bg-white/10" />
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white">
                    {users.length}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {error
                      ? "Unable to load user totals right now."
                      : "All accounts available in the system."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 0.45, delay: 0.14 }
          }
        >
          <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheckIcon className="size-5" />
                Admin users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className="h-10 w-20 bg-white/12" />
                  <Skeleton className="mt-3 h-4 w-44 bg-white/10" />
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white">
                    {adminCount}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Active accounts with administrator access.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
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
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {item.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-200 transition group-hover:translate-x-1">
                    Open
                    <ArrowRightIcon className="size-4" />
                  </span>
                </Link>
              </motion.div>
            ))}
      </section>
    </div>
  );
}
