// Split bill: items with payers, per-item tax rules, discount, tax split and rounding.
// Pure functions in integer satang. Every total is built from the same person rows, so the
// per-person totals always add up to the bill.
import { allocate, mulRound, sum } from './money.ts';

export type Category = 'food' | 'drink' | 'alcohol';
export type TaxRule = 'bill' | 'net' | 'vat7' | 'sc10_vat7';

export interface SplitItem {
  id: string;
  category: Category;
  name: string;
  unitSatang: number;
  qty: number;
  rule: TaxRule;
  // Empty = nobody chosen. Such an item is shared by everyone and counted in `unassigned`.
  payers: string[];
}

export interface SplitSettings {
  scRate: number;
  vatRate: number;
  compound: boolean; // VAT on (food + SC), as in ++ menus
  discountSatang: number;
  discountMode: 'proportional' | 'equal';
  taxSplit: 'itemized' | 'equal';
  roundUp: boolean; // each person's total rounds up to whole baht
}

export interface PersonLine {
  itemId: string;
  name: string;
  category: Category;
  shareSatang: number;
  splitCount: number;
}

export interface PersonResult {
  id: string;
  foodSatang: number;
  drinkSatang: number;
  alcoholSatang: number;
  discountSatang: number;
  taxSatang: number;
  totalSatang: number;
  lines: PersonLine[];
}

export interface SplitResult {
  persons: PersonResult[];
  grossSatang: number;
  discountSatang: number;
  taxSatang: number;
  totalSatang: number;
  unassigned: number;
}

export function rateFor(rule: TaxRule, s: SplitSettings): { sc: number; vat: number } {
  switch (rule) {
    case 'net': return { sc: 0, vat: 0 };
    case 'vat7': return { sc: 0, vat: 7 };
    case 'sc10_vat7': return { sc: 10, vat: 7 };
    case 'bill': return { sc: Math.max(0, s.scRate), vat: Math.max(0, s.vatRate) };
  }
}

// Equal discount that never takes more than a person's food: people who run out pass the rest on.
function equalDiscount(total: number, foods: readonly number[]): number[] {
  const out = foods.map(() => 0);
  let open = foods.map((_, i) => i).filter((i) => (foods[i] ?? 0) > 0);
  for (;;) {
    const remaining = total - sum(out);
    if (open.length === 0 || remaining <= 0) break;
    const parts = allocate(remaining, open.map(() => 1));
    const capped = open.filter((i, k) => (parts[k] ?? 0) >= (foods[i] ?? 0) - (out[i] ?? 0));
    if (capped.length === 0) {
      open.forEach((i, k) => { out[i] = (out[i] ?? 0) + (parts[k] ?? 0); });
      break;
    }
    for (const i of capped) out[i] = foods[i] ?? 0;
    open = open.filter((i) => !capped.includes(i));
  }
  return out;
}

export function computeSplit(items: readonly SplitItem[], personIds: readonly string[], s: SplitSettings): SplitResult {
  const n = personIds.length;
  const index = new Map(personIds.map((id, i) => [id, i]));
  const food = personIds.map(() => 0);
  const byCat: Record<Category, number[]> = { food: personIds.map(() => 0), drink: personIds.map(() => 0), alcohol: personIds.map(() => 0) };
  const taxFull = personIds.map(() => 0);
  const lines: PersonLine[][] = personIds.map(() => []);
  let gross = 0;
  let unassigned = 0;

  if (n === 0) {
    return { persons: [], grossSatang: 0, discountSatang: 0, taxSatang: 0, totalSatang: 0, unassigned: 0 };
  }

  for (const item of items) {
    const base = item.unitSatang * item.qty;
    gross += base;
    let owners = item.payers.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
    if (owners.length === 0) {
      owners = personIds.map((_, i) => i);
      unassigned += 1;
    }
    const shares = allocate(base, owners.map(() => 1));
    const rate = rateFor(item.rule, s);
    owners.forEach((owner, k) => {
      const share = shares[k] ?? 0;
      const sc = mulRound(share, rate.sc, 100);
      const vat = mulRound(s.compound ? share + sc : share, rate.vat, 100);
      food[owner] = (food[owner] ?? 0) + share;
      byCat[item.category][owner] = (byCat[item.category][owner] ?? 0) + share;
      taxFull[owner] = (taxFull[owner] ?? 0) + sc + vat;
      lines[owner]?.push({ itemId: item.id, name: item.name, category: item.category, shareSatang: share, splitCount: owners.length });
    });
  }

  const discount = Math.min(Math.max(0, s.discountSatang), gross);
  const discountParts = s.discountMode === 'equal'
    ? equalDiscount(discount, food)
    : allocate(discount, food);

  // Tax is charged on what each person actually pays for food after the discount.
  const net = food.map((f, i) => f - (discountParts[i] ?? 0));
  const taxNet = food.map((f, i) => (f > 0 ? mulRound(taxFull[i] ?? 0, net[i] ?? 0, f) : 0));
  const taxParts = s.taxSplit === 'equal'
    ? allocate(sum(taxNet), personIds.map(() => 1))
    : taxNet;

  const persons: PersonResult[] = personIds.map((id, i) => {
    const tax = taxParts[i] ?? 0;
    let total = (net[i] ?? 0) + tax;
    if (s.roundUp) total = Math.ceil(total / 100) * 100;
    return {
      id,
      foodSatang: food[i] ?? 0,
      drinkSatang: byCat.drink[i] ?? 0,
      alcoholSatang: byCat.alcohol[i] ?? 0,
      discountSatang: discountParts[i] ?? 0,
      taxSatang: tax,
      totalSatang: total,
      lines: lines[i] ?? [],
    };
  });

  return {
    persons,
    grossSatang: gross,
    discountSatang: discount,
    taxSatang: sum(persons.map((p) => p.taxSatang)),
    totalSatang: sum(persons.map((p) => p.totalSatang)),
    unassigned,
  };
}
