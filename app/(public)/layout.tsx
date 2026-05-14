import type { ReactNode } from "react";

export default function PublicBuyerLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f8fb] text-slate-950">{children}</div>;
}
