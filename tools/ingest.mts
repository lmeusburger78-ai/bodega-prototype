// Usage: NODE_PATH=$(npm root -g) node --experimental-strip-types tools/ingest.mts [YYYY-MM-DD]
// Reads the category pages listed below and writes data/prices/<date>.jsonl plus a report.
// Needs playwright (npm i -D playwright) for the chains that load prices by script.
// Polite: one request at a time, 1.5 s apart, identified user agent for plain requests.
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { splitWsCards, parseWsCard, parseLidlText, parseMpreisText, parseDmText, checkObservation } from '../lib/ingest/parse.ts'
import type { Observation } from '../lib/domain/history.ts'

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const UA = 'BodegaPrototype/0.1 (personal price-comparison prototype)'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

const PLAIN = [
  { retailer: 'billa' as const, base: 'https://shop.billa.at', pages: 4,
    paths: ['/aktionen', '/kategorie/obst-und-gemuese-13751', '/kategorie/brot-und-gebaeck-15520', '/kategorie/fleisch-15571', '/kategorie/aus-der-feinkost-15429'] },
  { retailer: 'penny' as const, base: 'https://www.penny.at', pages: 4,
    paths: ['/kategorie/alle-angebote-99000000', '/kategorie/obst-und-gemuese-13013', '/kategorie/kuehlwaren-13032', '/kategorie/getraenke-13024', '/kategorie/brot-und-gebaeck-13018', '/kategorie/grundnahrungsmittel-13055'] },
]
const BROWSER = [
  { retailer: 'lidl', parse: parseLidlText, urls: ['https://www.lidl.at/h/kaese-milchprodukte-eier/h10095761', 'https://www.lidl.at/h/lebensmittelvorrat/h10096095', 'https://www.lidl.at/h/tiefkuehlkost-gefrorene-lebensmittel/h10071049'] },
  { retailer: 'mpreis', parse: parseMpreisText, urls: ['https://www.mpreis.at/shop/c/lebensmittel/obst-25999795', 'https://www.mpreis.at/shop/c/lebensmittel/gemuese-52259659', 'https://www.mpreis.at/shop/c/lebensmittel/obst/aepfel-40792619', 'https://www.mpreis.at/'] },
  { retailer: 'dm', parse: parseDmText, urls: ['https://www.dm.at/'] },
]

const all: Observation[] = []
const log: Record<string, { pages: number; items: number; unread: number }> = {}
const bump = (r: string, items: number, unread = 0) => { const l = (log[r] ??= { pages: 0, items: 0, unread: 0 }); l.pages++; l.items += items; l.unread += unread }

for (const c of PLAIN) for (const path of c.paths) for (let page = 1; page <= c.pages; page++) {
  const url = `${c.base}${path}${page > 1 ? `?page=${page}` : ''}`
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'de-AT' } })
  await wait(1500)
  if (!res.ok) { console.log(res.status, url); break }
  const cards = splitWsCards(await res.text())
  const obs = cards.map(x => parseWsCard(x, c.retailer, { date, source: url })).filter((o): o is Observation => !!o)
  bump(c.retailer, obs.length, cards.length - obs.length)
  all.push(...obs)
  if (cards.length < 20) break // last page
}

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'de-AT', viewport: { width: 1280, height: 900 } })
for (const c of BROWSER) for (const url of c.urls) {
  const p = await ctx.newPage()
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!r || r.status() >= 400) { console.log(r?.status(), url); continue }
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(1500)
    const obs = c.parse(await p.evaluate(() => document.body.innerText), { date, source: url })
    bump(c.retailer, obs.length); all.push(...obs)
  } catch (e) { console.log('Fehler', url, String(e).slice(0, 80)) }
  await p.close(); await wait(1500)
}
await browser.close()

// one line per article and day; duplicates (same article on two pages) are kept once
const seen = new Map<string, Observation>()
for (const o of all) if (!seen.has(`${o.retailer}|${o.sku}`)) seen.set(`${o.retailer}|${o.sku}`, o)
const rows = [...seen.values()]
const flagged = rows.map(o => ({ o, why: checkObservation(o) })).filter(x => x.why)
mkdirSync('data/prices', { recursive: true })
writeFileSync(`data/prices/${date}.jsonl`, rows.map(o => JSON.stringify(o)).join('\n') + '\n')
writeFileSync(`data/prices/${date}.report.json`, JSON.stringify({ date, perRetailer: log, total: rows.length, duplicatesDropped: all.length - rows.length,
  flagged: flagged.map(x => ({ retailer: x.o.retailer, name: x.o.name, why: x.why })) }, null, 2))
console.log(JSON.stringify(log), 'gesamt', rows.length, 'auffällig', flagged.length)
