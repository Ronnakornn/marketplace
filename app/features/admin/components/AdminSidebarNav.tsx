"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CommandIcon,
  BanknoteIcon,
  BarChart3Icon,
  Building2Icon,
  FileClockIcon,
  LinkIcon,
  LayoutDashboardIcon,
  PanelLeftCloseIcon,
  MenuIcon,
  PackageSearchIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ShoppingBagIcon,
  Undo2Icon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "#/components/ui/sidebar";

interface AdminSidebarNavProps {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };
  children: ReactNode;
}

const ADMIN_NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboardIcon,
    match: (pathname: string) => pathname === "/admin" || pathname === "/admin/dashboard",
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: ShieldCheckIcon,
    match: (pathname: string) => pathname.startsWith("/admin/users"),
  },
  {
    title: "Shops",
    href: "/admin/shops",
    icon: Building2Icon,
    match: (pathname: string) => pathname.startsWith("/admin/shops"),
  },
  {
    title: "Products",
    href: "/admin/products",
    icon: PackageSearchIcon,
    match: (pathname: string) => pathname.startsWith("/admin/products") || pathname.startsWith("/admin/catalog"),
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingBagIcon,
    match: (pathname: string) => pathname.startsWith("/admin/orders"),
  },
  {
    title: "Refunds",
    href: "/admin/refunds",
    icon: RotateCcwIcon,
    match: (pathname: string) => pathname.startsWith("/admin/refunds"),
  },
  {
    title: "Returns",
    href: "/admin/returns",
    icon: Undo2Icon,
    match: (pathname: string) => pathname.startsWith("/admin/returns"),
  },
  {
    title: "Payouts",
    href: "/admin/payouts",
    icon: BanknoteIcon,
    match: (pathname: string) => pathname.startsWith("/admin/payouts") || pathname.startsWith("/admin/commissions"),
  },
  {
    title: "Affiliates",
    href: "/admin/affiliates",
    icon: LinkIcon,
    match: (pathname: string) => pathname.startsWith("/admin/affiliates"),
  },
  {
    title: "Fraud",
    href: "/admin/fraud",
    icon: ShieldAlertIcon,
    match: (pathname: string) => pathname.startsWith("/admin/fraud"),
  },
  {
    title: "Audit Logs",
    href: "/admin/audit-logs",
    icon: FileClockIcon,
    match: (pathname: string) => pathname.startsWith("/admin/audit-logs"),
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: BarChart3Icon,
    match: (pathname: string) => pathname.startsWith("/admin/reports"),
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    match: (pathname: string) => pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/profile"),
  },
] as const;

function getPageTitle(pathname: string) {
  return (
    ADMIN_NAV_ITEMS.find((item) => item.match(pathname))?.title ?? "Admin"
  );
}

export function AdminSidebarNav({
  user,
  children,
}: AdminSidebarNavProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        variant="inset"
        collapsible="icon"
        className="border-r-0 bg-transparent md:p-3"
      >
        <SidebarHeader className="px-3 py-4">
          <Link
            href="/admin"
            className="admin-panel flex items-center gap-3 rounded-2xl px-3 py-3 no-underline"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-200">
              <ShieldCheckIcon className="size-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold text-white">
                Galaxy Control
              </p>
              <p className="truncate text-xs text-slate-300">
                {user.email}
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href} className="relative">
                    {item.match(pathname) ? (
                      <motion.span
                        layoutId="admin-nav-active"
                        className="absolute inset-y-1 left-0 w-1 rounded-full bg-[linear-gradient(180deg,rgba(103,232,249,1),rgba(168,85,247,0.95))] shadow-[0_0_18px_rgba(103,232,249,0.8)]"
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : { type: "spring", stiffness: 380, damping: 32 }
                        }
                      />
                    ) : null}
                    <SidebarMenuButton
                      asChild
                      isActive={item.match(pathname)}
                      tooltip={item.title}
                      className="rounded-xl text-slate-300 hover:bg-white/6 hover:text-white data-[active=true]:bg-[linear-gradient(90deg,rgba(34,211,238,0.18),rgba(168,85,247,0.12))] data-[active=true]:text-cyan-100 data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_26px_rgba(34,211,238,0.08)]"
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-3">
          <div className="admin-panel rounded-2xl px-3 py-3 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-white">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-300">
              {user.role ?? "ADMIN"}
            </p>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <div className="relative flex min-h-screen w-full min-w-0 flex-col px-4 pb-8 pt-6 md:px-6">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <SidebarTrigger className="h-10 w-10 rounded-full border border-white/12 bg-slate-950/70 text-slate-100 backdrop-blur-md">
              <MenuIcon className="size-4" />
              <span className="sr-only">Open admin navigation</span>
            </SidebarTrigger>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm">
              <CommandIcon className="size-3.5 text-cyan-200" />
              {getPageTitle(pathname)}
            </div>
          </div>
          <div className="mb-5 hidden md:flex">
            <SidebarTrigger className="h-10 rounded-full border border-white/12 bg-slate-950/60 px-4 text-slate-100 backdrop-blur-md hover:bg-white/10">
              <PanelLeftCloseIcon className="size-4" />
              <span>Toggle Sidebar</span>
            </SidebarTrigger>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="min-w-0 flex-1"
              key={pathname}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.32, ease: "easeOut" }
              }
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
