# Changelog

All notable changes to Kaiten Sushi Calc are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-21

### Added
- Add static bill calculator with GitHub Pages deploy
- Add split-bill screen behind a menu and switch table sharing off
- Responsive layout, Playwright suite across phone, tablet and desktop, separate SC and VAT
- Move Hama, Onodera and Genki to item pricing; set Katsu Midori to 12 plate patterns
- Show Hama, Onodera and Genki as tabs on the sushi screen; confirm Katsu Midori
- Enter items first, then tap who ate each one on its row
- SC and VAT percentages per category, auto-filled under each tax choice
- Npm start opens a runner menu (dev, tests, browser tests, build, preview)
- Release tooling with git-cliff changelog, build number, and version 0.1.0

### Changed
- Convert the calculator to TypeScript with Vite
- Remove the split screen's brand source row; shortcuts are one shared set
- Tax rule per category in the settings card, not per item
- Four tax choices per category (none, SC, VAT, SC plus VAT)
- One SC/VAT rule for the whole bill; SC plus VAT always compounds

### Documentation
- State where each brand's prices disagree with the sources
- Mark Sushiro prices verified from the 2026 price structure supplied by the user
- README for split-bill (English, both screens, maths, running, releases)

### Fixed
- Brand tabs stay on the sushi screen; item brands show a hint to use the split screen
- Restore Hama, Onodera and Genki plate counters; list all brands as split sources
- Readable text on selected split-bill chips; clearer bill-default tax label
- Hamburger menu works even if a screen fails to start

