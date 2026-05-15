import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import {
  HomeAuthenticatedSection,
  HomeGuestSection,
} from "#/features/home";
import { getServerSession } from "#/lib/auth-server";
import { getSiteName, publicPageMetadata, safeDescription, websiteJsonLd } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return publicPageMetadata({
    title: getSiteName(),
    description: safeDescription(undefined, "Shop active products, trusted sellers, and marketplace deals."),
    path: "/",
    locale,
  });
}

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    return (
      <>
        <JsonLd data={websiteJsonLd()} />
        <HomeAuthenticatedSection user={session.user} />
      </>
    );
  }

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <HomeGuestSection />
    </>
  );
}
