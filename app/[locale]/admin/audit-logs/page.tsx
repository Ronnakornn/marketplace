import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AuditLogsTable } from "#/features/audit-log";

export default function AdminAuditLogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="admin.pages.auditLogs.eyebrow" title="admin.pages.auditLogs.title" description="admin.pages.auditLogs.description">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AuditLogsTable />
    </div>
  );
}
