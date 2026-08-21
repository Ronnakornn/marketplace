"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CommandIcon,
  BellIcon,
  BadgePercentIcon,
  BanknoteIcon,
  BarChart3Icon,
  Building2Icon,
  FileClockIcon,
  LinkIcon,
  LayoutDashboardIcon,
  ChevronUpIcon,
  CreditCardIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  MenuIcon,
  MoonIcon,
  PackageSearchIcon,
  MessageSquareWarningIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ShoppingBagIcon,
  SunIcon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { signOut } from "#/lib/auth-client";
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
    title: "admin.nav.dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboardIcon,
    match: (pathname: string) => pathname === "/admin" || pathname === "/admin/dashboard",
  },
  {
    title: "admin.nav.users",
    href: "/admin/users",
    icon: ShieldCheckIcon,
    match: (pathname: string) => pathname.startsWith("/admin/users"),
  },
  {
    title: "admin.nav.shops",
    href: "/admin/shops",
    icon: Building2Icon,
    match: (pathname: string) => pathname.startsWith("/admin/shops"),
  },
  {
    title: "admin.nav.products",
    href: "/admin/products",
    icon: PackageSearchIcon,
    match: (pathname: string) => pathname.startsWith("/admin/products") || pathname.startsWith("/admin/catalog"),
  },
  {
    title: "admin.nav.contentModeration",
    href: "/admin/content-moderation",
    icon: MessageSquareWarningIcon,
    match: (pathname: string) => pathname.startsWith("/admin/content-moderation"),
  },
  {
    title: "admin.nav.orders",
    href: "/admin/orders",
    icon: ShoppingBagIcon,
    match: (pathname: string) => pathname.startsWith("/admin/orders"),
  },
  {
    title: "admin.nav.refunds",
    href: "/admin/refunds",
    icon: RotateCcwIcon,
    match: (pathname: string) => pathname.startsWith("/admin/refunds"),
  },
  {
    title: "admin.nav.returns",
    href: "/admin/returns",
    icon: Undo2Icon,
    match: (pathname: string) => pathname.startsWith("/admin/returns"),
  },
  {
    title: "admin.nav.payouts",
    href: "/admin/payouts",
    icon: BanknoteIcon,
    match: (pathname: string) => pathname.startsWith("/admin/payouts"),
  },
  {
    title: "admin.nav.commissions",
    href: "/admin/commissions",
    icon: BadgePercentIcon,
    match: (pathname: string) => pathname.startsWith("/admin/commissions"),
  },
  {
    title: "admin.nav.affiliates",
    href: "/admin/affiliates",
    icon: LinkIcon,
    match: (pathname: string) => pathname.startsWith("/admin/affiliates"),
  },
  {
    title: "admin.nav.fraud",
    href: "/admin/fraud",
    icon: ShieldAlertIcon,
    match: (pathname: string) => pathname.startsWith("/admin/fraud"),
  },
  {
    title: "admin.nav.auditLogs",
    href: "/admin/audit-logs",
    icon: FileClockIcon,
    match: (pathname: string) => pathname.startsWith("/admin/audit-logs"),
  },
  {
    title: "admin.nav.reports",
    href: "/admin/reports",
    icon: BarChart3Icon,
    match: (pathname: string) => pathname.startsWith("/admin/reports"),
  },
  {
    title: "admin.nav.settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    match: (pathname: string) => pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/profile"),
  },
] as const;

function getPageTitle(pathname: string) {
  return (
    ADMIN_NAV_ITEMS.find((item) => item.match(pathname))?.title ?? "admin.brand"
  );
}

export function AdminSidebarNav({
  user,
  children,
}: AdminSidebarNavProps) {
  const t = useTranslations();
  const router = useRouter();
  const localePath = useLocalePath();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(window.localStorage.getItem("admin-theme") === "dark" ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("admin-theme", nextTheme);
  }

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/login"));
  }

  return (
    <SidebarProvider defaultOpen data-admin-theme={theme}>
      <Sidebar
        variant="inset"
        collapsible="icon"
        className="border-r bg-sidebar md:p-2"
      >
        <SidebarHeader className="px-3 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-3 no-underline"
          >
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold text-foreground">
                {t("admin.brand")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("admin.navigation")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href} className="relative">
                    {item.match(pathname) ? (
                      <motion.span
                        layoutId="admin-nav-active"
                        className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary"
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
                      tooltip={t(item.title)}
                      className="rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{t(item.title)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="space-y-2 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={`${user.name} · ${user.email}`} className="h-auto min-h-12 border border-sidebar-border bg-sidebar px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent">
                <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-primary/15 text-primary">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
                <ChevronUpIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
              <DropdownMenuLabel className="font-normal"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href={localePath("/admin/profile")}><ShieldCheckIcon />{t("common.account")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href={localePath("/admin/payouts")}><CreditCardIcon />{t("common.billing")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href={localePath("/admin/settings")}><BellIcon />{t("common.notifications")}</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}><LogOutIcon />{t("common.logout")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            onClick={toggleTheme}
            aria-label={theme === "light" ? t("admin.common.darkMode") : t("admin.common.lightMode")}
          >
            {theme === "light" ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
            <span className="group-data-[collapsible=icon]:hidden">{theme === "light" ? t("admin.common.darkMode") : t("admin.common.lightMode")}</span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <div className="relative flex min-h-screen w-full min-w-0 flex-col px-4 pb-8 pt-6 md:px-6">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <SidebarTrigger className="h-10 w-10 rounded-md border bg-background text-foreground">
              <MenuIcon className="size-4" />
              <span className="sr-only">{t("admin.openAdminNavigation")}</span>
            </SidebarTrigger>
            <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              <CommandIcon className="size-3.5" />
              {t(getPageTitle(pathname))}
            </div>
          </div>
          <div className="mb-5 hidden md:flex">
            <SidebarTrigger className="h-10 rounded-md border bg-background px-4 text-foreground hover:bg-accent">
              <PanelLeftCloseIcon className="size-4" />
              <span>{t("admin.toggleSidebar")}</span>
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
