import { headers } from "next/headers";
import type { ReactNode } from "react";
import { isLocale, stripLocale } from "#/i18n/config";

interface AppChromeProps {
  children: ReactNode;
}

export default async function AppChrome({ children }: AppChromeProps) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const hasLocaleSegment = isLocale(pathname.split("/")[1]);
  if (!hasLocaleSegment) return <>{children}</>;

  const pathWithoutLocale = stripLocale(pathname);
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");
  const isSellerRoute = pathWithoutLocale.startsWith("/seller");
  const isAuthRoute = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/change-password"].some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`),
  );
  const isMarketplaceHome = pathWithoutLocale === "/";
  const isShopRoute = pathWithoutLocale === "/shops" || pathWithoutLocale.startsWith("/shops/");
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

  if (isAdminRoute || isSellerRoute || isAuthRoute || isMarketplaceHome || isShopRoute || isBuyerRoute) {
    return <>{children}</>;
  }

  const [{ default: Header }, { default: Footer }] = await Promise.all([
    import("#/components/Header"),
    import("#/components/Footer"),
  ]);

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-80px)]">{children}</main>
      <Footer />
    </>
  );
}
