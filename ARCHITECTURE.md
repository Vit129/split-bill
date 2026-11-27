# Architecture

TypeScript + Vite browser app. `src/` is organized by responsibility; the layer boundaries below are repository rules checked by reviewing the table and searching the source.

## Layer map

| Layer | Folder | May import | Responsibilities and rules |
|---|---|---|---|
| Translator | `src/strings/` (`th.ts`) | — | Thai language text lives here. The baht sign (U+0E3F) used as a currency symbol next to prices and code comments are allowed anywhere; neither is Thai language text. |
| Config | `src/config/` | Logic and strings (for preset types) | App data and tokens. Hex colour literals belong only in `src/config/colors.ts`; numeric font-size values belong only in `src/config/typography.ts`. |
| Logic | `src/logic/` | Logic, config and strings | Calculations, validation, state transforms and summary formatting. No DOM, storage, network or imports from `src/ui/` or `src/integrations/`. |
| Integrations | `src/integrations/` | Logic | Browser storage and peer sharing I/O; no calculation or presentation rules. |
| UI | `src/ui/` | Logic, config, strings and integrations | Rendering and event handling. CSS uses typography and colour variables; it does not define hex colours or numeric font sizes. |
| Unit tests and fixtures | `tests/`, `tests/fixtures/` | Application modules and fixtures | Headless unit tests run with Node's test runner. |
| Browser tests | `tests/web/` | Running app through Playwright | Browser-level checks. |

No static architecture check is configured. Review changes against this table. To locate likely rule violations, use:

```bash
rg -n '[ก-๙]' src -g '!src/strings/th.ts'
rg -n '#[0-9A-Fa-f]{3,8}' src -g '!src/config/colors.ts'
rg -n 'font-size\s*:\s*[0-9]' src
rg -n 'document\.|localStorage|fetch\(|RTCPeerConnection|from ["\x27].*(ui|integrations)' src/logic
```

Review search matches manually: Thai in comments and the baht sign next to prices are allowed.

Accepted exception: browser tests (`tests/web/*.spec.ts`) import the `STRINGS` keys from `src/strings/th.ts` so their expected text comes from the translator. This is the only place a test may import from `src/`; it is accepted by the owner (2026-11-22), not a violation. The import search is a locator; inspect imports and browser APIs in each changed logic file.

## Data model

State is a map `key → { v, t }`. `v` is the value (`null` = deleted), and `t` is the last write time. Devices merge by keeping the newer cell for each key. Remote cells are validated; payloads over 5000 cells are dropped. Last-write-wins uses device clocks, so simultaneous edits or clock skew can lose or override updates.

## Money

Amounts are integer satang. `allocate()` uses largest remainder so shares add up exactly. On the sushi screen, person mode splits the shared pool evenly, spreads discounts by gross food, then allocates the grand total by net food (or shares the added charges evenly when configured). Table mode splits the grand total evenly.

On the split-bill screen, SC and VAT are calculated once on the discounted bill, with VAT applied after SC. The two charges are then allocated by each person's applicable share or divided evenly. Optional whole-baht rounding applies to each person's final amount.

## Sharing

Peer sharing uses WebRTC and the public Google STUN server; no TURN relay is configured, so some mobile networks may not connect. Sharing is switched off in `src/config/features.ts`.
