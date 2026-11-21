# Architecture

Pattern: `~/.claude/skills/ai-sdlc/references/dev-qa-pattern.md` (Dev + QA). Layout: `rules/coding/project-blueprint.md`.

## Layer map (dev-qa-pattern §7: BE vs FE per project)

| Layer | Folder | Holds | Rule |
|---|---|---|---|
| **BE** (headless core) | `src/logic/` | billing maths, cell merge, share-code decode, view model, summary text | no DOM, storage, network or WebRTC; no import from `ui/` or `integrations/` |
| **Config (tokens)** | `src/config/` | `colors.js` (only hex), `typography.js` (only font sizes), `brands.js` (prices, tax type, source links) | data only |
| **Translator** | `src/strings/th.js` | every Thai word | the only place Thai text may live |
| **Integrations** | `src/integrations/` | `storage.js` (localStorage), `peer-sync.js` (WebRTC, copy-paste codes) | I/O only, no rules |
| **FE** (presentation) | `src/ui/` | `render.js` (markup), `app.js` (events → cell writes), `styles.css` (var() only) | assembles; never computes a rule |
| **QA guard** | `tests/architecture-guard.test.js` | static checks: no Thai outside strings, no hex outside colors, no numeric font sizes outside typography, logic purity, every key exists | fails CI on a breach |
| **QA tests** | `tests/*.test.js`, `tests/fixtures/` | headless unit and matrix tests (`node:test`, zero deps) | fixtures hold data only |

Tags (`[LAYER-KIND]`): `[BE-UT]` one function, `[BE-BL]` a rule across steps, `[BE-IT]` two modules together, `[FE-UT]`/`[FE-IT]` for UI-facing checks.

## Data model: flat cells (why sharing works without a server)

State is a map `key → { v, t }`. `v` is the value (`null` = deleted), `t` is the last write time.

- Two devices merge by keeping the newer cell for each key. Merge is order-independent and idempotent (tested).
- Keys: `cfg:brand`, `cfg:mode`, `cfg:equalTaxSplit`, `brand:<b>:sc|discount|budget`, `brand:<b>:plate:<owner>:<plate>` (owner = `table` | `shared` | `p_<id>`), `brand:<b>:extra:<id>`, `person:<id>`.
- Remote data is untrusted: `isValidCell` checks every key and value, and a payload over 5000 cells is dropped.
- Known limit: last-write-wins by device clock. Two people tapping the same counter at the same moment can lose one tap. A skewed phone clock can make its edits win.

## Money

Integer satang everywhere. `allocate()` (largest remainder) splits totals so shares add up exactly.

- Person mode: the shared pool splits equally; the discount is spread in proportion to each person's gross food (never negative); the bill grand total is spread in proportion to each person's net food (or equally when `equalTaxSplit`).
- Table mode: the grand total is split equally.
- Tax formulas: see `src/logic/billing.js` header and README §"Tax rules".

## Share flow (no app server)

1. Host: `createInvite()` builds a WebRTC offer and waits for ICE, then shows the code.
2. Guest: `joinWithInvite(code)` builds an answer and shows its code.
3. Host pastes the answer → data channel opens → both sides send their full cells and merge.
4. Each later local change is sent in full to the connected peer.

Only outside party: public STUN server `stun.l.google.com` (to learn addresses). No TURN, so some carrier NATs will fail. One guest per invite.

## Not done / open

- `tests-web/` (browser E2E in the pattern) is not in the repo. Two-browser sync and layout smoke tests were run manually (see README §"Verified").
- Plate prices are unverified for four of five brands (see `src/config/brands.js` `status` / `sources`). Editing prices in the app is not built.
- Tax model for vat_included brands matches the reading in `billing.js`; confirm with one real receipt per brand.
