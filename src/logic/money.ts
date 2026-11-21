// Money is integer satang (1 baht = 100) so shares add up exactly. Pure functions only.

// Rounds half-up for non-negative values: satang × num / den.
export const mulRound = (satang: number, num: number, den: number): number =>
  Math.round((satang * num) / den);

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// Splits integer `total` in proportion to `weights`. The parts always add up to
// `total` exactly (largest-remainder method). All-zero weights split equally.
export function allocate(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const weightSum = sum(weights);
  const w = weightSum > 0 ? weights : weights.map(() => 1);
  const denom = weightSum > 0 ? weightSum : n;
  const exact = w.map((x) => (total * x) / denom);
  const parts = exact.map(Math.floor);
  const remainder = total - sum(parts);
  const order = exact
    .map((e, i): [number, number] => [e - Math.floor(e), i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < remainder; k += 1) {
    const idx = order[k]?.[1];
    if (idx !== undefined) parts[idx] = (parts[idx] ?? 0) + 1;
  }
  return parts;
}

export function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
