// The shared table is a flat map of "cells": key -> { v, t }. v is the value (null = deleted),
// t is the last-write time. Two devices merge by keeping the newer cell per key, so
// merging is order-independent and repeating it is harmless. Pure functions only.
import { BRANDS, BRAND_ORDER, type BrandId } from '../config/brands.ts';

export const MAX_CELLS = 5000;
const MAX_BAHT = 100000;
const OWNER_PERSON = /^p_[a-z0-9]{1,16}$/;
const ID = /^[a-z0-9_]{1,24}$/;
const BRAND_FIELD = /^brand:([a-z]+):(sc|discount|budget)$/;
const BRAND_PLATE = /^brand:([a-z]+):plate:([a-z0-9_]+):([a-z0-9_]+)$/;
const BRAND_EXTRA = /^brand:([a-z]+):extra:([a-z0-9]+)$/;
const PERSON = /^person:(p_[a-z0-9]{1,16})$/;

export interface Cell {
  v: unknown;
  t: number;
}
export type Cells = Record<string, Cell>;

export type ParsedKey =
  | { kind: 'cfg:brand' | 'cfg:mode' | 'cfg:equalTaxSplit' }
  | { kind: 'brandField'; brand: string; field: 'sc' | 'discount' | 'budget' }
  | { kind: 'plate'; brand: string; owner: string; plate: string }
  | { kind: 'extra'; brand: string; id: string }
  | { kind: 'person'; id: string };

export function parseKey(key: string): ParsedKey | null {
  if (key === 'cfg:brand' || key === 'cfg:mode' || key === 'cfg:equalTaxSplit') {
    return { kind: key };
  }
  let m = BRAND_FIELD.exec(key);
  if (m && m[1] && m[2]) return { kind: 'brandField', brand: m[1], field: m[2] as 'sc' | 'discount' | 'budget' };
  m = BRAND_PLATE.exec(key);
  if (m && m[1] && m[2] && m[3]) return { kind: 'plate', brand: m[1], owner: m[2], plate: m[3] };
  m = BRAND_EXTRA.exec(key);
  if (m && m[1] && m[2]) return { kind: 'extra', brand: m[1], id: m[2] };
  m = PERSON.exec(key);
  if (m && m[1]) return { kind: 'person', id: m[1] };
  return null;
}

const isBrandId = (x: string): x is BrandId => Object.hasOwn(BRANDS, x);
const isOwner = (o: unknown): boolean =>
  typeof o === 'string' && (o === 'table' || o === 'shared' || OWNER_PERSON.test(o));
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

function validValue(parsed: ParsedKey, v: unknown): boolean {
  switch (parsed.kind) {
    case 'cfg:brand':
      return typeof v === 'string' && isBrandId(v);
    case 'cfg:mode':
      return v === 'table' || v === 'person';
    case 'cfg:equalTaxSplit':
      return typeof v === 'boolean';
    case 'brandField': {
      if (!isBrandId(parsed.brand)) return false;
      if (parsed.field === 'sc') return typeof v === 'boolean';
      return isInt(v, 0, MAX_BAHT);
    }
    case 'plate': {
      if (!isBrandId(parsed.brand)) return false;
      return isOwner(parsed.owner)
        && BRANDS[parsed.brand].plates.some((p) => p.id === parsed.plate)
        && isInt(v, 0, 999);
    }
    case 'extra':
      return isBrandId(parsed.brand)
        && ID.test(parsed.id)
        && isObj(v)
        && typeof v['n'] === 'string' && v['n'].trim().length > 0 && v['n'].length <= 60
        && isInt(v['p'], 0, MAX_BAHT)
        && isInt(v['q'], 1, 99)
        && isOwner(v['o']);
    case 'person':
      return isObj(v)
        && typeof v['n'] === 'string' && v['n'].trim().length > 0 && v['n'].length <= 40
        && typeof v['o'] === 'number' && Number.isFinite(v['o']);
  }
}

// Rejects anything malformed: this is the trust boundary for data from another device.
export function isValidCell(key: string, cell: unknown): cell is Cell {
  if (!isObj(cell) || typeof cell['t'] !== 'number' || !Number.isFinite(cell['t'])) return false;
  if (cell['v'] === null) return parseKey(key) !== null; // tombstone
  const parsed = parseKey(key);
  return parsed !== null && validValue(parsed, cell['v']);
}

// Local write. Time never goes backwards for a key, so a local edit always wins over the older copy.
export function setCell(cells: Cells, key: string, value: unknown, now: number = Date.now()): Cells {
  const prev = cells[key];
  const t = Math.max(now, (prev?.t ?? 0) + 1);
  return { ...cells, [key]: { v: value, t } };
}

