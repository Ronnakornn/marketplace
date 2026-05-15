import "server-only";
import type { Locale } from "./config";
import { fallbackLocale, resolveLocale } from "./config";
import enMessages from "../../messages/en.json";
import thMessages from "../../messages/th.json";

type Messages = typeof enMessages;
export type TranslationKey = Leaves<Messages>;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Leaves<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

const messages = {
  en: enMessages,
  th: thMessages,
} satisfies Record<Locale, Messages>;

function readPath(source: unknown, key: string): string | undefined {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source) as string | undefined;
}

export async function getMessages(locale: string | undefined): Promise<Messages> {
  return messages[resolveLocale(locale)];
}

export function createTranslator(locale: string | undefined) {
  const resolvedLocale = resolveLocale(locale);
  const primary = messages[resolvedLocale];
  const fallback = messages[fallbackLocale];

  return function t(key: TranslationKey): string {
    return readPath(primary, key) ?? readPath(fallback, key) ?? key;
  };
}
