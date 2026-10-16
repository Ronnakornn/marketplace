import { AdminFlashSaleManager } from "#/features/admin/components/AdminFlashSaleManager";
import { AdminPageIntro } from "#/features/admin/components/AdminPageIntro";

export default function AdminFlashSalesPage() {
  return <div className="flex flex-col gap-6"><AdminPageIntro eyebrow="admin.flashSales.eyebrow" title="admin.flashSales.title" description="admin.flashSales.description" /><AdminFlashSaleManager /></div>;
}
