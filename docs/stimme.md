# Die Stimme von Smart-Tok

> Du wirst nicht als der Mann geboren, der du sein willst. Du musst ihn bauen.

Smart-Tok ist für Männer, die an sich arbeiten. Jede Karte dient einem Ziel: **Charakter aufbauen**, also Disziplin, Selbstbeherrschung, Mut, Klarheit, Verantwortung und mentale Härte. Nichts davon ist angeboren. Alles davon lässt sich trainieren, Tag für Tag.

Das Leitbild: Batman hat keine Superkräfte. Er ist reich, aber dafür bewundert ihn niemand. Bewundert wird, was er sich selbst erarbeitet hat: Mut, Disziplin, Wissen und einen Willen, der nicht bricht. Er hat seinen Schmerz in einen Auftrag verwandelt. Genau diese Haltung trägt die App.

## Haltung

- **Aufbauen statt jammern.** Jede Karte zeigt, was du selbst in der Hand hast. Ausreden, Opferrolle und Schuldzuweisungen haben keinen Platz.
- **Disziplin vor Motivation.** Motivation kommt und geht. Wer handelt, wenn er keine Lust hat, baut Charakter.
- **Schmerz wird Sinn.** Rückschläge, Verluste und Fehler sind Rohmaterial. Die Frage ist nicht „Warum ich?“, sondern „Was mache ich daraus?“.
- **Stärke heisst Kontrolle.** Stark ist, wer sich selbst beherrscht: Wut, Bequemlichkeit, Ablenkung. Nicht, wer am lautesten ist.
- **Verantwortung.** Für dein Leben, deine Familie, dein Wort und die Menschen, die sich auf dich verlassen.
- **Sinn.** Ein Mann braucht etwas, wofür er aufsteht. Geld, Status und Aussehen sind Mittel, nie das Ziel.

## Ton

- Direkt, in der Du-Form, ruhig und sicher. Wie ein älterer Bruder oder ein guter Trainer: fordernd, aber auf deiner Seite.
- Kurze, klare Sätze. Keine Floskeln, kein Hype, kein Kitsch.
- **Nie** abwertend gegenüber Frauen, Schwächeren oder anderen Männern. Männlichkeit zeigt sich in Schutz, Respekt und Haltung, nicht in Härte gegen andere.
- Kein Macho-Gehabe, keine Alpha-Sprüche, keine Fantasie-Versprechen („in 7 Tagen ein neuer Mensch“).

## Aufbau einer Karte

1. **Titel**: eine klare Aussage oder ein Versprechen, höchstens 9 Wörter.
2. **Einstieg**: ein Satz, der trifft. Eine Situation, die jeder Mann kennt, oder eine harte Wahrheit.
3. **Kern** (`body`): das Wissen, belegt und korrekt. Zahlen, Studien und Zitate mit Quelle. Gliederung für einen übersichtlichen Text:
   - kurze Absätze (die App teilt Absätze über rund 40 Wörtern automatisch);
   - `## ` setzt eine Zwischenüberschrift, gut bei langen Karten;
   - `> ` macht einen **Kernsatz**: der eine Satz zum Merken, hervorgehoben. Höchstens zwei pro Karte;
   - Zeilen mit `- ` werden eine Aufzählung;
   - `---` erzwingt eine neue Seite, nur wenn es wirklich nötig ist.
4. **Beispiel** (`example`, optional): eine konkrete Szene aus dem Alltag, wenn sie das Prinzip greifbarer macht. Lieber ein gutes Beispiel als drei Absätze Theorie.
5. **Abschluss** (`act` mit `actKind`): passt zum Inhalt, nicht jede Karte ist eine Aufgabe für heute.
   - `heute`: Heute anwenden. Eine konkrete Aufgabe, machbar und unbequem genug, dass sie etwas aufbaut.
   - `so`: So wendest du es an. Schritte; jede Zeile mit `- ` wird ein nummerierter Schritt.
   - `achte`: Achte darauf. Woran man es im Alltag erkennt.
   - `langfristig`: Über längere Zeit. Eine Gewohnheit über Wochen.
   - `merke`: Merk dir. Der Kern in ein bis zwei Sätzen, gut für Fakten.
   - `frage`: Frag dich. Eine ehrliche Frage zum Nachdenken.
   - `gebet`: Im Gebet. Für Glaubenskarten.
6. **Genauer betrachtet** (`deep`, optional): Hintergrund für alle, die mehr wissen wollen. Steht auf den letzten Seiten.

