import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import AppChrome from "#/components/AppChrome";
import { I18nProvider } from "#/i18n/client";
import { fallbackLocale, isLocale, locales, type Locale } from "#/i18n/config";
import { getMessages } from "#/i18n/server";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [messages, fallbackMessages] = await Promise.all([
    getMessages(locale),
    getMessages(fallbackLocale),
  ]);

  return (
    <I18nProvider locale={locale as Locale} messages={messages} fallbackMessages={fallbackMessages}>
      <AppChrome>{children}</AppChrome>
    </I18nProvider>
  );
}
