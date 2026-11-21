import { test, expect } from '@playwright/test';

// Old or broken saved split data must not disable the tabs.
test('[FE-IT] tabs still switch when saved split data is broken', async ({ page }) => {
  await page.goto('/#sushi');
  await page.evaluate(() => localStorage.setItem('kaiten-sushi-calc:split:v1', JSON.stringify({
    people: [{ id: 'x', name: 'a', paid: false }],
    items: [{ id: 'i', category: 'food', unitSatang: 'bad', qty: 1 }],
    settings: {},
  })));
  await page.reload();
  await page.waitForSelector('.plate-row');
  await page.locator('.tab[data-screen="split"]').click();
  await expect(page.locator('#split-screen')).toBeVisible();
});
