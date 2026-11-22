# split-bill

Browser app for counting sushi plates and splitting restaurant bills by item, with service charge and VAT calculations.

## Running it

```bash
npm install
npm start          # menu: dev server, tests, build, preview, release
npm run dev        # dev server at http://localhost:5173
npm run build      # tests + typecheck + static build into dist/
npm test           # unit tests (Node 22.18+ runs the TypeScript directly)
npm run test:web   # browser tests at phone, tablet and desktop sizes (Playwright)
```

`npm start 2` runs an option without the menu, which is handy for scripts and CI.

## Project layout

- `src/logic/`: calculations, validation and state transforms.
- `src/config/`: colours, typography, brands, presets and feature switches.
- `src/strings/th.ts`: Thai language text.
- `src/integrations/`: browser storage and peer sharing.
- `src/ui/`: rendering, event handling and styles.
- `tests/`: Node unit tests and fixtures; `tests/web/`: Playwright browser tests.

See [ARCHITECTURE.md](ARCHITECTURE.md) for import boundaries and literal placement rules.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
