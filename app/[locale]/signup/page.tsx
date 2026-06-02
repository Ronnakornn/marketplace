import { redirect } from "next/navigation";
import { SignupForm } from "#/features/auth";
import { resolveOptionalNextPath } from "#/features/auth/redirect";
import { resolveLocale, withLocale } from "#/i18n/config";
import { getServerSession } from "#/lib/auth-server";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const session = await getServerSession();
  const nextPath = resolveOptionalNextPath(next);

  if (session) {
    redirect(nextPath ?? withLocale("/", resolveLocale(locale)));
  }

  return <SignupForm nextPath={nextPath} />;
}
