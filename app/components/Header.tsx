"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreIcon } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession, signOut } from "#/lib/auth-client";
import { isAdminRole } from "#/lib/roles";

export default function Header() {
  const router = useRouter();
  const t = useTranslations();
  const localePath = useLocalePath();
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  async function handleSignOut() {
    await signOut();
    router.push(localePath("/"));
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex items-center gap-3 py-3 sm:py-4">
        <Link
          href={localePath("/")}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          {t("common.marketplace")}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />

          {!isPending && (
            <>
              {session ? (
                <div className="flex items-center gap-3">
                  {isAdminRole(session.user.role) && (
                    <Link
                      href={localePath("/admin")}
                      className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
                    >
                      {t("common.admin")}
                    </Link>
                  )}
                  <Link
                    href={localePath("/seller/register")}
                    prefetch={false}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
                  >
                    <StoreIcon className="size-3.5" />
                    Start selling
                  </Link>
                  <span className="hidden text-sm text-[var(--sea-ink-soft)] sm:inline">
                    {session.user.name}
                  </span>
                  <button
                    onClick={() => void handleSignOut()}
                    className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(23,58,64,0.35)] hover:bg-white/80"
                  >
                    {t("common.logout")}
                  </button>
                </div>
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
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
