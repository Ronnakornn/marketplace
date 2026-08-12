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

  useEffect(() => {
    setQueryString(window.location.search.replace(/^\?/, ""));
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1" aria-label={t("common.language")}>
      {locales.map((targetLocale) => (
        <Link
          key={targetLocale}
          href={`${withLocale(pathname, targetLocale)}${queryString ? `?${queryString}` : ""}`}
          className={cn(
            "rounded-full px-2 py-1 text-xs font-bold no-underline transition",
            locale === targetLocale
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-700 hover:text-slate-950",
          )}
          hrefLang={targetLocale}
        >
          {localeLabels[targetLocale]}
        </Link>
      ))}
    </div>
  );
}
