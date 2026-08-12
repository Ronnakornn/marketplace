import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import webpush from "web-push";

const vapid = webpush.generateVAPIDKeys();
const env = {
  ...process.env,
  PUSH_NOTIFICATIONS_ENABLED: "true",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:dev@localhost",
  PUSH_SUBSCRIPTION_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  REDIS_URL: "",
  CACHE_ENABLED: "false",
};

console.info("Web Push dev mode: http://localhost:3000 (localhost only)");
console.info("VAPID keys are ephemeral; browser subscriptions reset after restart.");

const child = spawn("bun", ["run", "dev"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

process.exitCode = await new Promise<number>((resolve) => {
  child.once("exit", (code) => resolve(code ?? 1));
});
