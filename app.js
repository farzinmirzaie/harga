import { SRC, monthsToTry, readPrices, cheapest, bestShops, splitTrip, matches, rank, nearestDistrict } from './harga.js'
import { LANGS, T, CATS } from './i18n.js'
import { ITEMS } from './items.js'
import { DISTRICTS } from './districts.js'
import { IMAGES } from './images.js'

const $ = s => document.querySelector(s)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const rm = n => 'RM' + n.toFixed(2)
const nice = s => String(s ?? '').toLowerCase().replace(/(^|[\s(\/&.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).trim()
const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`
const I = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  up: svg('<path d="M7 17 17 7M9 7h8v8"/>'),
  store: svg('<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6zM9 20v-5h6v5"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
  basket: svg('<path d="M3 9h18l-2 11H5z"/><path d="M8 9l4-6 4 6M9 13v3M15 13v3"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'),
  wifi: svg('<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><path d="M3 3l18 18"/>'),
  locate: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
}
// Order matches T[lang].groups. Each group has an icon and a colour token (--g0..--g8).
const GROUPS = [
  ['', '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'],
  ['BARANGAN SEGAR', '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>'],
  ['BARANGAN KERING', '<path d="M12 21V9"/><path d="M12 9c-3 0-4-2-4-5 3 0 4 2 4 5zM12 9c3 0 4-2 4-5-3 0-4 2-4 5zM12 15c-3 0-4-2-4-5 3 0 4 2 4 5zM12 15c3 0 4-2 4-5-3 0-4 2-4 5z"/>'],
  ['BARANGAN BERBUNGKUS', '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'],
  ['MINUMAN', '<path d="M6 8h12l-1.5 12h-9z"/><path d="M5 8h14M13 8l1.5-5H17"/>'],
  ['SUSU DAN BARANGAN BAYI', '<path d="M9 9h6v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M9 14h6"/>'],
  ['PRODUK KEBERSIHAN', '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'],
  ['BARANGAN KEDAI SERBANEKA', '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6zM9 20v-5h6v5"/>'],
  ['MAKANAN SIAP MASAK', '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>'],
]
const groupIdx = g => Math.max(0, GROUPS.findIndex(([k]) => k === g))
const tile = g => { const n = groupIdx(g); return `<span class="tile" style="--c:var(--g${n})">${svg(GROUPS[n][1])}</span>` }
// Product photo when Open Food Facts has a reviewed match, else the category icon. Decorative: the name is always next to it.
const thumb = code => IMAGES[code]
  ? `<span class="tile photo"><img src="img/${IMAGES[code]}.jpg" alt="" loading="lazy" decoding="async"></span>`
  : tile(items.get(code)?.item_group)
const KEY = 'harga-check'

let items, premises, index, latest
const ui = { state: '', district: '', list: [], group: '', mode: 'split', lang: '', query: '', geoAsked: false }
try { Object.assign(ui, JSON.parse(localStorage.getItem(KEY)) ?? {}) } catch {}
ui.query = ''
if (!T[ui.lang]) ui.lang = /^zh/i.test(navigator.language) ? 'zh' : /^(ms|id)/i.test(navigator.language) ? 'ms' : 'en'
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ state: ui.state, district: ui.district, list: ui.list, group: ui.group, mode: ui.mode, lang: ui.lang, geoAsked: ui.geoAsked })) } catch {} }
const t = () => T[ui.lang]
const locale = () => LANGS.find(l => l[0] === ui.lang)[2]
const day = d => new Date(d + 'T00:00:00Z').toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Streams the body so the progress bar moves with real bytes. Falls back to arrayBuffer() without Content-Length.
async function fetchBuf(url, onProgress) {
  const r = await fetch(url)
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status })
  const total = Number(r.headers.get('content-length'))
  if (!onProgress || !total || !r.body) return r.arrayBuffer()
  const reader = r.body.getReader(), chunks = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    onProgress(got / total)
  }
  const out = new Uint8Array(got)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out.buffer
}
async function load(progress) {
  const [{ parquetRead, parquetReadObjects }, { compressors }] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/hyparquet@1.31.2/+esm'),
    import('https://cdn.jsdelivr.net/npm/hyparquet-compressors@1.1.2/+esm'),
  ])
  const lookup = async name => {
    const rows = await parquetReadObjects({ file: await fetchBuf(SRC + name), compressors })
    return new Map(rows.filter(r => r.item_code > 0n || r.premise_code > 0n)
      .map(r => [Number(r.item_code ?? r.premise_code), r]))
  }
  const lookups = Promise.all([lookup('lookup_item.parquet'), lookup('lookup_premise.parquet')])
  lookups.catch(() => {}) // awaited below; this stops an unhandled rejection if the price file fails first
  let buf, lastErr
  for (const m of monthsToTry()) {
    try { buf = await fetchBuf(`${SRC}pricecatcher_${m}.parquet`, f => progress(0.05 + f * 0.8, t().loading)); break }
    catch (e) { lastErr = e; if (e.status !== 404) throw e } // only a missing month falls through to the previous one
  }
  if (!buf) throw lastErr
  const [it, pr] = await lookups
  progress(0.9, t().parsing)
  await new Promise(r => setTimeout(r, 30)) // let the label paint before the blocking parse
  const res = await readPrices(buf, parquetRead, compressors)
  ;[items, premises, index, latest] = [it, pr, res.index, res.latest]
}

function area() {
  const s = new Set()
  for (const [code, p] of premises) {
    if (ui.state && p.state !== ui.state) continue
    if (ui.district && p.district !== ui.district) continue
    s.add(code)
  }
  return s
}
const placeName = () => ui.district || ui.state || t().allMalaysia
const inBasket = code => ui.list.some(l => l.item === code)
const official = code => nice(items.get(code)?.item) || `#${code}`
const itemName = code => (ui.lang !== 'ms' && ITEMS[code]?.[ui.lang === 'en' ? 0 : 1]) || official(code)
// Search hits the Malay name, the English and Chinese names, and the category in all three languages.
function hit(code, i, q, ql) {
  const tr = ITEMS[code]
  return matches(i.item, q) || (tr && (matches(tr[0], q) || tr[1].includes(q))) || catSearch(i).includes(ql)
}
const score = (code, i, q) => Math.min(rank(i.item, q), ITEMS[code] ? rank(ITEMS[code][0], q) : 1, ITEMS[code]?.[1].startsWith(q) ? 0 : 1)
const catLabel = i => {
  const c = CATS[i?.item_category]
  return ui.lang === 'ms' || !c ? nice(i?.item_category) : c[ui.lang === 'en' ? 0 : 1]
}
const catSearch = i => [i.item_category, ...(CATS[i.item_category] ?? [])].join(' ').toLowerCase()
const shop = code => premises.get(code) ?? { premise: `#${code}` }
const shopType = p => esc(p.premise_type?.trim() ?? '')
function stats(shops) {
  const p = shops.map(s => s.price)
  return { lo: p[0], hi: p.at(-1), med: p[Math.floor((p.length - 1) / 2)], n: p.length }
}

/* Static chrome: language, theme, headline, chips, selects */
function renderChrome() {
  document.documentElement.lang = ui.lang === 'zh' ? 'zh-Hans' : ui.lang
  $('#lang').innerHTML = LANGS.map(([k, label, , name]) => `<button data-lang="${k}" lang="${k === 'zh' ? 'zh-Hans' : k}" aria-label="${name}" aria-pressed="${k === ui.lang}">${label}</button>`).join('')
  $('#headline').innerHTML = t().headline
  $('#q').placeholder = t().search
  $('#q').setAttribute('aria-label', t().search)
  $('#source').textContent = t().source
  $('#photos').textContent = t().photos
  $('#theme').setAttribute('aria-label', t().dark)
  $('#state').setAttribute('aria-label', t().state)
  $('#district').setAttribute('aria-label', t().district)
  $('#clear-q').setAttribute('aria-label', t().clearSearch)
  $('#progress').setAttribute('aria-label', t().loading)
  $('#locate').innerHTML = `${I.locate}<span>${t().nearMe}</span>`
  $('#locate').setAttribute('aria-label', t().nearMe)
  $('#kbd').title = t().kbd
  $('#sheet').setAttribute('aria-label', t().basket)
  $('#sheet .dlg-close').setAttribute('aria-label', t().close)
  renderTheme()
  $('#chips').innerHTML = GROUPS.map(([g], n) =>
    `<button class="chip" data-group="${g}" aria-pressed="${g === ui.group}">${tile(g)}${t().groups[n]}</button>`).join('')
  fadeChips()
  renderKpis()
  if (premises) renderFilters()
  else $('#results-title').textContent = t().popular
  requestAnimationFrame(() => document.documentElement.classList.remove('booting'))
}
function renderKpis(countUp) {
  const k = (v, label, n, sample) => `<div class="kpi"><dt class="label">${label}</dt>${v == null ? (failed ? '<dd class="cond">—</dd>' : `<dd class="cond wait" aria-hidden="true">${sample}</dd>`)
    : `<dd class="cond"${countUp && n ? ` data-to="${n}"` : ''}>${countUp && n ? 0 : v}</dd>`}</div>`
  $('#kpis').innerHTML = k(index?.size, t().statItems, index?.size, '000') + k(premises?.size.toLocaleString(locale()), t().statShops, premises?.size, '0,000')
    + k(latest && day(latest), t().statDate, 0, day('2026-09-24'))
  if (countUp) $('#kpis').querySelectorAll('[data-to]').forEach((el, n) => tween(`kpi${n}`, 0, Number(el.dataset.to), v => { el.textContent = Math.round(v).toLocaleString(locale()) }, 900))
}
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches
function renderTheme(spin) {
  $('#theme').innerHTML = isDark() ? I.sun : I.moon
  $('#theme').setAttribute('aria-pressed', isDark())
  if (spin) $('#theme svg').classList.add('spin')
}

function renderFilters() {
  const states = [...new Set([...premises.values()].map(p => p.state).filter(Boolean))].sort()
  const districts = [...new Set([...premises.values()].filter(p => p.state === ui.state).map(p => p.district).filter(Boolean))].sort()
  if (!districts.includes(ui.district)) ui.district = ''
  $('#state').innerHTML = `<option value="">${t().allMalaysia}</option>` + states.map(s => `<option ${s === ui.state ? 'selected' : ''}>${esc(s)}</option>`).join('')
  $('#district').innerHTML = `<option value="">${t().allDistricts}</option>` + districts.map(d => `<option ${d === ui.district ? 'selected' : ''}>${esc(d)}</option>`).join('')
  $('#district').disabled = !ui.state
  $('#state').disabled = false
}

/* Item cards */
function renderResults(a) {
  const q = ui.query.trim(), ql = q.toLowerCase()
  const hits = [...items.entries()]
    .filter(([code, i]) => index.has(code) && (!ui.group || i.item_group === ui.group) && (!q || hit(code, i, q, ql)))
    .map(([code, i]) => ({ code, r: q ? score(code, i, q) : 0, shops: cheapest(index, code, a) }))
    .filter(h => h.shops.length)
    .sort((x, y) => x.r - y.r || y.shops.length - x.shops.length)
  $('#results-title').textContent = q ? t().resultsFor(q) : ui.group ? t().groups[groupIdx(ui.group)] : t().popular
  $('#results-count').textContent = hits.length ? `${t().count(hits.length)} · ${placeName()}` : ''
  const grid = $('#results'), key = [q, ui.group, ui.state, ui.district, ui.lang].join('|')
  if (key !== listKey) { listKey = key; grid.classList.remove('enter'); void grid.offsetWidth; grid.classList.add('enter') }
  if (!hits.length) { grid.innerHTML = `<li class="empty">${I.search}${t().noResults}</li>`; return }
  grid.innerHTML = hits.slice(0, 36).map(({ code, shops }, n) => {
    const i = items.get(code), s = stats(shops), on = inBasket(code)
    const pos = s.hi > s.lo ? ((s.med - s.lo) / (s.hi - s.lo)) * 100 : 50
    const more = Math.round((s.hi / s.lo - 1) * 100)
    return `<li class="card" style="--c:var(--g${groupIdx(i.item_group)});--i:${n}">
      <button class="open" data-open="${code}" aria-label="${t().compare}: ${esc(itemName(code))}"></button>
      <button class="add" data-toggle="${code}" aria-pressed="${on}" aria-label="${esc(t().addItem(itemName(code)))}">${on ? I.check : I.plus}</button>
      ${thumb(code)}
      <div><h3>${esc(itemName(code))}</h3><div class="meta">${esc(catLabel(i))} · ${esc(i.unit)}</div></div>
      <div class="price"><strong class="cond">${rm(s.lo)}</strong>${more >= 10 ? `<span class="badge warn">${I.up}${more}%</span>` : ''}</div>
      <div class="track" aria-hidden="true"><i style="left:${pos}%"></i></div>
      <div class="foot"><span>${I.store}${s.n}</span><span>${rm(s.hi)}</span></div>
    </li>`
  }).join('')
}

/* Detail dialog */
function openDetail(code) {
  const i = items.get(code), shops = cheapest(index, code, area()), s = stats(shops), on = inBasket(code)
  const dlg = $('#detail')
  dlg.dataset.code = code
  dlg.innerHTML = `
    <div class="dlg-head" style="--c:var(--g${groupIdx(i.item_group)})">
      <div class="dlg-title">${thumb(code)}<div>
        <h2 class="display" id="detail-title">${esc(itemName(code))}</h2>
        ${ui.lang !== 'ms' && ITEMS[code] ? `<div class="official">${esc(official(code))}</div>` : ''}
        ${IMAGES[code] ? `<a class="credit" href="https://world.openfoodfacts.org/product/${IMAGES[code]}" target="_blank" rel="noopener">${t().photo}</a>` : ''}
        <div class="muted">${esc(catLabel(i))} · ${esc(i.unit)} · ${I.store.replace('class="i"', 'class="i" style="width:13px;height:13px;vertical-align:-2px"')} ${s.n}</div></div></div>
      <button class="dlg-close" data-close aria-label="${t().close}">${I.close}</button>
      <dl class="stats">
        <div class="stat lo"><dt class="label">${t().lowest}</dt><dd class="cond">${rm(s.lo)}</dd></div>
        <div class="stat"><dt class="label">${t().typical}</dt><dd class="cond">${rm(s.med)}</dd></div>
        <div class="stat"><dt class="label">${t().highest}</dt><dd class="cond">${rm(s.hi)}</dd></div>
      </dl>
    </div>
    <ol class="shoplist">${shops.slice(0, 25).map((x, n) => {
      const p = shop(x.premise)
      return `<li class="${x.price === s.lo ? 'lo' : ''}" style="--i:${n}"><span class="rk">${n + 1}</span>
        <div><div class="nm">${esc(nice(p.premise))}</div><div class="loc">${esc(p.district ?? '')} · ${shopType(p)}</div></div>
        <div class="p cond">${rm(x.price)}<small>${day(x.date)}</small></div>
        <div class="bar-line"><i style="width:${(x.price / s.hi) * 100}%"></i></div></li>`
    }).join('')}</ol>
    ${shops.length > 25 ? `<p class="muted" style="padding:0 24px">${t().more(shops.length - 25)}</p>` : ''}
    <div class="dlg-foot">${cta(code)}</div>`
  if (!dlg.open) dlg.showModal()
}
const cta = code => inBasket(code)
  ? `<button class="cta secondary" data-toggle="${code}">${I.check} ${t().inBasket}</button>`
  : `<button class="cta" data-toggle="${code}">${I.plus} ${t().add}</button>`

/* Basket */
function renderBasket(a) {
  const list = ui.list, bar = $('#bar')
  if (!list.length) {
    shownTotal = 0
    bar.classList.remove('show')
    $('#basket').innerHTML = `<div class="basket-head"><h2 class="display">${t().basket}</h2></div>
      <div class="basket-empty"><div class="art">${I.basket}</div>${t().emptyBasket}</div>`
    return
  }
  const one = bestShops(index, list, a).slice(0, 3)
  const split = splitTrip(index, list, a)
  const top = one[0]
  const saving = top && !top.missing.length ? top.total - split.total : 0
  const stops = [...Map.groupBy(split.picks, p => p.premise)]
  const count = list.reduce((n, l) => n + l.qty, 0)
  const lines = list.map(({ item, qty }) => {
    const i = items.get(item), lo = cheapest(index, item, a)[0]
    return `<li class="line${item === justAdded ? ' new' : ''}">${thumb(item)}
      <div><div class="nm">${esc(itemName(item))}</div><div class="sub">${esc(i.unit)} · ${lo ? rm(lo.price) : '—'}</div></div>
      <div class="step"><button data-qty="${item}" data-d="-1" aria-label="${esc(t().dec(itemName(item)))}">−</button><b data-q="${item}" aria-live="polite">${qty}</b><button data-qty="${item}" data-d="1" aria-label="${esc(t().inc(itemName(item)))}">+</button></div>
    </li>`
  }).join('')
  const shopHead = (code, amount) => {
    const p = shop(code)
    return `<div class="shop"><span>${esc(nice(p.premise))}</span><span class="cond">${rm(amount)}</span></div>
      <div class="sm">${esc(p.district ?? '')} · ${shopType(p)}</div>`
  }
  const dots = picks => `<div class="dots">${picks.map(x => `<span title="${esc(itemName(x.item))} ×${x.qty}">${thumb(x.item)}</span>`).join('')}</div>`

  let result
  if (ui.mode === 'split') {
    result = `<div class="total-label label">${t().stops(stops.length)}</div>
      <div class="total display">${rm(shownTotal)}</div>
      <div class="flags">
        ${saving > 0.005 ? `<span class="badge good">${t().save(rm(saving))}</span>` : stops.length === 1 ? `<span class="badge good">${t().allInOne}</span>` : ''}
        ${split.missing.length ? `<span class="badge warn">${t().notSold(split.missing.length)}</span>` : ''}
      </div>
      <ol class="stops">${stops.map(([code, picks], n) => `<li class="${n ? '' : 'best'}">
        ${shopHead(code, picks.reduce((s, x) => s + x.price * x.qty, 0))}${dots(picks)}</li>`).join('')}</ol>`
  } else {
    result = top ? `<div class="total-label label">${t().oneStop}</div>
      <div class="total display">${rm(shownTotal)}</div>
      <div class="flags">${top.missing.length ? `<span class="badge warn">${t().missing(top.missing.length)}</span>` : `<span class="badge good">${t().hasAll}</span>`}</div>
      <ol class="stops">${one.map((s, n) => `<li class="${n ? '' : 'best'}">${shopHead(s.premise, s.total)}
        ${s.missing.length ? `<div class="miss">− ${s.missing.map(i => esc(itemName(i))).join(', ')}</div>` : ''}</li>`).join('')}</ol>`
      : `<div class="total-label label">${t().noShop}</div>`
  }

  $('#basket').innerHTML = `
    <div class="basket-head"><h2 class="display">${t().basket} <span class="n">${count}</span></h2><button class="ghost" id="clear">${t().clear}</button></div>
    <ul class="lines">${lines}</ul>
    <div class="result">
      <div class="seg" role="group" aria-label="${t().plan}" data-mode="${lastMode}">
        <button data-mode="split" aria-pressed="${ui.mode === 'split'}">${t().cheapest}</button>
        <button data-mode="one" aria-pressed="${ui.mode === 'one'}">${t().oneStop}</button>
      </div>${result}
    </div>`
  const shown = ui.mode === 'split' ? split.total : top?.total ?? 0
  bar.innerHTML = `<div><small class="label">${t().items(count)}</small><strong class="cond">${rm(shownTotal)}</strong></div><span class="go" aria-hidden="true">${t().viewPlan}</span>`
  bar.setAttribute('aria-label', `${t().viewPlan}: ${t().items(count)}, ${rm(shown)}`)
  bar.classList.add('show')
  const seg = $('#basket .seg')
  lastMode = ui.mode
  requestAnimationFrame(() => seg?.setAttribute('data-mode', ui.mode))
  const totals = [$('#basket .total'), bar.querySelector('strong')].filter(Boolean)
  tween('total', shownTotal, shown, v => { shownTotal = v; totals.forEach(el => { el.textContent = rm(v) }) })
}

let listKey = '', lastMode = ui.mode, shownTotal = 0, justAdded = null, failed = false
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Eased number animation; a new call with the same key cancels the running one.
const tweens = new Map()
function tween(key, from, to, set, dur = 450) {
  cancelAnimationFrame(tweens.get(key))
  if (reduced() || Math.abs(to - from) < 0.005) { set(to); return }
  const t0 = performance.now()
  const step = now => {
    const k = Math.min(1, (now - t0) / dur)
    set(from + (to - from) * (1 - (1 - k) ** 3))
    if (k < 1) tweens.set(key, requestAnimationFrame(step))
  }
  tweens.set(key, requestAnimationFrame(step))
}
const replay = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) }

// A dot arcs from the tapped button to the basket (or the mobile bar), then the target bumps.
// `a` is the button's rect measured before re-render, because render() replaces the button.
function fly(a) {
  const target = mobile.matches ? $('#bar') : $('#basket .basket-head h2')
  if (!a || !target || reduced()) return replay(target, 'bump')
  const b = target.getBoundingClientRect()
  const dx = b.left + 40 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const dot = Object.assign(document.createElement('div'), { className: 'fly' })
  dot.style.left = `${a.left + a.width / 2 - 9}px`
  dot.style.top = `${a.top + a.height / 2 - 9}px`
  document.body.append(dot)
  dot.animate([
    { transform: 'translate(0, 0) scale(1)' },
    { transform: `translate(${dx * 0.45}px, ${Math.min(dy, 0) * 0.5 - 90}px) scale(1.15)`, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0.4 },
  ], { duration: 620, easing: 'cubic-bezier(.45, 0, .4, 1)' }).onfinish = () => { dot.remove(); replay(target, 'bump') }
}

// Top progress bar and the loading label in the section head.
function progress(f, label) {
  const p = $('#progress')
  p.className = 'progress'
  p.firstElementChild.style.width = `${Math.round(f * 100)}%`
  p.setAttribute('aria-valuenow', Math.round(f * 100))
  if (label) $('#results-count').textContent = `${label} · ${Math.round(f * 100)}%`
}

// Fade a chip-bar edge only when there is more to scroll that way.
function fadeChips() {
  const c = $('#chips'), end = c.scrollWidth - c.clientWidth - 1
  c.style.setProperty('--fl', c.scrollLeft > 1 ? '48px' : '0px')
  c.style.setProperty('--fr', c.scrollLeft < end ? '48px' : '0px')
}

// Location stays on the device: the browser gives coordinates, we match the nearest bundled district centre.
function locate(auto) {
  if (!navigator.geolocation) return
  const btn = $('#locate')
  btn.setAttribute('aria-busy', 'true')
  navigator.geolocation.getCurrentPosition(pos => {
    btn.removeAttribute('aria-busy')
    // Only districts that have PriceCatcher shops, so the district filter always sticks.
    const known = new Set([...premises.values()].map(p => `${p.state}|${p.district}`))
    const { row, km } = nearestDistrict(DISTRICTS.filter(r => known.has(`${r[2]}|${r[3]}`)), pos.coords.latitude, pos.coords.longitude)
    if (km > 80) { if (!auto) toast(t().locFail); return } // outside Malaysia
    ui.state = row[2]
    ui.district = row[3]
    renderFilters()
    render()
    toast(t().located(placeName()))
  }, () => {
    btn.removeAttribute('aria-busy')
    if (!auto) toast(t().locFail)
  }, { timeout: 10000, maximumAge: 3600e3 })
}

function render() {
  if (!index) return
  const a = area()
  renderResults(a)
  renderBasket(a)
  save()
}

let toastTimer
function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800)
}
// Basket edits re-render the basket only. Cards and the open popup update in place, so the grid never flashes.
function basketChanged(codes) {
  renderBasket(area())
  save()
  for (const code of codes) {
    const b = $(`#results [data-toggle="${code}"]`), on = inBasket(code)
    if (b) {
      b.setAttribute('aria-pressed', on)
      b.innerHTML = on ? I.check : I.plus
    }
    const dlg = $('#detail')
    if (dlg.open && Number(dlg.dataset.code) === code) dlg.querySelector('.dlg-foot').innerHTML = cta(code)
  }
}
function toggle(code, from) {
  const adding = !inBasket(code), rect = from?.getBoundingClientRect()
  if (adding) { ui.list.push({ item: code, qty: 1 }); justAdded = code; toast(t().added(itemName(code))) }
  else { ui.list = ui.list.filter(l => l.item !== code); toast(t().removed(itemName(code))) }
  basketChanged([code])
  justAdded = null
  replay($(`#results [data-toggle="${code}"]`), 'pop')
  replay($('#detail[open] .cta'), 'pop')
  if (adding) fly(rect)
}

