import { redirect } from "next/navigation";
import { resolveLocale, type Locale, withLocale } from "#/i18n/config";
import { getSellerAccess } from "#/lib/auth-server";
import { getSellerRedirectPath } from "#/lib/seller-access";

export async function enforceSellerRoute(pathname: string, locale: string | Locale) {
  const access = await getSellerAccess();
  const redirectPath = getSellerRedirectPath(pathname, access);

  if (redirectPath) {
    redirect(withLocale(redirectPath, resolveLocale(locale)));
  }
}
