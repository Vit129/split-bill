// Architecture guard (dev-qa-pattern §5): static checks that fail the moment a boundary is breached.
// Runs in plain Node with no browser, in well under 100 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRINGS } from '../src/strings/th.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = join(root, 'src');

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

// Comments may mention anything; only code counts.
const stripComments = (text: string): string => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
  .join('\n');

const rel = (file: string): string => relative(root, file).split(sep).join('/');
const files = listFiles(srcRoot);
const code = (file: string): string => stripComments(readFileSync(file, 'utf8'));
const scan = (pattern: RegExp, filter: (file: string) => boolean): string[] => files
  .filter(filter)
  .flatMap((file) => code(file).split('\n')
    .map((line, i) => (pattern.test(line) ? `${rel(file)}:${i + 1}: ${line.trim()}` : null))
    .filter((x): x is string => x !== null));

const isStrings = (file: string): boolean => rel(file).startsWith('src/strings/');
const isColorConfig = (file: string): boolean => rel(file) === 'src/config/colors.ts';
const isTypographyConfig = (file: string): boolean => rel(file) === 'src/config/typography.ts';
const isLogic = (file: string): boolean => rel(file).startsWith('src/logic/');

test('[FE-IT] no Thai text outside src/strings (every label is a translation key)', () => {
  const thai = /[ก-ฺเ-๿]/;
  assert.deepEqual(scan(thai, (f) => !isStrings(f)), []);
});

test('[FE-UT] no hex colours outside config/colors.ts (use tokens)', () => {
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  assert.deepEqual(scan(hex, (f) => !isColorConfig(f)), []);
});

test('[FE-UT] no numeric font sizes outside config/typography.ts', () => {
  const css = /font-size\s*:\s*\d/;
  const js = /fontSize\s*:\s*\d/;
  const hits = scan(css, (f) => !isTypographyConfig(f) && f.endsWith('.css'))
    .concat(scan(js, (f) => !isTypographyConfig(f) && f.endsWith('.ts')));
  assert.deepEqual(hits, []);
});

test('[BE-UT] logic has no DOM, storage, network or WebRTC', () => {
  const io = /\b(document|window|localStorage|sessionStorage|fetch|RTCPeerConnection|navigator)\b/;
  assert.deepEqual(scan(io, isLogic), []);
});

test('[BE-UT] logic imports nothing from ui or integrations', () => {
  const up = /from '\.\.\/(ui|integrations)\//;
  assert.deepEqual(scan(up, isLogic), []);
});

test('[BE-UT] no eval or dynamic code', () => {
  const dyn = /\beval\s*\(|new Function\s*\(/;
  assert.deepEqual(scan(dyn, () => true), []);
});

test('[FE-UT] every STRINGS.KEY referenced in src exists in strings/th.ts', () => {
  const missing: string[] = [];
  for (const file of files) {
    for (const m of code(file).matchAll(/\bSTRINGS\.([A-Z0-9_]+)\b/g)) {
      const key = m[1] ?? '';
      if (!(key in STRINGS)) missing.push(`${rel(file)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('[FE-UT] every text key named in config/brands.ts exists in strings/th.ts', () => {
  const brands = readFileSync(join(srcRoot, 'config/brands.ts'), 'utf8');
  const missing: string[] = [];
  for (const m of brands.matchAll(/(\w+Key|textKey): '([A-Z0-9_]+)'/g)) {
    const key = m[2] ?? '';
    if (!(key in STRINGS)) missing.push(key);
  }
  assert.deepEqual(missing, []);
});

test('[FE-UT] user-typed values reach HTML only through esc() (no raw template of state.* names)', () => {
  const rawName = /\$\{\s*(s\.name|p\.name|e\.name|person\.name|ex\.name|s\.people)\b/;
  assert.deepEqual(scan(rawName, (f) => rel(f) === 'src/ui/render.ts'), []);
});
