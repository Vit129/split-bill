// Turns derived state into what the screen shows. Pure: no DOM, no storage.
import { BRANDS } from '../config/brands.js';
import { computeBill, computeEqualShares, computePersonShares } from './billing.js';
import { sum } from './money.js';

const plateSatang = (brand, counts) =>
  sum(brand.plates.map((p) => (counts[p.id] || 0) * p.price * 100));
const plateCount = (brand, counts) => sum(brand.plates.map((p) => counts[p.id] || 0));
const extrasSatang = (list) => sum(list.map((e) => e.price * e.qty * 100));

// Which owners a screen can count into: 'table' in table mode; 'shared' and each person in person mode.
export function ownersFor(state) {
  if (state.mode === 'table') return ['table'];
  return ['shared', ...state.people.map((p) => p.id)];
}

// Extras whose owner is not a current person (for example a removed person) count as shared.
function extrasFor(state, data, owner) {
  const personIds = new Set(state.people.map((p) => p.id));
  if (state.mode === 'table') return data.extras.filter((e) => e.owner === 'table');
  if (owner === 'shared') {
    return data.extras.filter((e) => e.owner === 'shared' || !personIds.has(e.owner));
  }
  return data.extras.filter((e) => e.owner === owner);
}

export function buildView(state, target) {
  const brand = BRANDS[state.brandId];
  const data = state.brands[state.brandId];
  const discountSatang = data.discount * 100;
  const base = {
    brandId: state.brandId,
    brand,
    mode: state.mode,
    equalTaxSplit: state.equalTaxSplit,
    sc: data.sc,
    discount: data.discount,
    budget: data.budget,
    people: state.people,
    target,
    plateRows: brand.plates.map((p) => ({ ...p, count: (data.plates[target] || {})[p.id] || 0 })),
    extras: extrasFor(state, data, target),
  };

  if (state.mode === 'table') {
    const counts = data.plates.table || {};
    const extras = extrasFor(state, data, 'table');
    const bill = computeBill({
      grossSatang: plateSatang(brand, counts) + extrasSatang(extras),
      discountSatang,
      taxType: brand.taxType,
      serviceCharge: data.sc,
    });
    return {
      ...base,
      bill,
      plateTotal: plateCount(brand, counts),
      extraQty: sum(extras.map((e) => e.qty)),
      equalShares: computeEqualShares(bill.grandSatang, state.people),
      shares: [],
    };
  }

  const sharedExtras = extrasFor(state, data, 'shared');
  const sharedSatang = plateSatang(brand, data.plates.shared || {}) + extrasSatang(sharedExtras);
  const people = state.people.map((p) => {
    const counts = data.plates[p.id] || {};
    return {
      id: p.id,
      name: p.name,
      plateCount: plateCount(brand, counts),
      personalSatang: plateSatang(brand, counts) + extrasSatang(extrasFor(state, data, p.id)),
    };
  });
  const { bill, shares } = computePersonShares({
    people,
    sharedSatang,
    discountSatang,
    taxType: brand.taxType,
    serviceCharge: data.sc,
    equalTaxSplit: state.equalTaxSplit,
  });
  const allCounts = [data.plates.shared || {}, ...state.people.map((p) => data.plates[p.id] || {})];
  const allExtras = data.extras.filter((e) => e.owner !== 'table');
  return {
    ...base,
    bill: bill ?? computeBill({ grossSatang: 0, discountSatang: 0, taxType: brand.taxType, serviceCharge: data.sc }),
    plateTotal: sum(allCounts.map((c) => plateCount(brand, c))),
    extraQty: sum(allExtras.map((e) => e.qty)),
    allPlates: brand.plates.map((p) => ({ ...p, count: sum(allCounts.map((c) => c[p.id] || 0)) })),
    allExtras,
    equalShares: [],
    shares,
  };
}

// Sum of plates counted for a brand in the current mode (for the brand tab badges).
export function brandPlateTotal(state, brandId) {
  const brand = BRANDS[brandId];
  const data = state.brands[brandId];
  const owners = ownersFor(state);
  return sum(owners.map((o) => plateCount(brand, data.plates[o] || {})));
}

export function budgetStatus(grandSatang, budgetBaht) {
  if (!budgetBaht) return null;
  const budget = budgetBaht * 100;
  const remaining = budget - grandSatang;
  let level = 'ok';
  if (remaining < 0) level = 'over';
  else if (grandSatang / budget >= 0.8) level = 'warn';
  return { level, remaining, ratio: Math.min(1, grandSatang / budget) };
}
