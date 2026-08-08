import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebarNav } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";
import { privatePageMetadata } from "#/lib/seo";
import { Providers } from "#/providers";

export const metadata: Metadata = privatePageMetadata;

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await requireAdmin();

  return (
    <Providers>
      <div className="admin-shell min-h-screen">
        <AdminSidebarNav
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
          }}
        >
          {children}
        </AdminSidebarNav>
      </div>
    </Providers>
  );
}
