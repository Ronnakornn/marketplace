import { AdminFraudCasesTable, AdminPageIntro } from "#/features/admin";

export default function AdminFraudPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageIntro eyebrow="Risk" title="Fraud Cases" description="Review rule-generated risk cases before they affect marketplace operations." />
      <AdminFraudCasesTable />
    </div>
  );
}
