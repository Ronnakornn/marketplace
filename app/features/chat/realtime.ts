"use client";

import { useEffect, useRef, useState } from "react";

export type ChatConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export function useChatRealtime(channels: string[], onSync: () => void) {
  const channelKey = [...new Set(channels.filter(Boolean))].sort().join("|");
  const syncRef = useRef(onSync);
  syncRef.current = onSync;
  const [status, setStatus] = useState<ChatConnectionStatus>("connecting");

  useEffect(() => {
    if (!channelKey) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const subscribed = new Set<string>();
    const requestedChannels = channelKey.split("|");
    const active = () => !disposed && document.visibilityState === "visible" && navigator.onLine;
    const sync = () => { if (active()) syncRef.current(); };

    function disconnect() {
      clearTimeout(reconnectTimer);
      clearTimeout(subscriptionTimer);
      const previous = socket;
      socket = null;
      subscribed.clear();
      previous?.close();
    }

    function scheduleReconnect() {
      if (!active()) { setStatus("offline"); return; }
      setStatus("reconnecting");
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, Math.min(1_000 * 2 ** attempt++, 30_000));
    }

    function connect() {
      if (!active() || socket) return;
      setStatus(attempt ? "reconnecting" : "connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const current = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
      socket = current;
      current.addEventListener("open", () => {
        if (socket !== current || !active()) return;
        for (const channel of requestedChannels) current.send(JSON.stringify({ action: "subscribe", channel }));
        subscriptionTimer = setTimeout(() => {
          if (socket === current && subscribed.size !== requestedChannels.length) { disconnect(); scheduleReconnect(); }
        }, 5_000);
        sync();
      });
      current.addEventListener("message", (event) => {
        if (socket !== current || !active()) return;
        const data = parseRealtimeEvent(event.data);
        if (!data || !requestedChannels.includes(data.channel)) return;
        if (data.event === "realtime.subscribed") {
          subscribed.add(data.channel);
          if (subscribed.size === requestedChannels.length) { clearTimeout(subscriptionTimer); attempt = 0; setStatus("live"); }
          sync();
        } else if (data.event.startsWith("chat.")) sync();
        else if (data.event === "realtime.error") { disconnect(); scheduleReconnect(); }
      });
      current.addEventListener("close", () => {
        if (socket !== current || disposed) return;
        socket = null;
        subscribed.clear();
        clearTimeout(subscriptionTimer);
        scheduleReconnect();
      });
      current.addEventListener("error", () => {
        if (socket === current) { disconnect(); scheduleReconnect(); }
      });
    }

    function resume() {
      if (!active()) { disconnect(); setStatus("offline"); return; }
      sync();
      connect();
    }

    const polling = setInterval(sync, 10_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    resume();
    return () => {
      disposed = true;
      disconnect();
      clearInterval(polling);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [channelKey]);

  return channelKey ? status : "offline";
}

function parseRealtimeEvent(value: unknown): { event: string; channel: string } | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !("event" in parsed) || !("channel" in parsed)) return null;
    return typeof parsed.event === "string" && typeof parsed.channel === "string"
      ? { event: parsed.event, channel: parsed.channel } : null;
  } catch { return null; }
}
