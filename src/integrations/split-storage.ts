// Split-bill data on this device only (not shared). Failures are logged; the app keeps working in memory.
import type { SplitItem, SplitSettings } from '../logic/split.ts';

const KEY = 'kaiten-sushi-calc:split:v1';

export interface SplitPerson {
  id: string;
  name: string;
  paid: boolean;
}

export interface SplitData {
  shopName: string;
  note: string;
  people: SplitPerson[];
  items: SplitItem[];
  settings: SplitSettings;
}

export const defaultSplitData = (): SplitData => ({
  shopName: '',
  note: '',
  people: [],
  items: [],
  settings: {
    scRate: 10, vatRate: 7, compound: true, discountSatang: 0,
    discountMode: 'proportional', taxSplit: 'itemized', roundUp: false,
  },
});

export function loadSplit(): SplitData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const d = parsed as Partial<SplitData>;
    if (!Array.isArray(d.people) || !Array.isArray(d.items) || typeof d.settings !== 'object' || d.settings === null) return null;
    return { ...defaultSplitData(), ...d } as SplitData;
  } catch (err) {
    console.warn('Could not read saved split bill:', err);
    return null;
  }
}

export function saveSplit(data: SplitData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save split bill:', err);
  }
}
