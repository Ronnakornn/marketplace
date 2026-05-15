"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BellIcon,
  FlameIcon,
  HomeIcon,
  PackageIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  UserCircleIcon,
} from "lucide-react";
import { Input } from "#/components/ui/input";
import { fetchCart } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import { cn } from "#/lib/utils";

const navItems = [
  { href: "/", labelKey: "nav.home", icon: HomeIcon },
  { href: "/search", labelKey: "nav.search", icon: SearchIcon },
  { href: "/deals", labelKey: "common.deals", icon: FlameIcon },
  { href: "/cart", labelKey: "nav.cart", icon: ShoppingCartIcon },
  { href: "/orders", labelKey: "nav.orders", icon: PackageIcon },
  { href: "/profile", labelKey: "nav.profile", icon: UserCircleIcon },
] as const;

export function BuyerPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-20 text-slate-950">
      <main>{children}</main>
      <MobileBottomNavigation />
    </div>
  );
}

export function BuyerTopBar({ title = "Marketplace", searchQuery = "" }: { title?: string; searchQuery?: string }) {
  const { data: session } = useSession();
  const t = useTranslations();
  const localePath = useLocalePath();
  const cartQuery = useQuery({
    queryKey: ["buyer-cart"],
    queryFn: fetchCart,
    enabled: Boolean(session),
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <Link href={localePath("/")} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-600 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700">
          <ShoppingBagIcon className="size-4" />
          <span className="hidden sm:inline">{t("common.marketplace")}</span>
        </Link>
        <form action={localePath("/search")} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-orange-200">
          <SearchIcon className="size-4 shrink-0 text-slate-500" />
          <Input
            name="q"
            defaultValue={searchQuery}
            placeholder={t("home.searchPlaceholder")}
            className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </form>
        <Link href={localePath("/notifications")} className="flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-orange-50 hover:text-orange-600">
          <BellIcon className="size-5" />
          <span className="sr-only">{t("common.notifications")}</span>
        </Link>
        <Link href={localePath("/cart")} className="relative flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-orange-50 hover:text-orange-600">
          <ShoppingCartIcon className="size-5" />
          {cartItemCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
              {cartItemCount > 99 ? "99+" : cartItemCount}
            </span>
          ) : null}
          <span className="sr-only">{t("common.cart")}</span>
        </Link>
      </div>
      <p className="mx-auto mt-1 max-w-6xl px-1 text-xs font-semibold text-orange-600">{title}</p>
    </header>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const t = useTranslations();
  const localePath = useLocalePath();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const localizedHref = localePath(href);
          const active = href === "/" ? pathname === localizedHref : pathname.startsWith(localizedHref);
          return (
            <Link
              key={href}
              href={localizedHref}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold",
                active ? "bg-orange-50 text-orange-600" : "text-slate-500",
              )}
            >
              <Icon className="size-5" />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
