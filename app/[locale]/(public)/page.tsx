import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import {
  HomeAuthenticatedSection,
  HomeGuestSection,
} from "#/features/home";
import { getInitialMarketplaceHome } from "#/features/home/home-data.server";
import { isLocale } from "#/i18n/config";
import { createTranslator } from "#/i18n/server";
import { getServerSession } from "#/lib/auth-server";
import { getSiteName, publicPageMetadata, safeDescription, websiteJsonLd } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createTranslator(locale);
  return publicPageMetadata({
    title: getSiteName(),
    description: safeDescription(undefined, t("seo.homeDescription")),
    path: "/",
    locale,
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = isLocale(requestedLocale) ? requestedLocale : "th";
  const [session, initialHome] = await Promise.all([
    getServerSession(),
    getInitialMarketplaceHome(locale),
  ]);

  if (session) {
    return (
      <>
        <JsonLd data={websiteJsonLd()} />
        <HomeAuthenticatedSection initialHome={initialHome} user={session.user} />
      </>
    );
  }

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <HomeGuestSection initialHome={initialHome} />
    </>
  );
}
