"use client";

import type { ReactNode } from "react";
import { useTranslations } from "#/i18n/client";

interface AdminPageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function AdminPageIntro(props: AdminPageIntroProps) {
  const t = useTranslations();
  const resolve = (value: string) =>
    value.startsWith("admin.") ? t(value as Parameters<typeof t>[0]) : value;
  const { eyebrow, title, description, children } = props;

  return (
    <section className="py-1">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {resolve(eyebrow)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {resolve(title)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {resolve(description)}
          </p>
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