// Animated close for both dialogs. Reduced motion closes at once, since no animationend would fire.
function closeDialog(dlg) {
  if (!dlg.open || dlg.classList.contains('closing')) return
  if (reduced()) return dlg.close()
  dlg.classList.add('closing')
  dlg.addEventListener('animationend', () => { dlg.classList.remove('closing'); dlg.close() }, { once: true })
}
const mobile = matchMedia('(max-width: 1000px)')
function openSheet() {
  $('#sheet').append($('#basket'))
  $('#sheet').showModal()
}

/* Events */
let debounce
$('#q').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => { ui.query = e.target.value; renderResults(area()) }, 120) })
$('#state').addEventListener('change', e => { ui.state = e.target.value; ui.district = ''; renderFilters(); render() })
$('#district').addEventListener('change', e => { ui.district = e.target.value; render() })
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $('#q') && !$('#detail').open) { e.preventDefault(); $('#q').focus() }
})
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(dlg) })
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(dlg) })
}
$('#sheet').addEventListener('close', () => $('.layout').append($('#basket')))
mobile.addEventListener('change', e => { if (!e.matches && $('#sheet').open) $('#sheet').close() })
$('#chips').addEventListener('scroll', fadeChips, { passive: true })
addEventListener('resize', fadeChips)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTheme)
document.addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b) return
  const d = b.dataset
  if (b.id === 'clear-q') { const q = $('#q'); q.value = ''; q.dispatchEvent(new Event('input')); q.focus() }
  else if (b.id === 'locate') locate(false)
  else if (b.id === 'theme') {
    const next = isDark() ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('harga-theme', next) } catch {}
    renderTheme(true)
  } else if (d.lang) {
    ui.lang = d.lang
    renderChrome(); render(); save()
    const dlg = $('#detail')
    if (dlg.open) openDetail(Number(dlg.dataset.code))
  } else if ('group' in d) {
    ui.group = d.group
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.group === ui.group))
    replay(b.querySelector('.tile'), 'pop')
    if (index) renderResults(area())
    save()
  } else if ('retry' in d) boot()
  else if (!index) return
  else if (d.open) openDetail(Number(d.open))
  else if (d.toggle) toggle(Number(d.toggle), b)
  else if ('close' in d) closeDialog(b.closest('dialog'))
  else if (b.id === 'bar') openSheet()
  else if (d.mode) { ui.mode = d.mode; renderBasket(area()); save() }
  else if (d.qty) {
    const l = ui.list.find(x => x.item === Number(d.qty))
    l.qty += Number(d.d)
    if (l.qty < 1) ui.list = ui.list.filter(x => x !== l)
    basketChanged([l.item])
    replay($(`#basket [data-q="${d.qty}"]`), 'bump')
  } else if (b.id === 'clear') {
    const codes = ui.list.map(l => l.item)
    ui.list = []
    basketChanged(codes)
  }
})

