import { AdminFlashSaleManager, AdminPageIntro } from "#/features/admin";

export default function AdminFlashSalesPage() {
  return <div className="flex flex-col gap-6"><AdminPageIntro eyebrow="admin.flashSales.eyebrow" title="admin.flashSales.title" description="admin.flashSales.description" /><AdminFlashSaleManager /></div>;
}
