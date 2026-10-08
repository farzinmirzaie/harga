// node harga.test.mjs  (add --live to also read the real PriceCatcher file)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DISTRICTS } from './districts.js'
import { monthsToTry, cheapest, bestShops, splitTrip, matches, rank, dropOutliers, nearestDistrict, readPrices, lookupMap, packSnapshot, unpackSnapshot, monthsBefore, median, typicalPrices, packHistory, unpackHistory, priceChange, SRC } from './harga.js'

assert.deepEqual(monthsToTry(new Date('2026-09-30T17:00:00Z')), ['2026-10', '2026-09', '2026-08']) // 01:00 MYT on 1 Oct
assert.deepEqual(monthsToTry(new Date('2026-01-05T00:00:00Z')), ['2026-01', '2025-12', '2025-11'])

const m = o => new Map(Object.entries(o).map(([k, v]) => [Number(k), { price: v, date: '2026-09-01' }]))
const index = new Map([[1, m({ 10: 5, 20: 4, 30: 1 })], [2, m({ 10: 2, 20: 3 })], [3, m({ 20: 7 })]])
const area = new Set([10, 20]) // shop 30 is outside the area
const list = [{ item: 1, qty: 2 }, { item: 2, qty: 1 }, { item: 3, qty: 1 }, { item: 9, qty: 1 }]

assert.deepEqual(cheapest(index, 1, area).map(c => c.premise), [20, 10])
const best = bestShops(index, list, area)
assert.equal(best[0].premise, 20) // stocks 3 of 4 items
assert.equal(best[0].total, 4 * 2 + 3 + 7)
assert.deepEqual(best[0].missing, [9])
assert.deepEqual(best[1].missing, [3, 9])
const split = splitTrip(index, list, area)
assert.equal(split.total, 4 * 2 + 2 + 7)
assert.deepEqual(split.missing, [9])

assert.ok(matches('AYAM BERSIH - STANDARD', 'chicken'))
assert.ok(matches('AYAM BERSIH - STANDARD', 'ayam standard'))
assert.ok(!matches('TELUR AYAM GRED A', 'beef'))
assert.ok(!matches('BAYAM HIJAU', 'chicken'))
assert.ok(matches('MINYAK MASAK TULEN CAP BURUH', 'oil buruh'))
assert.equal(rank('AYAM BERSIH - STANDARD', 'chicken'), 0)
assert.equal(rank('SERBUK KARI AYAM', 'chicken'), 1)
const noisy = new Map([[1, m({ 1: 10, 2: 11, 3: 12, 4: 1359, 5: 0.1 })]])
dropOutliers(noisy)
assert.deepEqual([...noisy.get(1).keys()], [1, 2, 3])
assert.deepEqual(nearestDistrict(DISTRICTS, 3.107, 101.607).row.slice(2), ['Selangor', 'Petaling Jaya'])
assert.deepEqual(nearestDistrict(DISTRICTS, 3.054, 101.585).row.slice(2), ['Selangor', 'Petaling']) // Subang Jaya
assert.deepEqual(nearestDistrict(DISTRICTS, 3.158, 101.712).row.slice(2), ['W.P. Kuala Lumpur', 'Bukit Bintang']) // KLCC
assert.equal(nearestDistrict(DISTRICTS, 1.492, 103.741).row[2], 'Johor') // Johor Bahru
assert.equal(nearestDistrict(DISTRICTS, 5.414, 100.329).row[2], 'Pulau Pinang') // George Town
assert.ok(nearestDistrict(DISTRICTS, 52.37, 4.9).km > 5000) // Amsterdam

