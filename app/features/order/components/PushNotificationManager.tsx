"use client";

import { useEffect, useState } from "react";
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

type PushState = "loading" | "unavailable" | "off" | "on" | "denied" | "error";

export function PushNotificationManager() {
  const t = useTranslations();
  const locale = useLocale();
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!supportsWebPush()) {
      setState("unavailable");
      return;
    }
    void fetch("/api/notifications/push/config", { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then(async (config: { enabled?: boolean; publicKey?: string }) => {
        if (!config.enabled || !config.publicKey) return setState("unavailable");
        setPublicKey(config.publicKey);
        const registration = await registerPushServiceWorker();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await savePushSubscription(subscription, locale);
        setState(subscription ? "on" : Notification.permission === "denied" ? "denied" : "off");
      })
      .catch(() => setState("error"));
  }, [locale]);

  async function enable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const subscription = await subscribeBrowserToPush(publicKey);
      await savePushSubscription(subscription, locale);
      setState("on");
      await fetch("/api/notifications/push/test", { method: "POST", credentials: "include" });
    } catch {
      setState("error");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      await unsubscribePushForCurrentBrowser();
      setState("off");
    } catch {
      setState("error");
    } finally {
      setPending(false);
    }
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
