import { AdminPageIntro, AdminSpaceCat } from "#/features/admin";
import { AuditLogsTable } from "#/features/audit-log";

export default function AdminAuditLogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Governance" title="Audit Logs" description="Read-only administrative event history for sensitive marketplace changes.">
        <AdminSpaceCat mode="dashboard" />
      </AdminPageIntro>
      <AuditLogsTable />
    </div>
  );
}