// Snapshot round trip keeps prices, dates and the lookup fields the UI reads
const items = lookupMap([{ item_code: -1n, item: 'X' }, { item_code: 1n, item: 'AYAM', unit: '1kg', item_group: 'G', item_category: 'C' }, { item_code: 2n, item: 'TELUR', unit: '10 biji' }])
const premises = lookupMap([{ premise_code: 10n, premise: 'KEDAI A', state: 'Johor', district: 'Muar' }, { premise_code: 20n, premise: 'KEDAI B' }, { premise_code: 99n, premise: 'UNUSED' }])
assert.deepEqual([...items.keys()], [1, 2])
const snap = unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot({ month: '2026-09', latest: '2026-09-01', index, items, premises }))))
assert.deepEqual(snap.index, index)
assert.equal(snap.items.get(1).item_category, 'C')
assert.equal(snap.items.get(2).item_group, null)
assert.equal(snap.premises.get(10).district, 'Muar')
assert.ok(!snap.premises.has(99)) // shops with no prices are left out
assert.throws(() => unpackSnapshot({ v: 2 }))

// readPrices: BigInt codes, Date dates, latest report per shop wins, rows without a date are skipped
const day = s => new Date(s + 'T00:00:00Z')
const fakeRead = async ({ onChunk }) => onChunk && [
  ['date', [day('2026-09-01'), day('2026-09-03'), null, day('2026-09-02')]],
  ['premise_code', [10n, 10n, 20n, -1n]], ['item_code', [1n, 1n, 1n, 1n]], ['price', [5, 6, 7, 8]],
].forEach(([columnName, columnData]) => onChunk({ columnName, columnData, rowStart: 0 }))
const read = await readPrices(null, fakeRead)
assert.deepEqual(read.index.get(1), new Map([[10, { price: 6, date: '2026-09-03' }]]))
assert.equal(read.latest, '2026-09-03')
// Price history
assert.deepEqual(monthsBefore('2026-02', 3), ['2026-02', '2026-01', '2025-12'])
assert.equal(median([1, 2, 3, 4]), 2)
assert.equal(median([5]), 5)
assert.deepEqual(typicalPrices(index), new Map([[1, 4], [2, 2], [3, 7]]))
const hist = unpackHistory(JSON.parse(JSON.stringify(packHistory(new Map([
  ['2026-09', new Map([[1, 4], [2, 2]])], ['2026-07', new Map([[1, 5]])], ['2026-08', new Map([[1, 4.5], [3, 7]])],
])))))
assert.deepEqual(hist.months, ['2026-07', '2026-08', '2026-09'])
assert.deepEqual(hist.items.get(1), [5, 4.5, 4])
assert.deepEqual(hist.items.get(2), [null, null, 2])
assert.deepEqual(hist.items.get(3), [null, 7, null])
assert.throws(() => unpackHistory({}))
assert.deepEqual(priceChange(hist.months, [5, null, 4]), { change: 4 / 5 - 1, from: 5, to: 4, fromMonth: '2026-07', toMonth: '2026-09' })
assert.equal(priceChange(hist.months, [null, null, 2]), null)

// The browser imports hyparquet from a CDN; keep those pinned versions equal to the lockfile (npm updates only touch the lockfile)
const lock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url))).packages
for (const [, pkg, ver] of readFileSync(new URL('./app.js', import.meta.url), 'utf8').matchAll(/npm\/(hyparquet[\w-]*)@([\d.]+)/g))
  assert.equal(ver, lock[`node_modules/${pkg}`].version, `app.js loads ${pkg}@${ver}; package-lock.json has ${lock[`node_modules/${pkg}`].version}`)
console.log('unit ok')

if (process.argv.includes('--live')) {
  const { parquetRead } = await import('hyparquet')
  const { compressors } = await import('hyparquet-compressors')
  const month = monthsToTry()[1]
  const r = await fetch(`${SRC}pricecatcher_${month}.parquet`)
  assert.ok(r.ok, `${r.status} for ${month}`)
  const file = await r.arrayBuffer()
  const { index, latest } = await readPrices(file, parquetRead, compressors)
  assert.ok(index.size > 200, `only ${index.size} items`)
  assert.ok(latest.startsWith(month))
  console.log(`live ok: ${month}, ${index.size} items, latest ${latest}`)
}
