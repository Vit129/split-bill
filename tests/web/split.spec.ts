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

test('[FE-IT] split: an item added without eaters is flagged on its row and on the summary', async ({ page }) => {
  await page.locator('#split-root [data-split-action="preset"][data-index="0"]').click();
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await expect(page.locator('#split-root .item-row .level-warn').first()).toHaveText('ยังไม่ระบุคนจ่าย');
  await expect(page.locator('#split-root .summary-card .level-warn')).toHaveCount(1);
});

test('[FE-IT] split: tapping a name on the item row makes that person the only eater', async ({ page }) => {
  await page.locator('#split-root [data-split-action="preset"][data-index="0"]').click();
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await page.locator('#split-root .item-row [data-split-action="item-payer"]').first().click();
  await expect(page.locator('#split-root .person .amt')).toHaveText(['฿705.02', '฿0.00']);
});

test('[FE-IT] split: a bad price expression is rejected, not evaluated', async ({ page }) => {
  await page.locator('#split-root [data-split-draft="price"]').fill('alert(1)');
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await expect(page.locator('#split-root .level-over')).toHaveText('กรุณาระบุราคาที่ถูกต้อง');
});

test('[FE-IT] split: pressing SC + VAT shows both percentage inputs filled with 10 and 7', async ({ page }) => {
  await page.locator('#split-root [data-split-action="bill-rule"][data-rule="none"]').click();
  await expect(page.locator('#split-root input[data-split-change="rate-sc"]')).toHaveCount(0);
  await page.locator('#split-root [data-split-action="bill-rule"][data-rule="sc_vat"]').click();
  await expect(page.locator('#split-root input[data-split-change="rate-sc"]')).toHaveValue('10');
  await expect(page.locator('#split-root input[data-split-change="rate-vat"]')).toHaveValue('7');
});
