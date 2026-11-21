import { test, expect } from '@playwright/test';

// Old or broken saved split data must not disable the menu.
test('[FE-IT] hamburger still opens the menu when saved split data is broken', async ({ page }) => {
  await page.goto('/#sushi');
  await page.evaluate(() => localStorage.setItem('kaiten-sushi-calc:split:v1', JSON.stringify({
    people: [{ id: 'x', name: 'a', paid: false }],
    items: [{ id: 'i', category: 'food', unitSatang: 'bad', qty: 1 }],
    settings: {},
  })));
  await page.reload();
  await page.waitForSelector('.plate-row');
  await page.locator('#menu-btn').click();
  await expect(page.locator('#menu')).toBeVisible();
});
