import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "#/i18n/config";
import {
  getPublishedContent,
  PublicContentBody,
} from "#/features/admin/operations/PublicContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = await getPublishedContent(resolveLocale(locale), slug);
  if (!content?.publishedTitle) return {};
  return {
    title: content.publishedTitle,
    description: content.publishedBody?.slice(0, 160),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const content = await getPublishedContent(resolveLocale(locale), slug);
  if (!content?.publishedTitle || content.publishedBody === null) notFound();
  return (
    <PublicContentBody
      title={content.publishedTitle}
      body={content.publishedBody}
    />
  );
}
