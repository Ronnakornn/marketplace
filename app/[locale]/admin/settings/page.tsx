import { SettingsIcon } from "lucide-react";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Configuration" title="Settings" description="Review current administrative configuration surfaces.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <SettingsIcon className="size-5 text-cyan-200" />
            Marketplace settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>Settings APIs are not exposed yet, so this page is intentionally read-only.</p>
          <p>Operational configuration remains managed through environment variables and deployment controls.</p>
        </CardContent>
      </Card>
    </div>
  );
}
