# Marktrecherche: Welche Ketten haben ihre Preise online?

Stand 20.11.2026. Recherche über Websuche. Die Websites der Ketten selbst waren
aus der Arbeitsumgebung nicht erreichbar (Netzwerkfreigabe fehlt). Deshalb ist
nichts davon durch einen eigenen Abruf bestätigt. Der Code führt das als
`verified: false` (`lib/domain/directory.ts`).

## Ergebnis je Kette

| Kette | Gruppe | Online-Preise | Grundpreis | Kundenprogramm | Beleg |
|---|---|---|---|---|---|
| HOFER | Diskonter | Sortiment mit Preisen | ja | – | Suchtreffer hofer.at/produkte |
| Lidl | Diskonter | nur Aktionen / Flugblatt | ? | Lidl Plus | lidl.at, Vergleichsportale |
| PENNY | Diskonter | nur Aktionen | ? | jö | nur indirekt (Vergleichsportale) |
| BILLA / BILLA PLUS | Supermarkt | Online-Shop, > 10.000 Artikel, Filialpreise | ? | jö, Rabattmarkerl | Presse (REWE, 2025) |
| SPAR / EUROSPAR / INTERSPAR | Supermarkt | Produktwelt mit Preisen, Aktionen je Markt | ja | SPAR-App, Rabattmarkerl | spar.at, interspar.at |
| MPREIS | Supermarkt | Online-Shop zu Filialpreisen (Tirol) | ja | ? | Presse, Produktseite |
| dm, BIPA, Müller | Drogerie | Online-Shops mit Preisen | ? | dm-App, jö | indirekt (Vergleichsportale, AK Tirol) |
| Gurkerl, Alfies | nur online | Shop mit Preisen | ? | – | indirekt |
| ADEG, Nah&Frisch | Kaufleute | keine Online-Preise gefunden | | | → ausgegraut |
| Maximarkt | Supermarkt | ungeklärt | | | → ausgegraut |
| Unimarkt | Supermarkt | laut Wikipedia 2025 geschlossen | | | → nicht aufnehmen, bestätigen |

**Folgen für die App**

- Bei **Lidl und PENNY** gibt es online nur Aktionspreise. Ein Vergleich mit dem
  Dauersortiment ist dort nicht möglich. Die App zeigt diese Ketten trotzdem
  (Diskonter sind immer dabei), markiert aber: „nur Aktionsartikel verglichen“.
- **Lagerbestand je Filiale** ist bei keiner Kette als öffentlich belegt. SPAR
  nennt „Verfügbarkeit je Markt“ in der Produktwelt; das muss geprüft werden.
  Bis dahin gilt „laut Online-Shop verfügbar“, mit Hinweis.
- **Reine Online-Händler** haben keine Filiale und kommen nicht in die Route,
  nur als eigener Vergleich mit Lieferkosten.

## Was „sinnvoll“ ist: Prüfung der Wünsche

| Wunsch | Machbar? | Anmerkung |
|---|---|---|
| Alle Märkte mit Online-Preisen | ja | Liste oben; wöchentlich neu prüfen, ob Ketten dazukommen |
| Ganzes Sortiment ins Verzeichnis | ja, für Ketten mit „Sortiment online“ | Lidl/PENNY nur Aktionen |
| Täglich aktualisieren | ja | eigener Server-Job, siehe unten |
| Preis + Angebote berücksichtigen | ja | 1+1, −x % ab n Stk: in `compare.ts` |
| Kundenkarten-Rabatte, wenn man Anspruch hat | ja | Nutzer gibt seine Programme an |
| Rabattmarkerl | ja | wird abgefragt, nie automatisch abgezogen |
| Radius / bestimmte Märkte | ja | `retailers.ts` |
| Lagerbestand bei gewählten Märkten | **eingeschränkt** | Filialbestand meist nicht öffentlich |
| Bio / Gütesiegel je Artikel oder Korb | ja, **wenn die Kette das Siegel in den Daten führt** | sonst Abgleich über Produktname/Marke, fehleranfällig |
| Marke festlegen | ja | |
| Mengen-Vergleich (6 Eier ≠ 10 Eier) | ja | genaue Packungsgröße, sonst Grundpreis |

## Rechtliches, vor dem Live-Betrieb klären

Für den Prototyp reichen Beispieldaten. Für den echten Betrieb:

- **Nutzungsbedingungen und robots.txt** jeder Kette (konnten nicht gelesen werden).
- **Datenbankschutz** (§ 76c UrhG): Das automatische Übernehmen eines
  wesentlichen Teils einer Datenbank kann unzulässig sein. Mehrere österreichische
  Vergleichsportale tun es offenbar seit Jahren (z. B. heisse-preise.io,
  Preisrunter, Sparkorb), das ist aber keine Rechtssicherheit.
- **Alternative:** Statistik Austria betreibt seit Jänner 2026 den „Preisradar“
  (rund 100 Lebensmittel, Durchschnittspreise, nicht je Kette). Eine zentrale
  Preistransparenz-Datenbank ist beschlossen. Sobald sie Preise je Kette
  öffentlich macht, wäre sie die sauberste Quelle.
- Empfehlung: Anwalt bzw. WKO-Beratung, und bei den Ketten direkt um einen
  Datenzugang anfragen.

## Täglicher Abgleich (Plan)

1. Ein Server-Job läuft einmal täglich früh morgens (Aktionen wechseln meist
   Montag/Donnerstag).
2. Je Kette ein Adapter: liest Preise, Aktionen, Grundpreis, Siegel und Packung,
   schreibt `ShelfOffer`-Datensätze mit `seenAt` und `source`.
3. Plausibilitätsprüfung: Preis um mehr als 50 % geändert, Grundpreis passt
   nicht zur Packung, Siegel verschwunden → Datensatz zurückhalten, nicht anzeigen.
4. Die App zeigt bei jedem Preis das Datum („Preis vom 20.11.“).
5. Fällt eine Kette aus, bleibt ihr letzter Stand höchstens 2 Tage sichtbar,
   danach ausgegraut.

## Offen

- Netzwerkfreigabe für die Websites der Ketten, um die Tabelle oben zu bestätigen.
- Welche Siegel die Ketten in ihren Produktdaten führen.
- Ob SPARs „Verfügbarkeit je Markt“ öffentlich abrufbar ist.

## Quellen

- https://www.hofer.at/produkte
- https://shop.hofer.at/alle-produkte
- https://www.lidl.at/c/flugblatt/s10012330
- https://rewe-group.at/en/newsroom/2025/10/top-marks-for-billa-online-shop-in-oegvs-test
- https://www.spar.at/produktwelt/lebensmittel
- https://www.interspar.at/shop/lebensmittel/
- https://www.mpreis.at/shop/p/hoertnagl-gurkerl-extra-premium-33064
- https://www.meinbezirk.at/innsbruck/c-wirtschaft/auch-in-tirol-per-mausklick-zum-einkaufswagen_a1612059
- https://tirol.orf.at/stories/3377271/
- https://www.ifun.de/heisse-preise-io-lebensmittelpreise-im-zeitlichen-verlauf-225020/
- https://github.com/zickb/heissepreise
- https://sparkorb.at/
- https://produktangel.at/
- https://en.wikipedia.org/wiki/List_of_supermarket_chains_in_Austria
- https://orf.at/stories/3417575/
- https://www.5min.at/oesterreich/5202601112304/muessen-supermaerkte-ihre-preise-bald-taeglich-melden/
