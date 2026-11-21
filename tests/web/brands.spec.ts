import { test, expect } from '@playwright/test';

test('[FE-IT] sushi screen lists all five brands with their plates', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await expect(page.locator('.brand-tab')).toHaveCount(5);
  await page.locator('.brand-tab', { hasText: 'Ginza Onodera' }).click();
  await expect(page).toHaveURL(/#sushi$/);
  await expect(page.locator('#sushi-screen')).toBeVisible();
  await expect(page.locator('.plate-row')).toHaveCount(7);
});

test('[FE-IT] split: Katsu Midori plate table shows all 12 patterns on the sushi screen', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await page.locator('.brand-tab', { hasText: 'Katsu Midori' }).click();
  await expect(page.locator('.plate-row')).toHaveCount(12);
});
