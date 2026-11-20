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
  /** die Seite zeigt die Verfügbarkeit je Markt (Markt wählen) */
  stockPerBranch?: boolean
  note: string
}

export const CHAINS: Chain[] = [
  // Diskonter: in der Marktauswahl zuerst und standardmäßig angehakt, sobald Online-Preise bestätigt sind
  { id: 'hofer', name: 'HOFER', group: 'discounter', coverage: 'unknown', verified: false,
    note: 'www.hofer.at liefert für automatische Abrufe 403; shop.hofer.at/alle-produkte ist ein Shop ohne Lebensmittel. Lebensmittelpreise nicht bestätigt, Flugblatt (shop.hofer.at/zum-aktuellen-flugblatt) noch zu prüfen. Sperre nicht umgehen: bei HOFER um Datenzugang anfragen.' },
  { id: 'lidl', name: 'Lidl', group: 'discounter', coverage: 'offers-only', priceUrl: 'https://www.lidl.at/c/flugblatt/s10012330', loyalty: 'Lidl Plus', verified: true, verifiedOn: '2026-11-20',
    note: 'Mit Browser geprüft (Kategorie Käse, Milchprodukte & Eier, 32 Produkte): nur Aktionsartikel mit Zeitraum ("in der Filiale von 17.12. - 19.12."), auch weit in der Zukunft (bis 24.12.), mit Grundpreis ("1 kg = 27.90"). Kein Dauersortiment. Die Startseite lädt Inhalte per Skript nach.' },
  { id: 'penny', name: 'PENNY', group: 'discounter', coverage: 'offers-only', priceUrl: 'https://www.penny.at/angebote', showsUnitPrice: true, loyalty: 'jö Bonus Club', verified: true, verifiedOn: '2026-11-20',
    note: 'Direkt geprüft (Kategorie Getränke, 67 Artikel laut Seite): jeder Artikel hat einen Aktionszeitraum von/bis, auch für die nächste Woche (bis 02.12.). Teils Streichpreis, teils Mindestmenge ("ab 24 Flaschen"). Keine Dauerpreise. robots.txt ohne Sperren.' },

  // Supermärkte
  { id: 'billa', name: 'BILLA / BILLA PLUS', group: 'supermarket', coverage: 'full', priceUrl: 'https://shop.billa.at/', showsUnitPrice: true, loyalty: 'jö Bonus Club', stickers: true, verified: true, verifiedOn: '2026-11-20',
    note: 'Direkt geprüft (Obst & Gemüse, 315 Artikel laut Seite, mehrere Seiten): Preise ohne Login, Losware "per 1 kg", Packungen mit Grundpreis. Preise des Online-Shops; ob gleich wie in der Filiale, nicht geprüft. robots.txt ohne Sperren.' },
  { id: 'spar', name: 'SPAR / EUROSPAR / INTERSPAR', group: 'supermarket', coverage: 'full', priceUrl: 'https://www.spar.at/produktwelt/lebensmittel', showsUnitPrice: true, loyalty: 'SPAR-App', stickers: true, verified: false,
    note: 'Cloudflare-Prüfseite ("Just a moment…") vor spar.at und interspar.at, nur robots.txt und Sitemap sind abrufbar. Inhalt nicht bestätigt. Prüfung nicht umgehen: bei SPAR um Datenzugang anfragen (Entwurf: docs/anfrage-datenzugang.md).' },
  { id: 'mpreis', name: 'MPREIS', group: 'supermarket', coverage: 'full', stockPerBranch: true, verified: true, verifiedOn: '2026-11-20',
    note: 'Mit Browser geprüft: www.mpreis.at/shop/c/lebensmittel/... zeigt Preise, Grundpreis ("Per kg", "1,34 € /l"), Aktionen mit Streichpreis ("Aktueller Preis 0,67 €, statt 1,35 €") und "Verfügbarkeit in deinem Markt prüfen" (Markt wählbar). Flugblatt unter /aktionen/flugblatt.' },
  { id: 'adeg', name: 'ADEG', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Seite erreichbar, keine Preise gefunden.' },
  { id: 'nahfrisch', name: 'Nah&Frisch', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Seite erreichbar, keine Preise gefunden.' },
  { id: 'maximarkt', name: 'Maximarkt', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'robots.txt sperrt KI-Crawler ausdrücklich (u. a. ClaudeBot, GPTBot): nicht abrufen.' },
  { id: 'unimarkt', name: 'Unimarkt', group: 'supermarket', coverage: 'excluded', verified: true, verifiedOn: '2026-11-20',
    note: 'www.unimarkt.at leitet auf unigruppe.at (Firmenseite, kein Shop) weiter; passt zur gemeldeten Schließung 2025.' },

  // Drogerien
  { id: 'dm', name: 'dm drogerie markt', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.dm.at/', loyalty: 'dm-App', stockPerBranch: true, verified: true, verifiedOn: '2026-11-20',
    note: 'Mit Browser geprüft: Produktkacheln mit Preis, Grundpreis ("129,90 € je 1 St") und Verfügbarkeit (lieferbar / "dm Markt wählen"). Ohne Skript sind die Preise nicht im HTML.' },
  { id: 'bipa', name: 'BIPA', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.bipa.at/', loyalty: 'jö Bonus Club', verified: false,
    note: 'Mit Browser: Startseite zeigt Preise (136 Zeilen). Die Sortimentsseite bipa.at/sortiment antwortet mit Fehler 500, das Gesamtsortiment unter bipa.at/c/bipa-online-shop ist noch zu prüfen.' },
  { id: 'mueller', name: 'Müller', group: 'drugstore', coverage: 'full', verified: false,
    note: 'www.mueller.at liefert für automatische Abrufe 403. Nicht bestätigt, Sperre nicht umgehen.' },

  // reine Online-Supermärkte (keine Filialen; Lieferkosten extra)
  { id: 'gurkerl', name: 'Gurkerl', group: 'online', coverage: 'unknown', verified: false,
    note: 'robots.txt sperrt /regal/* (die Warenregale) für alle Crawler, die nicht ausdrücklich erlaubt sind. Startseite und Kategorien (/c26-obst-gemuese …) sind abrufbar. Ohne Zustimmung die Regale nicht auslesen: um Datenzugang anfragen.' },
  { id: 'alfies', name: 'Alfies', group: 'online', coverage: 'full', priceUrl: 'https://alfies.shop/de/at/shop', verified: false,
    note: 'Neue Adresse des Shops: alfies.shop (robots.txt erlaubt alles). Ohne Lieferadresse zeigt der Shop keine Preise ("€ 0,00", Mindestbestellwert 25 €). Reiner Lieferdienst, keine Filiale.' },
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
