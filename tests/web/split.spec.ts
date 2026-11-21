import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#split');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#split-root .card');
});

test('[FE-IT] split: the default two people and a 599 ฿ buffet give 705.02 ฿ split evenly', async ({ page }) => {
  await page.locator('#split-root [data-split-action="preset"][data-index="0"]').click();
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await expect(page.locator('#split-root .total')).toHaveText('฿705.02');
  await expect(page.locator('#split-root .person .amt')).toHaveText(['฿352.51', '฿352.51']);
});

test('[FE-IT] split: an item with no payer chosen is rejected', async ({ page }) => {
  await page.locator('#split-root [data-split-action="payers-clear"]').click();
  await page.locator('#split-root [data-split-draft="price"]').fill('100');
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await expect(page.locator('#split-root .level-over')).toHaveText('เลือกคนจ่ายอย่างน้อย 1 คน');
});

test('[FE-IT] split: a bad price expression is rejected, not evaluated', async ({ page }) => {
  await page.locator('#split-root [data-split-draft="price"]').fill('alert(1)');
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await expect(page.locator('#split-root .level-over')).toHaveText('กรุณาระบุราคาที่ถูกต้อง');
});