Die App teilt jede Karte in Seiten, die ohne Scrollen auf den Bildschirm passen; weiter geht es mit einem Wisch zur Seite. Es gibt keine feste Länge: Ein Fakt passt auf eine Seite, eine Geschichte mit Hintergrund braucht drei bis fünf, ein Grundlagenthema (z. B. „Die Komfort-Falle“) auch sechs bis acht. Ziel ist Lernen, nicht Länge: kurz, wo kurz reicht, ausführlich, wo es mehr Erklärung oder Beispiele braucht.

**Geschichte, Parallele, Prinzip**: Eine starke Form ist eine überraschende wahre Geschichte (Alcatraz, Biosphere 2), dann eine Parallele aus Mythos, Bibel oder Geschichte (Odysseus bei Kalypso), dann das Prinzip in einem Kernsatz. Legenden werden als solche benannt („erzählt man sich“, „ist nicht belegt“). Diese Form ist der Standard für Karten über Haltung, Charakter und Glauben: wo es eine starke wahre Geschichte gibt, wird sie erzählt. Reine Fakten- und Tipp-Karten dürfen kurz bleiben.

Was der Leser umsetzen will, legt er mit „Umsetzen“ auf seine Liste. Die App fragt nach 2, 7 und 17 Tagen nach, ob er es getan hat. Der Abschluss soll darum so formuliert sein, dass man ihn wirklich tun und abhaken kann.

## Grafiken

Wo ein Bild schneller erklärt als ein Absatz (Abläufe, Kreisläufe, Kurven, Vergleiche, Aufbau), bekommt die Karte eine Grafik. Sonst nicht.

Es gibt zwei Arten:

- **Diagramme aus Vorlagen** (Abläufe, Ketten, Vergleiche, Zahlen, Kurven): `content/figures/<name>.json` mit `type` `flow` (Ablauf mit Abzweigung), `chain` (Prozesskette in Zeilen), `compare` (Spalten nebeneinander), `bars` (Zahlen vergleichen), `timeline` (Daten der Reihe nach) oder `curve` (Verlauf über Zeit). `npm run figures` zeichnet daraus die SVG. Beispiele: `gesetz-schweiz.json`, `passwort-hash.json`, `anleihe-zins.json`, `muskel-aufbau.json`. Texte als `"Deutsch|English"`. Im Text: `[[fig:name]]`.
- **Illustrationen aus Code** (Wellen, Himmel, Erdachse, Punkteraster, Schlösser): in `src/figures/index.ts` aus den Bausteinen in `src/figures/kit.ts`, dürfen sich bewegen, wo Bewegung etwas erklärt. Im Text: `[[grafik:id]]`.
- Zuerst eine Vorlage prüfen, sie ist am günstigsten. Eine Illustration nur, wenn kein Diagramm passt.
- Clean und übersichtlich: eine Aussage pro Grafik, wenige Wörter, nichts doppelt, was der Text schon sagt.
- Ein Absatz `[[fig:name]]` oder `[[grafik:id]]` setzt die Grafik an diese Stelle im Text, direkt nach dem Absatz, den sie zeigt. `[[fig:name|full|Bildunterschrift]]` (oder eine Illustration allein zwischen zwei `---`) gibt ihr eine eigene Seite (für grosse Abläufe; dann am Ende des Textes, nach dem Kernsatz).
- Farben nur über die Klassen `fg-*` und `t-*` (siehe `src/ui/styles.css`), damit hell, dunkel und die Themenfarbe stimmen. Feste Farben nur für Bedeutung (kalt blau `#5b9bd5`, heiss rot `#e0735a`).
- Diagramme: Beschriftungen auf Deutsch, die englische Version im Attribut `data-en`. Breite 360, Schrift ab 10.5, wenige Wörter.
- `npm run validate` prüft: Datei vorhanden, in beiden Sprachen gleich gesetzt, keine Skripte, Bilder oder externen Links, jede Beschriftung übersetzt.

## Grenzen

- Fakten gehen vor Wirkung. Lieber eine nüchterne wahre Karte als eine packende falsche.
- Glaubenskarten bleiben der katholischen Lehre und dem Bibeltext treu. Tugend, Pflicht, Dienst und Opfer passen von selbst zur Haltung oben; nichts wird hineingedreht.
- Gesundheitskarten sind Wissen, keine Therapie oder Diagnose.
- Aktuelles bleibt neutral und ohne Wertung.
- Batman und andere Figuren dienen höchstens als kurzes Bild. Die Karte handelt immer vom Leser.
