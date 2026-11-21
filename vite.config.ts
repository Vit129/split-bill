import { defineConfig } from 'vite';

// Relative base so the same build works from a Pages sub-path (/repo/) or a plain host.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
