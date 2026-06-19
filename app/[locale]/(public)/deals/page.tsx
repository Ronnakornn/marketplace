import type { Metadata } from "next";
import { DealsPage } from "#/features/buyer";
import { createTranslator } from "#/i18n/server";
import { publicPageMetadata } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createTranslator(locale);
  return publicPageMetadata({
    title: t("common.deals"),
    description: t("seo.dealsDescription"),
    path: "/deals",
    locale,
  });
}

export default function DealsRoutePage() {
  return <DealsPage />;
}
