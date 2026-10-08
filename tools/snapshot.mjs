// Build step: download this month's PriceCatcher data and write a compact snapshot the site loads first.
//   node tools/snapshot.mjs [outDir]   writes <outDir>/prices.json (default: data/)
// The deploy workflow runs this daily, so visitors skip the parquet download, the hyparquet import and the parse.
import { mkdirSync, writeFileSync } from 'node:fs'
import { parquetRead, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { SRC, monthsToTry, readPrices, lookupMap, packSnapshot } from '../harga.js'

const out = process.argv[2] ?? 'data'

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
