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

  if (isAdminRoute || isMarketplaceHome) {
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
