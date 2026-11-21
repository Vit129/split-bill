// Quick-fill presets for the split bill. Names live in strings/th.ts; these are numbers and rules only.
import type { Category } from '../logic/split.ts';
import type { STRINGS } from '../strings/th.ts';

export interface BillPreset {
  key: keyof typeof STRINGS;
  price: number;
}

export const BILL_PRESETS: Record<Category, readonly BillPreset[]> = {
  food: [
    { key: 'BILL_P_FOOD_1', price: 599 },
    { key: 'BILL_P_FOOD_2', price: 799 },
    { key: 'BILL_P_FOOD_3', price: 250 },
    { key: 'BILL_P_FOOD_4', price: 95 },
  ],
  drink: [
    { key: 'BILL_P_DRINK_1', price: 49 },
    { key: 'BILL_P_DRINK_2', price: 30 },
    { key: 'BILL_P_DRINK_3', price: 45 },
    { key: 'BILL_P_DRINK_4', price: 60 },
  ],
  alcohol: [
    { key: 'BILL_P_ALC_1', price: 140 },
    { key: 'BILL_P_ALC_2', price: 280 },
    { key: 'BILL_P_ALC_3', price: 190 },
    { key: 'BILL_P_ALC_4', price: 260 },
  ],
};
