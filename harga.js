// Core logic. No DOM, so the same file runs in the browser and in Node tests.
export const SRC = 'https://storage.data.gov.my/pricecatcher/'

// Current month in Malaysia time, then the two before it. The current file is 404 until KPDN publishes it.
export function monthsToTry(now = new Date()) {
  const myt = new Date(now.getTime() + 8 * 3600e3)
  return [0, 1, 2].map(k => new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth() - k, 1)).toISOString().slice(0, 7))
}

// Price parquet -> Map<item, Map<premise, {price, date}>>, keeping the latest observation per shop and item.
export async function readPrices(file, parquetRead, compressors) {
  const groups = new Map()
  await parquetRead({
    file, compressors,
    columns: ['date', 'premise_code', 'item_code', 'price'],
    onChunk: ({ columnName, columnData, rowStart }) => {
      if (!groups.has(rowStart)) groups.set(rowStart, {})
      groups.get(rowStart)[columnName] = columnData
    },
  })
  const index = new Map()
  let latest = ''
  for (const g of groups.values()) {
    for (let i = 0; i < g.price.length; i++) {
      const item = Number(g.item_code[i]), premise = Number(g.premise_code[i]), price = g.price[i]
      const date = g.date[i].toISOString().slice(0, 10)
      if (item < 0 || premise < 0 || !(price > 0)) continue
      if (date > latest) latest = date
      let shops = index.get(item)
      if (!shops) index.set(item, shops = new Map())
      const prev = shops.get(premise)
      if (!prev || date >= prev.date) shops.set(premise, { price, date })
    }
  }
  dropOutliers(index)
  return { index, latest }
}

// Remove likely data-entry errors: prices under a third or over three times the item's national median.
export function dropOutliers(index) {
  for (const shops of index.values()) {
    const sorted = [...shops.values()].map(o => o.price).sort((a, b) => a - b)
    const med = sorted[Math.floor(sorted.length / 2)]
    for (const [premise, { price }] of shops) if (price < med / 3 || price > med * 3) shops.delete(premise)
  }
}

// Shops in the area that sell this item, cheapest first.
export function cheapest(index, item, area) {
  return [...(index.get(item) ?? [])]
    .filter(([p]) => area.has(p))
    .map(([premise, o]) => ({ premise, ...o }))
    .sort((a, b) => a.price - b.price)
}

// Rank single shops for a list of {item, qty}: most items stocked first, then lowest total.
export function bestShops(index, list, area) {
  const shops = new Map()
  for (const { item, qty } of list) {
    for (const [premise, { price }] of index.get(item) ?? []) {
      if (!area.has(premise)) continue
      const s = shops.get(premise) ?? { premise, total: 0, have: 0 }
      s.total += price * qty
      s.have++
      shops.set(premise, s)
    }
  }
  return [...shops.values()]
    .map(s => ({ ...s, missing: list.filter(l => !index.get(l.item)?.has(s.premise)).map(l => l.item) }))
    .sort((a, b) => b.have - a.have || a.total - b.total)
}

// Cheapest shop per item. ponytail: no cap on the number of shops; add a max-stops limit if users complain.
export function splitTrip(index, list, area) {
  const picks = [], missing = []
  let total = 0
  for (const { item, qty } of list) {
    const best = cheapest(index, item, area)[0]
    if (!best) { missing.push(item); continue }
    picks.push({ item, qty, premise: best.premise, price: best.price })
    total += best.price * qty
  }
  return { total, picks, missing }
}

