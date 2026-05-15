"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeEvent {
  event?: string;
  channel?: string;
  payload?: {
    roomId?: string;
    shopId?: string;
  };
}

export function useChatRealtime(channels: string[]) {
  const queryClient = useQueryClient();
  const channelKey = channels.filter(Boolean).sort().join("|");

  useEffect(() => {
    if (!channelKey || typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
    const subscribedChannels = channelKey.split("|");

    socket.addEventListener("open", () => {
      for (const channel of subscribedChannels) {
        socket.send(JSON.stringify({ action: "subscribe", channel }));
      }
    });

    socket.addEventListener("message", (event) => {
      const data = parseRealtimeEvent(event.data);
      if (!data?.event?.startsWith("chat.")) return;

      void queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
      const roomId = data.payload?.roomId ?? data.channel?.replace(/^chat:/, "");
      if (roomId) {
        void queryClient.invalidateQueries({ queryKey: ["chat-room", roomId] });
      }
    });

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        for (const channel of subscribedChannels) {
          socket.send(JSON.stringify({ action: "unsubscribe", channel }));
        }
      }
      socket.close();
    };
  }, [channelKey, queryClient]);
}

function parseRealtimeEvent(value: unknown): RealtimeEvent | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as RealtimeEvent : null;
  } catch {
    return null;
  }
}
