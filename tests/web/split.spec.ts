import { test, expect } from '@playwright/test';
import { STRINGS } from '../../src/strings/th.ts';

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
  await expect(page.locator('#split-root .item-row .level-warn').first()).toHaveText(STRINGS.BILL_ITEM_NO_PAYER);
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
  await expect(page.locator('#split-root .level-over')).toHaveText(STRINGS.ERR_PRICE_INVALID);
});

test('[FE-IT] split: pressing SC + VAT shows both percentage inputs filled with 10 and 7', async ({ page }) => {
  await page.locator('#split-root [data-split-action="bill-rule"][data-rule="none"]').click();
  await expect(page.locator('#split-root input[data-split-change="rate-sc"]')).toHaveCount(0);
  await page.locator('#split-root [data-split-action="bill-rule"][data-rule="sc_vat"]').click();
  await expect(page.locator('#split-root input[data-split-change="rate-sc"]')).toHaveValue('10');
  await expect(page.locator('#split-root input[data-split-change="rate-vat"]')).toHaveValue('7');
});

test('[TC-0004][FE-IT] split: keeping the last participant preserves the bill total', async ({ page }) => {
  await page.locator('#split-root [data-split-action="preset"][data-index="0"]').click();
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();

  const remove = page.locator('#split-root').getByRole('button', { name: STRINGS.BILL_REMOVE_PERSON });
  await remove.first().click();

  await expect(remove).toHaveCount(1);
  await expect(remove).toBeDisabled();
  await expect(page.locator('#split-root .total')).toHaveText('฿705.02');
});

test('[TC-0005][FE-IT] split: a saved bill without participants recovers after adding a name', async ({ page }) => {
  await page.locator('#split-root [data-split-action="preset"][data-index="0"]').click();
  await page.locator('#split-root form[data-split-form="item"] button[type="submit"]').click();
  await page.evaluate(() => {
    const key = 'kaiten-sushi-calc:split:v1';
    const data = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...data, people: [] }));
  });
  await page.reload();

  const summary = page.locator('#split-root .summary-card');
  await expect(summary.locator('.total')).toHaveText('฿705.02');
  await expect(summary).toContainText(STRINGS.ERR_LAST_PERSON);
  const copy = summary.getByRole('button', { name: STRINGS.BILL_COPY });
  await expect(copy).toBeDisabled();

  await page.getByRole('textbox', { name: STRINGS.BILL_NAME_PLACEHOLDER }).fill('A');
  await page.getByRole('button', { name: STRINGS.BILL_ADD_NAME }).click();
  await expect(copy).toBeEnabled();
  await expect(summary.locator('.person .amt')).toHaveText('฿705.02');
});

test('[TC-0006][FE-IT] split: the first click after changing SC selects the tax rule', async ({ page }) => {
  const sc = page.locator('#split-root [data-split-change="rate-sc"]');
  await sc.fill('15');
  const none = page.locator('#split-root [data-split-action="bill-rule"][data-rule="none"]');
  await none.scrollIntoViewIfNeeded();
  const bounds = await none.boundingBox();
  if (!bounds) throw new Error('The tax rule is outside the viewport');
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

  await expect(none).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#split-root [data-split-action="bill-rule"][data-rule="sc_vat"]').click();
  await expect(sc).toHaveValue('15');
});

test('[TC-0007][FE-IT] split: moving from SC to VAT keeps the VAT field focused', async ({ page, hasTouch }) => {
  await page.locator('[data-split-draft="price"]').fill('100');
  await page.locator('[data-split-form="item"] button[type="submit"]').click();
  const total = page.locator('#split-root .total');
  await expect(total).toHaveText('฿117.70');
  await page.getByLabel(STRINGS.BILL_SC_PERCENT).fill('15');

  const vat = page.getByLabel(STRINGS.BILL_VAT_PERCENT);
  if (hasTouch) await vat.tap();
  else await vat.click();

  await expect(total).toHaveText('฿123.05');
  await expect(vat).toBeFocused();
});
