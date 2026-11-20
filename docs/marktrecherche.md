# Marktrecherche: Welche Ketten haben ihre Preise online?

Stand 20.11.2026. Recherche über Websuche. Die Websites der Ketten selbst waren
aus der Arbeitsumgebung nicht erreichbar (Netzwerkfreigabe fehlt). Deshalb ist
nichts davon durch einen eigenen Abruf bestätigt. Der Code führt das als
`verified: false` (`lib/domain/directory.ts`).

## Ergebnis je Kette

| Kette | Gruppe | Online-Preise | Grundpreis | Kundenprogramm | Beleg |
|---|---|---|---|---|---|
| HOFER | Diskonter | **nicht bestätigt** (Seite gesperrt) | ? | – | Suchtreffer, Abruf 403 |
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
| Täglich Preise, monatlich Sortiment und Filialen | ja | eigener Server-Job, siehe unten |
| Preis + Angebote berücksichtigen | ja | Mengenaktion wird nur eingerechnet, wenn die Menge im Einkaufswagen sie erfüllt; sonst nur Hinweis |
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

## Abgleich: täglich und monatlich

**Täglich** (früh morgens): Preise, Aktionen, Mengenaktionen, Kundenkarten-Preise,
Rabattmarkerl. Jeder Preis wird als Datensatz abgelegt (`lib/domain/history.ts`):
`data/prices/JJJJ-MM-TT.jsonl`, eine Zeile je Artikel und Kette mit Preis,
Streichpreis, Aktionstext der Kette, Packung, Siegel, Quelle. Nichts wird
überschrieben, jeder Tag bleibt nachvollziehbar.

**Monatlich**: ganzes Sortiment und Filialliste je Kette. Ergebnis: neue und
ausgelistete Artikel, neu eröffnete und geschlossene Filialen (`diffAssortment`).

**Erklärung bei Preisänderungen** (`explainChanges`), geprüft in dieser Reihenfolge:

1. Aktionstext oder Streichpreis der Kette selbst
2. neue Mengenaktion (1+1, −x % ab n Stk)
3. Aktion ausgelaufen (Preis steigt zurück)
4. Kampagne der Kette: mindestens 5 Artikel einer Marke am selben Tag um denselben
   Prozentsatz („−25 % auf alle Ja! Natürlich“)
5. Mehrwertsteuer: Steuersatz geändert, oder Artikel bei 3 oder mehr Ketten am
   selben Tag um denselben Faktor
6. Packung kleiner oder größer bei gleichem Preis (Shrinkflation)
7. dauerhafte Preissenkung, die die Kette bewirbt („dauerhaft günstiger“)
8. sonst: „unerklärt“, zur Prüfung durch einen Menschen

Eine automatische Websuche je Preisänderung wäre bei zehntausenden Artikeln zu
teuer und unzuverlässig. Die Erklärung kommt deshalb aus den Daten selbst. Nur die
unerklärten Fälle werden gesammelt und gezielt nachrecherchiert.

**Plausibilität**: Preis um mehr als 50 % geändert ohne Aktionskennzeichen, oder
Preis 0 → Datensatz zurückhalten, nicht anzeigen. Fällt eine Kette aus, bleibt ihr
letzter Stand höchstens 2 Tage sichtbar, mit Datum.

## Kennzeichnung in der App

| Fall | Anzeige |
|---|---|
| Preis da, Filiale bestätigt | „in der Filiale verfügbar“ |
| Preis da, nur Online-Shop | „laut Online-Shop verfügbar, Filiale nicht bestätigt“ |
| Preis da, keine Bestandsangabe | „Preis bekannt, Verfügbarkeit nicht bestätigt“ |
| Lidl/PENNY, Artikel nicht in Aktion | „kein Online-Preis: diese Kette veröffentlicht nur Aktionen“ |
| Kette mit Vollsortiment, Artikel fehlt | „nicht im Sortiment“ |

Hat der Nutzer Märkte selbst ausgewählt, wird ein Angebot ohne bestätigte
Verfügbarkeit nicht in die Route eingerechnet, sondern mit dem Grund angezeigt.
So landet niemand in einem Markt, der den Artikel womöglich nicht hat.

