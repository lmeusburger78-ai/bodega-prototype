/**
 * Which Austrian grocery and drugstore chains publish prices online, and how much.
 *
 * Stand: Recherche vom 20.11.2026 über Websuche. Die Websites der Ketten selbst
 * waren aus der Arbeitsumgebung nicht erreichbar, deshalb ist jeder Eintrag mit
 * `verified: false` markiert, bis ein Abruf der Seite ihn bestätigt.
 * Siehe docs/marktrecherche.md für Quellen und offene Punkte.
 *
 * Aufnahmeregel: Kette mit mehreren Filialen oder eigenem Online-Shop, Preise auf
 * der eigenen offiziellen Seite. Keine Preise von Drittseiten als Quelle.
 */

export type Coverage =
  /** reguläre Preise für (fast) das ganze Sortiment, ohne Login */
  | 'full'
  /** nur Aktionen bzw. Flugblatt online */
  | 'offers-only'
  /** noch nicht geklärt; in der App nicht auswählbar */
  | 'unknown'
  /** nicht aufnehmen (geschlossen, keine Preise online) */
  | 'excluded'

export type ChainGroup = 'discounter' | 'supermarket' | 'drugstore' | 'online'

export type Chain = {
  id: string
  name: string
  group: ChainGroup
  coverage: Coverage
  /** Seite mit Preisen, von der täglich gelesen würde */
  priceUrl?: string
  showsUnitPrice?: boolean
  loyalty?: string
  stickers?: boolean
  /** ob der Eintrag durch einen Abruf der Seite selbst bestätigt ist */
  verified: boolean
  /** Tag des direkten Abrufs */
  verifiedOn?: string
  note: string
}

