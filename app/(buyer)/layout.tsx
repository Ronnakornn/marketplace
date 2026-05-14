import type { ReactNode } from "react";
import { BuyerPageShell } from "#/components/BuyerShell";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <BuyerPageShell>{children}</BuyerPageShell>;
}
