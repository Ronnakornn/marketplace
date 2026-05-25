import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "#server/lib/auth";
import { prisma } from "#server/lib/prisma";
import { defaultLocale, isLocale, withLocale } from "#/i18n/config";
import { isAdminRole } from "#/lib/roles";

export const getServerSession = cache(async function getServerSession() {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return null;
  }
});

export async function requireUser() {
  const session = await getServerSession();

  if (!session) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const locale = pathname.split("/").find(isLocale) ?? defaultLocale;
    const loginPath = withLocale("/login", locale);
    const nextPath = pathname || withLocale("/", locale);
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
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
  const access = await getSellerAccess();

  if (!access.hasActiveShop) {
    notFound();
  }

  return access.session;
}

export const getSellerAccess = cache(async function getSellerAccess() {
  const session = await requireUser();

  const [activeShops, application] = await Promise.all([
    prisma.shop.findMany({
      where: { ownerId: session.user.id, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { createdAt: "asc" },
    }),

    prisma.sellerApplication.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, rejectionReason: true, shopId: true },
    }),
  ]);

  return {
    session,
    hasActiveShop: activeShops.length > 0,
    activeShop: activeShops[0] ?? null,
    activeShops,
    application,
  };
});
