"use client";
import { Input } from "#/components/ui/input";
import { useState } from "react";
import { useLocale, useTranslations } from "#/i18n/client";
export function AdminOrderDocuments() {
  const t = useTranslations(),
    locale = useLocale(),
    [orderId, setOrderId] = useState("");
  const valid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderId,
    );
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <h1 className="text-2xl font-semibold text-white">
        {t("admin.reporting.documents")}
      </h1>
      <p className="text-sm leading-relaxed text-slate-300">
        {t("admin.reporting.documentNote")}
      </p>
      <label className="flex max-w-md flex-col gap-2 text-sm text-slate-300">
        {t("admin.reporting.orderId")}
        <Input
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          className="rounded border border-input bg-background px-3 py-2 text-foreground"
        />
      </label>
      {valid ? (
        <div className="flex gap-4">
          {(["INVOICE", "RECEIPT"] as const).map((kind) => (
            <a
              key={kind}
              className="rounded border border-white/20 px-4 py-2 text-sm text-cyan-200"
              href={`/api/admin/orders/${orderId}/documents/${kind}?locale=${locale}`}
            >
              {t(`admin.reporting.${kind}`)}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          {t("admin.reporting.enterOrderId")}
        </p>
      )}
    </section>
  );
}
