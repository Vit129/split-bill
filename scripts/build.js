// Copies the static app into dist/ for any static host. The app has no bundling step:
// the browser loads the same ES modules from src/, so dist/ is a plain copy after tests pass.
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist');

await rm(out, { recursive: true, force: true });
await cp(join(root, 'index.html'), join(out, 'index.html'));
await cp(join(root, 'src'), join(out, 'src'), { recursive: true });
console.log(`Built static app into ${out}`);
