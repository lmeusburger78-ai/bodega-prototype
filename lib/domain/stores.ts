/**
 * Branches: exact address, opening hours, map link, walking time.
 *
 * The branch list comes from the monthly check (`AssortmentSnapshot.branches`).
 * Walking time is estimated from the straight-line distance until a routing
 * service is connected; the map link hands the real route to Google Maps (or
 * Apple Maps on iOS), so the shopper always sees the actual way.
 */

/** 0 = Sonntag … 6 = Samstag, like Date#getDay. Times as "HH:MM". */
export type OpeningHours = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { open: string; close: string }[]>>

export type Branch = {
  id: string
  chain: string
  name: string
  street: string
  zip: string
  city: string
  lat: number
  lon: number
  hours: OpeningHours
  /** public holidays and other closed days, YYYY-MM-DD */
  closedOn?: string[]
  /** last time address and hours were checked against the chain's branch finder */
  checkedAt: string
  /** Bundesland; prices should not differ inside one region for the same branch type */
  region?: string
  /** the chain's own branch type (Supermarkt, Hypermarkt, Markt …), when the chain publishes one */
  type?: string
}

export const address = (b: Branch) => `${b.street}, ${b.zip} ${b.city}`

/** Is the branch open at this moment? Holidays count as closed. */
export function isOpen(b: Branch, at: Date): boolean {
  if (b.closedOn?.includes(isoDate(at))) return false
  const slots = b.hours[at.getDay() as 0] ?? []
  const now = at.getHours() * 60 + at.getMinutes()
  return slots.some(s => toMin(s.open) <= now && now < toMin(s.close))
}

/** "geöffnet bis 20:00", "öffnet um 7:15", "heute geschlossen" */
export function openLabel(b: Branch, at: Date): string {
  if (b.closedOn?.includes(isoDate(at))) return 'heute geschlossen (Feiertag)'
  const slots = b.hours[at.getDay() as 0] ?? []
  const now = at.getHours() * 60 + at.getMinutes()
  const cur = slots.find(s => toMin(s.open) <= now && now < toMin(s.close))
  if (cur) return `geöffnet bis ${cur.close}`
  const next = slots.find(s => toMin(s.open) > now)
  return next ? `öffnet um ${next.open}` : 'heute geschlossen'
}

/** Straight-line distance in metres. */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/**
 * Walking minutes, estimated: street detour factor 1,3 and 4,8 km/h.
 * Shown as "ca."; replaced by the routing service's figure once connected.
 */
export const walkMinutesEstimate = (m: number) => Math.max(1, Math.round((m * 1.3) / 80))

/** Opens the route in Google Maps (works in browser and app). Multiple stops become waypoints. */
export function mapsRoute(from: { lat: number; lon: number }, stops: Branch[], mode: 'walking' | 'driving' | 'transit' | 'bicycling' = 'walking'): string {
  const p = new URLSearchParams({ api: '1', origin: `${from.lat},${from.lon}`, travelmode: mode })
  const last = stops[stops.length - 1]
  p.set('destination', `${last.lat},${last.lon}`)
  if (stops.length > 1) p.set('waypoints', stops.slice(0, -1).map(s => `${s.lat},${s.lon}`).join('|'))
  return `https://www.google.com/maps/dir/?${p}`
}

/** A route is only useful if every stop is still open when the shopper gets there. */
export function closedOnArrival(from: { lat: number; lon: number }, stops: Branch[], start: Date, minutesPerStop = 15): Branch[] {
  let t = start.getTime(), pos = from
  const closed: Branch[] = []
  for (const s of stops) {
    t += walkMinutesEstimate(distanceM(pos, s)) * 60000
    if (!isOpen(s, new Date(t))) closed.push(s)
    t += minutesPerStop * 60000
    pos = s
  }
  return closed
}

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
