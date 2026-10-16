"use client";

import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BellIcon,
  FlameIcon,
  HomeIcon,
  MessageCircleIcon,
  PackageIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  UserCircleIcon,
} from "lucide-react";
import { LanguageSwitcher } from "#/components/LanguageSwitcher";
import { Input } from "#/components/ui/input";
import { fetchCart, fetchNotificationUnreadCount } from "#/features/buyer/api";
import { readGuestCart } from "#/features/cart/guest-cart";
import { mergeGuestCart } from "#/features/cart/merge-guest-cart";
import { chatUnreadQueryOptions } from "#/features/chat/queries";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import { cn } from "#/lib/utils";

const navItems = [
  { href: "/", labelKey: "nav.home", icon: HomeIcon },
  { href: "/search", labelKey: "nav.search", icon: SearchIcon },
  { href: "/deals", labelKey: "common.deals", icon: FlameIcon },
  { href: "/orders", labelKey: "nav.orders", icon: PackageIcon },
  { href: "/profile", labelKey: "nav.profile", icon: UserCircleIcon },
] as const;

const subscribeToHydration = () => () => undefined;

function useHasHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

export function BuyerPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-20 text-slate-950">
      <main>{children}</main>
      <MobileBottomNavigation />
    </div>
  );
}

export function BuyerTopBar({ title, searchQuery = "", prefetchLinks = true }: { title?: string; searchQuery?: string; prefetchLinks?: boolean }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const hasHydrated = useHasHydrated();
  const hydratedSession = hasHydrated ? session : null;
  const isHydratingSession = !hasHydrated || isSessionPending;
  const t = useTranslations();
  const locale = useLocale();
  const localePath = useLocalePath();
  const pathname = usePathname();
  const isSellerRoute = pathname.includes("/seller/");
  const notificationHref = isSellerRoute ? "/seller/notifications" : "/notifications";
  const notificationScope = isSellerRoute ? "seller" : "all";
  const canUseBuyerCart = Boolean(hydratedSession && hydratedSession.user.role !== "ADMIN");
  const canUseChat = Boolean(hydratedSession && hydratedSession.user.role !== "ADMIN");
  const chatHref = "/chat";
  const cartQuery = useQuery({
    queryKey: ["buyer-cart", locale],
    queryFn: () => fetchCart(locale),
    enabled: canUseBuyerCart,
  });
  const cartUserId = canUseBuyerCart ? hydratedSession?.user.id : undefined;
  useEffect(() => {
    if (isHydratingSession) return;
    const hadGuestItems = readGuestCart().length > 0;
    let active = true;
    void mergeGuestCart(cartUserId ?? null).then(() => {
      if (active && cartUserId && hadGuestItems) void cartQuery.refetch();
    });
    return () => { active = false; };
  }, [cartUserId, isHydratingSession]);
  const chatUnreadQuery = useQuery({
    ...chatUnreadQueryOptions("buyer", hydratedSession?.user.id ?? ""),
    enabled: canUseChat,
    refetchInterval: 30_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "unread-count", notificationScope, hydratedSession?.user.id, { excludeChat: true }],
    queryFn: () => fetchNotificationUnreadCount(notificationScope, { excludeChat: true }),
    enabled: Boolean(hydratedSession),
    refetchInterval: 30_000,
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;
  const chatUnreadCount = chatUnreadQuery.data?.unreadCount ?? 0;
  const notificationUnreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-3 py-3 shadow-sm backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 sm:gap-3">
        <Link aria-label={t("common.marketplace")} href={localePath("/")} prefetch={prefetchLinks} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-700 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-800">
          <ShoppingBagIcon className="size-4 text-white" />
          <span className="hidden sm:inline text-white">{t("common.marketplace")}</span>
        </Link>
        {/* <Link href={localePath("/categories/deals")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
          <MenuIcon className="size-5" />
          <span className="sr-only">{t("common.categories")}</span>
        </Link> */}
        <form suppressHydrationWarning action={localePath("/search")} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-orange-200">
          <SearchIcon className="size-4 shrink-0 text-slate-900" />
          <Input
            suppressHydrationWarning
            name="q"
            defaultValue={searchQuery}
            placeholder={t("home.searchPlaceholder")}
            className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </form>
        <Link href={localePath(notificationHref)} prefetch={prefetchLinks} className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
          <BellIcon className="size-5" />
          {notificationUnreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-700 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
              {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
            </span>
          ) : null}
          <span className="sr-only">{t("common.notifications")}</span>
        </Link>
        {canUseChat ? (
          <Link href={localePath(chatHref)} prefetch={prefetchLinks} className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
            <MessageCircleIcon className="size-5" />
            {chatUnreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-700 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            ) : null}
            <span className="sr-only">{t("chat.messages")}</span>
          </Link>
        ) : null}
        {canUseBuyerCart ? (
          <Link href={localePath("/cart")} prefetch={prefetchLinks} className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
            <ShoppingCartIcon className="size-5" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-700 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            ) : null}
            <span className="sr-only">{t("common.cart")}</span>
          </Link>
        ) : null}
        {hydratedSession ? (
          <>
            <Link aria-label={t("common.profile")} href={localePath("/profile")} prefetch={prefetchLinks} className="hidden size-10 shrink-0 items-center justify-center rounded-full text-slate-900 md:flex transition hover:bg-orange-50 hover:text-orange-600">
              <UserCircleIcon className="size-5" />
             
            </Link>
          </>
        ) : isHydratingSession ? (
          // The session resolves client-side, so it is null during SSR and until
          // hydration settles. Rendering the signed-out controls here would flash
          // "sign in" at buyers who are already signed in.
          <div className="h-10 w-20 shrink-0 rounded-full bg-slate-100" />
        ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={localePath("/login")}
                prefetch={prefetchLinks}
                className="flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 no-underline transition hover:bg-slate-50"
              >
                {t("common.login")}
              </Link>
            </div>
        )}
        <div className="hidden h-10 shrink-0 md:block [&>div]:h-full"><LanguageSwitcher prefetch={prefetchLinks} /></div>
      </div>
      <div className={cn("mx-auto mt-2 flex max-w-6xl items-center justify-between gap-3", { "md:hidden": !title })}>
        {title ? <p className="min-w-0 truncate text-xs font-semibold text-orange-700">{title}</p> : null}
        <div className="ml-auto shrink-0 md:hidden"><LanguageSwitcher prefetch={prefetchLinks} /></div>
      </div>
    </header>
  );
}

export function MobileBottomNavigation({ prefetchLinks = true }: { prefetchLinks?: boolean } = {}) {
  const pathname = usePathname();
  const t = useTranslations();
  const localePath = useLocalePath();
  // These pages provide their own fixed bottom actions. Rendering both bars
  // at the same position blocks checkout, review and return submission on mobile.
  const hasActionBar = ["/cart", "/checkout", "/payment/return"].some((path) => pathname === localePath(path))
    || (pathname.startsWith(`${localePath("/orders")}/`) && /\/(review|returns\/new)$/.test(pathname));
  if (hasActionBar) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const localizedHref = localePath(href);
          const active = href === "/" ? pathname === localizedHref : pathname.startsWith(localizedHref);
          return (
            <Link
              key={href}
              href={localizedHref}
              prefetch={prefetchLinks}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold",
                active ? "bg-orange-50 text-orange-700" : "text-slate-900",
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
