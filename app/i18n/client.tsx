"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type enMessages from "../../messages/en.json";
import type { Locale } from "./config";
import { defaultCurrency, defaultTimeZone, fallbackLocale, resolveLocale } from "./config";

type Messages = typeof enMessages;
type TranslationKey = Leaves<Messages>;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Leaves<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  fallbackMessages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readPath(source: unknown, key: string): string | undefined {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source) as string | undefined;
}

export function I18nProvider({
  locale,
  messages,
  fallbackMessages,
  children,
}: I18nContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ locale: resolveLocale(locale), messages, fallbackMessages }),
    [fallbackMessages, locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale() {
  return useI18n().locale;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

export function useTranslations() {
  const { messages, fallbackMessages } = useI18n();

  return function t(key: TranslationKey): string {
    return readPath(messages, key) ?? readPath(fallbackMessages, key) ?? key;
  };
}

export function useFormatters() {
  const locale = useLocale();

  return {
    currency(cents: number, currency = defaultCurrency) {
      return formatCurrency(cents, locale, currency);
    },
    date(value: Date | string | number, options?: Intl.DateTimeFormatOptions) {
      return formatDate(value, locale, options);
    },
  };
}

export function formatCurrency(cents: number, locale: Locale | string, currency = defaultCurrency) {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: normalizeDisplayCurrency(currency),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function normalizeDisplayCurrency(_currency: string) {
  return defaultCurrency;
}

export function formatDate(
  value: Date | string | number,
  locale: Locale | string = fallbackLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: defaultTimeZone,
    ...options,
  }).format(new Date(value));
}