export const CHAINS: Chain[] = [
  // Diskonter: in der Marktauswahl zuerst und standardmäßig angehakt, sobald Online-Preise bestätigt sind
  { id: 'hofer', name: 'HOFER', group: 'discounter', coverage: 'unknown', verified: false,
    note: 'www.hofer.at liefert für automatische Abrufe 403; shop.hofer.at/alle-produkte ist ein Shop ohne Lebensmittel. Lebensmittelpreise nicht bestätigt, Flugblatt (shop.hofer.at/zum-aktuellen-flugblatt) noch zu prüfen. Sperre nicht umgehen: bei HOFER um Datenzugang anfragen.' },
  { id: 'lidl', name: 'Lidl', group: 'discounter', coverage: 'offers-only', priceUrl: 'https://www.lidl.at/c/flugblatt/s10012330', loyalty: 'Lidl Plus', verified: false,
    note: 'robots.txt erlaubt Produktseiten. Die Startseite enthält im Abruf keine Preise (Inhalt wird nachgeladen), Flugblatt-Seiten noch zu prüfen. Kein Dauersortiment gefunden.' },
  { id: 'penny', name: 'PENNY', group: 'discounter', coverage: 'offers-only', priceUrl: 'https://www.penny.at/angebote', showsUnitPrice: true, loyalty: 'jö Bonus Club', verified: true, verifiedOn: '2026-11-20',
    note: 'Direkt geprüft (Kategorie Getränke, 67 Artikel laut Seite): jeder Artikel hat einen Aktionszeitraum von/bis, auch für die nächste Woche (bis 02.12.). Teils Streichpreis, teils Mindestmenge ("ab 24 Flaschen"). Keine Dauerpreise. robots.txt ohne Sperren.' },

  // Supermärkte
  { id: 'billa', name: 'BILLA / BILLA PLUS', group: 'supermarket', coverage: 'full', priceUrl: 'https://shop.billa.at/', showsUnitPrice: true, loyalty: 'jö Bonus Club', stickers: true, verified: true, verifiedOn: '2026-11-20',
    note: 'Direkt geprüft (Obst & Gemüse, 315 Artikel laut Seite, mehrere Seiten): Preise ohne Login, Losware "per 1 kg", Packungen mit Grundpreis. Preise des Online-Shops; ob gleich wie in der Filiale, nicht geprüft. robots.txt ohne Sperren.' },
  { id: 'spar', name: 'SPAR / EUROSPAR / INTERSPAR', group: 'supermarket', coverage: 'full', priceUrl: 'https://www.spar.at/produktwelt/lebensmittel', showsUnitPrice: true, loyalty: 'SPAR-App', stickers: true, verified: false,
    note: 'robots.txt erlaubt alles, aber www.spar.at/produktwelt liefert für automatische Abrufe 403. Inhalt nicht bestätigt. Sperre nicht umgehen: bei SPAR um Datenzugang anfragen.' },
  { id: 'mpreis', name: 'MPREIS', group: 'supermarket', coverage: 'full', verified: false,
    note: 'robots.txt erlaubt alles außer /search/ und Filterlinks (KI-Crawler ausdrücklich erlaubt). www.mpreis.at/shop gibt es nicht (404), die richtige Shop-Adresse ist noch zu finden.' },
  { id: 'adeg', name: 'ADEG', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Seite erreichbar, keine Preise gefunden.' },
  { id: 'nahfrisch', name: 'Nah&Frisch', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Seite erreichbar, keine Preise gefunden.' },
  { id: 'maximarkt', name: 'Maximarkt', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'robots.txt sperrt KI-Crawler ausdrücklich (u. a. ClaudeBot, GPTBot): nicht abrufen.' },
  { id: 'unimarkt', name: 'Unimarkt', group: 'supermarket', coverage: 'excluded', verified: true, verifiedOn: '2026-11-20',
    note: 'www.unimarkt.at leitet auf unigruppe.at (Firmenseite, kein Shop) weiter; passt zur gemeldeten Schließung 2025.' },

  // Drogerien
  { id: 'dm', name: 'dm drogerie markt', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.dm.at/', loyalty: 'dm-App', verified: false,
    note: 'robots.txt sperrt nur Suche, Warenkorb u. ä. Die Startseite lädt Preise per Skript nach, im Abruf keine Preise. Produktseiten noch zu prüfen.' },
  { id: 'bipa', name: 'BIPA', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.bipa.at/', loyalty: 'jö Bonus Club', verified: false,
    note: 'robots.txt erlaubt alles. Startseite enthält nur 2 Preise, Sortiment noch zu prüfen.' },
  { id: 'mueller', name: 'Müller', group: 'drugstore', coverage: 'full', verified: false,
    note: 'www.mueller.at liefert für automatische Abrufe 403. Nicht bestätigt, Sperre nicht umgehen.' },

  // reine Online-Supermärkte (keine Filialen; Lieferkosten extra)
  { id: 'gurkerl', name: 'Gurkerl', group: 'online', coverage: 'unknown', verified: false,
    note: 'robots.txt sperrt /regal/* (die Warenregale) für alle Crawler, die nicht ausdrücklich erlaubt sind. Ohne Zustimmung nicht auslesen: um Datenzugang anfragen.' },
  { id: 'alfies', name: 'Alfies', group: 'online', coverage: 'full', priceUrl: 'https://www.alfies.at/', verified: false,
    note: 'robots.txt erlaubt alles. Startseite ohne Preise im Abruf (Skript), Sortiment noch zu prüfen. Reiner Lieferdienst, keine Filiale.' },
]

/** In der Marktauswahl anhakbar: nur Ketten mit Online-Preisen. Die anderen bleiben ausgegraut sichtbar. */
export const selectable = (c: Chain) => c.coverage === 'full' || c.coverage === 'offers-only'

/** Diskonter erscheinen immer im Vergleich und sind standardmäßig gewählt. */
export const defaultSelected = (c: Chain) => c.group === 'discounter' && selectable(c)

const GROUP_ORDER: ChainGroup[] = ['discounter', 'supermarket', 'drugstore', 'online']
export const chainsForPicker = () =>
  [...CHAINS].filter(c => c.coverage !== 'excluded')
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))

/**
 * What the app writes next to a chain for one list line. No offer never means
 * "nicht verfügbar" without saying why.
 */
export function shelfLabel(chain: Chain, offer?: { availability: 'branch' | 'online' | 'unknown' | 'out' }): string {
  if (offer) {
    switch (offer.availability) {
      case 'branch': return 'in der Filiale verfügbar'
      case 'online': return 'laut Online-Shop verfügbar, Filiale nicht bestätigt'
      case 'unknown': return 'Preis bekannt, Verfügbarkeit nicht bestätigt'
      case 'out': return 'derzeit nicht verfügbar'
    }
  }
  if (chain.coverage === 'offers-only') return 'kein Online-Preis: diese Kette veröffentlicht nur Aktionen'
  if (chain.coverage === 'full') return 'nicht im Sortiment'
  return 'keine Preisangaben online'
}
