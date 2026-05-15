import type { Metadata } from "next";
import { DealsPage } from "#/features/buyer";
import { publicPageMetadata } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return publicPageMetadata({
    title: "Deals",
    description: "Flash sale products, vouchers, and marketplace deals.",
    path: "/deals",
    locale,
  });
}

export default function DealsRoutePage() {
  return <DealsPage />;
}
