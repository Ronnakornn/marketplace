import { redirect } from "next/navigation";
import { LoginForm } from "#/features/auth";
import { resolveLocale, withLocale } from "#/i18n/config";
import { getServerSession } from "#/lib/auth-server";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const session = await getServerSession();
  const nextPath = resolveNextPath(next);

  if (session) {
    redirect(nextPath ?? withLocale("/", resolveLocale(locale)));
  }

  return <LoginForm nextPath={nextPath} />;
}

function resolveNextPath(next: string | undefined) {
  if (!next?.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}
