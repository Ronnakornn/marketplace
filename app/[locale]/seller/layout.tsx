import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SellerShell } from "#/features/seller";
import { defaultLocale, isLocale, withLocale } from "#/i18n/config";
import { getSellerAccess } from "#/lib/auth-server";
import { privatePageMetadata } from "#/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const access = await getSellerAccess();
  const pathname = (await headers()).get("x-pathname") ?? "";
  const locale = pathname.split("/").find(isLocale) ?? defaultLocale;
  const sellerPath = pathname.replace(/^\/(th|en)(?=\/|$)/, "") || "/seller";
  const isOnboardingPath = sellerPath === "/seller/register" || sellerPath === "/seller/status";

  if (!access.hasActiveShop && !isOnboardingPath) {
    redirect(withLocale(access.application ? "/seller/status" : "/seller/register", locale));
  }
  if (access.hasActiveShop && isOnboardingPath) {
    redirect(withLocale("/seller", locale));
  }

  return (
    <SellerShell user={{ name: access.session.user.name, email: access.session.user.email }}>
      {children}
    </SellerShell>
  );
}
