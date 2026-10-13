"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgePercentIcon,
  BanknoteIcon,
  BarChart3Icon,
  BellIcon,
  BoltIcon,
  Building2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileClockIcon,
  LayoutDashboardIcon,
  LinkIcon,
  LogOutIcon,
  MoonIcon,
  PackageSearchIcon,
  MessageSquareWarningIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SunIcon,
  Undo2Icon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "#/components/ui/sidebar";
import { useTranslations } from "#/i18n/client";
import { useAdminAccess } from "#/features/admin/access/useAdminAccess";
import {
  adminPath,
  canVisitAdminPath,
} from "#/features/admin/operations/navigation";
import { useLocalePath } from "#/i18n/navigation";
import { signOut } from "#/lib/auth-client";

interface AdminSidebarNavProps {
  user: { id: string; name: string; email: string; role?: string | null };
  children: ReactNode;
}

interface AdminNavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  aliases?: readonly string[];
}

interface AdminNavigationGroup {
  title: string;
  items: readonly AdminNavigationItem[];
}

const ADMIN_NAV_GROUPS: readonly AdminNavigationGroup[] = [
  {
    title: "admin.workspace.groups.overview",
    items: [
      {
        title: "admin.nav.dashboard",
        href: "/admin/dashboard",
        icon: LayoutDashboardIcon,
        aliases: ["/admin"],
      },
      {
        title: "admin.nav.reports",
        href: "/admin/reports",
        icon: BarChart3Icon,
      },
      {
        title: "admin.integration.nav.schedules",
        href: "/admin/report-schedules",
        icon: FileClockIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.marketplace",
    items: [
      { title: "admin.nav.users", href: "/admin/users", icon: UsersIcon },
      { title: "admin.nav.shops", href: "/admin/shops", icon: Building2Icon },
      {
        title: "admin.integration.nav.shopPolicies",
        href: "/admin/shop-policies",
        icon: SettingsIcon,
      },
      {
        title: "admin.nav.products",
        href: "/admin/products",
        icon: PackageSearchIcon,
        aliases: ["/admin/catalog"],
      },
      {
        title: "admin.integration.nav.categories",
        href: "/admin/categories",
        icon: PackageSearchIcon,
      },
      {
        title: "admin.integration.nav.imports",
        href: "/admin/catalog/imports",
        icon: PackageSearchIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.orders",
    items: [
      {
        title: "admin.nav.orders",
        href: "/admin/orders",
        icon: ShoppingBagIcon,
      },
      {
        title: "admin.integration.nav.shipping",
        href: "/admin/shipping",
        icon: ShoppingBagIcon,
      },
      {
        title: "admin.integration.nav.documents",
        href: "/admin/order-documents",
        icon: FileClockIcon,
      },
      { title: "admin.nav.returns", href: "/admin/returns", icon: Undo2Icon },
      {
        title: "admin.nav.refunds",
        href: "/admin/refunds",
        icon: RotateCcwIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.finance",
    items: [
      {
        title: "admin.integration.nav.finance",
        href: "/admin/finance",
        icon: CreditCardIcon,
      },
      {
        title: "admin.nav.payouts",
        href: "/admin/payouts",
        icon: BanknoteIcon,
      },
      {
        title: "admin.integration.nav.reconciliation",
        href: "/admin/reconciliation",
        icon: CreditCardIcon,
      },
      {
        title: "admin.nav.commissions",
        href: "/admin/commissions",
        icon: BadgePercentIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.content",
    items: [
      {
        title: "admin.integration.nav.marketing",
        href: "/admin/marketing",
        icon: BadgePercentIcon,
      },
      {
        title: "admin.nav.flashSales",
        href: "/admin/flash-sales",
        icon: BoltIcon,
      },
      {
        title: "admin.nav.affiliates",
        href: "/admin/affiliates",
        icon: LinkIcon,
      },
      {
        title: "admin.integration.nav.content",
        href: "/admin/content",
        icon: FileClockIcon,
      },
      {
        title: "admin.nav.contentModeration",
        href: "/admin/content-moderation",
        icon: MessageSquareWarningIcon,
      },
      {
        title: "admin.integration.nav.templates",
        href: "/admin/templates",
        icon: BellIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.trust",
    items: [
      {
        title: "support.title",
        href: "/admin/support",
        icon: MessageSquareWarningIcon,
      },
      { title: "admin.nav.fraud", href: "/admin/fraud", icon: ShieldAlertIcon },
      {
        title: "admin.integration.nav.accessRules",
        href: "/admin/security/access",
        icon: ShieldCheckIcon,
      },
      {
        title: "admin.nav.auditLogs",
        href: "/admin/audit-logs",
        icon: FileClockIcon,
      },
    ],
  },
  {
    title: "admin.workspace.groups.settings",
    items: [
      {
        title: "admin.integration.nav.team",
        href: "/admin/team",
        icon: UsersIcon,
      },
      {
        title: "admin.nav.settings",
        href: "/admin/settings",
        icon: SettingsIcon,
      },
      {
        title: "admin.integration.nav.controls",
        href: "/admin/settings/controls",
        icon: SettingsIcon,
      },
    ],
  },
];

const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

function matchesNavigationItem(item: AdminNavigationItem, pathname: string) {
  if (pathname === item.href || item.aliases?.includes(pathname)) return true;
  if (pathname.startsWith(`${item.href}/`)) return true;
  return (
    item.aliases?.some(
      (alias) => alias !== "/admin" && pathname.startsWith(`${alias}/`),
    ) ?? false
  );
}

export function AdminSidebarNav(props: AdminSidebarNavProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(
      window.localStorage.getItem("admin-theme") === "dark" ? "dark" : "light",
    );
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("admin-theme", nextTheme);
  }

  return (
    <SidebarProvider defaultOpen data-admin-theme={theme}>
      <AdminNavigation {...props} theme={theme} onToggleTheme={toggleTheme} />
    </SidebarProvider>
  );
}

function AdminNavigation({
  user,
  children,
  theme,
  onToggleTheme,
}: AdminSidebarNavProps & {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const localePath = useLocalePath();
  const pathname = adminPath(usePathname());
  const access = useAdminAccess();
  const { setOpenMobile, state } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canVisitAdminPath(access.data?.permissions, item.href),
    ),
  })).filter((group) => group.items.length > 0);
  const firstPath = visibleGroups[0]?.items[0]?.href ?? "/admin/profile";
  const currentItem = ADMIN_NAV_ITEMS.filter((item) =>
    matchesNavigationItem(item, pathname),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  const currentGroup = ADMIN_NAV_GROUPS.find(
    (group) => currentItem && group.items.includes(currentItem),
  );
  useEffect(() => {
    if (!currentGroup) return;
    setExpandedGroups((current) =>
      current.includes(currentGroup.title)
        ? current
        : [...current, currentGroup.title],
    );
  }, [currentGroup]);
  const themeLabel =
    theme === "light"
      ? t("admin.common.darkMode")
      : t("admin.common.lightMode");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openPage(href: string) {
    setSearchOpen(false);
    setOpenMobile(false);
    router.push(localePath(href));
  }

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/login"));
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="px-3 py-4">
          <Link
            href={localePath(firstPath)}
            aria-label={t("admin.brand")}
            onClick={() => setOpenMobile(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg no-underline group-data-[collapsible=icon]:justify-center"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {t("admin.brand")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("admin.workspace.console")}
              </p>
            </div>
          </Link>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("admin.workspace.search")}
                onClick={() => setSearchOpen(true)}
                className="mt-3 border border-sidebar-border bg-background text-muted-foreground"
              >
                <SearchIcon aria-hidden="true" />
                <span>{t("admin.workspace.search")}</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {t("admin.workspace.shortcut")}
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="gap-0">
          {visibleGroups.map((group) => (
            <Collapsible
              key={group.title}
              asChild
              open={
                state === "collapsed" || expandedGroups.includes(group.title)
              }
              onOpenChange={(open) =>
                setExpandedGroups((current) =>
                  open
                    ? [...new Set([...current, group.title])]
                    : current.filter((title) => title !== group.title),
                )
              }
            >
              <SidebarGroup className="px-3 py-1">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mb-1 h-9 w-full justify-between px-2 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden"
                  >
                    <span>{t(group.title)}</span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={
                        expandedGroups.includes(group.title)
                          ? "size-3.5 rotate-180"
                          : "size-3.5"
                      }
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={item === currentItem}
                            tooltip={t(item.title)}
                            className="h-9 rounded-md text-sidebar-foreground data-[active=true]:font-semibold"
                          >
                            <Link
                              href={localePath(item.href)}
                              onClick={() => setOpenMobile(false)}
                            >
                              <item.icon
                                className="size-4"
                                aria-hidden="true"
                              />
                              <span>{t(item.title)}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                tooltip={`${user.name} · ${user.email}`}
                aria-label={`${user.name} · ${user.email}`}
                className="rounded-lg border border-sidebar-border hover:bg-sidebar-accent"
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-muted text-foreground">
                    {user.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </span>
                <ChevronUpIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={state === "collapsed" ? "right" : "top"}
              align="end"
              sideOffset={8}
              className="w-60"
            >
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={localePath("/admin/profile")}>
                  <ShieldCheckIcon />
                  {t("common.account")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleTheme}>
                {theme === "light" ? <MoonIcon /> : <SunIcon />}
                {themeLabel}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handleSignOut()}
              >
                <LogOutIcon />
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
        <SidebarRail
          aria-label={t("admin.toggleSidebar")}
          title={t("admin.toggleSidebar")}
        />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <SidebarTrigger
            className="size-9 shrink-0"
            aria-label={t("admin.toggleSidebar")}
            title={t("admin.toggleSidebar")}
          />
          <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <Breadcrumb
            className="min-w-0"
            aria-label={t("admin.workspace.location")}
          >
            <BreadcrumbList className="flex-nowrap">
              {currentGroup ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    {t(currentGroup.title)}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                </>
              ) : null}
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate font-medium">
                  {t(currentItem?.title ?? "common.account")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label={t("admin.workspace.search")}
              title={t("admin.workspace.search")}
            >
              <SearchIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === "light" ? (
                <MoonIcon className="size-4" />
              ) : (
                <SunIcon className="size-4" />
              )}
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="ml-1 hidden sm:inline-flex"
            >
              <Link href={localePath("/")}>
                <ExternalLinkIcon className="size-3.5" />
                {t("admin.workspace.storefront")}
              </Link>
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </SidebarInset>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={t("admin.workspace.search")}
        description={t("admin.workspace.searchDescription")}
      >
        <CommandInput
          placeholder={t("admin.workspace.searchPlaceholder")}
          aria-label={t("admin.workspace.search")}
        />
        <CommandList className="max-h-[min(65vh,480px)]">
          <CommandEmpty>{t("admin.workspace.noResults")}</CommandEmpty>
          {visibleGroups.map((group) => (
            <CommandGroup key={group.title} heading={t(group.title)}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${t(item.title)} ${t(group.title)} ${item.href}`}
                  onSelect={() => openPage(item.href)}
                >
                  <item.icon className="size-4" />
                  <span>{t(item.title)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
