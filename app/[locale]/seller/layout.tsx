import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SellerShell } from "#/features/seller";
import { defaultLocale, isLocale, stripLocale, withLocale } from "#/i18n/config";
import { getSellerAccess } from "#/lib/auth-server";
import { getSellerRedirectPath, getSellerRouteKind } from "#/lib/seller-access";
import { privatePageMetadata } from "#/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const access = await getSellerAccess();
  const pathname = (await headers()).get("x-pathname") ?? "";
  const locale = pathname.split("/").find(isLocale) ?? defaultLocale;
  const sellerPath = stripLocale(pathname) || "/seller";
  const redirectPath = getSellerRedirectPath(sellerPath, access);

  if (redirectPath) {
    redirect(withLocale(redirectPath, locale));
  }

  return (
    <SellerShell
      activeShop={access.activeShop}
      activeShops={access.activeShops}
      routeKind={getSellerRouteKind(sellerPath)}
      user={{ name: access.session.user.name, email: access.session.user.email }}
    >
      {children}
    </SellerShell>
  );
}
