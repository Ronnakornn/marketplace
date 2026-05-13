import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";

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

export default async function AdminProfilePage() {
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
    { label: "Name", value: session.user.name },
    { label: "Email", value: session.user.email },
    { label: "Role", value: session.user.role ?? "ADMIN" },
    { label: "User ID", value: session.user.id },
    {
      label: "Account created",
      value: getOptionalDateLabel(maybeSession.user?.createdAt, "Not available"),
    },
    {
      label: "Account updated",
      value: getOptionalDateLabel(maybeSession.user?.updatedAt, "Not available"),
    },
    {
      label: "Session created",
      value: getOptionalDateLabel(maybeSession.session?.createdAt, "Not available"),
    },
    {
      label: "Session expires",
      value: getOptionalDateLabel(maybeSession.session?.expiresAt, "Not available"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro
        eyebrow="Identity"
        title="Control-room profile"
        description="Review current account and session details for the active administrator."
      >
        <AdminSpaceCat mode="profile" />
      </AdminPageIntro>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <Card className="admin-panel rounded-2xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Profile details</CardTitle>
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
          <CardTitle className="text-white">Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge className="border border-cyan-300/20 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/12">
            {session.user.role ?? "ADMIN"}
          </Badge>
          <p className="text-sm text-slate-300">
            This view is read-only. Account edits stay outside the admin profile page for now.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
