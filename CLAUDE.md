# CLAUDE.md: kaiten-sushi-calc

Personal project. Plain ES modules, no build, no dependencies.

- Run: `npm start` (serves on http://localhost:5173). Test: `npm test` (`node --test`).
- Layout and layer rules: `ARCHITECTURE.md` (dev-qa-pattern: logic / config / strings / integrations / ui / tests).
- Hard rules, enforced by `tests/architecture-guard.test.js`:
  - Thai text only in `src/strings/th.js`.
  - Hex colours only in `src/config/colors.js`; numeric font sizes only in `src/config/typography.js`.
  - `src/logic/` has no DOM, storage, network or WebRTC, and imports nothing from `ui/` or `integrations/`.
- Money is integer satang. Shares must add up exactly (`allocate()`); tests check this on random bills.
- Brand prices are unverified (`status: 'unverified'`). Do not present them as real without a source.
- Temp files go in `.tmp/` (gitignored), not `/tmp`.
- Do not commit or push without asking.
