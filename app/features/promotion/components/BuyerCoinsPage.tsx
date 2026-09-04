"use client";

import { CoinsIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useBuyerCoinHistory } from "../hooks/useBuyerCoins";

export function BuyerCoinsPage() {
  const t = useTranslations();
  const formatters = useFormatters();
  const coins = useBuyerCoinHistory();
  const wallet = coins.data?.pages[0];
  const entries = coins.data?.pages.flatMap((page) => page?.entries ?? []) ?? [];

  return <>
    <BuyerTopBar title={t("coins.title")} />
    <main className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4">
      {coins.isLoading ? <BuyerLoadingList /> : null}
      {coins.isError ? <BuyerErrorState message={t("coins.loadError")} onRetry={() => void coins.refetch()} /> : null}
      {wallet ? <>
        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-orange-50 text-orange-600"><CoinsIcon className="size-6" /></span>
            <div><p className="text-sm text-slate-500">{t("coins.available")}</p><p className="text-3xl font-extrabold text-slate-950">{formatters.number(wallet.balance)}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">{t("coins.pending")}</p><p className="mt-1 font-bold text-slate-950">{formatters.number(wallet.pendingBalance)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">{t("coins.lifetimeEarned")}</p><p className="mt-1 font-bold text-slate-950">{formatters.number(wallet.lifetimeEarned)}</p></div>
          </div>
          {wallet.debtBalance > 0 ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-bold text-amber-900">{t("coins.debt")}: {formatters.number(wallet.debtBalance)}</p><p className="mt-1 text-amber-800">{t("coins.debtDescription")}</p></div> : null}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">{t("coins.history")}</h2>
          {!entries.length ? <BuyerEmptyState title={t("coins.emptyTitle")} description={t("coins.emptyDescription")} /> : null}
          <div className="mt-3 divide-y divide-slate-100">{entries.map((entry) => {
            const isDebit = entry.type === "SPENT" || entry.type === "EXPIRED" || (entry.type === "ADJUSTMENT" && entry.amount < 0);
            const displayAmount = isDebit ? -Math.abs(entry.amount) : Math.abs(entry.amount);
            return <article key={entry.id} className="flex items-start justify-between gap-3 py-3">
            <div><p className="font-semibold text-slate-950">{t(`coins.types.${entry.type}`)}</p><p className="mt-1 text-xs text-slate-500">{entry.reason ?? formatters.date(entry.createdAt)}</p></div>
            <div className="text-right"><p className={displayAmount < 0 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>{displayAmount > 0 ? "+" : ""}{formatters.number(displayAmount)}</p><p className="text-xs text-slate-500">{t(`coins.statuses.${entry.status}`)}</p></div>
          </article>})}</div>
          {coins.hasNextPage ? <button type="button" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800" disabled={coins.isFetchingNextPage} onClick={() => void coins.fetchNextPage()}>{coins.isFetchingNextPage ? t("coins.loadingMore") : t("coins.loadMore")}</button> : null}
        </section>
      </> : null}
    </main>
  </>;
}
