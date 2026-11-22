# CLAUDE.md: kaiten-sushi-calc

Personal project. TypeScript + Vite; no framework.

- Run: `npm run dev` (Vite, http://localhost:5173). Test: `npm test`. Typecheck: `npm run typecheck`. Build: `npm run build`.
- Layout and layer rules: `ARCHITECTURE.md` (logic / config / strings / integrations / ui / tests).
- Hard rules (review changes against the layer table and use its `rg` checks):
  - Thai text only in `src/strings/th.ts`.
  - Hex colours only in `src/config/colors.ts`; numeric font sizes only in `src/config/typography.ts`.
  - `src/logic/` has no DOM, storage, network or imports from `src/ui/` or `src/integrations/`.
  - The baht sign (U+0E3F) when used as a currency symbol next to prices and code comments are allowed anywhere; neither is Thai language text.
- Money is integer satang. Shares must add up exactly (`allocate()`); tests check this on random bills.
- Brand prices, tax types and source links are in `src/config/brands.ts`.
- Temp files go in `.tmp/` (gitignored), not `/tmp`.
- Do not commit or push without asking.
