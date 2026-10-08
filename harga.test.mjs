// node harga.test.mjs  (add --live to also read the real PriceCatcher file)
import assert from 'node:assert/strict'
import { DISTRICTS } from './districts.js'
import { monthsToTry, cheapest, bestShops, splitTrip, matches, rank, dropOutliers, nearestDistrict, readPrices, SRC } from './harga.js'

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
console.log('unit ok')

if (process.argv.includes('--live')) {
  const { parquetRead } = await import('hyparquet')
  const { compressors } = await import('hyparquet-compressors')
  const month = monthsToTry()[1]
  const file = await (await fetch(`${SRC}pricecatcher_${month}.parquet`)).arrayBuffer()
  const { index, latest } = await readPrices(file, parquetRead, compressors)
  assert.ok(index.size > 200, `only ${index.size} items`)
  assert.ok(latest.startsWith(month))
  console.log(`live ok: ${month}, ${index.size} items, latest ${latest}`)
}
