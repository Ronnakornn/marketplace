import { redirect } from "next/navigation";
import { ChangePasswordForm } from "#/features/auth";
import { resolveLocale, withLocale } from "#/i18n/config";
import { getServerSession } from "#/lib/auth-server";

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect(withLocale("/login?next=/change-password", resolveLocale(locale)));
  }

  return <ChangePasswordForm />;
}
