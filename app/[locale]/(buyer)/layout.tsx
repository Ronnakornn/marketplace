import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BuyerPageShell } from "#/components/BuyerShell";
import { privatePageMetadata } from "#/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <BuyerPageShell>{children}</BuyerPageShell>;
}
