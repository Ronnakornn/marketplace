import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const useProductionServers = process.env.PLAYWRIGHT_PRODUCTION === "true";
const configuredFrontendUrl = process.env.PLAYWRIGHT_BASE_URL;
const configuredFrontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT;
const urlPort = configuredFrontendUrl ? (new URL(configuredFrontendUrl).port || (new URL(configuredFrontendUrl).protocol === "https:" ? "443" : "80")) : undefined;
if (configuredFrontendPort && urlPort && configuredFrontendPort !== urlPort) {
  throw new Error(`PLAYWRIGHT_FRONTEND_PORT (${configuredFrontendPort}) must match PLAYWRIGHT_BASE_URL (${configuredFrontendUrl})`);
}
const frontendPort = configuredFrontendPort ?? urlPort ?? "3000";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3001";
const isolatedPorts = Boolean(configuredFrontendUrl || configuredFrontendPort || process.env.PLAYWRIGHT_API_PORT);
const frontendUrl = configuredFrontendUrl ?? `http://127.0.0.1:${frontendPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const nextDistDir = process.env.NEXT_DIST_DIR ?? (!useProductionServers && isolatedPorts ? `.next-e2e-${frontendPort}` : ".next");
const frontendHostname = new URL(frontendUrl).hostname;

const apiCommand = useProductionServers
  ? `cross-env NODE_ENV=production API_PORT=${apiPort} BETTER_AUTH_TRUSTED_ORIGINS=${frontendUrl} bun run server/index.ts`
  : `cross-env NODE_ENV=development API_PORT=${apiPort} RATE_LIMIT_ENABLED=false BETTER_AUTH_TRUSTED_ORIGINS=${frontendUrl} bun run --watch server/index.ts`;
const frontendCommand = useProductionServers
  ? `cross-env NODE_ENV=production NEXT_DIST_DIR=${nextDistDir} API_BASE_URL=${apiUrl} next start --port ${frontendPort}`
  : `cross-env NODE_ENV=development NEXT_DIST_DIR=${nextDistDir} NEXT_ALLOWED_DEV_ORIGINS=${frontendHostname} API_BASE_URL=${apiUrl} next dev --port ${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /storefront\.spec\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "test-results/.auth/seller.json" },
    },
    {
      name: "storefront-chromium",
      testMatch: /storefront\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: /seller-routes\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Firefox"], storageState: "test-results/.auth/seller.json" },
    },
    {
      name: "webkit",
      testMatch: /seller-routes\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Safari"], storageState: "test-results/.auth/seller.json" },
    },
    {
      name: "mobile-chromium",
      testMatch: /seller-routes\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: "test-results/.auth/seller.json" },
    },
  ],
  webServer: [
    {
      command: apiCommand,
      url: `${apiUrl}/api/health/ready`,
      reuseExistingServer: !process.env.CI && !isolatedPorts,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: frontendCommand,
      url: `${frontendUrl}/favicon.ico`,
      reuseExistingServer: !process.env.CI && !isolatedPorts,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
