import type { ReactNode } from "react";
import { AdminGalaxyScene, AdminSidebarNav } from "#/features/admin";
import { requireAdmin } from "#/lib/auth-server";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await requireAdmin();

  return (
    <div className="admin-galaxy min-h-screen">
      <AdminGalaxyScene />
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
  );
}
