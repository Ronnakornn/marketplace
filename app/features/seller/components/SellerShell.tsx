"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BanknoteIcon, BellIcon, BoxesIcon, ChartNoAxesCombinedIcon, ChevronRightIcon,
  ChevronsUpDownIcon, ClipboardListIcon, CreditCardIcon, ExternalLinkIcon,
  LayoutDashboardIcon, LogOutIcon, MegaphoneIcon, MessageCircleIcon,
  PackageCheckIcon, RotateCcwIcon, StoreIcon, UserRoundIcon, UsersIcon,
} from "lucide-react";
import { LanguageSwitcher } from "#/components/LanguageSwitcher";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger,
  useSidebar,
} from "#/components/ui/sidebar";
import { useTranslations } from "#/i18n/client";
import { stripLocale } from "#/i18n/config";
import { useLocalePath } from "#/i18n/navigation";
import { signOut } from "#/lib/auth-client";
import { getSellerRouteKind } from "#/lib/seller-access";

const navigationGroups = [
  {
    labelKey: "seller.ui.navigation.work",
    items: [
      { href: "/seller", labelKey: "seller.nav.dashboard", icon: LayoutDashboardIcon },
      { href: "/seller/orders", labelKey: "seller.nav.orders", icon: PackageCheckIcon },
      { href: "/seller/returns", labelKey: "seller.nav.returns", icon: RotateCcwIcon },
      { href: "/seller/products", labelKey: "seller.nav.products", icon: BoxesIcon },
      { href: "/seller/inventory", labelKey: "seller.nav.inventory", icon: ClipboardListIcon },
      { href: "/seller/chat", labelKey: "seller.nav.chat", icon: MessageCircleIcon },
    ],
  },
  {
    labelKey: "seller.ui.navigation.business",
    items: [
      { href: "/seller/analytics/products", labelKey: "seller.nav.productAnalytics", icon: ChartNoAxesCombinedIcon },
      { href: "/seller/promotions", labelKey: "seller.nav.promotions", icon: MegaphoneIcon },
      { href: "/seller/finance", labelKey: "seller.nav.finance", icon: BanknoteIcon },
    ],
  },
  {
    labelKey: "seller.ui.navigation.account",
    items: [
      { href: "/seller/shop", labelKey: "seller.nav.shopProfile", icon: StoreIcon },
      { href: "/seller/staff", labelKey: "seller.nav.staff", icon: UsersIcon },
      { href: "/seller/support", labelKey: "support.title", icon: MessageCircleIcon },
      { href: "/seller/notifications", labelKey: "seller.nav.notifications", icon: BellIcon },
    ],
  },
];

interface SellerShellProps {
  activeShop: { id: string; name: string; slug: string; status: string } | null;
  activeShops: Array<{ id: string; name: string; slug: string; status: string }>;
  children: ReactNode;
  user: { name: string; email: string };
}

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/seller" && pathname.startsWith(`${href}/`));
}

export function SellerShell(props: SellerShellProps) {
  const pathname = stripLocale(usePathname());
  const t = useTranslations();

  return (
    <div className="seller-shell min-h-svh bg-slate-50 text-slate-950">
      <a href="#seller-content" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-lg focus:not-sr-only">
        {t("seller.ui.skipToContent")}
      </a>
      {getSellerRouteKind(pathname) === "operational" ? (
        <SidebarProvider defaultOpen>
          <SellerWorkspace {...props} />
        </SidebarProvider>
      ) : (
        <main id="seller-content" tabIndex={-1} className="mx-auto flex min-h-svh max-w-7xl flex-col gap-6 px-4 py-6 outline-none md:px-8 md:py-8">
          {props.children}
        </main>
      )}
    </div>
  );
}

