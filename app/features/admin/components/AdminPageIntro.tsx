"use client";

import type { ReactNode } from "react";
import { PanelTopIcon } from "lucide-react";
import { useTranslations } from "#/i18n/client";

interface AdminPageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function AdminPageIntro(props: AdminPageIntroProps) {
  const t = useTranslations();
  const resolve = (value: string) => value.startsWith("admin.") ? t(value as Parameters<typeof t>[0]) : value;
  const { eyebrow, title, description, children } = props;

  return (
    <section className="admin-panel rounded-xl px-5 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <PanelTopIcon className="size-3.5" />
            {resolve(eyebrow)}
          </div>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {resolve(title)}
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            {resolve(description)}
          </p>
        </div>
        {children ? <div>{children}</div> : null}
      </div>
    </section>
  );
}
