// Bill maths: service charge, VAT, discount and per-person shares. Pure functions, integer satang.
import { allocate, mulRound, sum } from './money.ts';

export type TaxType = 'vat_included' | 'plus_plus';

export interface Charges {
  sc: number;
  vat: number;
  grand: number;
}

export interface BillResult {
  grossSatang: number;
  discountSatang: number;
  netSatang: number;
  scSatang: number;
  vatSatang: number;
  grandSatang: number;
}

export interface PersonInput {
  id: string;
  name: string;
  plateCount: number;
  personalSatang: number;
}

export interface PersonShare {
  id: string;
  name: string;
  plateCount: number;
  personalSatang: number;
  sharedSatang: number;
  discountSatang: number;
  netSatang: number;
  addedSatang: number;
  grandSatang: number;
}

// vat_included: the menu price already has VAT, SC 10% is added on top (total = 1.10 × price).
// plus_plus: SC 10% first, then VAT 7% on (food + SC) (total = 1.10 × 1.07 × price).
// Both readings of the Thai rule (SC is VAT-able) give 1.10 × price for vat_included.
export function chargesFor(netSatang: number, taxType: TaxType, serviceCharge: boolean): Charges {
  const sc = serviceCharge ? mulRound(netSatang, 10, 100) : 0;
  if (taxType === 'plus_plus') {
    const taxable = netSatang + sc;
    const vat = mulRound(taxable, 7, 100);
    return { sc, vat, grand: taxable + vat };
  }
  const grand = netSatang + sc;
  const preVat = mulRound(grand, 100, 107);
  return { sc, vat: grand - preVat, grand };
}

// Discount can never exceed the food total.
export function computeBill(input: {
  grossSatang: number;
  discountSatang: number;
  taxType: TaxType;
  serviceCharge: boolean;
}): BillResult {
  const { grossSatang, taxType, serviceCharge } = input;
  const discount = Math.min(Math.max(0, input.discountSatang), grossSatang);
  const net = grossSatang - discount;
  const charges = chargesFor(net, taxType, serviceCharge);
  return {
    grossSatang,
    discountSatang: discount,
    netSatang: net,
    scSatang: charges.sc,
    vatSatang: charges.vat,
    grandSatang: charges.grand,
  };
}

// The shared pool (กองกลาง) splits equally. The discount is spread in proportion to each
// person's gross food, so nobody goes negative and the shares add up to the bill exactly.
export function computePersonShares(input: {
  people: PersonInput[];
  sharedSatang: number;
  discountSatang: number;
  taxType: TaxType;
  serviceCharge: boolean;
  equalTaxSplit: boolean;
}): { bill: BillResult | null; shares: PersonShare[] } {
  const { people, equalTaxSplit } = input;
  if (people.length === 0) return { bill: null, shares: [] };
  const equal = people.map(() => 1);
  const sharedParts = allocate(input.sharedSatang, equal);
  const gross = people.map((p, i) => p.personalSatang + (sharedParts[i] ?? 0));
  const bill = computeBill({
    grossSatang: sum(gross),
    discountSatang: input.discountSatang,
    taxType: input.taxType,
    serviceCharge: input.serviceCharge,
  });
  const discountParts = allocate(bill.discountSatang, gross);
  const net = gross.map((g, i) => g - (discountParts[i] ?? 0));
  const grandParts = equalTaxSplit
    ? allocate(bill.grandSatang - bill.netSatang, equal).map((added, i) => (net[i] ?? 0) + added)
    : allocate(bill.grandSatang, net);
  const shares = people.map((p, i): PersonShare => {
    const grand = grandParts[i] ?? 0;
    const n = net[i] ?? 0;
    return {
      id: p.id,
      name: p.name,
      plateCount: p.plateCount,
      personalSatang: p.personalSatang,
      sharedSatang: sharedParts[i] ?? 0,
      discountSatang: discountParts[i] ?? 0,
      netSatang: n,
      addedSatang: grand - n,
      grandSatang: grand,
    };
  });
  return { bill, shares };
}

// Table mode: everyone pays the same, split exactly.
export function computeEqualShares(
  grandSatang: number,
  people: readonly { id: string; name: string }[],
): { id: string; name: string; grandSatang: number }[] {
  const parts = allocate(grandSatang, people.map(() => 1));
  return people.map((p, i) => ({ id: p.id, name: p.name, grandSatang: parts[i] ?? 0 }));
}
