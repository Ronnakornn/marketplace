import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "#server/lib/auth";
import { prisma } from "#server/lib/prisma";
import { defaultLocale, isLocale, withLocale } from "#/i18n/config";
import { isAdminRole } from "#/lib/roles";

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
  const access = await getSellerAccess();

  if (!access.hasActiveShop) {
    notFound();
  }

  return access.session;
}

export async function getSellerAccess() {
  const session = await requireUser();

  const [activeShop, application] = await Promise.all([
    prisma.shop.findFirst({
      where: { ownerId: session.user.id, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, status: true },
    }),

    prisma.sellerApplication.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, rejectionReason: true, shopId: true },
    }),
  ]);

  return {
    session,
    hasActiveShop: Boolean(activeShop),
    activeShop,
    application,
  };
}
