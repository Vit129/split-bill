# Kaiten Sushi Calc

Bill calculator for conveyor-belt sushi in Thailand. Counts plates, adds extras, discount, service charge (SC) and VAT, then splits the bill equally or per person. Two phones can share a table with copy-paste codes; no server.

## Run

```bash
npm start          # http://localhost:5173  (ES modules need http, not file://)
npm test           # 26 headless tests incl. architecture guard (Node 20+, no dependencies)
```

## Use

- **หารเท่ากัน / แยกตามคน**: equal split of the whole table, or count plates per person.
- **กองกลาง**: shared plates or extras split equally among everyone.
- **ส่วนลด**: spread across people in proportion to what each ate, so nobody goes negative.
- **แชร์โต๊ะ**: host creates an invite code, guest pastes it and sends back a reply code, host pastes the reply. Then both sides sync automatically. Works on the same Wi-Fi; some mobile carriers (strict NAT) may fail.
- **คัดลอกสรุปส่ง LINE**: copies a text summary.
- Undo is intentionally not provided.

## Tax rules

- `vat_included` brands (Sushiro, Hama, Genki in the data): total = price × 1.10 (SC 10% on top, VAT already inside the price).
- `plus_plus` brands (Katsu Midori, Ginza Onodera): total = price × 1.10 × 1.07 = × 1.177. This matches the Thai practice found on [Thai-language tax guidance](https://www.rd.go.th/49016.html) and worked examples (100 → 117.70). Verified against the search results on 2026-11-21; the RD ruling itself was not opened.

## Brand data: verification status (checked 2026-11-21)

Every brand is marked `unverified` in `src/config/brands.js`, and the app shows a warning banner. Search results found:

| Brand | Found | Not confirmed |
|---|---|---|
| Sushiro | Plate prices from 40 to 120 ฿ ([Thairath](https://en.thairath.co.th/money/business_marketing/business_strategy/2908264), [Bangkok Post](https://www.bangkokpost.com/life/social-and-lifestyle/2104267/sushi-expressway)) | White plate 30 vs 60 ฿, black 100 vs 120 ฿ conflict between sources |
| Hama Sushi | Opened at Central Pinklao, plates from 40 ฿ ([Brand Inside](https://brandinside.asia/?p=239488)) | Plate colours and prices |
| Katsu Midori | Range 40–180 ฿ in a Feb 2026 review ([Wongnai](https://www.wongnai.com/restaurants/2916357Ds-katsu-midori-thailand-centralworld/reviews)) | Colours; the old code's 40–150 ฿ range does not match |
| Ginza Onodera | First Thai branch at CentralWorld; from 40 ฿, premium 100–300 ฿ ([Kaohoon](https://www.kaohooninternational.com/?p=586907)) | Colours; the old code's 80–380 ฿ range does not match |
| Genki Sushi | Exists in Thailand (CentralWorld) ([Wongnai](https://www.wongnai.com/articles/genki-sushi)) | Any price or colour |

Reliable prices need a photo of the current menu or a receipt from each branch.

## Verified

- 26/26 headless tests pass (`npm test`).
- Browser smoke (headless Chromium, 390 px and desktop): renders with no console errors; brand switch; person mode; discount 40 with one red plate → 0.00 ฿; no horizontal overflow on a phone-sized screen.
- Two-browser sync (separate contexts): offline counts merged to 132.00 ฿ on both sides (red 40 + gold 80, +10% SC); no duplicate people; live edit propagated (165.00 ฿ on both).
- Not tested on two real phones over mobile data.

## Files

See `ARCHITECTURE.md` for the layer map and data model.
