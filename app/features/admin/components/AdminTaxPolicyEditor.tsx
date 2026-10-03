"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useTranslations } from "#/i18n/client";

type TaxPolicyResponse = NonNullable<Treaty.Data<ReturnType<typeof api.api.admin.checkout["tax-policy"]["get"]>>>;
type TaxPolicyInput = Parameters<typeof api.api.admin.checkout["tax-policy"]["put"]>[0];

function percentageToPpm(value: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) return null;
  const ppm = BigInt(match[1] ?? "0") * 10000n + BigInt((match[2] ?? "").padEnd(4, "0"));
  return ppm <= 1000000n ? Number(ppm) : null;
}

export function AdminTaxPolicyEditor() {
  const t = useTranslations();
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: ["admin", "tax-policy"], queryFn: async () => {
    const { data, error } = await api.api.admin.checkout["tax-policy"].get();
    if (error) throw new Error(t("admin.taxPolicy.loadFailed"));
    if (!data) throw new Error(t("admin.taxPolicy.loadFailed"));
    return data;
  } });
  return <section className="admin-panel rounded-xl border border-white/10 bg-white/5 p-5">
    <h2 className="text-lg font-semibold text-white">{t("admin.taxPolicy.title")}</h2>
    <p className="mt-1 text-sm text-slate-400">{t("admin.taxPolicy.description")}</p>
    {query.isLoading ? <p className="mt-3 text-slate-300">{t("common.loading")}</p> : null}
    {query.isError ? <div role="alert" className="mt-3 text-red-300">{query.error.message}<Button variant="outline" onClick={() => void query.refetch()}>{t("state.retry")}</Button></div> : null}
    {query.data ? <TaxPolicyForm key={query.data.policy.revision} response={query.data} onSaved={() => setSaved(true)} /> : null}
    {saved ? <p role="status" className="mt-3 text-sm text-emerald-300">{t("admin.taxPolicy.saved")}</p> : null}
  </section>;
}

function TaxPolicyForm({ response, onSaved }: { response: TaxPolicyResponse; onSaved: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [rate, setRate] = useState(String(response.policy.ratePpm / 10000));
  const [policy, setPolicy] = useState(response.policy);
  const [validationError, setValidationError] = useState("");
  const save = useMutation({ mutationFn: async (input: TaxPolicyInput) => {
    const { data, error } = await api.api.admin.checkout["tax-policy"].put(input);
    if (error || !data) throw new Error(t("admin.taxPolicy.saveFailed"));
    return data;
  }, onSuccess: async (data) => {
    onSaved();
    queryClient.setQueryData(["admin", "tax-policy"], data);
    await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  } });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ratePpm = percentageToPpm(rate);
    if (ratePpm === null) { setValidationError(t("admin.taxPolicy.invalidRate")); return; }
    setValidationError("");
    save.mutate({ ratePpm, mode: policy.mode, fundingBasis: policy.fundingBasis,
      taxableShipping: policy.taxableShipping, shippingBasis: policy.shippingBasis,
      rounding: policy.rounding, custodian: policy.custodian, exclusiveTaxFunding: policy.exclusiveTaxFunding });
  };
  const fieldClass = "h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100";
  return <form className="mt-4 space-y-4" onSubmit={submit}>
    {!response.settlementEnabled ? <p role="status" className="text-sm text-amber-200">{t("admin.taxPolicy.settlementDisabled")}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="tax-rate">{t("admin.taxPolicy.rate")}</Label><Input id="tax-rate" type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} className={fieldClass} /></div>
      <div className="space-y-2"><Label htmlFor="tax-mode">{t("admin.taxPolicy.mode")}</Label><select id="tax-mode" value={policy.mode} onChange={(event) => setPolicy({ ...policy, mode: event.target.value === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE" })} className={fieldClass}><option value="INCLUSIVE">{t("admin.taxPolicy.inclusive")}</option><option value="EXCLUSIVE">{t("admin.taxPolicy.exclusive")}</option></select></div>
    </div>
    <div className="space-y-2"><Label htmlFor="tax-basis">{t("admin.taxPolicy.basis")}</Label><select id="tax-basis" value={policy.fundingBasis} onChange={(event) => setPolicy({ ...policy, fundingBasis: event.target.value === "SELLER_AFTER_SHOP_COUPON" ? "SELLER_AFTER_SHOP_COUPON" : "BUYER_AFTER_ALL_DISCOUNTS" })} className={fieldClass}><option value="BUYER_AFTER_ALL_DISCOUNTS">{t("admin.taxPolicy.buyerBasis")}</option><option value="SELLER_AFTER_SHOP_COUPON">{t("admin.taxPolicy.sellerBasis")}</option></select></div>
    <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={policy.taxableShipping} onChange={(event) => setPolicy({ ...policy, taxableShipping: event.target.checked })} />{t("admin.taxPolicy.shipping")}</label>
    <p className="text-xs text-slate-400">{t("admin.taxPolicy.fixedRules")}</p>
    {validationError || save.error ? <p role="alert" className="text-sm text-red-300">{validationError || save.error?.message}</p> : null}
    <Button type="submit" disabled={save.isPending}>{t("admin.common.save")}</Button>
  </form>;
}
