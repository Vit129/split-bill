// The shared table is a flat map of "cells": key -> { v, t }. v is the value (null = deleted),
// t is the last-write time. Two devices merge by keeping the newer cell per key, so
// merging is order-independent and repeating it is harmless. Pure functions only.
import { BRANDS, BRAND_ORDER } from '../config/brands.js';

export const MAX_CELLS = 5000;
const MAX_BAHT = 100000;
const OWNER_PERSON = /^p_[a-z0-9]{1,16}$/;
const ID = /^[a-z0-9_]{1,24}$/;
const BRAND_FIELD = /^brand:([a-z]+):(sc|discount|budget)$/;
const BRAND_PLATE = /^brand:([a-z]+):plate:([a-z0-9_]+):([a-z0-9_]+)$/;
const BRAND_EXTRA = /^brand:([a-z]+):extra:([a-z0-9]+)$/;
const PERSON = /^person:(p_[a-z0-9]{1,16})$/;

export function parseKey(key) {
  if (key === 'cfg:brand' || key === 'cfg:mode' || key === 'cfg:equalTaxSplit') {
    return { kind: key };
  }
  let m = BRAND_FIELD.exec(key);
  if (m) return { kind: 'brandField', brand: m[1], field: m[2] };
  m = BRAND_PLATE.exec(key);
  if (m) return { kind: 'plate', brand: m[1], owner: m[2], plate: m[3] };
  m = BRAND_EXTRA.exec(key);
  if (m) return { kind: 'extra', brand: m[1], id: m[2] };
  m = PERSON.exec(key);
  if (m) return { kind: 'person', id: m[1] };
  return null;
}

const isOwner = (o) => o === 'table' || o === 'shared' || OWNER_PERSON.test(o);
const isInt = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;

function validValue(parsed, v) {
  switch (parsed.kind) {
    case 'cfg:brand': return Object.hasOwn(BRANDS, v);
    case 'cfg:mode': return v === 'table' || v === 'person';
    case 'cfg:equalTaxSplit': return typeof v === 'boolean';
    case 'brandField': {
      if (!Object.hasOwn(BRANDS, parsed.brand)) return false;
      if (parsed.field === 'sc') return typeof v === 'boolean';
      return isInt(v, 0, MAX_BAHT);
    }
    case 'plate': {
      const brand = BRANDS[parsed.brand];
      return Boolean(brand)
        && isOwner(parsed.owner)
        && brand.plates.some((p) => p.id === parsed.plate)
        && isInt(v, 0, 999);
    }
    case 'extra':
      return Boolean(BRANDS[parsed.brand])
        && ID.test(parsed.id)
        && typeof v === 'object' && v !== null
        && typeof v.n === 'string' && v.n.trim().length > 0 && v.n.length <= 60
        && isInt(v.p, 0, MAX_BAHT)
        && isInt(v.q, 1, 99)
        && isOwner(v.o);
    case 'person':
      return typeof v === 'object' && v !== null
        && typeof v.n === 'string' && v.n.trim().length > 0 && v.n.length <= 40
        && Number.isFinite(v.o);
    default: return false;
  }
}

// Rejects anything malformed: this is the trust boundary for data from another device.
export function isValidCell(key, cell) {
  if (!cell || typeof cell !== 'object' || !Number.isFinite(cell.t)) return false;
  if (cell.v === null) return parseKey(key) !== null; // tombstone
  const parsed = parseKey(key);
  return parsed !== null && validValue(parsed, cell.v);
}

// Local write. Time never goes backwards for a key, so a local edit always wins over the older copy.
export function setCell(cells, key, value, now = Date.now()) {
  const prev = cells[key];
  const t = Math.max(now, (prev?.t ?? 0) + 1);
  return { ...cells, [key]: { v: value, t } };
}

// Keeps the newer cell per key. Invalid cells are skipped and counted, not applied.
export function mergeCells(local, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { cells: local, changed: false, rejected: 0 };
  }
  const keys = Object.keys(incoming);
  if (keys.length > MAX_CELLS) return { cells: local, changed: false, rejected: keys.length };
  const merged = { ...local };
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

const liveValue = (cells, key) => {
  const cell = cells[key];
  return cell && cell.v !== null ? cell.v : undefined;
};

// Turns the flat cells into the shape the UI and billing read. Missing values get defaults.
export function deriveState(cells) {
  const brands = {};
  for (const id of BRAND_ORDER) {
    brands[id] = { sc: true, discount: 0, budget: 0, plates: {}, extras: [] };
  }
  const people = [];
  const extras = [];
  for (const [key, cell] of Object.entries(cells)) {
    if (cell.v === null) continue;
    const parsed = parseKey(key);
    if (!parsed) continue;
    if (parsed.kind === 'person') people.push({ id: parsed.id, ...cell.v });
    if (parsed.kind === 'brandField') brands[parsed.brand][parsed.field] = cell.v;
    if (parsed.kind === 'plate') {
      const owners = brands[parsed.brand].plates;
      owners[parsed.owner] = { ...owners[parsed.owner], [parsed.plate]: cell.v };
    }
    if (parsed.kind === 'extra') extras.push({ brand: parsed.brand, id: parsed.id, t: cell.t, ...cell.v });
  }
  people.sort((a, b) => a.o - b.o || a.id.localeCompare(b.id));
  extras.sort((a, b) => a.t - b.t);
  for (const ex of extras) {
    brands[ex.brand].extras.push({ id: ex.id, name: ex.n, price: ex.p, qty: ex.q, owner: ex.o });
  }
  return {
    brandId: liveValue(cells, 'cfg:brand') ?? 'sushiro',
    mode: liveValue(cells, 'cfg:mode') ?? 'table',
    equalTaxSplit: liveValue(cells, 'cfg:equalTaxSplit') ?? false,
    people: people.map((p) => ({ id: p.id, name: p.n })),
    brands,
  };
}
