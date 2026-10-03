import { randomInt } from 'node:crypto';
import { test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

/** Preserve project device emulation for independently authenticated actors. */
export function newActorContext(browser: Browser, overrides: BrowserContextOptions = {}) {
  const project = test.info().project.use;
  const device: BrowserContextOptions = {};
  if (project.viewport !== undefined) device.viewport = project.viewport;
  if (project.userAgent !== undefined) device.userAgent = project.userAgent;
  if (project.isMobile !== undefined) device.isMobile = project.isMobile;
  if (project.hasTouch !== undefined) device.hasTouch = project.hasTouch;
  if (project.deviceScaleFactor !== undefined) device.deviceScaleFactor = project.deviceScaleFactor;
  if (project.locale !== undefined) device.locale = project.locale;
  if (project.colorScheme !== undefined) device.colorScheme = project.colorScheme;
  return browser.newContext({
    ...device,
    ...overrides,
    extraHTTPHeaders: { ...simulatedClientHeaders(overrides.baseURL), ...overrides.extraHTTPHeaders },
    // Never inherit the project's seller login when creating a new actor.
    storageState: overrides.storageState ?? { cookies: [], origins: [] },
  });
}

/** Local proxy tests model separate clients while leaving production limits enabled. */
export function simulatedClientHeaders(baseURL = test.info().project.use.baseURL): Record<string, string> {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) return {};
  const ip = `10.${randomInt(1, 255)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
  return { 'x-forwarded-for': ip, 'x-real-ip': ip };
}

export async function isolateActorPage(page: Page) {
  await page.context().setExtraHTTPHeaders({
    ...simulatedClientHeaders(),
    ...test.info().project.use.extraHTTPHeaders,
  });
}
