export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function subscribeBrowserToPush(publicKey: string): Promise<PushSubscription> {
  const registration = await registerPushServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function savePushSubscription(subscription: PushSubscription, locale: "th" | "en"): Promise<void> {
  await apiRequest("/api/notifications/push/subscribe", {
    ...JSON.parse(JSON.stringify(subscription)),
    locale,
  });
}

export async function unsubscribePushForCurrentBrowser(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    await apiRequest("/api/notifications/push/unsubscribe", { endpoint });
  } catch {
    // The invalid endpoint is removed after the push provider returns 404/410.
  }
}

export function supportsWebPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function apiRequest(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Push notification request failed (${response.status})`);
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}
