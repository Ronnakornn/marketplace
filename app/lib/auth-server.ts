import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "#server/lib/auth";
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
    redirect("/login");
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
