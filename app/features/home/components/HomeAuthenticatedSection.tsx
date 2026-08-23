import { HomeMarketplaceClient } from "./HomeMarketplaceClient";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";
import { I18nProvider } from "#/i18n/client";
import { fallbackLocale, type Locale } from "#/i18n/config";
import { getMessages } from "#/i18n/server";
import { Providers } from "#/providers";

interface HomeAuthenticatedSectionProps {
  initialHome?: DiscoveryHomeResponse;
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
  locale: Locale;
}

export async function HomeAuthenticatedSection({
  initialHome,
  user,
  locale,
}: HomeAuthenticatedSectionProps) {
  const [messages, fallbackMessages] = await Promise.all([
    getMessages(locale),
    getMessages(fallbackLocale),
  ]);

  return (
    <I18nProvider locale={locale} messages={messages} fallbackMessages={fallbackMessages}>
      <Providers>
        <HomeMarketplaceClient initialHome={initialHome} user={user} />
      </Providers>
    </I18nProvider>
  );
}
