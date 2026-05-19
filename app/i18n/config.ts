export const locales = ["th", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "th";
export const fallbackLocale: Locale = "en";
export const defaultCurrency = "THB";
export const defaultTimeZone = "Asia/Bangkok";

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  return isLocale(segments[1]) ? `/${segments.slice(2).join("/")}`.replace(/\/$/, "") || "/" : pathname;
}

export function withLocale(pathname: string, locale: Locale): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathWithoutLocale = stripLocale(normalized);
  return pathWithoutLocale === "/" ? `/${locale}` : `/${locale}${pathWithoutLocale}`;
}
