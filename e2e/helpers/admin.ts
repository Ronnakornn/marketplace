import { expect, type Page } from "@playwright/test";
import { isolateActorPage } from './browser-context';

export type AdminIdentity = {
  email: string;
  password: string;
};

export const primaryAdmin: AdminIdentity = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "DemoPass123!",
};

export const financeAdmin: AdminIdentity = {
  email: process.env.E2E_FINANCE_ADMIN_EMAIL ?? "admin.finance.e2e@example.com",
  password: process.env.E2E_FINANCE_ADMIN_PASSWORD ?? "DemoPass123!",
};

export async function signInAdmin(page: Page, identity: AdminIdentity = primaryAdmin) {
  await isolateActorPage(page);
  await page.context().clearCookies();
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: identity,
    headers: { origin: new URL(baseUrl).origin },
  });
  expect(response.ok(), `Admin sign-in failed: ${response.status()} ${await response.text()}`).toBeTruthy();

  const session = await page.request.get("/api/auth/get-session");
  expect(session.ok(), "Admin session could not be read").toBeTruthy();
  expect(await session.json(), "Admin sign-in did not create a session").toBeTruthy();
}
