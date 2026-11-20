// Usage: NODE_PATH=$(npm root -g) NODE_USE_ENV_PROXY=1 node --experimental-strip-types tools/stores-dm.mts
// Loads every dm branch listed in dm's own store sitemap (robots.txt allows it) and keeps what the
// store page itself fetches: address, Bundesland, coordinates, opening hours, closing days.
// Writes data/stores/dm.json. One page at a time, 1.5 s apart.
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import type { Branch, OpeningHours } from '../lib/domain/stores.ts'

const UA = 'BodegaPrototype/0.1 (personal price-comparison prototype)'
const today = new Date().toISOString().slice(0, 10)
const xml = await (await fetch('https://www.dm.at/store-sitemap.xml', { headers: { 'user-agent': UA } })).text()
const urls = [...xml.matchAll(/<loc>(https:\/\/www\.dm\.at\/store\/[a-z0-9]+\/[^<]+)<\/loc>/g)].map(m => m[1])
console.log('Filialseiten in der Sitemap:', urls.length)

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
// resume: stores already in the file are skipped; the browser is restarted every 20 pages (it crashed after 25 once)
const branches: Branch[] = existsSync('data/stores/dm.json') ? JSON.parse(readFileSync('data/stores/dm.json', 'utf8')) : []
const failed: string[] = []
const have = new Set(branches.map(b => b.id))
let browser = await chromium.launch(), ctx = await browser.newContext({ locale: 'de-AT' }), sinceStart = 0
const restart = async () => { await browser.close().catch(() => {}); browser = await chromium.launch(); ctx = await browser.newContext({ locale: 'de-AT' }); sinceStart = 0 }

for (const [i, url] of urls.entries()) {
  const sid = 'dm:' + url.match(/\/store\/([a-z0-9]+)\//)![1].toUpperCase()
  if (have.has(sid)) continue
  if (sinceStart >= 20) await restart()
  sinceStart++
  let p
  try { p = await ctx.newPage() } catch { await restart(); p = await ctx.newPage() }
  let item: any = null
  p.on('response', async r => { if (/\/api\/v2\/stores\/item\//i.test(r.url())) { try { item = await r.json() } catch { /* ignore */ } } })
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // wait only until the page has fetched the branch data (not for a quiet network: analytics never stop)
    for (let w = 0; w < 40 && !item; w++) await p.waitForTimeout(250)
    if (!item?.address || !item.location) throw new Error('keine Daten')
    const hours: OpeningHours = {}
    for (const d of item.openingHours ?? []) hours[(d.weekDay % 7) as 0] = d.timeRanges.map((t: any) => ({ open: t.opening, close: t.closing }))
    const closed = (item.extraClosingDates ?? []).map((c: any) => String(typeof c === 'string' ? c : c.date ?? c.day ?? '').slice(0, 10)).filter(Boolean)
    branches.push({
      id: `dm:${item.storeId}`, chain: 'dm', name: `dm ${item.address.district ?? item.address.city}`.trim(),
      street: item.address.street, zip: item.address.zip, city: item.address.city,
      lat: item.location.lat, lon: item.location.lon, hours, ...(closed.length ? { closedOn: closed } : {}),
      checkedAt: today, region: item.address.regionName,
    })
  } catch (e) { failed.push(url) }
  await p.close()
  if ((i + 1) % 25 === 0) { console.log(`${i + 1}/${urls.length} geladen, ${failed.length} ohne Daten`); writeFileSync('data/stores/dm.json', JSON.stringify(branches)) }
  await new Promise(r => setTimeout(r, 1500))
}
await browser.close().catch(() => {})
writeFileSync('data/stores/dm.json', JSON.stringify(branches))
writeFileSync('data/stores/dm.report.json', JSON.stringify({ date: today, sitemap: urls.length, loaded: branches.length, failed }, null, 1))
console.log('fertig:', branches.length, 'Filialen,', failed.length, 'ohne Daten')
