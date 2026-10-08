# harga

Compare grocery prices across Malaysian shops with official data, and find the cheapest way to buy a whole shopping list.

**Live:** https://farzinmirzaie.github.io/harga/

*Harga* is Malay for "price". The app reads KPDN's [PriceCatcher](https://data.gov.my/data-catalogue/pricecatcher) data straight from data.gov.my in the browser. There is no backend, no build step and no account.

## What it does

- Search about 340 tracked items in English, Bahasa Melayu or Chinese, and browse by category.
- Filter by state and district. "Near me" picks your district from your device location, and the location never leaves the browser.
- See the lowest, typical and highest price for an item, with every shop ranked.
- Build a basket. It shows two plans: the cheapest split across several shops, and the best single shop with any missing items listed.
- Light and dark themes, and a layout for phones and desktops. It meets WCAG 2.2 AA in automated checks.

## How it works

1. The browser downloads the current month's PriceCatcher file. That is a Parquet file of about 2 MB with about 1.4M price reports. If KPDN has not published the current month yet, it falls back to the previous month.
2. [hyparquet](https://github.com/hyparam/hyparquet) parses the file in under a second and keeps the latest price per shop and item.
3. Prices below a third or above three times an item's national median are dropped as likely data-entry errors.
4. Everything else, including search, the basket plans and district matching, runs in plain JavaScript in the page.

## Run locally

Requires Node 24 for tests and tools. The site itself is static files.

```bash
npm install
npm start          # serves the folder on http://localhost:4173
npm test           # unit tests, offline
npm run test:live  # also downloads the real PriceCatcher file and checks it parses
```

Any static file server works in place of `npm start`, which uses Python's built-in server. Opening `index.html` from disk does not work, because ES modules need HTTP.

## Product photos

40 branded items show a front-of-pack photo from [Open Food Facts](https://world.openfoodfacts.org). PriceCatcher has no barcodes, so a one-off tool matches items by brand, name and pack size:

```bash
npm run images                # uses the cached catalogue in .cache/
npm run images -- --refresh
```

The tool identifies itself to Open Food Facts with this repo's URL. Set `OFF_CONTACT` to override it. It prints a review table and writes `images.js` and `img/`. A person must check every match. Record wrong products or poor photos in `tools/review.json` under `reject`, and correct matches that scored too low under `accept`. The current list was reviewed by eye on a contact sheet.

## Deploy

GitHub Actions runs the tests on every push and pull request, and deploys `main` to GitHub Pages (`.github/workflows/pages.yml`). Only `index.html`, the root `*.js` modules and `img/` are published.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | Markup and all CSS, including the design tokens |
| `app.js` | UI: data loading, rendering, basket, dialogs, location, animation |
| `harga.js` | Pure logic with no DOM: parsing, outlier filter, price ranking, basket plans, search, nearest district |
| `i18n.js` | UI strings in EN, BM and 中文, plus category names |
| `items.js` | English and Chinese names per PriceCatcher item code |
| `districts.js` | District centre points, used for "Near me" |
| `images.js`, `img/` | Generated photo map and thumbnails. Do not edit by hand |
| `harga.test.mjs` | Unit tests, plus a live data check behind `--live` |
| `tools/` | Photo matching tool and its review decisions |

## Data and credits

| Source | Used for | Licence |
|---|---|---|
| [PriceCatcher](https://data.gov.my/data-catalogue/pricecatcher), KPDN via data.gov.my | Prices, items, shops | CC BY 4.0 |
| [DOSM district boundaries](https://github.com/dosm-malaysia/data-open) | District centre points | CC BY 4.0 |
| [Open Food Facts](https://world.openfoodfacts.org) | Product photos | CC BY-SA, by Open Food Facts contributors |

The English and Chinese item names are our own translations and have not been checked by a native speaker. The 36 district centres for areas without an official boundary, such as Kuala Lumpur's parliamentary areas, are hand-entered approximations.

## Limitations

- Prices are the latest report per shop in the month and can be out of date. The app shows the report date for each shop.
- "Near me" matches the nearest district centre, so it can pick the neighbouring district near a border.
- Photo coverage is about a quarter of branded items. Many Malaysian brands are not in Open Food Facts yet.
