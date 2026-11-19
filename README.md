# Bodega Prototype

Zweiter Prototyp. Keine Einkaufsfunktion: Gerichte, Feed, geteilte Listen,
Rechnung teilen und ein Preisvergleich über die Märkte in der Nähe.

## Stand

- `lib/domain/retailers.ts` — Preisvergleich: günstigster Einzelmarkt, bester
  Preis je Artikel, Route über höchstens N Märkte im gewählten Umkreis,
  Markenbindung und Rabattmarkerl, die erst nach Bestätigung abgezogen werden.
  Alle Preise sind Beispielwerte (`PRICES_ARE_EXAMPLES`).
- `design/layouts.html` — drei Layout-Entwürfe zum Öffnen im Browser.

## Geplant

Rezepte mit Bewertung und Kommentaren · Feed (Trending, Regional, Neu; Bilder)
· geteilte Einkaufsliste · Rechnung teilen mit Bon-Scan · Apple Pay und PayPal
· Foto zu Rezept (Premium, mit Rückfrage vor dem Speichern).
