import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteName, getSiteUrl, resolveSeoImage, safeDescription } from "#/lib/seo";
import { Providers } from "#/providers";
import "./styles.css";

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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
