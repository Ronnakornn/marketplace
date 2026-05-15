import { redirect } from "next/navigation";
import { SignupForm } from "#/features/auth";
import { resolveLocale, withLocale } from "#/i18n/config";
import { getServerSession } from "#/lib/auth-server";

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession();

  if (session) {
    redirect(withLocale("/", resolveLocale(locale)));
  }

  return <SignupForm />;
}
