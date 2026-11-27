import { test, expect } from '@playwright/test';
import { STRINGS } from '../../src/strings/th.ts';

test('[FE-IT] sushi: one red plate is 44.00 ฿, then a 40 ฿ discount makes it 0.00 ฿', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await page.locator('[data-action="plate"][data-plate="red"][data-delta="1"]').first().click();
  await expect(page.locator('.grand strong')).toHaveText('44.00 ฿');
  await page.locator('[data-action="discount"][data-amount="40"]').click();
  await expect(page.locator('.grand strong')).toHaveText('0.00 ฿');
});

test('[FE-IT] sushi: table sharing is hidden while the feature switch is off', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await expect(page.locator('[data-action="open-share"]')).toHaveCount(0);
});

test('[TC-0003][FE-IT] sushi: copied person bill includes items entered in table mode', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text: string) => sessionStorage.setItem('copied-bill', text) },
    });
  });
  await page.goto('/#sushi');
  const form = page.locator('[data-form="custom"]');
  await form.locator('[name="extraName"]').fill('Table item');
  await form.locator('[name="extraPrice"]').fill('100');
  await form.locator('button[type="submit"]').click();
  await page.locator('[data-action="mode"][data-mode="person"]').click();

  await expect(page.locator('.grand strong')).toHaveText('110.00 ฿');
  await expect(page.locator('.receipt')).toContainText(STRINGS.RECEIPT_COUNT(0, 1));
  await page.getByRole('button', { name: STRINGS.BTN_COPY_SUMMARY }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('copied-bill')))
    .toContain(STRINGS.SUMMARY_ITEM_ROW('Table item', 1, '100.00'));
});
