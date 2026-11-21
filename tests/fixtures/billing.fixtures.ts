// Scenario data only (no assertions), shared by the billing tests.
// A tiny deterministic generator gives repeatable "random" bills without a dependency.
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const TAX_TYPES = ['vat_included', 'plus_plus'] as const;

export interface FixturePerson {
  id: string;
  name: string;
  plateCount: number;
  personalSatang: number;
}

export function randomPeople(rand: () => number, count: number): FixturePerson[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    plateCount: 0,
    personalSatang: Math.floor(rand() * 20000) * (rand() < 0.3 ? 0 : 1),
  }));
}
