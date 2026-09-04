import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { resolveLocale } from "#/i18n/config";
import { getSiteName, getSiteUrl, resolveSeoImage, safeDescription } from "#/lib/seo";
import { isAnonymousMarketplaceHomeRequest } from "#/lib/request-rendering.server";
import { Providers } from "#/providers";
import "./styles.css";

const notoSansThai = localFont({
  src: "../public/fonts/NotoSansThai-LatinThai-Variable.woff2",
  display: "swap",
  preload: false,
  weight: "100 900",
  variable: "--font-noto-sans-thai",
});

const siteName = getSiteName();
const siteUrl = getSiteUrl();
const description = safeDescription(
  undefined,
  "Shop active products, trusted sellers, and marketplace deals.",
);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  openGraph: {
    title: siteName,
    description,
    url: siteUrl,
    siteName,
    type: "website",
    images: [{ url: resolveSeoImage() }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description,
    images: [resolveSeoImage()],
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const locale = resolveLocale(pathname.split("/")[1]);
  const renderMinimalHomepage = await isAnonymousMarketplaceHomeRequest();

  return (
    <html lang={locale} className={renderMinimalHomepage ? "font-sans" : notoSansThai.className} suppressHydrationWarning>
      <body className="min-h-screen">
        {renderMinimalHomepage ? children : <Providers>{children}</Providers>}
      </body>
    </html>
  );
}
