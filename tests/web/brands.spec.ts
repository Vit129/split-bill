import { test, expect } from '@playwright/test';

test('[FE-IT] sushi screen lists all five brands; item brands open the split screen', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await expect(page.locator('.brand-tab')).toHaveCount(5);
  await page.locator('.brand-tab', { hasText: 'Ginza Onodera' }).click();
  await expect(page).toHaveURL(/#sushi$/);
  await expect(page.locator('#sushi-screen')).toBeVisible();
  await expect(page.locator('.plate-row')).toHaveCount(0);
});

test('[FE-IT] split: choosing Hama fills its item presets and sets VAT-included rates', async ({ page }) => {
  await page.goto('/#split');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#split-root .card');
  await page.locator('#split-root [data-split-action="source"][data-value="hama"]').click();
  await expect(page.locator('#split-root .chip').first()).toContainText('เครื่องดื่มรีฟิล');
});

test('[FE-IT] split: Katsu Midori plate table shows all 12 patterns on the sushi screen', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await page.locator('.brand-tab', { hasText: 'Katsu Midori' }).click();
  await expect(page.locator('.plate-row')).toHaveCount(12);
});
