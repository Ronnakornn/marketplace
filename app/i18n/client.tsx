"use client";

import { formatMinorCurrency, formatMinorInteger, type MinorUnitValue } from "#/lib/money";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type enMessages from "../../messages/en.json";
import type { Locale } from "./config";
import { defaultCurrency, defaultTimeZone, fallbackLocale, resolveLocale } from "./config";
import { mergeMessages, type MessageDictionary } from "./messages";

type Messages = typeof enMessages;
type TranslationKey = Leaves<Messages>;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Leaves<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

interface I18nContextValue {
  locale: Locale;
  messages: MessageDictionary;
  fallbackMessages: MessageDictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const EMPTY_MESSAGES: MessageDictionary = {};

function readPath(source: unknown, key: string): string | undefined {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source) as string | undefined;
}

export function I18nProvider({
  locale,
  messages,
  fallbackMessages = EMPTY_MESSAGES,
  children,
}: Omit<I18nContextValue, "fallbackMessages"> & { fallbackMessages?: MessageDictionary; children: ReactNode }) {
  const parent = useContext(I18nContext);
  const resolvedLocale = resolveLocale(locale);
  const inherited = parent?.locale === resolvedLocale ? parent : null;
  const value = useMemo(
    () => ({
      locale: resolvedLocale,
      messages: inherited ? mergeMessages(inherited.messages, messages) : messages,
      fallbackMessages: inherited ? mergeMessages(inherited.fallbackMessages, fallbackMessages) : fallbackMessages,
    }),
    [fallbackMessages, inherited, messages, resolvedLocale],
  );

  useEffect(() => {
    document.documentElement.lang = value.locale;
  }, [value.locale]);

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

  return function t(key: TranslationKey | string): string {
    return readPath(messages, key) ?? readPath(fallbackMessages, key) ?? key;
  };
}

export function useFormatters() {
  const locale = useLocale();

  return {
    currency(cents: MinorUnitValue, currency = defaultCurrency) {
      return formatCurrency(cents, locale, currency);
    },
    date(value: Date | string | number, options?: Intl.DateTimeFormatOptions) {
      return formatDate(value, locale, options);
    },
    number(value: MinorUnitValue) {
      if (typeof value !== "number" || Number.isInteger(value)) return formatMinorInteger(value, resolveLocale(locale));
      if (!Number.isFinite(value)) throw new RangeError("Display number must be finite");
      return new Intl.NumberFormat(resolveLocale(locale)).format(value);
    },
  };
}

export function formatCurrency(cents: MinorUnitValue, locale: Locale | string, currency = defaultCurrency) {
  return formatMinorCurrency(cents, resolveLocale(locale), normalizeDisplayCurrency(currency));
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
