// LINE summary for the split bill. Labels come from strings/th.ts; amounts are formatted here.
// Layout: one line per person with the total, then a line that shows SC and VAT separately.
import { STRINGS } from '../strings/th.ts';
import { formatBaht } from './money.ts';
import type { SplitResult } from './split.ts';

export function buildSplitSummary(
  title: string,
  note: string,
  people: readonly { id: string; name: string; paid: boolean }[],
  result: SplitResult,
): string {
  const lines: string[] = [
    STRINGS.BILL_SUMMARY_HEADER(title || STRINGS.BILL_SHOP_DEFAULT),
    '------------------------',
    `${STRINGS.BILL_SC_TOTAL}: ${formatBaht(result.scSatang)} ฿`,
    `${STRINGS.BILL_VAT_TOTAL}: ${formatBaht(result.vatSatang)} ฿`,
    STRINGS.BILL_SUMMARY_TOTAL(formatBaht(result.totalSatang)),
    '------------------------',
  ];
  for (const p of result.persons) {
    const person = people.find((x) => x.id === p.id);
    if (!person) continue;
    const mark = person.paid ? '✅' : '🔸';
    lines.push(`${mark} ${STRINGS.BILL_SUMMARY_PERSON(person.name, formatBaht(p.totalSatang))}`);
    lines.push(STRINGS.BILL_SUMMARY_TAX(`${formatBaht(p.scSatang)} ฿`, `${formatBaht(p.vatSatang)} ฿`));
  }
  if (note.trim()) {
    lines.push('------------------------');
    lines.push(STRINGS.BILL_SUMMARY_NOTE(note.trim()));
  }
  return lines.join('\n');
}
