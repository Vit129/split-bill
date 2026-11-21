// Text for "copy and paste into LINE". Labels come from strings/th.js; amounts are formatted here.
import { STRINGS } from '../strings/th.js';
import { formatBaht } from './money.js';

export function buildSummaryText(view) {
  const { brand, bill } = view;
  const lines = [STRINGS.SUMMARY_HEADER(brand.shortName)];
  for (const p of view.allPlates) {
    if (p.count > 0) {
      lines.push(STRINGS.SUMMARY_ITEM_ROW(STRINGS[p.nameKey], p.count, formatBaht(p.count * p.price * 100)));
    }
  }
  for (const e of view.allExtras) {
    lines.push(STRINGS.SUMMARY_ITEM_ROW(e.name, e.qty, formatBaht(e.price * e.qty * 100)));
  }
  lines.push('------------------------');
  lines.push(`${STRINGS.SUMMARY_SUBTOTAL}: ${formatBaht(bill.grossSatang)}`);
  if (bill.discountSatang > 0) lines.push(`${STRINGS.SUMMARY_DISCOUNT}: -${formatBaht(bill.discountSatang)}`);
  if (bill.scSatang > 0) lines.push(`${STRINGS.SUMMARY_SC}: ${formatBaht(bill.scSatang)}`);
  if (brand.taxType === 'plus_plus') lines.push(`${STRINGS.SUMMARY_VAT}: ${formatBaht(bill.vatSatang)}`);
  lines.push(`${STRINGS.SUMMARY_GRAND}: ${formatBaht(bill.grandSatang)}`);
  lines.push('------------------------');
  if (view.mode === 'table') {
    const n = view.equalShares.length;
    const per = n > 0 ? formatBaht(view.equalShares[0].grandSatang) : formatBaht(0);
    lines.push(STRINGS.SUMMARY_EQUAL(n, per));
    for (const s of view.equalShares) lines.push(`- ${s.name}: ${formatBaht(s.grandSatang)}`);
  } else {
    lines.push(STRINGS.SUMMARY_PERSON(view.shares.length));
    for (const s of view.shares) {
      lines.push(STRINGS.SUMMARY_PERSON_ROW(s.name, s.plateCount, formatBaht(s.grandSatang)));
    }
  }
  return lines.join('\n');
}
