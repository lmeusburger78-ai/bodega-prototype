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
  note: string
}

export const CHAINS: Chain[] = [
  // Diskonter: in der Marktauswahl immer zuerst und standardmäßig angehakt
  { id: 'hofer', name: 'HOFER', group: 'discounter', coverage: 'full', priceUrl: 'https://www.hofer.at/produkte', showsUnitPrice: true, verified: false,
    note: 'Sortimentsseite mit Preisen und Grundpreis laut Suchtreffer; Online-Shop shop.hofer.at führt v. a. Non-Food.' },
  { id: 'lidl', name: 'Lidl', group: 'discounter', coverage: 'offers-only', priceUrl: 'https://www.lidl.at/c/flugblatt/s10012330', loyalty: 'Lidl Plus', verified: false,
    note: 'Website zeigt Filialangebote und Flugblatt; keine Preisliste des Dauersortiments gefunden (auch nicht in Lidl Plus beschrieben). App-Preise (Lidl Plus) regional verschieden.' },
  { id: 'penny', name: 'PENNY', group: 'discounter', coverage: 'offers-only', loyalty: 'jö Bonus Club', verified: false,
    note: 'Angebotsseite mit Gültigkeit und Grundpreis; Kategorieseiten (z. B. penny.at/kategorie/getraenke-13024) zeigen Preise, ob auch Dauerpreise: prüfen.' },

  // Supermärkte
  { id: 'billa', name: 'BILLA / BILLA PLUS', group: 'supermarket', coverage: 'full', priceUrl: 'https://shop.billa.at/', loyalty: 'jö Bonus Club', stickers: true, verified: false,
    note: 'Online-Shop mit über 10.000 Artikeln, Preise wie in der Filiale (Presseberichte). Rabattmarkerl über jö.' },
  { id: 'spar', name: 'SPAR / EUROSPAR / INTERSPAR', group: 'supermarket', coverage: 'full', priceUrl: 'https://www.spar.at/produktwelt/lebensmittel', showsUnitPrice: true, loyalty: 'SPAR-App', stickers: true, verified: false,
    note: 'Produktwelt mit Preisen und Grundpreis; Aktionspreise und Verfügbarkeit je Markt laut INTERSPAR-Seite.' },
  { id: 'mpreis', name: 'MPREIS', group: 'supermarket', coverage: 'full', priceUrl: 'https://www.mpreis.at/shop', verified: false,
    note: 'Online-Shop zu Filialpreisen, v. a. Tirol (Presse, Produktseite gefunden).' },
  { id: 'adeg', name: 'ADEG', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Selbstständige Kaufleute; keine Online-Preise gefunden.' },
  { id: 'nahfrisch', name: 'Nah&Frisch', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Selbstständige Kaufleute; keine Online-Preise gefunden.' },
  { id: 'maximarkt', name: 'Maximarkt', group: 'supermarket', coverage: 'unknown', verified: false,
    note: 'Nicht geklärt.' },
  { id: 'unimarkt', name: 'Unimarkt', group: 'supermarket', coverage: 'excluded', verified: false,
    note: 'Laut Wikipedia 2025 geschlossen; vor Aufnahme bestätigen.' },

  // Drogerien
  { id: 'dm', name: 'dm drogerie markt', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.dm.at/', loyalty: 'dm-App', verified: false,
    note: 'Online-Shop mit Preisen; von Vergleichsportalen erfasst. Nicht direkt geprüft.' },
  { id: 'bipa', name: 'BIPA', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.bipa.at/', loyalty: 'jö Bonus Club', verified: false,
    note: 'Online-Shop mit Preisen; von Vergleichsportalen erfasst. Nicht direkt geprüft.' },
  { id: 'mueller', name: 'Müller', group: 'drugstore', coverage: 'full', priceUrl: 'https://www.mueller.at/', verified: false,
    note: 'Online-Shop mit Preisen; von Vergleichsportalen erfasst. Nicht direkt geprüft.' },

  // reine Online-Supermärkte (keine Filialen; Lieferkosten extra)
  { id: 'gurkerl', name: 'Gurkerl', group: 'online', coverage: 'full', priceUrl: 'https://www.gurkerl.at/', verified: false,
    note: 'Reiner Lieferdienst; Preise im Shop sichtbar. Keine Filiale, daher nicht in der Routenplanung.' },
  { id: 'alfies', name: 'Alfies', group: 'online', coverage: 'full', priceUrl: 'https://www.alfies.at/', verified: false,
    note: 'Reiner Lieferdienst (v. a. Wien); von Vergleichsportalen erfasst.' },
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
