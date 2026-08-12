import { defineConfig, devices } from "@playwright/test";

const useProductionServers = process.env.PLAYWRIGHT_PRODUCTION === "true";

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
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
      command: useProductionServers ? "bun run start:server" : "bun run dev:server",
      url: "http://localhost:3001/api/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: useProductionServers ? "bun run start:frontend" : "bun run dev:frontend",
      url: "http://localhost:3000/favicon.ico",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
