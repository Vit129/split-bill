// Turns derived state into what the screen shows. Pure: no DOM, no storage.
import { BRANDS, type BrandDef, type BrandId } from '../config/brands.ts';
import { computeBill, computeEqualShares, computePersonShares, type BillResult, type PersonShare } from './billing.ts';
import { sum } from './money.ts';
import type { AppState, ExtraItem } from './cells.ts';

const plateSatang = (brand: BrandDef, counts: Record<string, number>): number =>
  sum(brand.plates.map((p) => (counts[p.id] ?? 0) * p.price * 100));
const plateCount = (brand: BrandDef, counts: Record<string, number>): number =>
  sum(brand.plates.map((p) => counts[p.id] ?? 0));
const extrasSatang = (list: readonly ExtraItem[]): number => sum(list.map((e) => e.price * e.qty * 100));

// Which owners a screen can count into: 'table' in table mode; 'shared' and each person in person mode.
export function ownersFor(state: AppState): string[] {
  if (state.mode === 'table') return ['table'];
  return ['shared', ...state.people.map((p) => p.id)];
}

export interface PlateRow {
  id: string;
  color: string;
  price: number;
  nameKey: string;
  descKey: string;
  count: number;
}

export interface View {
  brandId: BrandId;
  brand: BrandDef;
  mode: 'table' | 'person';
  equalTaxSplit: boolean;
  sc: boolean;
  discount: number;
  budget: number;
  people: { id: string; name: string }[];
  target: string;
  plateRows: PlateRow[];
  extras: ExtraItem[];
  bill: BillResult;
  plateTotal: number;
  extraQty: number;
  allPlates: PlateRow[];
  allExtras: ExtraItem[];
  equalShares: { id: string; name: string; grandSatang: number }[];
  shares: PersonShare[];
}

export function buildView(state: AppState, target: string): View {
  const brandId = state.brandId;
  const brand = BRANDS[brandId];
  const data = state.brands[brandId];
  const discountSatang = data.discount * 100;
  const allExtras = state.mode === 'table' ? data.extras.filter((e) => e.owner === 'table') : data.extras;
  const personIds = new Set(state.people.map((p) => p.id));
  // In person mode, table items and items from removed people count toward the shared pool.
  const extrasFor = (owner: string): ExtraItem[] =>
    allExtras.filter((e) => (personIds.has(e.owner) ? e.owner : 'shared') === owner);
  const plateRowsFor = (counts: Record<string, number>): PlateRow[] =>
    brand.plates.map((p) => ({ ...p, count: counts[p.id] ?? 0 }));
  const base = {
    brandId,
    brand,
    mode: state.mode,
    equalTaxSplit: state.equalTaxSplit,
    sc: data.sc,
    discount: data.discount,
    budget: data.budget,
    people: state.people,
    target,
    plateRows: plateRowsFor(data.plates[target] ?? {}),
    extras: state.mode === 'table' ? allExtras : extrasFor(target),
    extraQty: sum(allExtras.map((e) => e.qty)),
    allExtras,
  };

  if (state.mode === 'table') {
    const counts = data.plates['table'] ?? {};
    const bill = computeBill({
      grossSatang: plateSatang(brand, counts) + extrasSatang(allExtras),
      discountSatang,
      taxType: brand.taxType,
      serviceCharge: data.sc,
    });
    return {
      ...base,
      bill,
      plateTotal: plateCount(brand, counts),
      allPlates: plateRowsFor(counts),
      equalShares: computeEqualShares(bill.grandSatang, state.people),
      shares: [],
    };
  }

  const sharedSatang = plateSatang(brand, data.plates['shared'] ?? {}) + extrasSatang(extrasFor('shared'));
  const people = state.people.map((p) => {
    const counts = data.plates[p.id] ?? {};
    return {
      id: p.id,
      name: p.name,
      plateCount: plateCount(brand, counts),
      personalSatang: plateSatang(brand, counts) + extrasSatang(extrasFor(p.id)),
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
  const allCounts = [data.plates['shared'] ?? {}, ...state.people.map((p) => data.plates[p.id] ?? {})];
  const allPlates = brand.plates.map((p) => ({
    ...p,
    count: sum(allCounts.map((c) => c[p.id] ?? 0)),
  }));
  return {
    ...base,
    bill: bill ?? computeBill({ grossSatang: 0, discountSatang: 0, taxType: brand.taxType, serviceCharge: data.sc }),
    plateTotal: sum(allCounts.map((c) => plateCount(brand, c))),
    allPlates,
    equalShares: [],
    shares,
  };
}

// Sum of plates counted for a brand in the current mode (for the brand tab badges).
export function brandPlateTotal(state: AppState, brandId: BrandId): number {
  const brand = BRANDS[brandId];
  const data = state.brands[brandId];
  return sum(ownersFor(state).map((o) => plateCount(brand, data.plates[o] ?? {})));
}

export interface BudgetStatus {
  level: 'ok' | 'warn' | 'over';
  remaining: number;
  ratio: number;
}

export function budgetStatus(grandSatang: number, budgetBaht: number): BudgetStatus | null {
  if (!budgetBaht) return null;
  const budget = budgetBaht * 100;
  const remaining = budget - grandSatang;
  let level: BudgetStatus['level'] = 'ok';
  if (remaining < 0) level = 'over';
  else if (grandSatang / budget >= 0.8) level = 'warn';
  return { level, remaining, ratio: Math.min(1, grandSatang / budget) };
}