function SellerWorkspace({ activeShop, activeShops, children, user }: SellerShellProps) {
  const t = useTranslations();
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const pathname = stripLocale(rawPathname);
  const localePath = useLocalePath();
  const { setOpenMobile } = useSidebar();
  const selectedShopParam = searchParams.get("shopId");
  const selectedShopId = activeShops.some((shop) => shop.id === selectedShopParam)
    ? selectedShopParam ?? ""
    : activeShop?.id ?? activeShops[0]?.id ?? "";
  const selectedShop = activeShops.find((shop) => shop.id === selectedShopId) ?? activeShop;
  const selectedShopQuery = selectedShopId ? `shopId=${encodeURIComponent(selectedShopId)}` : "";
  const currentNavigation = navigationGroups.flatMap((group) => group.items).find((item) => isCurrentRoute(pathname, item.href));
  const publicShopHref = selectedShop ? localePath(`/shops/${selectedShop.slug || selectedShop.id}`) : null;

  function createSellerHref(href: string) {
    const base = localePath(href);
    return selectedShopQuery ? `${base}?${selectedShopQuery}` : base;
  }

  function closeMobileNavigation() {
    setOpenMobile(false);
  }

  function handleShopSelection(nextShopId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextShopId === activeShop?.id) {
      nextParams.delete("shopId");
    } else {
      nextParams.set("shopId", nextShopId);
    }
    const query = nextParams.toString();
    closeMobileNavigation();
    router.push(query ? `${rawPathname}?${query}` : rawPathname);
  }

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/login"));
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-slate-200">
        <SidebarHeader className="gap-4 border-b border-slate-200 px-3 py-4 group-data-[collapsible=icon]:px-2">
          <Link href={createSellerHref("/seller")} prefetch={false} onClick={closeMobileNavigation} className="flex items-center gap-3 rounded-lg p-2 no-underline focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none group-data-[collapsible=icon]:p-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white group-data-[collapsible=icon]:size-8">
              <StoreIcon aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block text-sm font-semibold text-slate-950">{t("seller.ui.workspace")}</span>
              <span className="block truncate text-xs text-slate-500">{t("seller.ui.workspaceDescription")}</span>
            </span>
          </Link>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 group-data-[collapsible=icon]:hidden [&_[data-slot=native-select-wrapper]]:w-full">
            <p className="mb-2 text-xs font-medium text-slate-500">{t("seller.ui.currentShop")}</p>
            {activeShops.length > 1 ? (
              <NativeSelect aria-label={t("seller.nav.activeShop")} value={selectedShopId} onChange={(event) => handleShopSelection(event.target.value)} className="w-full bg-white font-medium [&+svg]:text-slate-500">
                {activeShops.map((shop) => <NativeSelectOption key={shop.id} value={shop.id}>{shop.name}</NativeSelectOption>)}
              </NativeSelect>
            ) : (
              <p className="truncate text-sm font-semibold text-slate-900">{selectedShop?.name ?? user.email}</p>
            )}
            {selectedShop ? <p className="mt-2 truncate text-xs text-slate-500">/{selectedShop.slug || selectedShop.id}</p> : null}
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-1 px-2 py-3 group-data-[collapsible=icon]:px-1">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.labelKey} className="p-1">
              <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-slate-500">{t(group.labelKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isCurrentRoute(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey)} className="h-10 gap-3 px-3 text-slate-600 hover:bg-slate-100 hover:text-slate-950 data-[active=true]:bg-orange-50 data-[active=true]:font-semibold data-[active=true]:text-orange-800">
                          <Link href={createSellerHref(item.href)} prefetch={false} onClick={closeMobileNavigation} aria-current={active ? "page" : undefined}>
                            <item.icon aria-hidden="true" className="size-4" />
                            <span>{t(item.labelKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={`${user.name} · ${user.email}`} aria-label={`${t("seller.ui.accountMenu")} ${user.name}`} className="h-auto min-h-12 rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-slate-50 data-[state=open]:bg-slate-100">
                    <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-slate-100 text-slate-600">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span>
                    <ChevronsUpDownIcon aria-hidden="true" className="ml-auto size-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
                  <DropdownMenuLabel className="font-normal"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {publicShopHref ? <DropdownMenuItem asChild><Link href={publicShopHref} prefetch={false} onClick={closeMobileNavigation}><StoreIcon />{t("seller.nav.viewShop")}</Link></DropdownMenuItem> : null}
                  <DropdownMenuItem asChild><Link href={localePath("/profile")} onClick={closeMobileNavigation}><UserRoundIcon />{t("common.account")}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href={createSellerHref("/seller/finance")} onClick={closeMobileNavigation}><CreditCardIcon />{t("common.billing")}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href={createSellerHref("/seller/notifications")} onClick={closeMobileNavigation}><BellIcon />{t("common.notifications")}</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}><LogOutIcon />{t("common.logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail aria-label={t("seller.nav.toggleSidebar")} title={t("seller.nav.toggleSidebar")} />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-slate-50">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger aria-label={t("seller.nav.toggleSidebar")} className="size-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100" />
            <nav aria-label={t("seller.ui.breadcrumb")} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="max-w-44 truncate font-medium text-slate-700">{selectedShop?.name ?? t("seller.ui.workspace")}</span>
              <ChevronRightIcon aria-hidden="true" className="hidden size-3.5 shrink-0 text-slate-300 sm:block" />
              <span className="hidden truncate text-slate-500 sm:inline">{currentNavigation ? t(currentNavigation.labelKey) : t("seller.ui.workspace")}</span>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {publicShopHref ? (
              <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white sm:inline-flex">
                <Link href={publicShopHref} prefetch={false}><ExternalLinkIcon aria-hidden="true" className="size-3.5" />{t("seller.nav.viewShop")}</Link>
              </Button>
            ) : null}
            <LanguageSwitcher prefetch={false} queryString={searchParams.toString()} />
            <Button asChild variant="ghost" size="icon" className="size-9 rounded-lg text-slate-500 hover:bg-slate-100">
              <Link href={createSellerHref("/seller/notifications")} prefetch={false} aria-label={t("seller.nav.notifications")}><BellIcon aria-hidden="true" className="size-4" /></Link>
            </Button>
          </div>
        </header>
        <div id="seller-content" tabIndex={-1} className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 outline-none md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function SellerPageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
