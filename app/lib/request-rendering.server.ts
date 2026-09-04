import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { isLocale, stripLocale } from "#/i18n/config";
import { getServerSession } from "#/lib/auth-server";

export function canRenderMinimalAnonymousHome(pathname: string, hasSession: boolean): boolean {
  return isLocale(pathname.split("/")[1]) && stripLocale(pathname) === "/" && !hasSession;
}

export const isAnonymousMarketplaceHomeRequest = cache(async function isAnonymousMarketplaceHomeRequest() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!canRenderMinimalAnonymousHome(pathname, false)) return false;
  return !await getServerSession();
});
