"use client";

import dynamic from "next/dynamic";

const CreatorDashboardPage = dynamic(
  () => import("#/features/affiliate").then((mod) => mod.CreatorDashboardPage),
  { ssr: false }
);

export default function AffiliatesRoutePage() {
  return <CreatorDashboardPage />;
}
