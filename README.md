# harga

Find the cheapest groceries in Malaysia, using official government price data.

**Try it:** https://farzinmirzaie.github.io/harga/

*Harga* means "price" in Malay. Search about 340 everyday items, see what each shop near you charges, and build a basket to find the cheapest place to buy it all. Works in English, Bahasa Melayu and 中文, on phones and desktops, with no sign-up.

## Features

- **Compare prices.** See the lowest, typical and highest price for an item, with every shop ranked.
- **Near you.** Filter by state and district, or tap "Near me". Your location never leaves your device.
- **Plan a shop.** Add items to a basket and choose between the cheapest split across several shops and the best single shop.

## How it works

Prices come from [PriceCatcher](https://data.gov.my/data-catalogue/pricecatcher), where KPDN publishes about 1.4 million shop price reports a month.

Once a day, a GitHub Action downloads the latest month and keeps each shop's newest price per item. It drops obvious typos: prices under a third or over three times the national median. Then it publishes the result with the site as one small JSON file. Everything else runs in your browser, and there is no server.

If that file is missing, for example when you run the site locally, the app reads PriceCatcher directly instead.

## Run it locally

You need Node 24 and Python 3.

```bash
npm install
npm start          # http://localhost:4173
npm test           # unit tests
npm run snapshot   # optional: build data/prices.json, like the daily Action does
```

## Code layout

| Path | What it is |
|---|---|
| `index.html` | Page markup and all CSS |
| `app.js` | The user interface |
| `harga.js` | Price logic with no UI code, tested in `harga.test.mjs` |
| `i18n.js`, `items.js`, `districts.js` | Translations, item names and district locations |
| `images.js`, `img/` | Product photos. Generated, so don't edit them by hand |
| `tools/` | Scripts for the price snapshot and product photos |

GitHub Actions runs the tests on every push. It deploys `main` to GitHub Pages on each push and once a day.

## Product photos

About 40 branded items have a photo from [Open Food Facts](https://world.openfoodfacts.org). PriceCatcher has no barcodes, so `npm run images` matches items by brand, name and pack size. A person then checks every match and records wrong ones in `tools/review.json`.

## Credits

- Prices: [PriceCatcher](https://data.gov.my/data-catalogue/pricecatcher), KPDN via data.gov.my, CC BY 4.0
- District locations: [DOSM](https://github.com/dosm-malaysia/data-open), CC BY 4.0
- Product photos: Open Food Facts contributors, CC BY-SA

## Limitations

- Each price is the shop's latest report this month, so it may be a few weeks old. The app shows the report date.
- "Near me" picks the closest district centre, so near a border it can choose the neighbouring district.
- The English and Chinese item names have not been checked by a native speaker.
