"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BellIcon,
  FlameIcon,
  HomeIcon,
  LogOutIcon,
  MessageCircleIcon,
  PackageIcon,
  SearchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  StoreIcon,
  UserCircleIcon,
} from "lucide-react";
import { LanguageSwitcher } from "#/components/LanguageSwitcher";
import { Input } from "#/components/ui/input";
import { fetchCart, fetchNotifications } from "#/features/buyer/api";
import { fetchChatRooms } from "#/features/chat/api";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { signOut, useSession } from "#/lib/auth-client";
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

export function BuyerTopBar({ title, searchQuery = "" }: { title?: string; searchQuery?: string }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const localePath = useLocalePath();
  const pathname = usePathname();
  const isSellerRoute = pathname.includes("/seller/");
  const notificationHref = isSellerRoute ? "/seller/notifications" : "/notifications";
  const notificationScope = isSellerRoute ? "seller" : "all";
  const canUseBuyerCart = Boolean(session && session.user.role !== "ADMIN");
  const canUseChat = Boolean(session && session.user.role !== "ADMIN");
  const chatHref = "/chat";
  const sellerChatHref = "/seller/chat";
  const cartQuery = useQuery({
    queryKey: ["buyer-cart", locale],
    queryFn: () => fetchCart(locale),
    enabled: canUseBuyerCart,
  });
  const chatRoomsQuery = useQuery({
    queryKey: ["chat-rooms", session?.user.role],
    queryFn: () => fetchChatRooms("buyer"),
    enabled: canUseChat,
    refetchInterval: 30_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", notificationScope],
    queryFn: () => fetchNotifications(notificationScope),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;
  const chatUnreadCount = chatRoomsQuery.data?.reduce((total, room) => total + room.unreadCount, 0) ?? 0;
  const notificationUnreadCount = notificationsQuery.data?.filter((notification) => !notification.readAt && !isChatNotification(notification.type)).length ?? 0;

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/"));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <Link href={localePath("/")} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-600 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700">
          <ShoppingBagIcon className="size-4 text-white" />
          <span className="hidden sm:inline text-white">{t("common.marketplace")}</span>
        </Link>
        {/* <Link href={localePath("/categories/deals")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
          <MenuIcon className="size-5" />
          <span className="sr-only">{t("common.categories")}</span>
        </Link> */}
        <form action={localePath("/search")} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-orange-200 md:max-w-[520px] lg:max-w-[640px]">
          <SearchIcon className="size-4 shrink-0 text-slate-900" />
          <Input
            name="q"
            defaultValue={searchQuery}
            placeholder={t("home.searchPlaceholder")}
            className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </form>
        <Link href={localePath(notificationHref)} className="relative flex size-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
          <BellIcon className="size-5" />
          {notificationUnreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
              {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
            </span>
          ) : null}
          <span className="sr-only">{t("common.notifications")}</span>
        </Link>
        {canUseChat ? (
          <Link href={localePath(chatHref)} className="relative flex size-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
            <MessageCircleIcon className="size-5" />
            {chatUnreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            ) : null}
            <span className="sr-only">{t("chat.messages")}</span>
          </Link>
        ) : null}
        {canUseBuyerCart ? (
          <Link href={localePath("/cart")} className="relative flex size-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
            <ShoppingCartIcon className="size-5" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            ) : null}
            <span className="sr-only">{t("common.cart")}</span>
          </Link>
        ) : null}
        {session ? (
          <>
            {session.user.role !== "ADMIN" ? (
              <Link href={localePath("/seller/register")} prefetch={false} className="hidden h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-900 transition hover:bg-emerald-50 hover:text-emerald-900 sm:flex">
                <StoreIcon className="size-4" />
                {t("buyer.startSelling")}
              </Link>
            ) : null}
            {session.user.role !== "ADMIN" && !isSellerRoute ? (
              <Link href={localePath(sellerChatHref)} className="hidden h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-900 transition hover:bg-emerald-50 hover:text-emerald-900 lg:flex">
                <StoreIcon className="size-4" />
                {t("buyer.sellerChat")}
              </Link>
            ) : null}
            <Link href={localePath("/profile")} className="flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-slate-900 transition hover:bg-orange-50 hover:text-orange-600">
              <UserCircleIcon className="size-5" />
             
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600"
            >
              <LogOutIcon className="size-5" />
              <span className="sr-only">{t("common.logout")}</span>
            </button>
          </>
        ) : isSessionPending ? (
          // The session resolves client-side, so it is null during SSR and until
          // hydration settles. Rendering the signed-out controls here would flash
          // "sign in" at buyers who are already signed in.
          <div className="h-10 w-32 shrink-0 animate-pulse rounded-full bg-slate-100" />
        ) : (
            <div className="flex items-center gap-2">
              <Link
                href={localePath("/login")}
                className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:border-[rgba(23,58,64,0.35)] hover:bg-white/80"
              >
                {t("common.login")}
              </Link>
              <Link
                href={localePath("/signup")}
                className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
              >
                {t("common.signup")}
              </Link>
            </div>
        )}
      </div>
      <div className="mx-auto mt-1 flex max-w-6xl items-center justify-between gap-2 px-1">
        <p className="min-w-0 truncate text-xs font-semibold text-orange-600">{title ?? t("common.marketplace")}</p>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

function isChatNotification(type: string): boolean {
  return type.toLowerCase().includes("chat");
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
                active ? "bg-orange-50 text-orange-600" : "text-slate-900",
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
