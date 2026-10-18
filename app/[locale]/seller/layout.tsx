import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SellerShell } from "#/features/seller/components/SellerShell";
import { getSellerAccess } from "#/lib/auth-server";
import { privatePageMetadata } from "#/lib/seo";
import { I18nProvider } from "#/i18n/client";
import { resolveLocale } from "#/i18n/config";
import { getClientMessages } from "#/i18n/server";

export const metadata: Metadata = privatePageMetadata;

export default async function SellerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const [access, { locale }] = await Promise.all([getSellerAccess(), params]);
  const messages = await getClientMessages(locale, "seller");

  return (
    <I18nProvider locale={resolveLocale(locale)} messages={messages}>
      <SellerShell
        activeShop={access.activeShop}
        activeShops={access.activeShops}
        user={{ name: access.session.user.name, email: access.session.user.email }}
      >
        {children}
      </SellerShell>
    </I18nProvider>
  );
}
