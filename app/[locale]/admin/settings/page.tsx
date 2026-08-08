import { SettingsIcon } from "lucide-react";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { createTranslator } from "#/i18n/server";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = createTranslator(locale);
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.settings.eyebrow" title="admin.pages.settings.title" description="admin.pages.settings.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <SettingsIcon className="size-5 text-cyan-200" />
            {t("admin.pages.settings.cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>{t("admin.settingsReadOnly")}</p>
          <p>{t("admin.settingsManaged")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
