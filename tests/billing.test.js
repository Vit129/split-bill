import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargesFor, computeBill, computeEqualShares, computePersonShares } from '../src/logic/billing.js';
import { allocate, sum } from '../src/logic/money.js';
import { lcg, randomPeople, TAX_TYPES } from './fixtures/billing.fixtures.js';

test('[BE-UT] ++ brand: 100 baht food gives 117.70 with SC then VAT', () => {
  assert.deepEqual(chargesFor(10000, 'plus_plus', true), { sc: 1000, vat: 770, grand: 11770 });
});

test('[BE-UT] VAT-included brand: 100 baht food gives 110.00 total (SC on top, no second VAT)', () => {
  const c = chargesFor(10000, 'vat_included', true);
  assert.equal(c.sc, 1000);
  assert.equal(c.grand, 11000);
  assert.equal(c.vat, 720, 'VAT shown is the part inside the 110.00 total (11000 × 7/107)');
});

// Katsu Midori and Ginza Onodera: ++ (SC 10%, then VAT 7% on top), confirmed by the user.
test('[BE-UT] ++ brands (Katsu Midori, Ginza Onodera) are configured as plus_plus', async () => {
  const { BRANDS } = await import('../src/config/brands.js');
  assert.equal(BRANDS.katsumidori.taxType, 'plus_plus');
  assert.equal(BRANDS.onodera.taxType, 'plus_plus');
  assert.equal(chargesFor(10000, BRANDS.onodera.taxType, true).grand, 11770);
});

test('[BE-UT] service charge off (takeaway): no SC added', () => {
  assert.equal(chargesFor(10000, 'vat_included', false).grand, 10000);
  assert.equal(chargesFor(10000, 'plus_plus', false).grand, 10700);
});

test('[BE-BL] discount cannot exceed food total', () => {
  const bill = computeBill({ grossSatang: 5000, discountSatang: 99999, taxType: 'plus_plus', serviceCharge: true });
  assert.equal(bill.discountSatang, 5000);
  assert.equal(bill.netSatang, 0);
  assert.equal(bill.grandSatang, 0);
});

test('[BE-IT] discount on a person who ate nothing: the other person pays it, shares add up', () => {
  const people = [
    { id: 'a', name: 'A', plateCount: 0, personalSatang: 0 },
    { id: 'b', name: 'B', plateCount: 1, personalSatang: 10000 },
  ];
  const { bill, shares } = computePersonShares({
    people, sharedSatang: 0, discountSatang: 4000, taxType: 'vat_included', serviceCharge: true, equalTaxSplit: false,
  });
  assert.equal(bill.netSatang, 6000);
  assert.equal(shares[0].netSatang, 0, 'a must not go negative');
  assert.equal(shares[1].netSatang, 6000);
  assert.equal(sum(shares.map((s) => s.grandSatang)), bill.grandSatang);
  assert.equal(shares[1].grandSatang, 6600);
});

test('[BE-UT] allocate always sums to the total', () => {
  assert.equal(sum(allocate(100, [1, 1, 1])), 100);
  assert.deepEqual(allocate(10, [0, 0]), [5, 5]);
  assert.deepEqual(allocate(7, [3, 0, 1]), [5, 0, 2]);
});

test('[BE-BL] person shares add up to the bill for random bills (both tax types, both SC splits)', () => {
  const rand = lcg(20261121);
  for (let run = 0; run < 400; run += 1) {
    const people = randomPeople(rand, 1 + Math.floor(rand() * 5));
    const sharedSatang = Math.floor(rand() * 9000);
    const discountSatang = Math.floor(rand() * 30000);
    const taxType = TAX_TYPES[run % 2];
    const equalTaxSplit = run % 3 === 0;
    const { bill, shares } = computePersonShares({
      people, sharedSatang, discountSatang, taxType, serviceCharge: true, equalTaxSplit,
    });
    assert.equal(sum(shares.map((s) => s.grandSatang)), bill.grandSatang, `run ${run}`);
    assert.equal(sum(shares.map((s) => s.netSatang)), bill.netSatang, `run ${run}`);
    for (const s of shares) assert.ok(s.netSatang >= 0, `run ${run}: negative net`);
  }
});

// Real checkout total reported by the user (Sushiro, 580 ฿ food): 638 ฿ = 580 × 1.10.
// The 1.107 reading would give 642.06 ฿, so this case rules it out.
test('[BE-IT] Sushiro checkout case: 580 ฿ food → 638 ฿ total, split 242 / 396', () => {
  const price = { red: 40, silver: 60, gold: 80 };
  const food = (counts) => Object.entries(counts).reduce((a, [k, n]) => a + n * price[k] * 100, 0);
  const { bill, shares } = computePersonShares({
    people: [
      { id: 'a', name: 'คนที่ 1', plateCount: 4, personalSatang: food({ red: 2, silver: 1, gold: 1 }) },
      { id: 'b', name: 'คนที่ 2', plateCount: 6, personalSatang: food({ red: 1, silver: 4, gold: 1 }) },
    ],
    sharedSatang: 0, discountSatang: 0, taxType: 'vat_included', serviceCharge: true, equalTaxSplit: false,
  });
  assert.equal(bill.grandSatang, 63800);
  assert.equal(bill.scSatang, 5800);
  assert.deepEqual(shares.map((s) => s.grandSatang), [24200, 39600]);
});

test('[BE-BL] table mode splits the bill equally with no satang lost', () => {
  const people = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const shares = computeEqualShares(10001, people);
  assert.equal(sum(shares.map((s) => s.grandSatang)), 10001);
  assert.ok(Math.max(...shares.map((s) => s.grandSatang)) - Math.min(...shares.map((s) => s.grandSatang)) <= 1);
});
