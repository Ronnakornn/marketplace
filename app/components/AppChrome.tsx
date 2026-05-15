"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Footer from "#/components/Footer";
import Header from "#/components/Header";
import { isLocale, stripLocale } from "#/i18n/config";

interface AppChromeProps {
  children: ReactNode;
}

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const hasLocaleSegment = isLocale(pathname.split("/")[1]);
  if (!hasLocaleSegment) {
    return <>{children}</>;
  }

  const pathWithoutLocale = stripLocale(pathname);
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");
  const isSellerRoute = pathWithoutLocale.startsWith("/seller");
  const isMarketplaceHome = pathWithoutLocale === "/";
  const isBuyerRoute = [
    "/account",
    "/search",
    "/categories",
    "/products",
    "/cart",
    "/chat",
    "/checkout",
    "/followed-shops",
    "/orders",
    "/payment",
    "/profile",
    "/notifications",
    "/vouchers",
    "/wishlist",
  ].some((route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`));

  if (isAdminRoute || isSellerRoute || isMarketplaceHome || isBuyerRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-80px)]">{children}</main>
      <Footer />
    </>
  );
}
