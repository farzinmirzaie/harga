// One-off build step: match branded PriceCatcher items to Open Food Facts products and download front-pack thumbnails.
//   node tools/match-images.mjs            fetch (cached in .cache/), match, print a review table, write images.js + img/
//   node tools/match-images.mjs --refresh  ignore the cache and fetch again
// Images are CC BY-SA from Open Food Facts contributors; the footer credits them and each popup links the product page.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { ITEMS } from '../items.js'
import { SRC } from '../harga.js'

// Open Food Facts asks API clients to identify themselves: set OFF_CONTACT to a URL or email you are happy to share.
const UA = `harga/0.1 (${process.env.OFF_CONTACT ?? 'https://github.com/farzinmirzaie/harga'})`
const API = 'https://search.openfoodfacts.org/search'
const FIELDS = 'code,product_name,product_name_en,brands,quantity,image_front_small_url'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const refresh = process.argv.includes('--refresh')
mkdirSync('.cache', { recursive: true })

async function search(q, page = 1, size = 100) {
  const url = `${API}?q=${encodeURIComponent(q)}&page=${page}&page_size=${size}&fields=${FIELDS}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return r.json()
    await sleep(2000 * (attempt + 1))
  }
  throw new Error(`OFF search failed: ${q}`)
}

// Brands as they appear in PriceCatcher names. Longest match wins, so "DUTCH LADY" beats "LADY".
const BRANDS = ['ADABI', 'BABAS', 'MAGGI', 'NESTLE', 'NESCAFE', 'MILO', 'DUTCH LADY', 'DUTCHLADY', "LADY'S CHOICE", 'AYAM BRAND', 'CAP AYAM',
  'KING CUP', 'MAINLAND', 'DAISY', 'PLANTA', 'KIPAS UDANG', 'LIFE', 'DRINHO', "YEO'S", 'COCA COLA', 'F&N', 'MIRINDA', 'MARIGOLD',
  'RED BULL', 'LIVITA', 'MAZOLA', 'RED EAGLE', 'KNIFE', 'BURUH', 'SERI MURNI', 'VESAWIT', 'QBB', 'COLGATE', 'DARLIE', 'FRESH & WHITE',
  'LACTOGEN', 'GOLD COIN', 'SAUH', 'VECORN', '100 PLUS', 'HEINZ', 'ORAL B', 'HARIMAU', 'SERI AJI', 'PEPSI', 'WINDMILL', 'KARA',
  'HARMUNI', 'STAR BRAND', 'ANCHOR', 'LIPTON', 'TEH BOH', 'SUN VALLEY', 'DOWNY', 'SEVEN UP', 'DUMEX', 'SAJI', 'ALIF', 'ROYAL',
  'FARM FRESH', 'ANMUM', 'QUAKER', 'MILNA', 'HEAD & SHOULDERS', 'NIVEA', 'REXONA', 'ATTACK', 'DETTOL', 'MR MUSCLE', 'AJAX', 'CLOROX',
  'ENFAGROW', 'LACTEL', 'BUTTERCUP', 'EVERYDAY', 'NAN', 'S-26', 'PETPET', 'KUDA HIJAU', 'LONGKOU', 'AXION', 'DRYPERS', 'HUGGIES',
  'LIFEBUOY', 'FERNLEAF', 'REJOICE', 'SUNSILK', 'BREEZE', 'DAIA', 'SUNLIGHT', 'SUNQUICK', 'INDOCAFE', 'DESA', 'BLUE KEY', 'MUHIBAH',
  'FAIZA', 'JATI', 'RAMBUTAN', 'UNCLE TAN', 'KELISA', 'SAZARICE', 'BAO-BAO', 'CERELAC', 'TOP']
const ALIAS = { 'CAP AYAM': 'ayam brand', DUTCHLADY: 'dutch lady', 'TEH BOH': 'boh', 'SEVEN UP': '7up', 'ORAL B': 'oral-b', 'COCA COLA': 'coca-cola' }
const brandOf = name => BRANDS.filter(b => ` ${name} `.includes(` ${b} `) || name.startsWith(b + ' ')).sort((a, b) => b.length - a.length)[0]

const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9&'+-]+/g, ' ').trim()
const STOP = new Set('and dan the of with cap jenama brand pelbagai perisa jenis kotak botol tin paket pack refill assorted flavours imported import original asli'.split(' '))
const words = s => new Set(norm(s).split(' ').filter(w => w.length > 1 && !STOP.has(w)))
// "425 g" / "1.5 liter" / "5 X 79g" -> grams or ml, for a size bonus
function size(s) {
  const m = norm(s).replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|liter|litre)\b/)
  if (!m) return null
  const n = Number(m[1]), u = m[2]
  return u === 'kg' || u === 'l' || u === 'liter' || u === 'litre' ? n * 1000 : n
}

function score(item, p, brand) {
  const ptext = norm(`${p.brands ?? ''} ${p.product_name ?? ''} ${p.product_name_en ?? ''}`)
  const b = norm(ALIAS[brand] ?? brand)
  if (!` ${ptext} `.includes(` ${b} `) && !ptext.replace(/\s/g, '').includes(b.replace(/\s/g, ''))) return 0
  const want = new Set([...words(item.item), ...words(ITEMS[item.code]?.[0])].filter(w => !b.split(' ').includes(w)))
  const have = words(ptext)
  const overlap = [...want].filter(w => have.has(w)).length / Math.max(1, want.size)
  const s1 = size(item.unit), s2 = size(p.quantity)
  const sizeBonus = s1 && s2 ? (Math.abs(s1 - s2) / s1 < 0.05 ? 0.35 : -0.15) : 0
  return 0.3 + overlap + sizeBonus + (p.image_front_small_url ? 0 : -1)
}

// 1. Malaysian catalogue, cached
let catalogue
if (!refresh && existsSync('.cache/off-my.json')) catalogue = JSON.parse(readFileSync('.cache/off-my.json'))
else {
  catalogue = []
  for (let page = 1; ; page++) {
    const r = await search('countries_tags:"en:malaysia"', page)
    catalogue.push(...r.hits)
    process.stderr.write(`\rcatalogue page ${page}/${r.page_count}`)
    if (page >= r.page_count) break
    await sleep(600)
  }
  writeFileSync('.cache/off-my.json', JSON.stringify(catalogue))
  process.stderr.write('\n')
}

// 2. Branded items only: fresh goods and "pelbagai jenama" (assorted brands) have no single product photo
const lookup = await parquetReadObjects({ file: await asyncBufferFromUrl({ url: SRC + 'lookup_item.parquet' }), compressors })
const items = lookup
  .map(i => ({ ...i, code: Number(i.item_code) }))
  .filter(i => ITEMS[i.code] && i.item_group !== 'BARANGAN SEGAR' && !/PELBAGAI JENAMA/.test(i.item))
  .map(i => ({ ...i, brand: brandOf(i.item) }))
  .filter(i => i.brand)

// 3. Best catalogue match per item; a targeted worldwide search for misses
const cachePath = '.cache/off-targeted.json'
const targeted = !refresh && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath)) : {}
const results = []
for (const it of items) {
  let pool = catalogue
  let best = pool.map(p => ({ p, s: score(it, p, it.brand) })).sort((a, b) => b.s - a.s)[0]
  if (!best || best.s < 0.75) {
    const q = `${ALIAS[it.brand] ?? it.brand.toLowerCase()} ${[...words(ITEMS[it.code][0])].slice(0, 4).join(' ')}`
    if (!targeted[q]) { targeted[q] = (await search(q, 1, 25)).hits; await sleep(600) }
    const alt = targeted[q].map(p => ({ p, s: score(it, p, it.brand) })).sort((a, b) => b.s - a.s)[0]
    if (alt && (!best || alt.s > best.s)) best = alt
  }
  results.push({ it, best })
}
writeFileSync(cachePath, JSON.stringify(targeted))

// 4. Manual review (tools/review.json): reject = auto-match is the wrong product or variant;
//    accept = the best candidate is right although it scored under the threshold. Re-check both after --refresh.
const review = JSON.parse(readFileSync('tools/review.json'))
const REJECT = new Set(review.reject), ACCEPT = new Set(review.accept)
const accepted = results.filter(r => r.best && (r.best.s >= 0.75 || ACCEPT.has(r.it.code)) && !REJECT.has(r.it.code))

console.log(`branded items: ${items.length}, matched: ${accepted.length}`)
for (const { it, best } of results) {
  const mark = REJECT.has(it.code) ? '  x' : ACCEPT.has(it.code) ? 'ok*' : !best || best.s < 0.75 ? '  -' : 'ok '
  console.log(`${mark} ${String(it.code).padStart(4)} ${ITEMS[it.code][0].padEnd(44).slice(0, 44)} | ${best ? `${best.s.toFixed(2)} ${best.p.brands} — ${best.p.product_name} (${best.p.quantity ?? '?'})` : ''}`)
}

// 5. Download thumbnails and write the map
mkdirSync('img', { recursive: true })
const map = {}
for (const { it, best } of accepted) {
  const file = `img/${best.p.code}.jpg`
  if (!existsSync(file)) {
    const r = await fetch(best.p.image_front_small_url, { headers: { 'User-Agent': UA } })
    if (!r.ok) continue
    writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    await sleep(200)
  }
  map[it.code] = best.p.code
}
writeFileSync('images.js', `// Generated by tools/match-images.mjs. item_code -> Open Food Facts barcode; the photo is img/<barcode>.jpg (CC BY-SA).\nexport const IMAGES = ${JSON.stringify(map)}\n`)
console.log(`wrote images.js with ${Object.keys(map).length} images`)