export interface MergeResult {
  cells: Cells;
  changed: boolean;
  rejected: number;
}

// Keeps the newer cell per key. Invalid cells are skipped and counted, not applied.
export function mergeCells(local: Cells, incoming: unknown): MergeResult {
  if (!isObj(incoming) || Array.isArray(incoming)) {
    return { cells: local, changed: false, rejected: 0 };
  }
  const keys = Object.keys(incoming);
  if (keys.length > MAX_CELLS) return { cells: local, changed: false, rejected: keys.length };
  const merged: Cells = { ...local };
  let changed = false;
  let rejected = 0;
  for (const key of keys) {
    const remote = incoming[key];
    if (!isValidCell(key, remote)) {
      rejected += 1;
      continue;
    }
    const mine = merged[key];
    const remoteWins = !mine
      || remote.t > mine.t
      || (remote.t === mine.t && JSON.stringify(remote.v) > JSON.stringify(mine.v));
    if (remoteWins && JSON.stringify(mine) !== JSON.stringify(remote)) {
      merged[key] = { v: remote.v, t: remote.t };
      changed = true;
    }
  }
  return { cells: merged, changed, rejected };
}

export interface ExtraItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  owner: string;
}

export interface BrandData {
  sc: boolean;
  discount: number;
  budget: number;
  plates: Record<string, Record<string, number>>;
  extras: ExtraItem[];
}

export interface PersonRow {
  id: string;
  name: string;
}

export interface AppState {
  brandId: BrandId;
  mode: 'table' | 'person';
  equalTaxSplit: boolean;
  people: PersonRow[];
  brands: Record<BrandId, BrandData>;
}

const liveValue = (cells: Cells, key: string): unknown => {
  const cell = cells[key];
  return cell && cell.v !== null ? cell.v : undefined;
};

// Turns the flat cells into the shape the UI and billing read. Missing values get defaults.
export function deriveState(cells: Cells): AppState {
  const brands = {} as Record<BrandId, BrandData>;
  for (const id of BRAND_ORDER) {
    brands[id] = { sc: true, discount: 0, budget: 0, plates: {}, extras: [] };
  }
  const people: { id: string; n: string; o: number }[] = [];
  const extras: { brand: BrandId; id: string; t: number; n: string; p: number; q: number; o: string }[] = [];
  for (const [key, cell] of Object.entries(cells)) {
    if (cell.v === null) continue;
    const parsed = parseKey(key);
    if (!parsed) continue;
    if (parsed.kind === 'person' && isObj(cell.v)) {
      people.push({ id: parsed.id, n: String(cell.v['n']), o: Number(cell.v['o']) });
    }
    if (parsed.kind === 'brandField' && isBrandId(parsed.brand)) {
      const data = brands[parsed.brand];
      if (parsed.field === 'sc') data.sc = cell.v === true;
      else if (parsed.field === 'discount') data.discount = Number(cell.v);
      else data.budget = Number(cell.v);
    }
    if (parsed.kind === 'plate' && isBrandId(parsed.brand)) {
      const owners = brands[parsed.brand].plates;
      owners[parsed.owner] = { ...owners[parsed.owner], [parsed.plate]: Number(cell.v) };
    }
    if (parsed.kind === 'extra' && isBrandId(parsed.brand) && isObj(cell.v)) {
      extras.push({
        brand: parsed.brand,
        id: parsed.id,
        t: cell.t,
        n: String(cell.v['n']),
        p: Number(cell.v['p']),
        q: Number(cell.v['q']),
        o: String(cell.v['o']),
      });
    }
  }
  people.sort((a, b) => a.o - b.o || a.id.localeCompare(b.id));
  extras.sort((a, b) => a.t - b.t);
  for (const ex of extras) {
    brands[ex.brand].extras.push({ id: ex.id, name: ex.n, price: ex.p, qty: ex.q, owner: ex.o });
  }
  const brandRaw = liveValue(cells, 'cfg:brand');
  const modeRaw = liveValue(cells, 'cfg:mode');
  const equalRaw = liveValue(cells, 'cfg:equalTaxSplit');
  return {
    brandId: typeof brandRaw === 'string' && isBrandId(brandRaw) ? brandRaw : 'sushiro',
    mode: modeRaw === 'person' ? 'person' : 'table',
    equalTaxSplit: equalRaw === true,
    people: people.map((p) => ({ id: p.id, name: p.n })),
    brands,
  };
}
