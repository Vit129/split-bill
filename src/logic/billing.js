// Bill maths: service charge, VAT, discount and per-person shares. Pure functions, integer satang.
import { allocate, mulRound, sum } from './money.js';

// vat_included: the menu price already has VAT, SC 10% is added on top (total = 1.10 × price).
// plus_plus: SC 10% first, then VAT 7% on (food + SC) (total = 1.10 × 1.07 × price).
// Both readings of the Thai rule (SC is VAT-able) give 1.10 × price for vat_included.
export function chargesFor(netSatang, taxType, serviceCharge) {
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
export function computeBill({ grossSatang, discountSatang, taxType, serviceCharge }) {
  const discount = Math.min(Math.max(0, discountSatang), grossSatang);
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

// people: [{ id, name, plateCount, personalSatang }]. Shared pool (กองกลาง) splits equally.
// The discount is spread in proportion to each person's gross food, so nobody goes
// negative and the shares add up to the bill exactly.
export function computePersonShares({ people, sharedSatang, discountSatang, taxType, serviceCharge, equalTaxSplit }) {
  if (people.length === 0) return { bill: null, shares: [] };
  const equal = people.map(() => 1);
  const sharedParts = allocate(sharedSatang, equal);
  const gross = people.map((p, i) => p.personalSatang + sharedParts[i]);
  const bill = computeBill({
    grossSatang: sum(gross),
    discountSatang,
    taxType,
    serviceCharge,
  });
  const discountParts = allocate(bill.discountSatang, gross);
  const net = gross.map((g, i) => g - discountParts[i]);
  const grandParts = equalTaxSplit
    ? allocate(bill.grandSatang - bill.netSatang, equal).map((added, i) => net[i] + added)
    : allocate(bill.grandSatang, net);
  const shares = people.map((p, i) => ({
    id: p.id,
    name: p.name,
    plateCount: p.plateCount,
    personalSatang: p.personalSatang,
    sharedSatang: sharedParts[i],
    discountSatang: discountParts[i],
    netSatang: net[i],
    addedSatang: grandParts[i] - net[i],
    grandSatang: grandParts[i],
  }));
  return { bill, shares };
}

// Table mode: everyone pays the same, split exactly.
export function computeEqualShares(grandSatang, people) {
  const parts = allocate(grandSatang, people.map(() => 1));
  return people.map((p, i) => ({ id: p.id, name: p.name, grandSatang: parts[i] }));
}
