import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSplit, type SplitItem, type SplitSettings } from '../src/logic/split.ts';
import { evaluateExpression } from '../src/logic/expr.ts';
import { lcg } from './fixtures/billing.fixtures.ts';

const base: SplitSettings = {
  taxRule: 'sc_vat', taxRates: { sc: 10, vat: 7 }, discountSatang: 0,
  discountMode: 'proportional', taxSplit: 'itemized', roundUp: false,
};

const item = (id: string, unit: number, payers: string[], category: SplitItem['category'] = 'food', qty = 1): SplitItem =>
  ({ id, category, name: id, unitSatang: unit * 100, qty, payers });

test('[BE-UT] expression parser: sums, products, brackets, and rejection of junk', () => {
  assert.equal(evaluateExpression('599+49'), 648);
  assert.equal(evaluateExpression('140*2'), 280);
  assert.equal(evaluateExpression('(100+20)*1.5'), 180);
  assert.equal(evaluateExpression('1,200+30'), 1230);
  assert.equal(evaluateExpression('10/0'), null);
  assert.equal(evaluateExpression('1+'), null);
  assert.equal(evaluateExpression('alert(1)'), null);
  assert.equal(evaluateExpression('2-5'), null, 'negative prices are not allowed');
});

test('[BE-BL] per-person totals add up to the bill for random bills, with or without discount', () => {
  const rand = lcg(7);
  const ids = ['a', 'b', 'c', 'd'];
  for (let run = 0; run < 300; run += 1) {
    const items: SplitItem[] = Array.from({ length: 1 + Math.floor(rand() * 6) }, (_, k) =>
      item(`i${k}`, 1 + Math.floor(rand() * 500), ids.filter(() => rand() < 0.5), (['food', 'drink', 'alcohol'] as const)[k % 3], 1 + Math.floor(rand() * 3)));
    const settings: SplitSettings = {
      ...base,
      discountSatang: Math.floor(rand() * 60000),
      discountMode: run % 2 ? 'equal' : 'proportional',
      taxSplit: run % 3 ? 'itemized' : 'equal',
      taxRule: (['none', 'sc', 'vat', 'sc_vat'] as const)[run % 4] ?? 'sc_vat',
    };
    const r = computeSplit(items, ids, settings);
    assert.equal(r.totalSatang, r.grossSatang - r.discountSatang + r.scSatang + r.vatSatang, `run ${run}`);
    assert.equal(r.persons.reduce((sum, p) => sum + p.totalSatang, 0), r.totalSatang, `run ${run}: total shares`);
    assert.equal(r.persons.reduce((sum, p) => sum + p.scSatang, 0), r.scSatang, `run ${run}: SC shares`);
    assert.equal(r.persons.reduce((sum, p) => sum + p.vatSatang, 0), r.vatSatang, `run ${run}: VAT shares`);
    for (const p of r.persons) {
      assert.ok(p.discountSatang <= p.foodSatang, `run ${run}: discount above food`);
      assert.ok(p.totalSatang >= 0, `run ${run}: negative total`);
    }
  }
});

test('[BE-IT] an item nobody picked is shared by everyone and is flagged', () => {
  const r = computeSplit([item('x', 100, [])], ['a', 'b'], { ...base, taxRule: 'none' });
  assert.equal(r.unassigned, 1);
  assert.equal(r.persons[0]?.foodSatang, 5000);
  assert.equal(r.persons[1]?.foodSatang, 5000);
});

test('[BE-BL] equal discount never takes more than a person ate (no negative shares)', () => {
  const items = [item('a1', 10, ['a']), item('b1', 100, ['b'])];
  const r = computeSplit(items, ['a', 'b'], { ...base, taxRule: 'none', discountSatang: 4000, discountMode: 'equal' });
  assert.equal(r.persons[0]?.discountSatang, 1000, 'a ate only 10 baht so takes 10 off');
  assert.equal(r.persons[1]?.discountSatang, 3000, 'b takes the rest');
  assert.equal(r.persons[0]?.totalSatang, 0);
  assert.equal(r.persons[1]?.totalSatang, 7000);
});

test('[BE-BL] discount is applied before SC/VAT (matches the sushi calculator)', () => {
  const r = computeSplit([item('a', 100, ['a'])], ['a'], { ...base, discountSatang: 4000 });
  // food 100 - 40 = 60 net; ++ charges: SC 6, VAT (66) × 7% = 4.62 → total 70.62
  assert.equal(r.persons[0]?.totalSatang, 7062);
});

test('[TC-0001][BE-BL] changing payers preserves bill-level SC and VAT after discount', () => {
  const settings = { ...base, discountSatang: 2000 };
  const dish = { ...item('buffet', 120, []), unitSatang: 12005 };
  for (const taxSplit of ['itemized', 'equal'] as const) {
    for (const payers of [[], ['a']]) {
      const result = computeSplit([{ ...dish, payers }], ['a', 'b'], { ...settings, taxSplit });
      assert.equal(result.scSatang, 1001);
      assert.equal(result.vatSatang, 770);
      assert.equal(result.totalSatang, 11776);
      assert.equal(result.persons.reduce((sum, person) => sum + person.totalSatang, 0), result.totalSatang);
    }
  }
});

test('[TC-0002][BE-BL] saved items retain the bill total when no participants are present', () => {
  const result = computeSplit([item('buffet', 599, [])], [], base);
  assert.equal(result.grossSatang, 59900);
  assert.equal(result.totalSatang, 70502);
  assert.deepEqual(result.persons, []);
});

test('[BE-BL] round up makes each total a whole baht', () => {
  const r = computeSplit([item('a', 33.33, ['a'], 'drink')], ['a'], { ...base, taxRule: 'none', roundUp: true });
  assert.equal(r.persons[0]?.totalSatang, 3400);
});

test('[BE-UT] equal tax split pools SC/VAT and divides it evenly', () => {
  const items = [item('a1', 100, ['a']), item('b1', 300, ['b'])];
  const r = computeSplit(items, ['a', 'b'], { ...base, taxSplit: 'equal' });
  const [a, b] = r.persons;
  assert.ok(Math.abs((a?.scSatang ?? 0) - (b?.scSatang ?? 0)) <= 1, "equal SC shares differ by at most one satang");
  assert.ok(Math.abs((a?.vatSatang ?? 0) - (b?.vatSatang ?? 0)) <= 1, "equal VAT shares differ by at most one satang");
  assert.equal((a?.scSatang ?? 0) + (b?.scSatang ?? 0), r.scSatang);
  assert.equal((a?.vatSatang ?? 0) + (b?.vatSatang ?? 0), r.vatSatang);
  assert.ok(r.scSatang + r.vatSatang > 0);
});

test('[BE-IT] buffet 599 ฿ with bill rules: SC 59.90 and VAT 46.12 shown separately, total 705.02', () => {
  const r = computeSplit([item('buffet', 599, ['a'])], ['a'], base);
  assert.equal(r.scSatang, 5990);
  assert.equal(r.vatSatang, 4612);
  assert.equal(r.persons[0]?.scSatang, 5990);
  assert.equal(r.persons[0]?.vatSatang, 4612);
  assert.equal(r.totalSatang, 70502);
});
