import { test, expect } from '@playwright/test';

// Every screen must fit its viewport: no sideways scroll, and touch targets are at least 44px
// on touch devices (the coarse-pointer rules in styles.css).
const screens = [
  { name: 'sushi', path: '/#sushi', ready: '.plate-row' },
  { name: 'split', path: '/#split', ready: '#split-root .card' },
];

for (const screen of screens) {
  test(`[FE-IT] ${screen.name}: no horizontal scroll`, async ({ page }) => {
    await page.goto(screen.path);
    await page.waitForSelector(screen.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`[FE-UT] ${screen.name}: touch targets are 44px on touch devices`, async ({ page }, testInfo) => {
    await page.goto(screen.path);
    await page.waitForSelector(screen.ready);
    const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    test.skip(!touch, 'desktop pointer: sizes are not enforced');
    const small = await page.evaluate(() => {
      const selector = '.step, .icon-btn, .chip, .btn, .brand-tab';
      return [...document.querySelectorAll<HTMLElement>(selector)]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim() ?? '', w: el.offsetWidth, h: el.offsetHeight }))
        .filter((r) => r.w < 44 || r.h < 44);
    });
    expect(small, `${testInfo.project.name}`).toEqual([]);
  });
}
