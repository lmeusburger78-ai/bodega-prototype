# Produktzuordnung über Ketten hinweg

Frage: Ist „Rummo Spaghetti n.3 500 g“ bei BILLA dasselbe Produkt wie bei SPAR?
Ohne Strichcode (EAN) geht das nur über Marke, Name und Packung. Das ist fehleranfällig,
deshalb gibt es mehrere Schichten, und unsichere Fälle werden nie stillschweigend übernommen.

## Zwei Beziehungen, weil Nutzer zwei Dinge fragen

| | Wofür | Regel |
|---|---|---|
| **identisch** | Marke festgelegt („Rummo“) | gleiche Marke (keine Eigenmarke), gleiche Packung, ähnlicher Name. Mit Strichcode auf beiden Seiten: exakt. |
| **vergleichbar** | „egal, günstigste“ („Spaghetti 500 g“, „6 Eier“) | Name ähnlich, Packung im selben Größenband, Bio nie mit Nicht-Bio. Eigenmarken gehören hierher: „Clever“ ist nie identisch mit „S-Budget“, aber vergleichbar. |

Feste Regeln, nie gelockert: andere Packung ist nie identisch; Bio nie mit Nicht-Bio;
ein unsicheres Paar kommt in die **Prüfliste** (`review`), nicht ins Ergebnis;
dieselbe Kette wird nie mit sich selbst gepaart.

## Schichten

1. **Strichcode**, wo die Seite ihn zeigt. Gefunden: dm zeigt die GTIN auf der Detailseite
   („GTIN 4262459494441“). In den Listenseiten von BILLA, PENNY und MPREIS stand keine, in den
   Detailseiten von BILLA und PENNY auch nicht. Bei MPREIS konnte ich die Detailseite nicht laden.
2. **Marke + Name + Packung** (`lib/match/match.ts`): Name ohne Marke und Größenangaben,
   Wortstämme, Ähnlichkeit nach Dice. „Sicher“ nur bei gleichem Namen oder einem Zusatzwort bei
   mindestens drei Wörtern. „Asia Noodles“ gegen „Asia Noodles Huhn“ kann eine andere Sorte sein
   und geht deshalb zur Prüfung. Das Markenwörterbuch lernt aus den Daten selbst (jede Zeile mit
   Marke), Eigenmarken stehen in `PRIVATE_LABELS`.
3. **Entscheidungen von Hand** (`data/matches/decisions.json`): „gleich“ oder „verschieden“ je
   Paar. Gelten dauerhaft und schlagen die Regeln. Je mehr geprüft wird, desto weniger bleibt offen.
4. **Strichcodes sammeln**: Der geplante Bon-Scan und ein Barcode-Scan im Markt liefern die
   Zuordnung Regalartikel ↔ EAN direkt von den Nutzern. Das ist die Lösung, die mit der App wächst.
5. **Weitere Quellen, nicht geprüft**: Open Food Facts (offene Strichcode-Datenbank; mein
   Abruf blieb leer, also unbestätigt), die GS1-Datenbank (Strichcode-Verwalter), ein Datenzugang
   der Ketten oder von Preisrunter.

## Wie gut ist es? (ehrlich)

Messung am Datenstand 20.11.2026: 1.277 Artikel aus 5 Ketten, 17 identische Paare (davon 8 zur
Prüfung) und 30 vergleichbare. Die Zahl ist klein, weil die Kategorien der Ketten nur wenig
überlappen (BILLA/PENNY/MPREIS-Auszug). Eine Aussage über das ganze Sortiment ist damit **nicht** möglich:
Es gibt noch keine von Hand geprüfte Vergleichsmenge. Geprüft ist: jede Regel mit echten
Beispielen (`lib/domain/__checks__/match.check.ts`) und eine Stichprobe der Ausgabe von Hand.
Beim Bauen hat die Prüfung einen echten Fehler gefunden (Umlaute wurden zerlegt, „natürlich“ → „natu rlich“).

Nächster Schritt für belastbare Zahlen: 200 zufällige Paare von Hand beurteilen und daraus
Genauigkeit und Trefferquote ausrechnen. Erst dann sind die Schwellen (0,6 / 0,7) begründet.

## Eigenmarken-Äquivalenz

Wer „Nudeln“ ohne Marke wählt, bekommt den günstigsten Grundpreis aus der Gruppe der vergleichbaren
Artikel. Die Gruppe wird nach Packung und Bio gebildet, nicht nach Marke.
