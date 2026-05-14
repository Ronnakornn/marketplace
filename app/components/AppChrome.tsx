"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Footer from "#/components/Footer";
import Header from "#/components/Header";

interface AppChromeProps {
  children: ReactNode;
}

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isMarketplaceHome = pathname === "/";
  const isBuyerRoute = [
    "/search",
    "/categories",
    "/products",
    "/cart",
    "/checkout",
    "/orders",
    "/profile",
    "/notifications",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (isAdminRoute || isMarketplaceHome || isBuyerRoute) {
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
