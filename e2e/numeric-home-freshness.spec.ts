import { expect, test } from '@playwright/test';
import { prisma } from '#server/lib/prisma.ts';
import en from '../messages/en.json' with { type: 'json' };
import { newActorContext } from './helpers/browser-context';
import { commerceFixture, loginUi } from './helpers/commerce-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.afterAll(async () => { await prisma.$disconnect(); });

test('new homepage server renders use current flash identity, price and physical availability', async ({ browser, baseURL }, testInfo) => {
  const fixture = await commerceFixture();
  const { shop, product, variant } = fixture.shops[0]!;
  await prisma.inventory.update({ where: { variantId: variant.id }, data: { quantityOnHand: 1, quantityReserved: 0 } });
  const context = await newActorContext(browser, { baseURL });
  const campaignIds: string[] = [];
  const hydrationErrors: string[] = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', error => { if (/hydration/i.test(error.message)) hydrationErrors.push(error.message); });
    page.on('console', message => { if (message.type() === 'error' && /hydration/i.test(message.text())) hydrationErrors.push(message.text()); });
    const older = await prisma.flashSale.create({ data: {
      title: `Older freshness ${shop.id}`, status: 'ACTIVE',
      startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
      items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
        salePrice: 9500n, originalPrice: 10000n, stockLimit: 20, perUserLimit: 1,
      } },
    } });
    campaignIds.push(older.id);
    const first = await prisma.flashSale.create({ data: {
      title: `Freshness A ${shop.id}`, status: 'ACTIVE',
      startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 120_000),
      items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
        salePrice: 9000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 1,
      } },
    }, include: { items: true } });
    campaignIds.push(first.id);
    const firstApi = await page.request.get('/api/discovery/home?locale=en&limit=12');
    expect(firstApi.ok(), await firstApi.text()).toBeTruthy();
    const firstDiscovery = await firstApi.json();
    expect(firstDiscovery).toMatchObject({ sections: { flashSale: {
      id: first.id, items: [expect.objectContaining({ id: first.items[0]!.id,
        salePrice: '9000', originalPrice: '10000', availableStock: 1,
      })],
    } } });
    const firstInventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    expect(firstInventory).toMatchObject({ quantityOnHand: 1, quantityReserved: 0 });
    await loginUi(page, fixture.buyer, '/en');
    const firstSection = page.locator('section').filter({ has: page.getByRole('heading', { name: first.title, exact: true }) });
    const firstCard = firstSection.locator('article').filter({ hasText: product.title });
    await expect(firstCard).toHaveCount(1);
    await expect(firstCard.getByText('THB 90.00', { exact: true })).toBeVisible();
    await expect(firstCard.getByRole('button', { name: en.product.add, exact: true })).toBeEnabled();
    const firstUi = { heading: await firstSection.getByRole('heading').innerText(),
      price: await firstCard.getByText('THB 90.00', { exact: true }).innerText(),
      addEnabled: await firstCard.getByRole('button', { name: en.product.add, exact: true }).isEnabled() };
    const firstScreenshot = testInfo.outputPath('homepage-freshness-a.png');
    await firstSection.screenshot({ path: firstScreenshot });
    await testInfo.attach('homepage-freshness-a', { path: firstScreenshot, contentType: 'image/png' });

    const second = await prisma.$transaction(async tx => {
      await tx.inventory.update({ where: { variantId: variant.id }, data: { quantityReserved: 1 } });
      await tx.flashSale.update({ where: { id: first.id }, data: { status: 'ENDED' } });
      return tx.flashSale.create({ data: {
        title: `Freshness B ${shop.id}`, status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 90_000),
        items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id,
          salePrice: 8000n, originalPrice: 10000n, stockLimit: 20, soldCount: 0, perUserLimit: 1,
        } },
      }, include: { items: true } });
    });
    campaignIds.push(second.id);
    const secondApi = await page.request.get('/api/discovery/home?locale=en&limit=12');
    expect(secondApi.ok(), await secondApi.text()).toBeTruthy();
    const secondDiscovery = await secondApi.json();
    expect(secondDiscovery).toMatchObject({ sections: { flashSale: {
      id: second.id, items: [expect.objectContaining({ id: second.items[0]!.id,
        salePrice: '8000', originalPrice: '10000', stockLimit: 20, soldCount: 0, availableStock: 0,
      })],
    } } });
    const secondInventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    expect(secondInventory).toMatchObject({ quantityOnHand: 1, quantityReserved: 1 });
    expect(await prisma.flashSale.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'ENDED' });
    expect(await prisma.flashSaleReservation.count({ where: { flashSaleItemId: second.items[0]!.id } })).toBe(0);
    await page.goto('/en');
    const secondSection = page.locator('section').filter({ has: page.getByRole('heading', { name: second.title, exact: true }) });
    const secondCard = secondSection.locator('article').filter({ hasText: product.title });
    await expect(secondCard).toHaveCount(1);
    await expect(secondCard.getByText('THB 80.00', { exact: true })).toBeVisible();
    await expect(secondCard.getByRole('button', { name: en.product.add, exact: true })).toBeDisabled();
    await expect(page.getByRole('heading', { name: first.title, exact: true })).toHaveCount(0);
    expect(hydrationErrors).toEqual([]);
    const secondScreenshot = testInfo.outputPath('homepage-freshness-b.png');
    await secondSection.screenshot({ path: secondScreenshot });
    await testInfo.attach('homepage-freshness-b', { path: secondScreenshot, contentType: 'image/png' });
    await testInfo.attach('homepage-ui-api-db-freshness', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      stockStateSource: 'Seeded projection precondition; checkout reservation lifecycle is covered separately by numeric-shipping.spec.ts.',
      first: { api: firstDiscovery.sections.flashSale, db: {
        campaignId: first.id, salePrice: first.items[0]!.salePrice.toString(),
        quantityOnHand: firstInventory.quantityOnHand, quantityReserved: firstInventory.quantityReserved,
      }, ui: firstUi },
      second: { api: secondDiscovery.sections.flashSale, db: {
        campaignId: second.id, salePrice: second.items[0]!.salePrice.toString(),
        quantityOnHand: secondInventory.quantityOnHand, quantityReserved: secondInventory.quantityReserved,
      }, ui: { heading: await secondSection.getByRole('heading').innerText(), price: await secondCard.getByText('THB 80.00', { exact: true }).innerText(),
        addDisabled: await secondCard.getByRole('button', { name: en.product.add, exact: true }).isDisabled() } },
      hydrationErrors,
    }, null, 2)) });
  } finally {
    if (campaignIds.length) await prisma.flashSale.updateMany({ where: { id: { in: campaignIds } }, data: { status: 'ENDED' } });
    await context.close();
  }
});
