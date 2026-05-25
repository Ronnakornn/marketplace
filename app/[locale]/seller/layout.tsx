import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SellerShell } from "#/features/seller";
import { getSellerAccess } from "#/lib/auth-server";
import { privatePageMetadata } from "#/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const access = await getSellerAccess();

  return (
    <SellerShell
      activeShop={access.activeShop}
      activeShops={access.activeShops}
      user={{ name: access.session.user.name, email: access.session.user.email }}
    >
      {children}
    </SellerShell>
  );
}
