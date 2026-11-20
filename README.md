# Bodega Prototype

Zweiter Prototyp. Keine Einkaufsfunktion: Gerichte, Feed, geteilte Listen,
Rechnung teilen und ein Preisvergleich über die Märkte in der Nähe.

## Stand

- `lib/domain/retailers.ts` — Preisvergleich: günstigster Einzelmarkt, bester
  Preis je Artikel, Route über höchstens N Märkte im gewählten Umkreis,
  Markenbindung und Rabattmarkerl, die erst nach Bestätigung abgezogen werden.
  Alle Preise sind Beispielwerte (`PRICES_ARE_EXAMPLES`).
- `lib/domain/compare.ts` — welches Angebot zu einer Listenzeile passt: genaue
  Packungsgröße, wenn eine Menge genannt ist, sonst günstigster Grundpreis
  (kg, l, Stk); Marke, Gütesiegel, Mengenaktionen (1+1, −x % ab n Stk) mit
  Hinweis, Kundenkarten-Preise nur mit Mitgliedschaft, Rabattmarkerl nur nach
  Rückfrage. Prüfungen: `node --experimental-strip-types lib/domain/__checks__/compare.check.ts`
- `lib/domain/directory.ts` — Verzeichnis der Ketten mit Online-Preisen
  (Recherche in `docs/marktrecherche.md`, noch nicht per Abruf bestätigt).
- `design/layouts.html` — drei Layout-Entwürfe zum Öffnen im Browser.

## Geplant

Rezepte mit Bewertung und Kommentaren · Feed (Trending, Regional, Neu; Bilder)
· geteilte Einkaufsliste · Rechnung teilen mit Bon-Scan · Beträge anfordern per IBAN-QR, PayPal.me, später Wero
(kein Geld fließt durch die App)
· Foto zu Rezept (Premium, mit Rückfrage vor dem Speichern).
