"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRingIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  registerPushServiceWorker,
  savePushSubscription,
  subscribeBrowserToPush,
  supportsWebPush,
  unsubscribePushForCurrentBrowser,
} from "#/lib/push-notifications";
import { useLocale, useTranslations } from "#/i18n/client";
import { requestApi } from "#/lib/api-client";

type PushState = "loading" | "unavailable" | "off" | "on" | "denied" | "error";

async function fetchPushConfig(): Promise<{ enabled?: boolean; publicKey?: string }> {
  return requestApi("/api/notifications/push/config");
}

export function PushNotificationManager() {
  const t = useTranslations();
  const locale = useLocale();
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState("");
  const configQuery = useQuery({
    queryKey: ["notifications", "push", "config"],
    queryFn: fetchPushConfig,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: supportsWebPush(),
  });
  const enableMutation = useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return permission === "denied" ? "denied" as const : "off" as const;
      const subscription = await subscribeBrowserToPush(publicKey);
      await savePushSubscription(subscription, locale);
      await requestApi("/api/notifications/push/test", { method: "POST" });
      return "on" as const;
    },
    onSuccess: setState,
    onError: () => setState("error"),
  });
  const disableMutation = useMutation({
    mutationFn: () => unsubscribePushForCurrentBrowser(),
    onSuccess: () => setState("off"),
    onError: () => setState("error"),
  });
  const pending = enableMutation.isPending || disableMutation.isPending;

  useEffect(() => {
    if (!supportsWebPush()) {
      setState("unavailable");
      return;
    }
    if (configQuery.isError) {
      setState("error");
      return;
    }
    if (!configQuery.data) return;
    void Promise.resolve(configQuery.data)
      .then(async (config) => {
        if (!config.enabled || !config.publicKey) return setState("unavailable");
        setPublicKey(config.publicKey);
        const registration = await registerPushServiceWorker();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await savePushSubscription(subscription, locale);
        setState(subscription ? "on" : Notification.permission === "denied" ? "denied" : "off");
      })
      .catch(() => setState("error"));
  }, [configQuery.data, configQuery.isError, locale]);

  async function enable() {
    await enableMutation.mutateAsync().catch(() => undefined);
  }

  async function disable() {
    await disableMutation.mutateAsync().catch(() => undefined);
  }

  if (state === "loading" || state === "unavailable") return null;

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3">
          <BellRingIcon className="mt-0.5 size-5 shrink-0 text-orange-600" />
          <div>
            <h2 className="font-semibold text-slate-950">{t("notification.push.title")}</h2>
            <p className="text-sm text-slate-600">{t(`notification.push.${state}`)}</p>
          </div>
        </div>
        {state === "on" ? (
          <Button variant="outline" disabled={pending} onClick={() => void disable()}>{t("notification.push.disable")}</Button>
        ) : state === "off" || state === "error" ? (
          <Button className="bg-orange-600 hover:bg-orange-700" disabled={pending} onClick={() => void enable()}>{t("notification.push.enable")}</Button>
        ) : null}
      </div>
    </section>
  );
}
