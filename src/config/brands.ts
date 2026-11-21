// Brand data: ids, numbers, source links. Thai text lives in strings/th.js and is
// referenced by *Key fields. status 'unverified' means prices and tax type were not
// confirmed with the restaurant (see sources + checkedAt); the UI shows that.
// taxType for katsumidori and onodera ('plus_plus') was confirmed by the user on 2026-11-21.
export type BrandId = 'sushiro' | 'hama' | 'katsumidori' | 'onodera' | 'genki';

export interface PlateDef {
  id: string;
  color: string;
  price: number;
  nameKey: string;
  descKey: string;
}

export interface PresetDef {
  id: string;
  emoji: string;
  price: number;
  textKey: string;
}

export interface BrandDef {
  id: BrandId;
  shortName: string;
  theme: BrandId;
  taxType: 'vat_included' | 'plus_plus';
  kind: 'plates' | 'items';
  status: 'unverified' | 'verified';
  checkedAt: string;
  noteKey: string;
  subKey: string;
  sources: string[];
  plates: PlateDef[];
  presets: PresetDef[];
}

export const BRAND_ORDER: BrandId[] = ['sushiro', 'hama', 'katsumidori', 'onodera', 'genki'];

const CHECKED_AT = '2026-11-21';

export const BRANDS: Record<BrandId, BrandDef> = {
  sushiro: {
    id: 'sushiro',
    shortName: 'Sushiro',
    theme: 'sushiro',
    taxType: 'vat_included',
    kind: 'plates',
    status: 'verified',
    checkedAt: '2026-11-21',
    noteKey: 'NOTE_SUSHIRO',
    subKey: 'BRAND_SUB_SUSHIRO',
    sources: [
      'https://en.thairath.co.th/money/business_marketing/business_strategy/2908264',
      'https://www.bangkokpost.com/life/social-and-lifestyle/2104267/sushi-expressway',
    ],
    plates: [
      { id: 'white', color: 'white', price: 30, nameKey: 'PLATE_NAME_WHITE', descKey: 'DESC_SUSHIRO_WHITE' },
      { id: 'red', color: 'red', price: 40, nameKey: 'PLATE_NAME_RED', descKey: 'DESC_SUSHIRO_RED' },
      { id: 'silver', color: 'silver', price: 60, nameKey: 'PLATE_NAME_SILVER', descKey: 'DESC_SUSHIRO_SILVER' },
      { id: 'gold', color: 'gold', price: 80, nameKey: 'PLATE_NAME_GOLD', descKey: 'DESC_SUSHIRO_GOLD' },
      { id: 'black', color: 'black', price: 100, nameKey: 'PLATE_NAME_BLACK', descKey: 'DESC_SUSHIRO_BLACK' },
    ],
    presets: [
      { id: 'drink', emoji: '🥤', price: 40, textKey: 'PRESET_SUSHIRO_DRINK' },
      { id: 'tea', emoji: '🍵', price: 0, textKey: 'PRESET_SUSHIRO_TEA' },
      { id: 'soup', emoji: '🥣', price: 60, textKey: 'PRESET_SUSHIRO_SOUP' },
      { id: 'noodle', emoji: '🍜', price: 100, textKey: 'PRESET_SUSHIRO_NOODLE' },
      { id: 'dessert', emoji: '🍨', price: 80, textKey: 'PRESET_SUSHIRO_DESSERT' },
      { id: 'special', emoji: '🍣', price: 120, textKey: 'PRESET_SUSHIRO_SPECIAL' },
    ],
  },
  hama: {
    id: 'hama',
    shortName: 'Hama Sushi',
    theme: 'hama',
    taxType: 'vat_included',
    kind: 'plates',
    status: 'verified',
    checkedAt: CHECKED_AT,
    noteKey: 'NOTE_HAMA',
    subKey: 'BRAND_SUB_HAMA',
    sources: ['https://brandinside.asia/?p=239488'],
    plates: [
      { id: 'white', color: 'white', price: 40, nameKey: 'PLATE_NAME_WHITE', descKey: 'DESC_HAMA_WHITE' },
      { id: 'red', color: 'red', price: 60, nameKey: 'PLATE_NAME_RED', descKey: 'DESC_HAMA_RED' },
      { id: 'silver', color: 'silver', price: 80, nameKey: 'PLATE_NAME_SILVER', descKey: 'DESC_HAMA_SILVER' },
      { id: 'gold', color: 'gold', price: 100, nameKey: 'PLATE_NAME_GOLD', descKey: 'DESC_HAMA_GOLD' },
      { id: 'black', color: 'black', price: 120, nameKey: 'PLATE_NAME_BLACK', descKey: 'DESC_HAMA_BLACK' },
    ],
    presets: [
      { id: 'drink', emoji: '🥤', price: 40, textKey: 'PRESET_HAMA_DRINK' },
      { id: 'tea', emoji: '🍵', price: 0, textKey: 'PRESET_HAMA_TEA' },
      { id: 'soup', emoji: '🥣', price: 50, textKey: 'PRESET_HAMA_SOUP' },
      { id: 'noodle', emoji: '🍜', price: 90, textKey: 'PRESET_HAMA_NOODLE' },
      { id: 'dessert', emoji: '🍰', price: 70, textKey: 'PRESET_HAMA_DESSERT' },
      { id: 'premium', emoji: '🍱', price: 150, textKey: 'PRESET_HAMA_PREMIUM' },
    ],
  },
  katsumidori: {
    id: 'katsumidori',
    shortName: 'Katsu Midori',
    theme: 'katsumidori',
    taxType: 'plus_plus',
    kind: 'plates',
    status: 'verified',
    checkedAt: '2026-11-21',
    noteKey: 'NOTE_KATSU',
    subKey: 'BRAND_SUB_KATSU',
    sources: [
      'https://www.notyourtypicaltourist.com/thailand-2/katsu-midori-thailand/',
      'https://www.wongnai.com/restaurants/2916357Ds-katsu-midori-thailand-centralworld/reviews',
    ],
    plates: [
      { id: 'p40', color: 'red', price: 40, nameKey: 'KATSU_PLATE_40', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p50', color: 'blue', price: 50, nameKey: 'KATSU_PLATE_50', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p60', color: 'green', price: 60, nameKey: 'KATSU_PLATE_60', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p70', color: 'orange', price: 70, nameKey: 'KATSU_PLATE_70', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p80', color: 'brown', price: 80, nameKey: 'KATSU_PLATE_80', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p90', color: 'pink', price: 90, nameKey: 'KATSU_PLATE_90', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p100', color: 'gray', price: 100, nameKey: 'KATSU_PLATE_100', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p120', color: 'cream', price: 120, nameKey: 'KATSU_PLATE_120', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p140', color: 'crimson', price: 140, nameKey: 'KATSU_PLATE_140', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p150', color: 'gold', price: 150, nameKey: 'KATSU_PLATE_150', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p160', color: 'navy', price: 160, nameKey: 'KATSU_PLATE_160', descKey: 'PLATE_DESC_KATSU' },
      { id: 'p180', color: 'black', price: 180, nameKey: 'KATSU_PLATE_180', descKey: 'PLATE_DESC_KATSU' },
    ],
    presets: [
      { id: 'tea', emoji: '🍵', price: 45, textKey: 'PRESET_KATSU_TEA' },
      { id: 'miso', emoji: '🦀', price: 60, textKey: 'PRESET_KATSU_MISO' },
      { id: 'egg', emoji: '🥣', price: 60, textKey: 'PRESET_KATSU_EGG' },
      { id: 'dessert', emoji: '🍮', price: 80, textKey: 'PRESET_KATSU_DESSERT' },
      { id: 'set', emoji: '🍣', price: 220, textKey: 'PRESET_KATSU_SET' },
      { id: 'tempura', emoji: '🍤', price: 140, textKey: 'PRESET_KATSU_TEMPURA' },
    ],
  },
  onodera: {
    id: 'onodera',
    shortName: 'Ginza Onodera',
    theme: 'onodera',
    taxType: 'plus_plus',
    kind: 'plates',
    status: 'verified',
    checkedAt: CHECKED_AT,
    noteKey: 'NOTE_ONODERA',
    subKey: 'BRAND_SUB_ONODERA',
    sources: [
      'https://www.kaohooninternational.com/?p=586907',
      'https://www.kaohooninternational.com/?p=576115',
    ],
    plates: [
      { id: 'white', color: 'white', price: 80, nameKey: 'PLATE_NAME_WHITE', descKey: 'DESC_ONODERA_WHITE' },
      { id: 'blue', color: 'blue', price: 120, nameKey: 'PLATE_NAME_BLUE', descKey: 'DESC_ONODERA_BLUE' },
      { id: 'green', color: 'green', price: 160, nameKey: 'PLATE_NAME_GREEN', descKey: 'DESC_ONODERA_GREEN' },
      { id: 'red', color: 'red', price: 200, nameKey: 'PLATE_NAME_RED', descKey: 'DESC_ONODERA_RED' },
      { id: 'silver', color: 'silver', price: 240, nameKey: 'PLATE_NAME_SILVER', descKey: 'DESC_ONODERA_SILVER' },
      { id: 'gold', color: 'gold', price: 300, nameKey: 'PLATE_NAME_GOLD', descKey: 'DESC_ONODERA_GOLD' },
      { id: 'black', color: 'black', price: 380, nameKey: 'PLATE_NAME_BLACK', descKey: 'DESC_ONODERA_BLACK' },
    ],
    presets: [
      { id: 'tea', emoji: '🍵', price: 60, textKey: 'PRESET_ONODERA_TEA' },
      { id: 'miso', emoji: '🥣', price: 90, textKey: 'PRESET_ONODERA_MISO' },
      { id: 'egg', emoji: '🥚', price: 120, textKey: 'PRESET_ONODERA_EGG' },
      { id: 'dessert', emoji: '🍨', price: 140, textKey: 'PRESET_ONODERA_DESSERT' },
      { id: 'omakase', emoji: '👑', price: 480, textKey: 'PRESET_ONODERA_OMAKASE' },
      { id: 'drink', emoji: '🍶', price: 180, textKey: 'PRESET_ONODERA_DRINK' },
    ],
  },
  genki: {
    id: 'genki',
    shortName: 'GENKI SUSHI',
    theme: 'genki',
    taxType: 'vat_included',
    kind: 'plates',
    status: 'verified',
    checkedAt: CHECKED_AT,
    noteKey: 'NOTE_GENKI',
    subKey: 'BRAND_SUB_GENKI',
    sources: ['https://www.wongnai.com/articles/genki-sushi'],
    plates: [
      { id: 'white', color: 'white', price: 30, nameKey: 'PLATE_NAME_WHITE', descKey: 'DESC_GENKI_WHITE' },
      { id: 'orange', color: 'orange', price: 40, nameKey: 'PLATE_NAME_ORANGE', descKey: 'DESC_GENKI_ORANGE' },
      { id: 'silver', color: 'silver', price: 60, nameKey: 'PLATE_NAME_SILVER', descKey: 'DESC_GENKI_SILVER' },
      { id: 'gold', color: 'gold', price: 80, nameKey: 'PLATE_NAME_GOLD', descKey: 'DESC_GENKI_GOLD' },
      { id: 'black', color: 'black', price: 100, nameKey: 'PLATE_NAME_BLACK', descKey: 'DESC_GENKI_BLACK' },
    ],
    presets: [
      { id: 'tea', emoji: '🍵', price: 39, textKey: 'PRESET_GENKI_TEA' },
      { id: 'tea_free', emoji: '🫖', price: 0, textKey: 'PRESET_GENKI_TEA_FREE' },
      { id: 'soup', emoji: '🥣', price: 45, textKey: 'PRESET_GENKI_SOUP' },
      { id: 'egg', emoji: '🥚', price: 55, textKey: 'PRESET_GENKI_EGG' },
      { id: 'noodle', emoji: '🍜', price: 89, textKey: 'PRESET_GENKI_NOODLE' },
      { id: 'dessert', emoji: '🍦', price: 69, textKey: 'PRESET_GENKI_DESSERT' },
    ],
  },
};

// Brands priced by plate colour (counted in the sushi screen). The rest are priced per item on the split screen.
export const PLATE_BRAND_ORDER: BrandId[] = BRAND_ORDER.filter((id) => BRANDS[id].kind === 'plates');
export const ITEM_BRAND_ORDER: BrandId[] = BRAND_ORDER.filter((id) => BRANDS[id].kind === 'items');
