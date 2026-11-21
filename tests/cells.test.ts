import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveState, isValidCell, mergeCells, setCell, type Cells } from '../src/logic/cells.ts';

const base: Cells = {};

test('[BE-UT] setCell never moves a key’s time backwards', () => {
  const a = setCell(base, 'cfg:mode', 'person', 1000);
  const b = setCell(a, 'cfg:mode', 'table', 500);
  assert.equal(b['cfg:mode']?.t, 1001);
  assert.equal(b['cfg:mode']?.v, 'table');
});

test('[BE-BL] merge keeps the newer cell per key, whichever device sends it', () => {
  const key = 'brand:sushiro:plate:table:red';
  const phone = setCell(base, key, 2, 1000);
  const tablet = setCell(base, key, 5, 2000);
  assert.equal(mergeCells(phone, tablet).cells[key]?.v, 5);
  assert.equal(mergeCells(tablet, phone).cells[key]?.v, 5);
});

test('[BE-BL] merge is order-independent and idempotent', () => {
  const x = setCell(setCell(base, 'cfg:brand', 'hama', 10), 'cfg:mode', 'person', 20);
  const y = setCell(setCell(base, 'cfg:brand', 'genki', 30), 'cfg:equalTaxSplit', true, 5);
  const xy = mergeCells(x, y).cells;
  const yx = mergeCells(y, x).cells;
  assert.deepEqual(xy, yx);
  assert.deepEqual(mergeCells(xy, y).cells, xy);
  assert.equal(mergeCells(xy, y).changed, false);
});

test('[BE-BL] a deletion (tombstone) from the other device wins when it is newer', () => {
  const person = 'person:p_abc12345';
  const added = setCell(base, person, { n: 'Mai', o: 1 }, 1000);
  const removed = setCell(added, person, null, 2000);
  assert.equal(deriveState(mergeCells(added, removed).cells).people.length, 0);
});

test('[BE-UT] rejects malformed cells from another device (trust boundary)', () => {
  const bad: Cells = {
    'brand:sushiro:plate:table:red': { v: -1, t: 1 },
    'brand:nope:plate:table:red': { v: 1, t: 1 },
    'brand:sushiro:plate:table:unknown': { v: 1, t: 1 },
    'cfg:mode': { v: 'hack', t: 1 },
    'hack:everything': { v: 1, t: 1 },
    'person:p_abc12345': { v: { n: '<img src=x onerror=alert(1)>'.repeat(10), o: 1 }, t: 1 },
    'brand:sushiro:extra:x1': { v: { n: 'x', p: 1.5, q: 1, o: 'table' }, t: 1 },
  };
  const result = mergeCells(base, bad);
  assert.equal(result.rejected, Object.keys(bad).length);
  assert.equal(result.changed, false);
  assert.equal(isValidCell('cfg:mode', { v: 'table', t: 1 }), true);
});

test('[BE-UT] rejects a payload with too many cells', () => {
  const huge: Record<string, { v: number; t: number }> = {};
  for (let i = 0; i < 5001; i += 1) huge[`brand:sushiro:plate:table:red${i}`] = { v: 1, t: 1 };
  assert.equal(mergeCells(base, huge).changed, false);
});

test('[BE-UT] deriveState applies defaults when nothing is saved', () => {
  const s = deriveState({});
  assert.equal(s.brandId, 'sushiro');
  assert.equal(s.mode, 'table');
  assert.equal(s.brands.sushiro.sc, true);
});