## Wie macht das heisse-preise.io?

Laut Projektbeschreibung holt es die Daten täglich von den Websites bzw.
Online-Shops der Ketten, also dieselben Quellen wie oben. Lidl und PENNY
veröffentlichen kein Vollsortiment mit Preisen, deshalb zeigt auch
heisse-preise.io dort nur Aktionsangebote. Die Einschränkung liegt also bei den
Ketten, nicht bei der Technik.

## Lidl und PENNY: reguläre Preise

- **Lidl**: keine Preisliste des Dauersortiments gefunden, weder auf lidl.at noch
  in der Beschreibung von Lidl Plus. Online stehen Flugblatt und Filialangebote;
  Lidl-Plus-Rabatte wechseln Montag und Donnerstag.
- **PENNY**: neben der Angebotsseite gibt es Kategorieseiten mit Preisen und
  Grundpreis (z. B. Getränke). Ob dort auch Artikel ohne Aktion stehen, muss ein
  Abruf der Seite zeigen.
- **Ersatz**: In der Aktion zeigt die Kette den Normalpreis als Streichpreis. Den
  speichern wir (`lastRegularPrice`) und vergleichen damit weiter, gekennzeichnet
  als „Normalpreis zuletzt gesehen am …“. Ältere Werte als 60 Tage verfallen.

## Filialen

Je Filiale: genaue Adresse, Koordinaten, Öffnungszeiten, Feiertage
(`lib/domain/stores.ts`). Quelle ist die Filialsuche der Kette, geprüft im
Monatsabgleich. Daraus:

- „geöffnet bis 20:00“ / „öffnet um 7:15“ / „heute geschlossen“
- Gehzeit (vorerst geschätzt, „ca.“), Route als Link zu Google Maps mit allen
  Stopps; später echte Gehzeit über einen Routing-Dienst (Google Routes API oder
  OpenStreetMap-basiert, Kosten offen)
- Warnung, wenn ein Markt der Route bei Ankunft schon zu hat

## Einkaufen: Abhaken und Ersparnis

Im Markt hakt man ab, was im Korb liegt; offene Artikel stehen je Markt oben
(`lib/domain/trip.ts`). Jede Zeile führt Normalpreis und bezahlten Preis. Am
Ende: Summe zum Normalpreis, bezahlt, gespart, und wofür (Aktion, 1+1,
Rabattmarkerl, Kundenkarte).

## Preise für einen anderen Tag dieser Woche

Wählbar ist heute bis Sonntag (`selectableDays`). Für einen späteren Tag gilt:
der heutige Normalpreis, plus alle Aktionen, die für diesen Tag angekündigt sind
(Flugblatt, Website, App). Angezeigt als Prognose („voraussichtlich“).

**Kleingedrucktes** wird je Aktion erfasst (`lib/domain/offers.ts`):
nur bestimmte Wochentage, nur mit Kundenkarte, max. Stückzahl, nicht in
bestimmten Filialen, ausgenommene Waren, solange der Vorrat reicht. Die App
rechnet die Aktion nur ein, wenn die Bedingungen erfüllt sind, und zeigt sie
immer dazu an.

**Flugblätter** sind meist PDF oder Bild. Sie werden beim Erscheinen gelesen
(Text, notfalls Texterkennung) und jeder Aktion zugeordnet, mit Seite als
Quelle. Bis ein Mensch Preis, Datum und Kleingedrucktes gegen das Flugblatt
geprüft hat, steht „noch nicht geprüft“ dabei. Automatische Prüfungen
(`promoProblems`): Ende vor Beginn, Aktionspreis nicht unter Normalpreis,
unplausibler Rabatt, fehlendes Kleingedrucktes, keine Artikel zugeordnet.

## Preisverlauf

Wird täglich vollständig dokumentiert, ist aber **vorerst nur intern**
(`HISTORY_VISIBLE_TO_USERS = false`): für Plausibilität, Erklärung von
Änderungen und den Normalpreis bei Lidl/PENNY. Ob Nutzer ihn sehen, ist offen.

## Datenstand 20.11.2026 (erster Lauf)

