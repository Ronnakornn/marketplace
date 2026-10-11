import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const webServers = Array.isArray(base.webServer) ? base.webServer : [];
const useBuiltFrontend = process.env.PLAYWRIGHT_SUPPORT_BUILT_FRONTEND === 'true';

export default defineConfig({
  ...base,
  testMatch: /support-repurchase\.spec\.ts/,
  timeout: 180_000,
  expect: { ...base.expect, timeout: 60_000 },
  outputDir: 'test-results/support-repurchase',
  reporter: [['list'], ['json', { outputFile: '.audit/support-repurchase-browser-results.json' }]],
  webServer: webServers.map(server => {
    if (!server.command.includes(' next dev ')) return server;
    return {
      ...server,
      command: useBuiltFrontend
        ? server.command.replace('NODE_ENV=development', 'NODE_ENV=production').replace(/NEXT_DIST_DIR=\S+/, 'NEXT_DIST_DIR=.next').replace(' next dev ', ' next start ')
        : server.command.replace(' next dev ', ' next dev --webpack '),
    };
  }),
  projects: [
    { name: 'support-desktop-chromium', use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } } },
    { name: 'support-mobile-chromium', grep: /@mobile/, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } } },
  ],
});
