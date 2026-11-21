import { defineConfig } from '@playwright/test';

// One project per screen size (same pattern as My-Investment-Port's projects list).
// Phone and tablet projects use touch emulation, so the coarse-pointer rules are exercised too.
const PORT = 5180;

export default defineConfig({
  testDir: './tests/web',
  timeout: 30000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: 'phone-portrait-390', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'phone-landscape-844', use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'tablet-portrait-768', use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'tablet-landscape-1024', use: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false } },
  ],
});
