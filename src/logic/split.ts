// Split bill: items with payers, per-item tax rules, discount, tax split and rounding.
// Pure functions in integer satang. SC and VAT are tracked separately so the summary can show both.
// Every total is built from the same person rows, so the per-person totals add up to the bill.
import { allocate, mulRound, sum } from './money.ts';

export type Category = 'food' | 'drink' | 'alcohol';
export type TaxRule = 'none' | 'sc' | 'vat' | 'sc_vat';

export interface SplitItem {
  id: string;
  category: Category;
  name: string;
  unitSatang: number;
  qty: number;
  // Empty = nobody chosen. Such an item is shared by everyone and counted in `unassigned`.
  payers: string[];
}

export interface SplitSettings {
  // One SC/VAT rule for the whole bill, and its percentages.
  taxRule: TaxRule;
  taxRates: { sc: number; vat: number };
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
  scSatang: number;
  vatSatang: number;
  totalSatang: number;
  lines: PersonLine[];
}

export interface SplitResult {
  persons: PersonResult[];
  grossSatang: number;
  discountSatang: number;
  scSatang: number;
  vatSatang: number;
  totalSatang: number;
  unassigned: number;
}

export function rateFor(rule: TaxRule, rates: { sc: number; vat: number }): { sc: number; vat: number } {
  const sc = Math.max(0, rates.sc);
  const vat = Math.max(0, rates.vat);
  switch (rule) {
    case 'none': return { sc: 0, vat: 0 };
    case 'sc': return { sc, vat: 0 };
    case 'vat': return { sc: 0, vat };
    case 'sc_vat': return { sc, vat };
  }
}

// Equal discount that never takes more than a person ate: people who run out pass the rest on.
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
  if (n === 0) {
    return { persons: [], grossSatang: 0, discountSatang: 0, scSatang: 0, vatSatang: 0, totalSatang: 0, unassigned: 0 };
  }
  const index = new Map(personIds.map((id, i) => [id, i]));
  const food = personIds.map(() => 0);
  const byCat: Record<Category, number[]> = {
    food: personIds.map(() => 0),
    drink: personIds.map(() => 0),
    alcohol: personIds.map(() => 0),
  };
  const scFull = personIds.map(() => 0);
  const vatFull = personIds.map(() => 0);
  const lines: PersonLine[][] = personIds.map(() => []);
  let gross = 0;
  let unassigned = 0;

  for (const item of items) {
    const base = item.unitSatang * item.qty;
    gross += base;
    let owners = item.payers.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
    if (owners.length === 0) {
      owners = personIds.map((_, i) => i);
      unassigned += 1;
    }
    const shares = allocate(base, owners.map(() => 1));
    const rate = rateFor(s.taxRule, s.taxRates);
    owners.forEach((owner, k) => {
      const share = shares[k] ?? 0;
      const sc = mulRound(share, rate.sc, 100);
      // VAT is charged on food plus SC, as in ++ menus.
      const vat = mulRound(share + sc, rate.vat, 100);
      food[owner] = (food[owner] ?? 0) + share;
      byCat[item.category][owner] = (byCat[item.category][owner] ?? 0) + share;
      scFull[owner] = (scFull[owner] ?? 0) + sc;
      vatFull[owner] = (vatFull[owner] ?? 0) + vat;
      lines[owner]?.push({ itemId: item.id, name: item.name, category: item.category, shareSatang: share, splitCount: owners.length });
    });
  }

  const discount = Math.min(Math.max(0, s.discountSatang), gross);
  const discountParts = s.discountMode === 'equal'
    ? equalDiscount(discount, food)
    : allocate(discount, food);

  // SC and VAT are charged on what each person actually pays for food after the discount.
  const net = food.map((f, i) => f - (discountParts[i] ?? 0));
  const scNet = food.map((f, i) => (f > 0 ? mulRound(scFull[i] ?? 0, net[i] ?? 0, f) : 0));
  const vatNet = food.map((f, i) => (f > 0 ? mulRound(vatFull[i] ?? 0, net[i] ?? 0, f) : 0));
  const equal = personIds.map(() => 1);
  const scParts = s.taxSplit === 'equal' ? allocate(sum(scNet), equal) : scNet;
  const vatParts = s.taxSplit === 'equal' ? allocate(sum(vatNet), equal) : vatNet;

  const persons: PersonResult[] = personIds.map((id, i) => {
    const sc = scParts[i] ?? 0;
    const vat = vatParts[i] ?? 0;
    let total = (net[i] ?? 0) + sc + vat;
    if (s.roundUp) total = Math.ceil(total / 100) * 100;
    return {
      id,
      foodSatang: food[i] ?? 0,
      drinkSatang: byCat.drink[i] ?? 0,
      alcoholSatang: byCat.alcohol[i] ?? 0,
      discountSatang: discountParts[i] ?? 0,
      scSatang: sc,
      vatSatang: vat,
      totalSatang: total,
      lines: lines[i] ?? [],
    };
  });

  return {
    persons,
    grossSatang: gross,
    discountSatang: discount,
    scSatang: sum(persons.map((p) => p.scSatang)),
    vatSatang: sum(persons.map((p) => p.vatSatang)),
    totalSatang: sum(persons.map((p) => p.totalSatang)),
    unassigned,
  };
}
