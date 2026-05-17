import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "#/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;
const localeCookieName = "marketplace-locale";

function detectLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const accepted = request.headers.get("accept-language") ?? "";
  const preferred = accepted
    .split(",")
    .map((part) => part.trim().split(";")[0]?.split("-")[0])
    .find(isLocale);

  return preferred ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(url);
  }

  const firstSegment = pathname.split("/")[1];

  if (firstSegment && !isLocale(firstSegment) && locales.some((locale) => firstSegment.length === locale.length)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  if (isLocale(firstSegment)) {
    const response = NextResponse.next();
    response.cookies.set(localeCookieName, firstSegment, {
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
