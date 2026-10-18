import "server-only";
import type { Locale } from "./config";
import { fallbackLocale, resolveLocale } from "./config";
import enMessages from "../../messages/en.json";
import thMessages from "../../messages/th.json";
import { mergeMessages, type MessageDictionary } from "./messages";

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

type ClientMessageScope = "public" | "admin" | "seller";

function selectClientMessages(dictionary: Messages, scope: ClientMessageScope): MessageDictionary {
  if (scope === "admin") return { admin: dictionary.admin, seller: { kyc: dictionary.seller.kyc } };
  if (scope === "seller") return { seller: dictionary.seller };
  const { admin, seller, ...shared } = dictionary;
  return { ...shared, admin: { statuses: admin.statuses }, seller: { dashboard: seller.dashboard } };
}

export async function getClientMessages(locale: string | undefined, scope: ClientMessageScope = "public"): Promise<MessageDictionary> {
  const primary = selectClientMessages(messages[resolveLocale(locale)], scope);
  const fallback = selectClientMessages(messages[fallbackLocale], scope);
  return mergeMessages(fallback, primary);
}

export function createTranslator(locale: string | undefined) {
  const resolvedLocale = resolveLocale(locale);
  const primary = messages[resolvedLocale];
  const fallback = messages[fallbackLocale];

  return function t(key: TranslationKey | string): string {
    return readPath(primary, key) ?? readPath(fallback, key) ?? key;
  };
}
