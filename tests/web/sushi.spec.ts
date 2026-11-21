import { test, expect } from '@playwright/test';

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
