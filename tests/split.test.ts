import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSplit, type SplitItem, type SplitSettings } from '../src/logic/split.ts';
import { evaluateExpression } from '../src/logic/expr.ts';
import { lcg } from './fixtures/billing.fixtures.ts';

const base: SplitSettings = {
  scRate: 10, vatRate: 7, compound: true, discountSatang: 0,
  discountMode: 'proportional', taxSplit: 'itemized', roundUp: false,
};

const item = (id: string, unit: number, payers: string[], rule: SplitItem['rule'] = 'bill', qty = 1): SplitItem =>
  ({ id, category: 'food', name: id, unitSatang: unit * 100, qty, rule, payers });

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
      item(`i${k}`, 1 + Math.floor(rand() * 500), ids.filter(() => rand() < 0.5), (['bill', 'net', 'vat7', 'sc10_vat7'] as const)[k % 4], 1 + Math.floor(rand() * 3)));
    const settings: SplitSettings = {
      ...base,
      discountSatang: Math.floor(rand() * 60000),
      discountMode: run % 2 ? 'equal' : 'proportional',
      taxSplit: run % 3 ? 'itemized' : 'equal',
    };
    const r = computeSplit(items, ids, settings);
    assert.equal(r.totalSatang, r.grossSatang - r.discountSatang + r.taxSatang, `run ${run}`);
    for (const p of r.persons) {
      assert.ok(p.discountSatang <= p.foodSatang, `run ${run}: discount above food`);
      assert.ok(p.totalSatang >= 0, `run ${run}: negative total`);
    }
  }
});

test('[BE-IT] an item nobody picked is shared by everyone and is flagged', () => {
  const r = computeSplit([item('x', 100, [])], ['a', 'b'], { ...base, scRate: 0, vatRate: 0 });
  assert.equal(r.unassigned, 1);
  assert.equal(r.persons[0]?.foodSatang, 5000);
  assert.equal(r.persons[1]?.foodSatang, 5000);
});

test('[BE-BL] equal discount never takes more than a person ate (no negative shares)', () => {
  const items = [item('a1', 10, ['a']), item('b1', 100, ['b'])];
  const r = computeSplit(items, ['a', 'b'], { ...base, scRate: 0, vatRate: 0, discountSatang: 4000, discountMode: 'equal' });
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

test('[BE-BL] round up makes each total a whole baht', () => {
  const r = computeSplit([item('a', 33.33, ['a'], 'net')], ['a'], { ...base, roundUp: true });
  assert.equal(r.persons[0]?.totalSatang, 3400);
});

test('[BE-UT] equal tax split pools SC/VAT and divides it evenly', () => {
  const items = [item('a1', 100, ['a']), item('b1', 300, ['b'])];
  const r = computeSplit(items, ['a', 'b'], { ...base, taxSplit: 'equal' });
  const [a, b] = r.persons;
  assert.ok(Math.abs((a?.taxSatang ?? 0) - (b?.taxSatang ?? 0)) <= 1, 'equal shares differ by at most one satang');
  assert.equal((a?.taxSatang ?? 0) + (b?.taxSatang ?? 0), r.taxSatang);
  assert.ok(r.taxSatang > 0);
});
