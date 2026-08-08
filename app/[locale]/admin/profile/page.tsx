import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";
import { createTranslator } from "#/i18n/server";

function getOptionalDateLabel(
  value: unknown,
  fallback: string,
) {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString();
}

export default async function AdminProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = createTranslator(locale);
  const session = await requireAdmin();
  const maybeSession = session as {
    session?: {
      expiresAt?: string | Date;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    };
    user?: {
      createdAt?: string | Date;
      updatedAt?: string | Date;
    };
  };

  const profileItems = [
    { label: t("admin.userManagement.name"), value: session.user.name },
    { label: t("admin.userManagement.email"), value: session.user.email },
    { label: t("admin.role"), value: session.user.role ?? "ADMIN" },
    { label: t("admin.profile.userId"), value: session.user.id },
    {
      label: t("admin.profile.accountCreated"),
      value: getOptionalDateLabel(maybeSession.user?.createdAt, t("admin.profile.notAvailable")),
    },
    {
      label: t("admin.profile.accountUpdated"),
      value: getOptionalDateLabel(maybeSession.user?.updatedAt, t("admin.profile.notAvailable")),
    },
    {
      label: t("admin.profile.sessionCreated"),
      value: getOptionalDateLabel(maybeSession.session?.createdAt, t("admin.profile.notAvailable")),
    },
    {
      label: t("admin.profile.sessionExpires"),
      value: getOptionalDateLabel(maybeSession.session?.expiresAt, t("admin.profile.notAvailable")),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow={t("admin.profile.eyebrow")}
        title={t("admin.profile.title")}
        description={t("admin.profile.description")}
      >
        <AdminSpaceCat mode="profile" />
      </AdminPageIntro>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">{t("admin.profileDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {profileItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 break-words text-sm font-medium text-slate-100">
                {item.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">{t("admin.access")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge className="border border-cyan-300/20 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/12">
            {session.user.role ?? "ADMIN"}
          </Badge>
          <p className="text-sm text-slate-300">
            {t("admin.profile.readOnly")}
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
