"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BanknoteIcon,
  BellIcon,
  BoxesIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  PackageCheckIcon,
  RotateCcwIcon,
  StoreIcon,
} from "lucide-react";
import { stripLocale } from "#/i18n/config";
import { useLocalePath } from "#/i18n/navigation";
import { cn } from "#/lib/utils";
import type { SellerRouteKind } from "#/lib/seller-access";

const navItems = [
  { href: "/seller", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/seller/products", label: "Products", icon: BoxesIcon },
  { href: "/seller/inventory", label: "Inventory", icon: ClipboardListIcon },
  { href: "/seller/orders", label: "Orders", icon: PackageCheckIcon },
  { href: "/seller/returns", label: "Returns", icon: RotateCcwIcon },
  { href: "/seller/promotions", label: "Promotions", icon: MegaphoneIcon },
  { href: "/seller/finance", label: "Finance", icon: BanknoteIcon },
  { href: "/seller/chat", label: "Chat", icon: MessageCircleIcon },
  { href: "/seller/notifications", label: "Notifications", icon: BellIcon },
] as const;

interface SellerShellProps {
  activeShop: { id: string; name: string; slug: string; status: string } | null;
  activeShops: Array<{ id: string; name: string; slug: string; status: string }>;
  children: ReactNode;
  routeKind: SellerRouteKind;
  user: { name: string; email: string };
}

export function SellerShell({ activeShop, activeShops, children, routeKind, user }: SellerShellProps) {
  const pathname = stripLocale(usePathname());
  const localePath = useLocalePath();
  const showOperationalNavigation = routeKind === "operational";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {showOperationalNavigation ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white md:flex md:flex-col">
          <Link href={localePath("/seller")} prefetch={false} className="flex items-center gap-3 border-b border-slate-200 px-5 py-5 no-underline">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <StoreIcon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-950">Seller Manage</span>
              <span className="block max-w-40 truncate text-xs text-slate-500">{activeShop?.name ?? user.email}</span>
            </span>
          </Link>
          {activeShops.length > 1 ? (
            <div className="border-b border-slate-200 px-3 py-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active shop
                <select className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm normal-case tracking-normal text-slate-700">
                  {activeShops.map((shop) => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const active = item.href === "/seller" ? pathname === "/seller" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={localePath(item.href)}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline",
                    active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 px-5 py-4">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-slate-500">{activeShop?.slug ?? user.email}</p>
          </div>
        </aside>
      ) : null}
      <div className={showOperationalNavigation ? "md:pl-64" : ""}>
        {showOperationalNavigation ? (
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <Link key={item.href} href={localePath(item.href)} prefetch={false} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline">
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
        ) : null}
        <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SellerPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Seller manage</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
    </section>
  );
}
