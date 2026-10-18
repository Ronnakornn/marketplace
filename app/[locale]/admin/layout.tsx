import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebarNav } from "#/features/admin/components/AdminSidebarNav";
import { requireAdmin } from "#/lib/auth-server";
import { privatePageMetadata } from "#/lib/seo";
import { Providers } from "#/providers";
import { I18nProvider } from "#/i18n/client";
import { resolveLocale } from "#/i18n/config";
import { getClientMessages } from "#/i18n/server";

export const metadata: Metadata = privatePageMetadata;

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const [session, { locale }] = await Promise.all([requireAdmin(), params]);
  const messages = await getClientMessages(locale, "admin");

  return (
    <I18nProvider locale={resolveLocale(locale)} messages={messages}>
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
    </I18nProvider>
  );
}