`data/prices/2026-11-20.jsonl`: **1.277 Artikel** aus ausgewählten Kategorien
(kein Vollabzug). Bei jeder Zeile stehen Quelle (Seite) und Tag.

| Kette | Artikel | Besonderes |
|---|---|---|
| BILLA | 748 | 220 Mengenaktionen ("ab 2 Packungen 2,69 € statt 3,99 €"), aus `/aktionen` und 4 Kategorien |
| PENNY | 324 | alle mit Aktionszeitraum, 185 erst ab nächster Woche gültig, 86 mit Streichpreis, 22 mit Mindestmenge |
| MPREIS | 132 | 30 mit Streichpreis, 10 mit Mindestmenge ("Bei 2 Stk. je") |
| dm | 61 | nur Startseite (überwiegend Technik und Geschenksets) |
| Lidl | 12 | 3 Kategorien, alles Aktionsware mit Zeitraum, 6 erst später gültig |

**Gegenprobe:** Jede Zeile wird gegen sich selbst geprüft (Grundpreis muss zu
Preis ÷ Packung passen, Streichpreis über Aktionspreis, Aktionsende nach Beginn).
Beim ersten Lauf waren 44 Zeilen auffällig. Ursachen waren Lesefehler (lose Ware
"je 100 g", Mehrfachpackungen "4x 185 g", "1 000 g") und Eigenheiten der Seiten
(MPREIS beschriftet kg-Packungen mit "/Stk"). Nach den Korrekturen bleibt **ein**
Fall übrig, und der ist ein Fehler im dm-Shop: Der Protein-Cookie (50 g) steht dort
mit Grundpreis "50 kg (0,03 € je 1 kg)".

**Nicht im Datenstand:** SPAR, HOFER, Müller, Gurkerl (gesperrt), BIPA und Alfies
(noch nicht lesbar), und von den gelesenen Ketten nur der Teil der Kategorien aus
`tools/ingest.mts`. Artikelnummern zeigt keine Seite im Text, `sku` ist deshalb aus
Marke, Name und Packung gebildet.

## Wie Preisrunter das macht (Stand 20.11.2026, nach deren eigenen Angaben)

- Preisrunter nennt als Grundlage „Preisdaten, die von Händlern bzw. deren technischen
  Schnittstellen übermittelt wurden“. Es hat Händler, die mich als Programm sperren
  (SPAR, HOFER, Müller), und etwa 20 Märkte in Österreich plus Deutschland. Daraus
  schließe ich, dass die Daten nicht nur aus dem Auslesen öffentlicher Seiten kommen.
  Wie genau, steht dort nicht.
- Es verkauft den Zugang als API (`preisrunter.at/api/`): kostenlos nur für bis zu
  10 festgelegte Produkte, Research (nicht kommerziell) kostenlos auf Anfrage,
  **Starter 49 €/Monat (10.000 Preisabfragen)**, **Business 349 €/Monat (100.000)**, Enterprise
  auf Anfrage. Ein Credit je Produktpreis. Vollständiger Export nur auf Anfrage.

## dm: was möglich ist

- Die Sitemap (robots.txt erlaubt sie) listet **6.235 Produktseiten** und **376 Filialen**
  mit Adresse. Die Preise stehen aber nicht im HTML, sie werden per Skript nachgeladen.
  Ein Vollabzug braucht je Produkt einen Browser-Abruf, rund 3 Stunden: nur als
  nächtlicher Job sinnvoll. Der erste Lauf hat nur die Startseite gelesen (61 Artikel).

## Offen

- Seiten mit nachgeladenen Preisen (dm, BIPA, Alfies, Lidl, SPAR) per Browser prüfen.
- Datenzugang bei SPAR, HOFER, Müller, Gurkerl anfragen.
- Welche Siegel die Ketten in ihren Produktdaten führen.
- Ob SPARs „Verfügbarkeit je Markt“ öffentlich abrufbar ist.

## Quellen

- https://www.lidl.at/c/lidl-plus/s10012352
- https://www.penny.at/angebote
- https://www.penny.at/kategorie/getraenke-13024

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
