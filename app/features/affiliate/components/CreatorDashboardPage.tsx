"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3Icon, CopyIcon, LinkIcon, MousePointerClickIcon, PlusIcon, SearchIcon, SparklesIcon, TargetIcon } from "lucide-react";
import { BuyerTopBar } from "#/components/BuyerShell";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { useFormatters, useTranslations } from "#/i18n/client";
import { affiliateProductTargetsQueryOptions, fetchAffiliateProductTargets, normalizeAffiliateProductTargets } from "#/features/product/queries";
import {
  affiliateTrackingUrl,
  createAffiliateLink,
  fetchAffiliateLinks,
  fetchAffiliateStats,
  fetchAffiliateTargets,
  formatAffiliateMoney,
  type AffiliateTargetOption,
  type AffiliateTargetType,
} from "../api";

const TARGET_TYPES: AffiliateTargetType[] = ["product", "shop", "campaign"];

export function CreatorDashboardPage() {
  const t = useTranslations();
  const formatters = useFormatters();
  const queryClient = useQueryClient();
  const [targetType, setTargetType] = useState<AffiliateTargetType>("product");
  const [targetQuery, setTargetQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<AffiliateTargetOption | null>(null);
  const [code, setCode] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const statsQuery = useQuery({ queryKey: ["affiliate", "stats"], queryFn: fetchAffiliateStats });
  const linksQuery = useQuery({ queryKey: ["affiliate", "links"], queryFn: fetchAffiliateLinks });
  const productTargetsQuery = affiliateProductTargetsQueryOptions({ q: targetQuery, limit: 8 });
  const targetsQuery = useQuery({
    queryKey: targetType === "product" ? productTargetsQuery.queryKey : ["affiliate", "targets", targetType, targetQuery],
    queryFn: async () => {
      if (targetType !== "product") {
        return fetchAffiliateTargets({ targetType, q: targetQuery, limit: 8 });
      }

      return normalizeAffiliateProductTargets(await fetchAffiliateProductTargets({ q: targetQuery, limit: 8 }));
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: createAffiliateLink,
    onSuccess: async () => {
      setCode("");
      setSelectedTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["affiliate", "links"] }),
        queryClient.invalidateQueries({ queryKey: ["affiliate", "stats"] }),
      ]);
    },
  });

  const links = linksQuery.data ?? [];
  const targetItems = targetsQuery.data ?? [];
  const error = statsQuery.error ?? linksQuery.error;

  function handleTargetType(value: AffiliateTargetType) {
    setTargetType(value);
    setSelectedTarget(null);
    setTargetQuery("");
  }

  function handleCreate() {
    if (!selectedTarget || createLinkMutation.isPending) return;
    createLinkMutation.mutate({
      code: code.trim() || undefined,
      targetType,
      targetId: selectedTarget.id,
    });
  }

  async function copyLink(linkCode: string) {
    const url = affiliateTrackingUrl(linkCode);
    await navigator.clipboard.writeText(url);
    setCopiedCode(linkCode);
    window.setTimeout(() => setCopiedCode((current) => current === linkCode ? "" : current), 1800);
  }

  return (
    <>
      <ClientOnlyBuyerTopBar title={t("affiliate.affiliates")} />
      <main className="mx-auto max-w-6xl space-y-5 px-3 pb-28 pt-4">
        {error ? <BuyerErrorState message={error.message} onRetry={() => { void statsQuery.refetch(); void linksQuery.refetch(); }} /> : null}

        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <Badge className="rounded-full bg-orange-600"><SparklesIcon className="mr-1 size-3" />{t("affiliate.affiliates")}</Badge>
              <h1 className="mt-3 text-2xl font-extrabold text-slate-950">{t("affiliate.title")}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("affiliate.shareDescription")}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:min-w-96">
              <StatCard icon={MousePointerClickIcon} label={t("affiliate.clicks")} value={String(statsQuery.data?.clicks ?? 0)} />
              <StatCard icon={TargetIcon} label={t("affiliate.conversions")} value={String(statsQuery.data?.conversions ?? 0)} />
              <StatCard icon={BarChart3Icon} label={t("affiliate.commission")} value={formatAffiliateMoney(statsQuery.data?.commissionCents ?? 0)} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><PlusIcon className="size-5 text-orange-600" />{t("affiliate.newLink")}</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>{t("affiliate.targetType")}</Label>
                <Select value={targetType} onValueChange={(value) => handleTargetType(value as AffiliateTargetType)}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((item) => <SelectItem key={item} value={item}>{targetTypeLabel(item, t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("affiliate.searchTarget")}</Label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3">
                  <SearchIcon className="size-4 shrink-0 text-slate-400" />
                  <Input value={targetQuery} onChange={(event) => setTargetQuery(event.target.value)} placeholder={targetSearchPlaceholder(targetType, t)} className="border-0 px-0 shadow-none focus-visible:ring-0" />
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {targetsQuery.isLoading ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t("common.loading")}</p> : null}
                  {targetItems.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setSelectedTarget(target)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${selectedTarget?.id === target.id ? "border-orange-300 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <p className="text-sm font-bold text-slate-950">{target.label}</p>
                      {target.description ? <p className="mt-0.5 text-xs text-slate-500">{target.description}</p> : null}
                    </button>
                  ))}
                  {targetsQuery.isSuccess && targetItems.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t("affiliate.noTargetsFound")}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("affiliate.customCode")}</Label>
                <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("affiliate.customCodePlaceholder")} className="rounded-2xl" />
              </div>

              {createLinkMutation.error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{createLinkMutation.error.message}</p> : null}
              <Button onClick={handleCreate} disabled={!selectedTarget || createLinkMutation.isPending} className="w-full rounded-2xl bg-orange-600 hover:bg-orange-700">
                <LinkIcon className="size-4" />
                {createLinkMutation.isPending ? t("affiliate.creating") : t("affiliate.createLink")}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">{t("affiliate.yourLinks")}</h2>
              <Badge variant="outline" className="rounded-full">{links.length} {t("affiliate.activeRecords")}</Badge>
            </div>
            {linksQuery.isLoading ? <BuyerLoadingList /> : null}
            {linksQuery.isSuccess && links.length === 0 ? <BuyerEmptyState title={t("affiliate.noLinksTitle")} description={t("affiliate.createFirstLink")} /> : null}
            <div className="grid gap-3">
              {links.map((link) => (
                <article key={link.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full bg-orange-600">{link.code}</Badge>
                        <Badge variant="outline" className="rounded-full capitalize">{link.targetType}</Badge>
                        <Badge variant="outline" className="rounded-full">{link.status}</Badge>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-950">{affiliateTrackingUrl(link.code)}</p>
                      <p className="mt-1 text-xs text-slate-500">{t("affiliate.target")} {link.targetId} / {t("affiliate.created")} {formatters.date(link.createdAt)}</p>
                    </div>
                    <Button variant="outline" className="shrink-0 rounded-full" onClick={() => void copyLink(link.code)}>
                      <CopyIcon className="size-4" />
                      {copiedCode === link.code ? t("affiliate.copied") : t("affiliate.copy")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function ClientOnlyBuyerTopBar({ title }: { title: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <BuyerTopBar title={title} />;
}

function StatCard({ icon: Icon, label, value }: { icon: typeof MousePointerClickIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
      <Icon className="size-4 text-orange-600" />
      <p className="mt-2 text-lg font-extrabold text-slate-950">{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function targetSearchPlaceholder(targetType: AffiliateTargetType, t: ReturnType<typeof useTranslations>) {
  if (targetType === "shop") return t("affiliate.searchShops");
  if (targetType === "campaign") return t("affiliate.searchCampaigns");
  return t("affiliate.searchProducts");
}

function targetTypeLabel(targetType: AffiliateTargetType, t: ReturnType<typeof useTranslations>) {
  if (targetType === "shop") return t("affiliate.shop");
  if (targetType === "campaign") return t("affiliate.campaign");
  return t("affiliate.product");
}
