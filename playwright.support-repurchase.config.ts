import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: /support-repurchase\.spec\.ts/,
  timeout: 180_000,
  outputDir: 'test-results/support-repurchase',
  reporter: [['list'], ['json', { outputFile: '.audit/support-repurchase-browser-results.json' }]],
  projects: [
    { name: 'support-desktop-chromium', use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } } },
    { name: 'support-mobile-chromium', grep: /@mobile/, use: { ...devices['Pixel 7'], storageState: { cookies: [], origins: [] } } },
  ],
});
