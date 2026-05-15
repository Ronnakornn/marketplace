"use client";

import dynamic from "next/dynamic";

interface HomeMarketplaceClientProps {
  user?: {
    name?: string;
    email?: string;
  } | null;
}

const MarketplaceHome = dynamic(
  () => import("#/features/marketplace/components/MarketplaceHome").then((mod) => mod.MarketplaceHome),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-[#f7f8fb] pb-36 text-slate-950" />,
  },
);

export function HomeMarketplaceClient(props: HomeMarketplaceClientProps) {
  return <MarketplaceHome {...props} />;
}
