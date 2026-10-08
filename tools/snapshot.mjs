// Build step: download PriceCatcher data and write what the site loads first.
//   node tools/snapshot.mjs [outDir]   writes <outDir>/prices.json and <outDir>/history.json (default: data/)
// prices.json is this month's latest price per shop, so visitors skip the parquet download, the hyparquet import and the parse.
// history.json is the typical nationwide price per item for the last 12 months. Set HISTORY_URL to the published
// history.json (the deploy workflow does) to reuse its finished months, so a daily run downloads only the current month.
import { mkdirSync, writeFileSync } from 'node:fs'
import { parquetRead, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { SRC, monthsToTry, monthsBefore, readPrices, lookupMap, packSnapshot, typicalPrices, packHistory, unpackHistory } from '../harga.js'

const out = process.argv[2] ?? 'data'
const HISTORY = 12

async function get(url) {
  const r = await fetch(url)
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status })
  return r.arrayBuffer()
}

let month, buf
for (const m of monthsToTry()) {
  try { buf = await get(`${SRC}pricecatcher_${m}.parquet`); month = m; break }
  catch (e) { if (e.status !== 404) throw e } // only a missing month falls through, as in the browser
}
if (!buf) throw new Error('no PriceCatcher month found')

const lookup = async name => lookupMap(await parquetReadObjects({ file: await get(SRC + name), compressors }))
const [items, premises] = await Promise.all([lookup('lookup_item.parquet'), lookup('lookup_premise.parquet')])
const { index, latest } = await readPrices(buf, parquetRead, compressors)
if (index.size < 200) throw new Error(`only ${index.size} items in ${month}, refusing to publish`)

const json = JSON.stringify(packSnapshot({ month, latest, index, items, premises }))
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/prices.json`, json)
console.log(`${out}/prices.json: ${month}, latest ${latest}, ${index.size} items, ${premises.size} premises, ${(json.length / 1e6).toFixed(2)} MB`)


// History: this month from the data above. Earlier months come from the published history when it has them,
// except its newest month, which was still in progress when it was built. Anything else is downloaded.
const published = new Map()
if (process.env.HISTORY_URL) {
  try {
    const h = unpackHistory(await (await fetch(process.env.HISTORY_URL)).json())
    h.months.slice(0, -1).forEach((m, k) => published.set(m, new Map([...h.items].flatMap(([c, s]) => s[k] == null ? [] : [[c, s[k]]]))))
  } catch (e) { console.log(`history: no published history (${e.message}), downloading every month`) }
}
const perMonth = new Map([[month, typicalPrices(index)]])
for (const m of monthsBefore(month, HISTORY).slice(1)) {
  if (published.has(m)) { perMonth.set(m, published.get(m)); continue }
  let file
  try { file = await get(`${SRC}pricecatcher_${m}.parquet`) }
  catch (e) { if (e.status === 404) { console.log(`history: ${m} not published, skipped`); continue } throw e }
  perMonth.set(m, typicalPrices((await readPrices(file, parquetRead, compressors)).index))
  console.log(`history: ${m} downloaded`)
}
const history = JSON.stringify(packHistory(perMonth))
writeFileSync(`${out}/history.json`, history)
console.log(`${out}/history.json: ${perMonth.size} months, ${(history.length / 1e3).toFixed(0)} kB`)
