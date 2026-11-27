// Split bill: items with payers, bill-level SC and VAT, discount, tax split and rounding.
// Pure functions in integer satang. SC and VAT are tracked separately so the summary can show both.
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
  const index = new Map(personIds.map((id, i) => [id, i]));
  const food = personIds.map(() => 0);
  const byCat: Record<Category, number[]> = {
    food: personIds.map(() => 0),
    drink: personIds.map(() => 0),
    alcohol: personIds.map(() => 0),
  };
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
    owners.forEach((owner, k) => {
      const share = shares[k] ?? 0;
      food[owner] = (food[owner] ?? 0) + share;
      byCat[item.category][owner] = (byCat[item.category][owner] ?? 0) + share;
      lines[owner]?.push({ itemId: item.id, name: item.name, category: item.category, shareSatang: share, splitCount: owners.length });
    });
  }

  const discount = Math.min(Math.max(0, s.discountSatang), gross);
  const discountParts = s.discountMode === 'equal'
    ? equalDiscount(discount, food)
    : allocate(discount, food);

  // Calculate and round each bill-level charge once, then allocate it to the payers.
  const rate = rateFor(s.taxRule, s.taxRates);
  const netBill = gross - discount;
  const scSatang = mulRound(netBill, rate.sc, 100);
  const vatSatang = mulRound(netBill + scSatang, rate.vat, 100);
  const net = food.map((f, i) => f - (discountParts[i] ?? 0));
  const equalWeights = s.taxSplit === 'equal' ? personIds.map(() => 1) : null;
  const scParts = allocate(scSatang, equalWeights ?? net);
  const vatParts = allocate(vatSatang, equalWeights ?? net.map((f, i) => f + (scParts[i] ?? 0)));

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
    scSatang,
    vatSatang,
    totalSatang: s.roundUp && persons.length > 0
      ? sum(persons.map((p) => p.totalSatang))
      : netBill + scSatang + vatSatang,
    unassigned,
  };
}
