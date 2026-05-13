import type { ReactNode } from "react";
import { SparklesIcon } from "lucide-react";

interface AdminPageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function AdminPageIntro(props: AdminPageIntroProps) {
  const { eyebrow, title, description, children } = props;

  return (
    <section className="admin-panel relative overflow-hidden rounded-2xl px-5 py-6 sm:px-7 sm:py-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.15),transparent_34%),radial-gradient(circle_at_right,rgba(217,70,239,0.12),transparent_30%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
            <SparklesIcon className="size-3.5" />
            {eyebrow}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
            {description}
          </p>
        </div>
        {children ? <div className="relative">{children}</div> : null}
      </div>
    </section>
  );
}
