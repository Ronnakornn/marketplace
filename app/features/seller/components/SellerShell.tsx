"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BanknoteIcon,
  BellIcon,
  ChevronUpIcon,
  CreditCardIcon,
  BoxesIcon,
  ChartNoAxesCombinedIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  PackageCheckIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  RotateCcwIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { stripLocale } from "#/i18n/config";
import { useLocalePath } from "#/i18n/navigation";
import { useTranslations } from "#/i18n/client";
import { cn } from "#/lib/utils";
import { getSellerRouteKind } from "#/lib/seller-access";
import { signOut } from "#/lib/auth-client";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
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

const navItems = [
  { href: "/seller", labelKey: "seller.nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/seller/shop", labelKey: "seller.nav.shopProfile", icon: StoreIcon },
  { href: "/seller/products", labelKey: "seller.nav.products", icon: BoxesIcon },
  { href: "/seller/analytics/products", labelKey: "seller.nav.productAnalytics", icon: ChartNoAxesCombinedIcon },
  { href: "/seller/inventory", labelKey: "seller.nav.inventory", icon: ClipboardListIcon },
  { href: "/seller/orders", labelKey: "seller.nav.orders", icon: PackageCheckIcon },
  { href: "/seller/returns", labelKey: "seller.nav.returns", icon: RotateCcwIcon },
  { href: "/seller/promotions", labelKey: "seller.nav.promotions", icon: MegaphoneIcon },
  { href: "/seller/finance", labelKey: "seller.nav.finance", icon: BanknoteIcon },
  { href: "/seller/chat", labelKey: "seller.nav.chat", icon: MessageCircleIcon },
  { href: "/seller/notifications", labelKey: "seller.nav.notifications", icon: BellIcon },
  { href: "/seller/staff", labelKey: "seller.nav.staff", icon: UsersIcon },
] as const;

interface SellerShellProps {
  activeShop: { id: string; name: string; slug: string; status: string } | null;
  activeShops: Array<{ id: string; name: string; slug: string; status: string }>;
  children: ReactNode;
  user: { name: string; email: string };
}

export function SellerShell({ activeShop, activeShops, children, user }: SellerShellProps) {
  const t = useTranslations();
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const pathname = stripLocale(rawPathname);
  const localePath = useLocalePath();
  const routeKind = getSellerRouteKind(pathname);
  const showOperationalNavigation = routeKind === "operational";
  const selectedShopParam = searchParams.get("shopId");
  const selectedShopId = activeShops.some((shop) => shop.id === selectedShopParam)
    ? (selectedShopParam ?? "")
    : activeShop?.id ?? activeShops[0]?.id ?? "";
  const selectedShop = activeShops.find((shop) => shop.id === selectedShopId) ?? activeShop;
  const selectedShopQuery = selectedShopId ? `shopId=${encodeURIComponent(selectedShopId)}` : "";

  function createSellerHref(href: string) {
    const base = localePath(href);
    return selectedShopQuery ? `${base}?${selectedShopQuery}` : base;
  }

  function handleShopSelection(nextShopId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextShopId === activeShop?.id) {
      nextParams.delete("shopId");
    } else {
      nextParams.set("shopId", nextShopId);
    }
    const query = nextParams.toString();
    router.push(query ? `${rawPathname}?${query}` : rawPathname);
  }

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/login"));
  }

  return (
    <div className="seller-shell min-h-screen bg-white text-slate-950">
      {showOperationalNavigation ? (
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
            <SidebarHeader className="border-b border-slate-200 px-3 py-4">
              <Link href={createSellerHref("/seller")} prefetch={false} className="flex items-center gap-3 rounded-lg px-2 py-2 no-underline">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white">
                  <StoreIcon className="size-5" />
                </span>
                <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="block text-sm font-semibold text-slate-950">Seller Manage</span>
                  <span className="block max-w-40 truncate text-xs text-slate-500">{activeShop?.name ?? user.email}</span>
                </span>
              </Link>
              {activeShops.length > 1 ? (
                <div className="border-t border-slate-200 px-2 pt-3 group-data-[collapsible=icon]:hidden">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("seller.nav.activeShop")}
                    <select
                      value={selectedShopId}
                      onChange={(event) => handleShopSelection(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm normal-case tracking-normal text-slate-700"
                    >
                      {activeShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
            </SidebarHeader>
            <SidebarContent className="px-2 py-3">
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = item.href === "/seller" ? pathname === "/seller" : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={t(item.labelKey)}
                        className={cn(
                          "text-slate-600 hover:bg-orange-50 hover:text-orange-800 data-[active=true]:bg-orange-50 data-[active=true]:text-orange-800",
                        )}
                      >
                        <Link href={createSellerHref(item.href)} prefetch={false}>
                          <item.icon className="size-4 text-orange-600" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter className="p-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton size="lg" tooltip={`${user.name} · ${user.email}`} className="h-auto min-h-12 border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-orange-50 hover:text-orange-900 data-[state=open]:bg-orange-50 data-[state=open]:text-orange-900">
                        <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-orange-100 text-orange-800">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                        <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span>
                        <ChevronUpIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
                      <DropdownMenuLabel className="font-normal"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {selectedShop ? <DropdownMenuItem asChild><Link href={localePath(`/shops/${selectedShop.slug || selectedShop.id}`)} prefetch={false}><StoreIcon />{t("seller.nav.viewShop")}</Link></DropdownMenuItem> : null}
                      <DropdownMenuItem asChild><Link href={localePath("/profile")}><StoreIcon />{t("common.account")}</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={createSellerHref("/seller/finance")}><CreditCardIcon />{t("common.billing")}</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={createSellerHref("/seller/notifications")}><BellIcon />{t("common.notifications")}</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}><LogOutIcon />{t("common.logout")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset className="min-w-0 bg-white">
            <div className="flex min-h-screen min-w-0 flex-col">
              <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <SidebarTrigger className="h-9 rounded-md border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-100">
                  <PanelLeftCloseIcon className="size-4 md:hidden" />
                  <MenuIcon className="hidden size-4 md:block" />
                  <span className="sr-only">{t("seller.nav.toggleSidebar")}</span>
                </SidebarTrigger>
                <span className="text-xs font-semibold text-slate-500 md:hidden">{activeShop?.name ?? t("seller.nav.manage")}</span>
              </div>
              <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
                {children}
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : null}
      {!showOperationalNavigation ? <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">{children}</main> : null}
    </div>
  );
}

export function SellerPageHeader({ title, description }: { title: string; description: string }) {
  const t = useTranslations();

  return (
    <section className="rounded-lg border border-orange-200 bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{t("seller.nav.manage")}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
    </section>
  );
}
