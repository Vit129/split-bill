import { test, expect } from '@playwright/test';

test('[FE-IT] menu switches screens and the choice survives a reload', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await page.locator('#menu-btn').click();
  await page.locator('#menu [data-screen="split"]').click();
  await expect(page).toHaveURL(/#split$/);
  await expect(page.locator('#split-screen')).toBeVisible();
  await page.reload();
  await expect(page.locator('#split-root .card').first()).toBeVisible();
});
