import { isolateActorPage, newActorContext } from './helpers/browser-context';
import { expect, test, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '#server/lib/prisma.ts';
import { getOtpHashSecret, hashEmailOtp } from '#server/modules/user/user.otp.ts';
import { loginUi } from './helpers/commerce-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL ?? 'http://missing');
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/marketplace_e2e_')) {
    throw new Error('Auth lifecycle requires a disposable local marketplace_e2e_* database');
  }
});
test.afterAll(async () => { await prisma.$disconnect(); });

async function session(context: BrowserContext) {
  const response = await context.request.get('/api/auth/get-session');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function signup(context: BrowserContext, origin: string) {
  const identity = { email: `auth-${randomUUID()}@example.test`, password: 'AuthBefore123!', name: 'Auth Lifecycle Buyer' };
  const response = await context.request.post('/api/auth/sign-up/email', {
    headers: { origin }, data: identity,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: identity.email } });
  expect(user.role).toBe('USER');
  return { ...identity, id: user.id };
}

// Known hashed OTP is an explicit precondition. No email provider is called or mocked;
// these assertions cover verification/reset consumption, not OTP issuance or delivery.
async function seedOtp(email: string, purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', otp: string) {
  const identifier = `${purpose}:${email}`;
  return prisma.verification.create({ data: {
    identifier, value: hashEmailOtp(identifier, otp, getOtpHashSecret()),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  } });
}

test('real signup, verification, two-device login and signout isolate sessions', async ({ browser, baseURL }) => {
  const first = await newActorContext(browser, { baseURL });
  const second = await newActorContext(browser, { baseURL });
  try {
    const identity = await signup(first, new URL(baseURL!).origin);
    expect((await session(first)).user.id).toBe(identity.id);
    const verification = await seedOtp(identity.email, 'EMAIL_VERIFICATION', '123456');
    const verified = await first.request.post('/api/auth/verify-email-otp', { data: { email: identity.email, otp: '123456' } });
    expect(verified.ok(), await verified.text()).toBeTruthy();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: identity.id } })).emailVerified).toBe(true);
    expect(await prisma.verification.findUnique({ where: { id: verification.id } })).toBeNull();
    const page = await second.newPage();
    await loginUi(page, identity, '/en/orders');
    expect((await session(second)).user.id).toBe(identity.id);
    const out = await first.request.post('/api/auth/sign-out', { headers: { origin: new URL(baseURL!).origin }, data: {} });
    expect(out.ok(), await out.text()).toBeTruthy();
    expect(await session(first)).toBeNull();
    expect((await session(second)).user.id).toBe(identity.id);
    await page.reload();
    await expect(page).toHaveURL('/en/orders');
  } finally {
    await first.close();
    await second.close();
  }
});

test('password reset consumes its OTP, rejects replay and revokes every old session', async ({ browser, baseURL }) => {
  const first = await newActorContext(browser, { baseURL });
  const second = await newActorContext(browser, { baseURL });
  const fresh = await newActorContext(browser, { baseURL });
  try {
    const identity = await signup(first, new URL(baseURL!).origin);
    await loginUi(await second.newPage(), identity, '/en/orders');
    const reset = await seedOtp(identity.email, 'PASSWORD_RESET', '654321');
    const payload = { email: identity.email, otp: '654321', newPassword: 'AuthAfter456!' };
    const response = await fresh.request.post('/api/auth/complete-password-reset', { data: payload });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(await prisma.verification.findUnique({ where: { id: reset.id } })).toBeNull();
    expect((await fresh.request.post('/api/auth/complete-password-reset', { data: payload })).status()).toBe(400);
    expect(await prisma.session.count({ where: { userId: identity.id } })).toBe(0);
    expect(await session(first)).toBeNull();
    expect(await session(second)).toBeNull();
    const oldLogin = await fresh.request.post('/api/auth/sign-in/email', {
      headers: { origin: new URL(baseURL!).origin }, data: { email: identity.email, password: identity.password },
    });
    expect(oldLogin.status()).toBe(401);
    await loginUi(await fresh.newPage(), { ...identity, password: payload.newPassword }, '/en/orders');
  } finally {
    await first.close();
    await second.close();
    await fresh.close();
  }
});

// Each local browser client gets its own production rate-limit bucket.
test.beforeEach(async ({ page }) => { await isolateActorPage(page); });
