"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { locales, type Locale, withLocale } from "#/i18n/config";
import { useLocale, useTranslations } from "#/i18n/client";
import { cn } from "#/lib/utils";

const localeLabels: Record<Locale, string> = {
  th: "ไทย",
  en: "EN",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations();
  const [queryString, setQueryString] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setQueryString(window.location.search.replace(/^\?/, ""));
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-1" aria-label={t("common.language")}>
      {locales.map((targetLocale) => (
        <Link
          key={targetLocale}
          href={`${withLocale(pathname, targetLocale)}${queryString ? `?${queryString}` : ""}`}
          className={cn(
            "rounded-full px-2 py-1 text-xs font-bold no-underline transition",
            locale === targetLocale
              ? "bg-white text-[var(--sea-ink)] shadow-sm"
              : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]",
          )}
          hrefLang={targetLocale}
        >
          {localeLabels[targetLocale]}
        </Link>
      ))}
    </div>
  );
}
