import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppChrome from "#/components/AppChrome";
import { Providers } from "#/providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Full-stack marketplace with Next.js, Elysia, Prisma, and Better Auth.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
