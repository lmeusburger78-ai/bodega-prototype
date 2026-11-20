// Run: node --experimental-strip-types lib/domain/__checks__/ingest.check.ts
// Cases are real page texts from 20.11.2026 that once went wrong.
import assert from 'node:assert/strict'
import { parseWsCard, parseLidlText, parseMpreisText, parseDmText, packFrom, checkObservation } from '../../ingest/parse.ts'

const ctx = { date: '2026-11-20', source: 'test' }

// PENNY: promo with period and minimum quantity
let o = parseWsCard(['Helles • Ottakringer', '0,33 liter Flasche', 'von Do 19.11.2026', 'bis Mi 25.11.2026', 'ab 24 Flaschen', '0,69 €', '500 ml 1,05 €', 'Monarch'], 'penny', ctx)!
assert.deepEqual([o.price, o.minQty, o.promoFrom, o.promoUntil, o.pack.value], [0.69, 24, '2026-11-19', '2026-11-25', 0.33])
// PENNY: strike price
o = parseWsCard(['Präsident • Julius Meinl', '500 g Packung', 'von Do 19.11.2026', 'bis Mi 25.11.2026', '7,99 €', '11,99 €', '1 kg 15,98 €'], 'penny', ctx)!
assert.deepEqual([o.price, o.wasPrice], [7.99, 11.99])
// PENNY: loose goods, "1 kg" shown but the price is per 100 g
o = parseWsCard(['Rauchfleisch • Ich bin Österreich', '1 kg', 'von Do 19.11.2026', 'bis Mi 25.11.2026', '0,80 €', '100 g 0,80 €', 'Ungarische Salami'], 'penny', ctx)!
assert.deepEqual(o.pack, { value: 0.1, unit: 'kg' }); assert.equal(checkObservation(o), null)
// footnote marks are not part of the name
assert.equal(parseWsCard(['Frische Forelle*', '1 kg Stück', '1,00 €', '100 g 1,00 €'], 'penny', ctx)!.name, 'Frische Forelle')
// BILLA: loose per kg, packaged with unit price
o = parseWsCard(['Ja! Natürlich Bananen', 'Ab 0,5 kg', '2,29 €', '2', '29 €', 'per 1 kg'], 'billa', ctx)!
assert.deepEqual([o.price, o.pack], [2.29, { value: 1, unit: 'kg' }])
o = parseWsCard(['Ja! Natürlich Maroni gegart', '100 g Packung', '1,99 €', '1', '99 €', '1 kg 19,90 €'], 'billa', ctx)!
assert.equal(o.unitPrice!.price, 19.9); assert.equal(checkObservation(o), null)

// BILLA multi-buy: single price 3,99, from 2 packs 2,69 each
o = parseWsCard(['Wagner Piccolinis Drei-Käse', '270 g Packung', 'Einzelpreis', '3,99 €', '1 kg 14,78 €', 'ab 2 Packungen', '2,69 €', '2', '69 €', '1 kg 9,96 €', 'Wagner Steinofen Pizza Salami'], 'billa', ctx)!
assert.deepEqual([o.price, o.deal], [3.99, { kind: 'price-from', from: 2, price: 2.69 }]); assert.equal(o.unitPrice!.price, 14.78)
o = parseWsCard(['nöm PRO Vanille Proteindrink', '330 ml Flasche', 'Einweg', 'Einzelpreis', '2,29 €', '1 Liter 6,94 €', 'Bei 4 Flaschen je', '1,14 €', '1', '14 €'], 'billa', ctx)!
assert.deepEqual(o.deal, { kind: 'price-from', from: 4, price: 1.14 })
o = parseWsCard(['BILLA Kaki', '1 stk', 'Einzelpreis', '0,99 €', 'ab 2 Stk', '0,79 €', '0', '79 €'], 'billa', ctx)!
assert.deepEqual([o.price, o.deal!.price], [0.99, 0.79])
o = parseWsCard(['Ariel Waschmittel', '25 Waschgang Flasche', 'Einzelpreis', '8,49 €', '1 Waschgang 0,34 €', 'ab 2 Flaschen', '6,99 €', '6', '99 €', '1 Waschgang 0,28 €'], 'billa', ctx)!
assert.equal(o.deal!.price, 6.99); assert.equal(checkObservation(o), null)

// BILLA: "1 000 g" with a space
o = parseWsCard(['Clever Faschiertes Gemischt', '1 000 g Tasse', '8,49 €', '8', '49 €', '1 kg 8,49 €'], 'billa', ctx)!
assert.deepEqual(o.pack, { value: 1, unit: 'kg' }); assert.equal(checkObservation(o), null)

// LIDL: badge line between name and price, multipack
let L = parseLidlText(['Thunfischfilets für 4.79 EUR', 'Nixe', 'Thunfischfilets', 'Aktion', '4.79€*', 'Je 4x 185 g', '1 kg = 6.47', 'in der Filiale 19.11. - 21.11.'].join('\n'), ctx)
assert.deepEqual([L[0].name, L[0].brand, L[0].pack.value, L[0].promoUntil], ['Thunfischfilets', 'Nixe', 0.74, '2026-11-21']); assert.equal(checkObservation(L[0]), null)

// MPREIS: "/Stk" on a kg pack is dropped; "statt" equal to the price is no discount; "/0,5l" unit
let M = parseMpreisText(['M-BIO', 'BIO Clementinen', '1kg', '2,99', '2,99 € /Stk', 'Verfügbarkeit in deinem Markt prüfen'].join('\n'), ctx)
assert.equal(M[0].unitPrice, undefined); assert.equal(checkObservation(M[0]), null)
M = parseMpreisText(['Zipfer', 'Märzen 20x 0,5 Liter', '10000ml', 'zzgl. 7,00 € Pfand | Mehrweg', 'Aktueller Preis 14,80 €, statt 14,80 €', '14,80', '0,74 € /0,5l', 'Verfügbarkeit in deinem Markt prüfen'].join('\n'), ctx)
assert.equal(M[0].wasPrice, undefined); assert.equal(M[0].pack.value, 10); assert.equal(checkObservation(M[0]), null)

// DM: pack from the name, legal category removed, Wl = wash loads, real error on dm's side is caught
let D = parseDmText('Marke: Mivolis; Produktname: Nasenspray Abschwellend, 20 ml; Rechtliche Kategorie: Medizinprodukt; Preis: 2,95 €; Grundpreis: 0,02 l (147,50 € je 1 l); Neu Grafik', ctx)
assert.deepEqual([D[0].name, D[0].pack.value, D[0].pack.unit], ['Nasenspray Abschwellend', 0.02, 'l']); assert.equal(checkObservation(D[0]), null)
D = parseDmText('Marke: Frosch baby; Produktname: Weichspüler Baby Sensitiv, 45 Wl, 900 ml; Preis: 2,95 €; Grundpreis: 45 Wl (0,07 € je 1 Wl); Neu', ctx)
assert.equal(D[0].name, 'Weichspüler Baby Sensitiv'); assert.equal(D[0].pack.unit, 'l')
D = parseDmText('Marke: Sportness; Produktname: Protein Cookie Soft Lebkuchen, 50 g; Preis: 1,45 €; Grundpreis: 50 kg (0,03 € je 1 kg); x', ctx)
assert.match(checkObservation(D[0])!, /passt nicht/) // dm shows "50 kg" for a 50 g cookie

assert.deepEqual(packFrom('4x 185 g')!.pack, { value: 0.74, unit: 'kg' })
console.log('ingest: alle Prüfungen bestanden')
