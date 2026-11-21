# split-bill

A bill calculator for eating out in Thailand. It works out who owes what, with service charge (SC) and VAT handled the way Thai restaurants bill them.

It runs entirely in the browser. There is no server and no account, and nothing you enter leaves your device.

## Screens

- **Sushi (count plates):** tap plate colours per person for conveyor-belt sushi. Each brand has its own plate prices and tax type.
- **Split bill (items):** add items by category, tap who ate each one, then set SC and VAT for the whole bill. Discounts come off before SC and VAT are charged.

Open the menu (☰) to switch between them.

## How the maths works

- **SC + VAT** (the "++" menus): SC 10% is added to the food, then VAT 7% is charged on food plus SC.
- **VAT included** menus: the menu price already has VAT, so only SC 10% is added on top.
- **Per-person shares** are split in whole satang, so the shares always add up to the bill exactly. The discount is spread in proportion to what each person ate, so nobody goes negative.
- The SC/VAT rule is set once for the whole bill: no SC/VAT, SC only, VAT only, or SC + VAT. The percentages fill in automatically and can be edited.

The calculation is covered by unit tests, including a random-bill check that the shares always add up.

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

## Data and sharing

- Your bill is saved in the browser's local storage on that device.
- Table sharing between two phones (copy-and-paste codes over WebRTC) is written and tested, but it is **switched off** in `src/config/features.ts`. It needs a network path between the phones and has no TURN relay, so it can fail on some mobile networks.

## Prices and tax types

Plate and item prices are stored in `src/config/brands.ts`, each with its sources and a check date. Restaurants change prices often, so check the current menu before you rely on a figure.

This tool is not tax advice. The rules it uses are a practical reading of how Thai restaurants bill, and your receipt is the final word.

## Project layout

- `src/logic/`: pure calculation (money, bill, split, expressions, cells). No DOM, no storage.
- `src/config/`: colours, typography, brands, presets, feature switches.
- `src/strings/th.ts`: every piece of visible Thai text.
- `src/integrations/`: local storage and WebRTC sharing.
- `src/ui/`: rendering and event handling for both screens.
- `tests/`: unit tests and an architecture guard that fails if text, colours or font sizes leak outside their files. Browser tests live in `tests/web/`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layer map.

## Releases

Versions follow semver, with a build number that goes up on every release. `npm run release` asks whether this is a patch, minor, major, or skip (build only). It runs the gate, updates the version and changelog, commits, and tags. Pushing and the GitHub release happen only with `--push`. The changelog is generated with [git-cliff](https://git-cliff.org) from conventional commits.

## Contributing

Work on a branch, keep the checks green (`npm test`, `npm run typecheck`, `npm run test:web`), and use conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`).

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
