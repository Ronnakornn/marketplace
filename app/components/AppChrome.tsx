"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isLocale, stripLocale } from "#/i18n/config";

interface AppChromeProps {
  children: ReactNode;
}

const Header = dynamic(() => import("#/components/Header"), { ssr: false });
const Footer = dynamic(() => import("#/components/Footer"), { ssr: false });

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  const hasLocaleSegment = isLocale(pathname.split("/")[1]);
  if (!hasLocaleSegment) {
    return <>{children}</>;
  }

  const pathWithoutLocale = stripLocale(pathname);
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");
  const isSellerRoute = pathWithoutLocale.startsWith("/seller");
  const isAuthRoute = ["/login", "/signup"].some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`),
  );
  const isMarketplaceHome = pathWithoutLocale === "/";
  const isBuyerRoute = [
    "/account",
    "/affiliates",
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

  if (isAdminRoute || isSellerRoute || isAuthRoute || isMarketplaceHome || isBuyerRoute) {
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