// English words and synonyms -> words found in the Malay names or the English names in items.js.
const EN = {
  chicken: 'AYAM', egg: 'TELUR', eggs: 'TELUR', rice: 'BERAS', sugar: 'GULA', oil: 'MINYAK', flour: 'TEPUNG',
  milk: 'SUSU', fish: ['IKAN', 'FISH'], beef: ['LEMBU', 'BEEF'], meat: 'DAGING', onion: 'BAWANG', garlic: 'BAWANG PUTIH',
  bread: 'ROTI', salt: 'GARAM', prawn: 'UDANG', prawns: 'UDANG', shrimp: 'UDANG', squid: 'SOTONG', cabbage: 'KUBIS',
  chilli: 'CILI', chili: 'CILI', potato: 'KENTANG', carrot: 'LOBAK MERAH', tea: 'TEH', noodle: ['MI', 'MEE', 'BIHUN'],
  noodles: ['MI', 'MEE', 'BIHUN'], ginger: 'HALIA', spinach: 'BAYAM', cucumber: 'TIMUN', lime: 'LIMAU', coconut: 'KELAPA',
  mutton: 'KAMBING', lamb: 'KAMBING', goat: 'KAMBING', butter: 'MENTEGA', soy: ['KICAP', 'SOYA'], sardine: 'SARDIN',
  banana: 'PISANG', pork: 'BABI', buffalo: 'KERBAU', crab: 'KETAM', watermelon: 'TEMBIKAI', grape: 'ANGGUR', grapes: 'ANGGUR',
  pineapple: 'NENAS', guava: 'JAMBU', papaya: 'BETIK', peanut: 'KACANG TANAH', peanuts: 'KACANG TANAH', beans: 'KACANG',
  lentils: 'DAL', dhal: 'DAL', dal: 'DAL', turmeric: 'KUNYIT', galangal: 'LENGKUAS', tamarind: 'ASAM JAWA', curry: 'KARI',
  // Synonyms that map onto words in the English names
  nappy: 'DIAPER', nappies: 'DIAPER', diapers: 'DIAPER', brinjal: 'EGGPLANT', aubergine: 'EGGPLANT', soda: 'SODA',
  coke: 'COCA', cola: 'COLA', fizzy: 'SODA', ketchup: 'KETCHUP', detergent: ['WASHING', 'DETERGENT'], laundry: ['WASHING', 'DETERGENT', 'SOFTENER'],
  dishwashing: 'DISHWASHING', formula: 'FORMULA', baby: ['INFANT', 'BABY', 'DIAPER'], coffee: 'COFFEE', yoghurt: 'YOGURT',
  capsicum: 'CAPSICUM', pepper: 'CAPSICUM', okra: 'OKRA', bokchoy: 'BOK CHOY', pakchoy: 'BOK CHOY', radish: 'RADISH',
  ghee: 'GHEE', margarine: 'MARGARINE', jam: 'JAM', mayo: 'MAYONNAISE', toothpaste: 'TOOTHPASTE', shampoo: 'SHAMPOO',
  soap: ['SOAP', 'WASH'], deodorant: 'DEODORANT', bleach: 'BLEACH', cleaner: 'CLEANER', energy: ['RED BULL', 'LIVITA'],
  isotonic: '100 PLUS', oats: 'OATS', cereal: 'CEREAL',
}
const alts = w => [w.toUpperCase(), ...[EN[w] ?? []].flat()]

// Match at word starts so AYAM does not hit BAYAM.
const hasWord = (n, t) => (' ' + n.replace(/[^A-Z0-9]+/g, ' ')).includes(' ' + t)

export function matches(name, query) {
  const n = name.toUpperCase()
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    .every(w => alts(w).some(t => hasWord(n, t)))
}

// 0 when the name starts with the first query word (or its Malay term), so "chicken" lists AYAM before SERBUK KARI AYAM.
export function rank(name, query) {
  const w = query.trim().toLowerCase().split(/\s+/)[0] ?? ''
  const n = name.toUpperCase()
  return alts(w).some(t => n.startsWith(t)) ? 0 : 1
}

// Nearest district centre to a coordinate. km is approximate (equirectangular), good enough to reject far-away users.
export function nearestDistrict(rows, lat, lon) {
  let row, best = Infinity
  for (const r of rows) {
    const dx = (r[1] - lon) * Math.cos(lat * Math.PI / 180), dy = r[0] - lat, d = dx * dx + dy * dy
    if (d < best) { best = d; row = r }
  }
  return { row, km: Math.sqrt(best) * 111 }
}
