import { test, expect } from '@playwright/test';

test('[FE-IT] tabs switch screens with a click and the choice survives a reload', async ({ page }) => {
  await page.goto('/#sushi');
  await page.waitForSelector('.plate-row');
  await page.locator('.tab[data-screen="split"]').click();
  await expect(page).toHaveURL(/#split$/);
  await expect(page.locator('#split-screen')).toBeVisible();
  await page.reload();
  await expect(page.locator('#split-root .card').first()).toBeVisible();
  await expect(page.locator('.tab[data-screen="split"]')).toHaveAttribute('aria-selected', 'true');
});
