import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "#server/lib/auth";
import { defaultLocale, isLocale, withLocale } from "#/i18n/config";
import { isAdminRole, isSellerRole } from "#/lib/roles";

export async function getServerSession() {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getServerSession();

  if (!session) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const locale = pathname.split("/").find(isLocale) ?? defaultLocale;
    redirect(withLocale("/login", locale));
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireUser();

  if (!isAdminRole(session.user.role)) {
    notFound();
  }

  return session;
}

export async function requireSeller() {
  const session = await requireUser();

  if (!isSellerRole(session.user.role)) {
    notFound();
  }

  return session;
}
