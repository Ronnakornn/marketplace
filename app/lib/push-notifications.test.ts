// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  savePushSubscription,
  subscribeBrowserToPush,
  unsubscribePushForCurrentBrowser,
} from "./push-notifications";

const subscription = {
  endpoint: "https://push.example/subscription-1",
  expirationTime: null,
  options: { userVisibleOnly: true },
  getKey: vi.fn(),
  toJSON: () => ({
    endpoint: "https://push.example/subscription-1",
    expirationTime: null,
    keys: { p256dh: "p256dh", auth: "auth" },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
} as unknown as PushSubscription;

const registration = {
  pushManager: {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn(),
  },
} as unknown as ServiceWorkerRegistration;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

describe("push notification browser helpers", () => {
  it("reuses an existing browser subscription", async () => {
    await expect(subscribeBrowserToPush("unused-public-key")).resolves.toBe(subscription);
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("persists subscription with the active locale", async () => {
    await savePushSubscription(subscription, "th");
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      endpoint: "https://push.example/subscription-1",
      locale: "th",
    });
  });

  it("invalidates the browser subscription before deleting it on the server", async () => {
    await unsubscribePushForCurrentBrowser();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/api/notifications/push/unsubscribe", expect.any(Object));
  });
});
