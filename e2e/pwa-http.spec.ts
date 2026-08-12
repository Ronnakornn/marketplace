import { expect, test } from "@playwright/test";

test("localhost HTTP is a secure Web Push development context", async ({ page, request }) => {
  await page.goto("/th");

  const capabilities = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
    return {
      isSecureContext,
      serviceWorker: "serviceWorker" in navigator,
      pushManager: "PushManager" in window,
      notification: "Notification" in window,
      scope: registration.scope,
    };
  });

  expect(capabilities).toMatchObject({
    isSecureContext: true,
    serviceWorker: true,
    pushManager: true,
    notification: true,
    scope: "http://localhost:3000/",
  });

  const [worker, manifest] = await Promise.all([
    request.get("/sw.js"),
    request.get("/manifest.webmanifest"),
  ]);
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["cache-control"]).toBe("no-cache, no-store, must-revalidate");
  expect(worker.headers()["content-type"]).toContain("application/javascript");
  expect(manifest.ok()).toBeTruthy();
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
});