/* Boot */
const SKELETON = $('#results').innerHTML
async function boot() {
  failed = false
  $('#results').innerHTML = SKELETON
  renderKpis()
  progress(0.03, t().loading)
  try {
    await load(progress)
    progress(1)
    $('#progress').classList.add('done')
    ui.list = ui.list.filter(l => items.has(l.item))
    $('#q').disabled = false
    renderFilters()
    renderKpis(true)
    render()
    if (!ui.state && !ui.geoAsked) { ui.geoAsked = true; save(); locate(true) }
  } catch (err) {
    console.error(err)
    failed = true
    const offline = !navigator.onLine || err instanceof TypeError // fetch throws TypeError on network failure
    $('#progress').className = 'progress error'
    $('#results-count').textContent = ''
    renderKpis()
    $('#results').innerHTML = `<li class="empty state">${offline ? I.wifi : I.alert}
      <strong>${t().errorTitle}</strong><span>${offline ? t().offline : t().loadError}</span>
      <button class="cta" data-retry>${t().retry}</button></li>`
    $('#basket').innerHTML = `<div class="basket-head"><h2 class="display">${t().basket}</h2></div>
      <div class="basket-empty"><div class="art">${I.basket}</div>${t().emptyBasket}</div>`
  }
}
addEventListener('online', () => { if (failed) boot() })
renderChrome()
boot()
