import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import AppChrome from "#/components/AppChrome";
import { I18nProvider } from "#/i18n/client";
import { isLocale, locales } from "#/i18n/config";
import { getClientMessages } from "#/i18n/server";

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

  const messages = await getClientMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <AppChrome>{children}</AppChrome>
    </I18nProvider>
  );
}
