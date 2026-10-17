# Sechzehn

Tägliches Browser-Ratespiel zu den 16 Bundesländern, im Stil von Wordle. Fokus: Handy.

## Spielprinzip (entschieden)

- Ein Level pro Tag, für alle Spieler identisch. Jedes Level hat 5 Runden mit 5 verschiedenen Bundesländern.
- Eine Runde: Der Spieler bekommt Hinweis 1 und tippt auf einer **unbeschrifteten** Deutschlandkarte ein Bundesland an, dann „Tipp abgeben“.
  - Richtig: Punkte nach Hinweisstufe, Runde beendet.
  - Falsch: Das Land wird ausgegraut und beschriftet, der nächste (leichtere) Hinweis erscheint.
  - Nach 5 falschen Tipps: 0 Punkte, Lösung wird gezeigt.
- Punkte: 100 / 75 / 50 / 30 / 10 (Arbeitsstand, noch nicht final).
- Markieren eines Landes zeigt bewusst **keinen** Namen an, sonst wäre die stumme Karte wirkungslos.
- Am Ende: Auswertung mit Emoji-Raster (🟥 falsch, 🟩 gelöst, ⬜ nicht benötigt) zum Teilen.

## Design (entschieden)

- Reduzierter Mobile-Game-Stil (Richtung NYT Games / Wordle): auf dem Handy eine schmale Spalte, Button fest am unteren Rand.
- Desktop (ab 880×540, `DESKTOP` in `app.js`, Zielgröße 1920×1080): **ein** Raster für Start, Spiel und Auswertung (`.app` max. 1200px, linke Spalte `clamp(320px,34vw,420px)`), damit Breite und Kopfzeile nie springen. Links Text und Button, rechts die Karte über die ganze Höhe (`#main` mit `display:contents`). Ansicht steht in `body[data-view]` (`intro`/`game`/`end`), `body.playing` nur im Spiel.
  - Start: links Überschrift, drei Regeln, Tag, Button; rechts setzt sich die Karte aus den 16 Ländern zusammen.
  - Auswertung: links Gesamtpunkte, Ergebnisraster, Countdown, Teilen; rechts die Karte mit den fünf Ländern des Tages (grün gelöst, rot nicht gelöst, beschriftet; beim Aufdecken im Takt des Rasters).
- Jede Kategorie hat eine eigene Farbe; die aktuelle Hinweiskarte ist vollflächig in dieser Farbe und so hoch wie ihr Text. Kategoriefarben **nur** für Kategorien: Regelziffern, Startkarte und Fokusrahmen sind neutral.
- Punkteskala: eine durchgehende Leiste 100/75/50/30/10, eine Markierung gleitet auf den aktuellen Wert, verbrauchte Werte werden blass. Nicht durchstreichen (verworfen, sah unruhig aus).
- Belohnung bei richtigem Tipp: Land wird grün, „+Punkte“ steigt über der Karte auf, Punktestand zählt hoch.
- Volltreffer (richtig mit dem **ersten** Hinweis, 100 Punkte; `jackpot`, `confetti`, Werte in `JACKPOT` in `app.js`): Land erst golden, nach 1 s weicher Übergang ins normale Grün; Konfetti-Burst (50 Partikel in Gold und Grün) auf einem einzelnen Canvas über der Karte (`pointer-events: none`), nach 1,5 s entfernt, ohne Bibliothek; statt „+100“ steht „Volltreffer! +100“ in Gold, etwas größer. Blockiert nichts („Nächste Runde“ sofort bedienbar, Reste verschwinden beim Rundenwechsel). Bleibend: Rundenindikator golden mit ✓, auf dem Endbildschirm erstes Feld der Zeile golden. Der Teilen-Text bleibt unverändert (🟩). Bei „Bewegung reduzieren“ kein Konfetti, nur Färbung und Text. Gemessen 2026-10: Frames 7–9 ms während des Konfettis.
  - Gold gehört zur Familie von Rot (`--bad`) und Grün (`--ok`): gleiche Helligkeit und Sättigung, flach mit nur sehr dezentem senkrechtem Verlauf, kein Rand, weißer Haken wie bei Grün/Rot, gleiche Größen und Radien. Das Besondere steckt nur in der Animation (Glanzlicht, Funkeln, Konfetti). Tokens: `--gold` (hell `#D19A12`, dunkel `#EDBB3F`), `--gold-hi`/`--gold-lo` (je ca. 8 % der Helligkeit heller/dunkler: hell `#E1A614`/`#C08E11`, dunkel `#EFC255`/`#EBB329`), `--gold-grad` (180°), `--on-gold` `#1F1600` (Schrift auf Gold). „Volltreffer! +100“: dunkle Schrift auf goldenem Badge. Karte: Der Auswahl-Pfad füllt „gelöst“ immer über den SVG-Verlauf `#gold-grad` (senkrecht, zwei Stopps); die Stopps sind normal grün und beim Volltreffer (`.jackpot` an der Karte) `--gold-hi`/`--gold-lo`, danach gleiten sie in 0,5 s ins Grün.
  - Verworfen 2026-10: flaches Gelb (wirkte billig) und danach ein mehrstufiger Metallverlauf mit braunem Rand und braunem Haken (wirkte wie ein anderes Material neben dem flachen Rot und Grün). Ein Abstand von 8 Prozentpunkten Helligkeit für den Verlauf wirkte im hellen Modus bräunlich, daher relativ.
  - Glanzlicht (`.shine::after`): ein schräger weißer Streifen (30 % Breite) wandert einmal in 0,8 s über das Gold, am Indikator beim Volltreffer, auf dem Endbildschirm einmal je Volltreffer-Feld (150 ms versetzt, nach dem Aufdecken). Dazu beim Volltreffer drei kleine vierzackige Funkelsterne am Indikator (0,6 s, `sparkles`). Keine Dauerschleife; bei „Bewegung reduzieren“ nur der Verlauf.
  - Testen: `?tag=5&dev=1&demo=volltreffer` löst nach 0,7 s einen Volltreffer in der ersten Runde aus (`&nach=ms` ändert die Wartezeit, z. B. für Screenshots mit `tools/screenshots.ps1`). Die Kategoriefarbe Wirtschaft war Goldbraun und ist deshalb jetzt Oliv (hell `#6F8A1E`, dunkel `#7E9B24`).
- „Sechzehn Facetten“ (`facetsStart`, `FACETTEN_CONFIG` in `app.js`, Block am Ende von `style.css`): Nur bei 500/500 (alle fünf Runden mit dem ersten Hinweis, `isPerfect`) wird die Auswertungskarte zum Diamanten. Prinzip wie bei der Karte: Die Länderpfade werden nie umsortiert oder transformiert, nur Klassen und Füllungen; keine Bibliotheken.
  - Facetten (überarbeitet 2026-10, vorher wirkte die Karte wie eine blau eingefärbte Statistikkarte): eigene Ebene `g.facets` über der Basiskarte, unter Strahl und Beschriftungen; je Land ein Pfad mit eigenem SVG-`linearGradient` (`#f_XX`, objectBoundingBox) entlang seiner Lichtrichtung, drei Stopps: 0 % Ton + 38 % Weiß, 55 % Ton, 100 % Ton + 16 % Schwarz (`color-mix` im `stop-color`-Stil, folgt also dem Modus). Kante `--facet-edge` 1,2 px, `stroke-linejoin: round`, `pointer-events: none`. Die Basispfade bleiben unverändert.
  - Feste Zuordnung Land → Ton/Winkel (`FACETS` in app.js, Winkel wie CSS `linear-gradient`: 0° = nach oben, im Uhrzeigersinn): SH t2 340°, HH t3 25°, HB t2 295°, NI t1 70°, MV t3 160°, BB t0 25°, BE t1 70°, ST t2 160°, NW t2 160°, HE t0 340°, TH t3 205°, SN t1 70°, RP t3 115°, SL t2 160°, BW t1 340°, BY t2 250°. Benachbarte Länder haben nie denselben Ton (sonst verschwinden Grenzen); beim Ändern prüfen.
  - Töne: hell `--t0` `#3F7FAE`, `--t1` `#6FA9D1`, `--t2` `#A6D3EE`, `--t3` `#DDF1FC`, `--facet-edge` `rgba(255,255,255,.95)`; dunkel `#2C6893`, `#4F92C2`, `#8EC6E8`, `#D8F1FF`, Kante `rgba(255,255,255,.85)`.
  - Eis-Tokens nur noch für Punktzahl und Diamant-Felder im Raster: hell `--ice-1` `#7FB4D6`, `--ice-2` `#A9D3EC`, `--ice-3` `#D6EEFA`, `--ice-edge` `#2D6E96`, `--glow` `rgba(70,150,210,.35)`; dunkel `#5C9CC6`, `#9ACDEB`, `#E4F6FF`, `#F2FBFF`, `rgba(150,215,255,.45)`.
  - Keine Sonderbehandlung der fünf Länder des Tages auf der Diamantkarte: Sobald die Kristallisierung beginnt, verschwinden Beschriftungen und Hinweislinien, das Gold darunter wird nach dem Einblenden entfernt. Nach Neuladen von Anfang an ohne Beschriftung.
  - Punktzahl „500“: nur Verlaufsfüllung (`background-clip: text`, 160°: `--ice-2` → `--ice-1` → `--ice-edge`), ohne Kontur und Schatten. Das dunkle Ende (`--ice-edge`) hält sie im hellen Modus lesbar.
  - Leuchten hinter der Karte: elliptischer `radial-gradient` über die ganze Kartenfläche (Radien 50 %/50 %, `--glow` mit 70 % → 45 % bei 55 % → transparent am Rand), dadurch ohne sichtbare Kante. Verworfen: Ellipse mit transparent bei 75 % (nur in der Einbuchtung an der tschechischen Grenze sichtbar, wirkte wie ein grauer Fleck).
  - Kartenhöhe Auswertung (Desktop): Die linke Spalte kann höher als das Fenster sein; die Karte ist trotzdem auf die sichtbare Höhe begrenzt (`height: calc(100dvh - 110px)`, `position: sticky`) und passt immer ganz ins Bild (geprüft 1920×1080 und 1920×940).
  - Ablauf (ca. 5 s, alle Zeiten in `FACETTEN_CONFIG`): a) Rückblick: ab 0,3 s alle 380 ms ein Land des Tages golden mit Name, Punktzahl zählt in 100er-Schritten. b) 0,5 s nach dem letzten Gold Kristallisierung: Beschriftungen weg, Facettenpfade nach x+y sortiert (oben links → unten rechts) alle 55 ms per opacity eingeblendet (je 0,7 s); Glow hinter der Karte (1,2 s); Punktzahl im Eisverlauf; Rasterfelder werden im 90-ms-Takt zu Diamantfeldern; Kicker „Sechzehn Facetten“. c) 1 s nach Beginn der Kristallisierung Lichtstrahl diagonal (1,4 s ease-in-out): zweite Ebene mit allen Länderpfaden, gefüllt mit einem `userSpaceOnUse`-Verlauf (Prisma-Saum hellblau/rosa), per rAF verschoben, `mix-blend-mode: screen`. d) 20–25 Funken (0,9 s) auf Landesgrenzen, jeweils wenn der Strahl dort ist. e) 0,9 s nach Strahlbeginn Überschrift „Perfekter Tag. Fünfmal mit dem ersten Hinweis.“
  - Danach, solange die Auswertung offen ist: alle 8–14 s ein dezenterer Strahl (70 %, 1,8 s, 3–5 Funken), alle 4–6 s ein einzelner Funke (Nachglühen). Versteckter Tab: alles angehalten, beim Zurückkehren werden die Zeitgeber neu geplant. Verlassen der Auswertung: `stopFacets`.
  - Volle Animation nur beim ersten Erreichen der Auswertung; beim Neuladen sofort der Endzustand mit kleinem Button „Nochmal abspielen“. „Bewegung reduzieren“: nur Endzustand, kein Strahl, keine Funken, kein Button.
  - Teilen-Text: „💎“ hinter „500/500“. Statistik: Abzeichen „Sechzehn Facetten × N“, Diamant-Kästchen im Kalender und „◆ N“ in der Kopfzeile (siehe Statistikfenster). Ein 500er-Tag wird wie jeder Tag über `recordToday` gespeichert (geprüft: Zähler 2 → 3, Kalender, Abzeichen-Datum, Länder gespeichert).
  - Testen: `?tag=5&dev=1&demo=perfekt` (volle Animation), `&statisch=1` (Endzustand wie nach Neuladen); im Entwicklermodus spielt Taste F auf der perfekten Auswertung die Animation erneut ab.
  - Geprüft 2026-10, hell und dunkel: Zeitplan wie oben (Rückblick bis 1,9 s, Strahl ab ca. 3,3 s, Überschrift ca. 4,2 s); 73 s Dauerlauf: Strahlen alle 10–13 s, höchstens 6 Funken gleichzeitig, keine hängenden Funken, Median 7 ms je Frame (max. 15,6 ms); versteckter Tab 16 s ohne Strahl/Funken; Handy 400×860 ohne waagerechtes Scrollen.
- Falscher Tipp: Land blinkt rot, Button wackelt. Die verbrauchte Hinweiskarte schrumpft in das Farbquadrat ihrer Zeile in der Hinweisliste (`flyIntoList`), die Markierung der Punkteskala gleitet weiter.
- Auswertung direkt nach dem Spiel: Das Raster deckt sich wie bei Wordle Kästchen für Kästchen auf (Takt `REVEAL` in `app.js`), die Gesamtpunkte zählen mit. Beim Neuladen erscheint es sofort. Rundenleiste und Punktestand oben sind auf der Auswertung ausgeblendet (stehen schon im Raster).
- Nach dem Tag: „Nächstes Rätsel in HH:MM:SS“, live bis 0:00 Uhr Ortszeit (`nextMidnight`). Danach „Neues Rätsel spielen“ als Hauptbutton (mit `?tag=N` springt er zu N+1). Nicht „Morgen gibt es fünf neue Bundesländer“: Länder können sich wiederholen.
- Wiederkehrer: Tag abgeschlossen → Neuladen zeigt direkt die Auswertung. Tag angefangen → Startbildschirm mit „Weiterspielen“. Spielstand im `localStorage` (`CONFIG.KEEP_PROGRESS: true`), gilt also auch für neue Tabs.
- Teilen (überarbeitet 2026-10, Text und Bild ähnlich Strava). **Spoiler-Regel: Weder Text noch Bild verraten, welche Länder heute gefragt waren** – nie Ländernamen, nie markierte Länder; Karten im Bild nur als Silhouette bzw. Diamant mit allen 16 Ländern gleich behandelt.
  - „Ergebnis teilen“ öffnet das Teilen-Fenster (`openShare`, gleicher Baustein `makeDrawer` wie das Statistikfenster; Desktop mittig als Dialog, Handy als Blatt von unten; Schließen per ✕, Esc oder Klick daneben, Fokus hinein und zurück zum Button). Inhalt: Vorschau (Bild in voller Auflösung, per CSS verkleinert; Sticker auf Schachbrett) mit Formatwahl Story | Sticker | Quadrat; „Bild teilen“ (System-Teilen-Menü mit der PNG, wenn `navigator.canShare({files})` es erlaubt, sonst Download); „Bild speichern“ (immer Download, `sechzehn-tag-N.png`); „Text kopieren“ (danach kurz „Kopiert“). Das PNG entsteht schon beim Wählen des Formats, damit „Bild teilen“ direkt im Klick teilt (sonst verfällt die Nutzeraktion, v. a. Safari).
  - Text (`shareText`): `Sechzehn #42 · 325/500`, je Runde eine Zeile, die mit dem Treffer endet (keine ⬜): 🟨 Volltreffer, 🟩 gelöst, davor je Fehltipp 🟥; nicht gelöst = fünf 🟥. Perfekter Tag: `· 500/500 💎`. Letzte Zeile `CONFIG.SITE_URL`.
  - Kopieren (`copyText`): `navigator.clipboard.writeText`, als Ersatz ein unsichtbares Textfeld mit `execCommand('copy')`; klappt beides nicht, steht der Text markiert im Fenster („mit Strg+C kopieren“). Ursache der früheren Meldung „Kopieren hat nicht geklappt“: Desktop-Edge/Chrome haben `navigator.share`; nach dem Schließen des Windows-Teilen-Dialogs lehnt `clipboard.writeText` ab (Seite nicht fokussiert, Nutzeraktion verbraucht). Außerdem kann die Clipboard-API per Berechtigung gesperrt sein (`NotAllowedError`, z. B. im Browser-Fenster von Claude).
  - Bilder (`teilen.js`, Canvas ohne Bibliothek, vor `app.js` geladen): vor dem Zeichnen `document.fonts.load`/`ready` (Bricolage Grotesque 600/800, Figtree 500–700), Karte aus `data/map.json` per `Path2D`. Farben wie im Spiel (Tabelle `SHARE_PAL`): Grün `#4CC271`, Rot `#F06A6E`, Gold-Verlauf `#EFC255 → #EDBB3F → #EBB329` (hell: Hell-Token), Kästchen mit 22 % Eckenradius, leere Kästchen dunkel `#2C3137` mit Kante `rgba(255,255,255,.07)`, hell `#DFE3E8`.
    - Story 1080×1920, immer dunkel `#111315`: „Sechzehn“ 76px, „Tag N · Datum“ 34px gedämpft; Punktzahl 300px, „von 500 Punkten“; Raster 5×5 (104px, Abstand 16px); dahinter Silhouette (`#181B1F`, Grenzen in Hintergrundfarbe, 900px breit, rechts angeschnitten, ab Höhe der Punktzahl); unten „SERIE / N Tage“ (entfällt ohne Serie) und rechts die Adresse ohne `https://`.
    - Story perfekter Tag (automatisch bei 500/500): Kopf wie oben, „500“ im Eisverlauf (260px) mit „SECHZEHN FACETTEN“ (`#9ACDEB`) und „Perfekter Tag“ daneben; Diamantkarte 800px breit mit denselben Tönen, Winkeln und Kanten wie die Facetten-Animation (`FACETS`, Verlauf je Land über seinen Begrenzungsrahmen), weiches bläuliches Leuchten dahinter.
    - Sticker 1080×1080, transparent: zentriert „Sechzehn“, Punktzahl mit „/500“, Raster (leere Kästchen weiß 28 %), „Tag N · Serie N · Adresse“; alle Texte weiß mit weichem Schatten. Perfekter Tag: Diamant-Kästchen und „500“ im Eisverlauf.
    - Quadrat 1080×1080 im aktuellen Modus: „Sechzehn“ / „Tag N“ oben, Punktzahl links, Raster rechts, Silhouette sehr dezent dahinter (hell `#F2F4F6`, dunkel `#181B1F`), Serie als Pille unten links, Adresse unten rechts. Perfekter Tag: ebenfalls Diamant-Kästchen und Eis-„500“.
  - Testen: `?tag=42&dev=1&demo=ende&verlauf=1&teilen=story|sticker|quadrat` öffnet das Fenster; `&bild=story|sticker|quadrat` zeigt nur das Bild 1:1 (Sticker auf Grau), für `tools/screenshots.ps1 -Breite 1080 -Hoehe 1920|1080` (`screenshots/bild-*.png`). Mit `demo=perfekt&statisch=1` die perfekten Varianten.
  - Geprüft 2026-10: alle Formate normal und perfekt, Quadrat hell und dunkel, Schriften geladen, kein Ländername und keine markierten Länder; Fenster am Desktop (mittig) und Handy 375px (Blatt), Esc, Klick daneben, Fokus zurück; Download mit Dateiname (abgefangen); Teilen-Menü mit gestubbtem `navigator.canShare/share` (PNG `image/png` übergeben) und ohne `canShare` (Download); Textformat normal und perfekt. Auf einem echten Handy noch nicht getestet.
- Auswertung, linke Spalte in dieser Reihenfolge: Punktzahl → Ergebnisraster → „Nächstes Rätsel in …“ → „Ergebnis teilen“ (direkt darunter, nicht in der festen Leiste; die Leiste ist auf der Auswertung ausgeblendet) → eine dezente Zeile „Serie: X Tage · Ø Y Punkte · Alle Statistiken →“ (`statLineHTML`; der Link öffnet das Statistikfenster). Bei 1920×1080 ohne Scrollen, auch auf der perfekten Auswertung.
- Persönliche Statistik (nur im eigenen Browser, `localStorage` unter `sechzehn-statistik`, alle Zugriffe mit try/catch; ist der Speicher gesperrt, bleibt die Statistik leer, das Spiel läuft weiter):
  - Gespeichert wird pro abgeschlossenem Kalendertag `{ pts, hints, lands }` (`{ days: { 'JJJJ-MM-TT': { pts: 325, hints: [1,2,0,3,1], lands: ['SH','TH','NI','HH','SN'] } } }`); `hints` = Hinweisnummer, mit der jede Runde gelöst wurde (1–5), 0 = nicht gelöst; `lands` = Land jeder Runde. Eingetragen beim Erreichen der Auswertung (`recordToday`). Jeder Tag zählt einmal: Spielt man ihn erneut (z. B. in einem neuen Tab), bleibt das erste Ergebnis, die Auswertung sagt das.
  - Altdaten bleiben gültig (`entryOf` vereinheitlicht alle Formate, ungültige Einträge werden ignoriert): nur die Punktzahl als Zahl (bis 2026-10) zählt für Kennzahlen, Serie und Kalender, nicht für „Gelöst mit Hinweis“ und die Volltreffer-Karte. Einträge mit Hinweisen, aber ohne Länder ergänzt `migrateStats` beim Start aus dem Tageslevel (`buildLevel` ist pro Tag fest; stimmt, solange der Faktenpool den Tag noch genauso ergibt). Ist der heutige Tag ein Alteintrag und stimmen die Punkte mit dem Spielstand überein, werden Hinweise und Länder beim nächsten Öffnen der Auswertung ergänzt.
  - Serie = aufeinanderfolgende Kalendertage mit abgeschlossenem Rätsel. Die aktuelle Serie endet heute oder, solange heute noch offen ist, gestern (sie „verfällt“ also erst, wenn ein ganzer Tag ausgelassen wurde). Ein ausgelassener Tag setzt sie auf 0. Gerechnet in Kalendertagen (UTC-Datumsindex), daher sicher über Monatswechsel und Zeitumstellung.
  - Belohnung direkt nach dem Abschluss: Steigt die Serie um 1, zählt sie in der Statistikzeile nach dem Aufdecken des Rasters hoch und leuchtet kurz grün. Neuer Rekord (längste Serie gestiegen, ab 2 Tagen): „· Neuer Rekord!“ in Grün in derselben Zeile. Beim Neuladen keine Animation.
  - Mit `?tag=N` gespielte Tage zählen nicht (Hinweis auf der Auswertung), außer im Entwicklermodus.
- Statistikfenster (`openStats`/`closeStats`, Inhalt `statsPanelHTML` in `app.js`, CSS-Block „Statistikfenster“): öffnet über das Balken-Symbol in der Kopfzeile, den Diamanten daneben und „Alle Statistiken →“ (alles mit `data-stats` öffnet es). Desktop: Seitenfenster von rechts, 560px, volle Höhe, eigener Scrollbereich; Handy: ganze Breite. Rest abgedunkelt, Seite scrollt nicht mit. Schließen per ✕, Klick daneben oder Esc; Fokus springt auf ✕, bleibt im Fenster (Tab läuft im Kreis) und geht beim Schließen zurück zum auslösenden Button. Ein-/Ausblenden 200 ms (leichtes Hereinschieben), bei „Bewegung reduzieren“ ohne. Die Hilfe („?“) bleibt das ausklappbare Blatt.
  - Inhalt: a) „Deine Statistik“ + ✕. b) Vier Kacheln: Gespielt, Serie, Längste Serie, Ø Punkte (Bestwert entfällt). c) Abzeichen: „Sechzehn Facetten × N“ mit kleinem Diamanten (`gemSVG`: Krone und Unterteil aus Facetten in Eisblau-Verläufen, Kanten `--ice-edge`), Text „N perfekte Tage mit 500 von 500 Punkten. Zuletzt am …“; bei 0 ausgegraut „Noch kein perfekter Tag …“. „Alle Sechzehn“ (goldene Plakette mit 16), ausgegraut bis alle 16 Länder je mit dem ersten Hinweis gelöst wurden („Bisher X von 16“). d) „Letzte 5 Wochen“: 7 Spalten (Mo–So) × 5 Zeilen, Kästchen 30px, letzte Zeile enthält heute (mit Rahmen), spätere Tage nur als blasser Umriss. Stufen: nicht gespielt neutral, < 300 / 300–399 / 400–499 Grün in drei Stufen (`--ok` mit 35 % bzw. 65 % in den Hintergrund gemischt, dann voll; im Dunkelmodus ergibt das dunkles → kräftiges Grün, im hellen zartes → kräftiges), 500 = Diamant-Kästchen wie im Ergebnisraster. Legende darunter, Tooltip (Datum und Punkte) beim Überfahren. e) „Gelöst mit Hinweis“: waagerechte Balken 1–5 und ✕, neutral grau (`--land`), nur der höchste Wert grün, Anzahl am Balkenende. f) „Deine Volltreffer-Karte“: kleine Karte aus denselben Kartendaten, je mit dem ersten Hinweis gelöste Länder in Gold, daneben „X / 16“ und Erklärung.
  - Kopfzeile: ab dem ersten perfekten Tag ein kleiner Diamant mit Anzahl („◆ 2“, `updateDiaBtn`) neben dem Statistik-Symbol, öffnet ebenfalls das Fenster.
  - Seit 2026-10 (Etappe 1 des Faktenausbaus) ergibt der Faktenpool für alle 16 Länder spielbare Runden, „Alle Sechzehn“ ist also erreichbar.
  - Verworfen 2026-10: Statistik (fünf Kacheln + Säulendiagramm) direkt auf der Auswertung; machte den Endbildschirm zu lang (Scrollen bei 1920×1080).
  - Achtung Klassennamen: `.top` ist die Kopfzeile (mit Linie darunter); im Fenster daher `.hmax` für den höchsten Balken.
- Alle Animationen entfallen bei „Bewegung reduzieren“ (CSS-Regel am Ende von `style.css`, in JS `reducedMotion()`). Die Klänge bleiben (sind keine Bewegung).
- Sounddesign (`sound.js`, vor `app.js` geladen; eingeführt 2026-10). Prinzip **Hintergrundakustik, kein Fokus**: moderat leise, aber dank Kompressor auch bei niedriger Systemlautstärke hörbar. Keine Audiodateien, alles per Web Audio API; Lautstärke und Hall in `SOUND_CONFIG` (`volume` 0.32, `reverb` 0.18). Klangfarben: Marimba (Treffer, Auswahl), Glas (Volltreffer), Kristall (perfekter Tag, Funkeln), dumpfes gefiltertes Dreieck (falsch), gefiltertes Rauschen (Klick, Hinweiskarte). Abspielen nur über `Sound.play(name, …)`.
  - Ereignisse (nur diese; keine Hover-Klänge, keine Klänge für normale Buttons, die Demo auf dem Startbildschirm bleibt stumm):
    - „Spielen“/„Weiterspielen“ auf dem Startbildschirm: kurzer Auftakt `start` (G–C–G aufwärts), direkt im Klick-Handler, nicht verzögert (sonst blockiert der Browser den Ton).
    - Land markieren (nicht beim Abwählen): `select`.
    - „Tipp abgeben“ hat keinen eigenen Klang, nur das Ergebnis: falsch `wrong`, richtig `right`, Volltreffer (erster Hinweis) `jackpot` statt `right`.
    - Neue Hinweiskarte nach einem Fehltipp: `hint`, 250 ms nach `wrong` (nach dem fünften Fehltipp keine Karte, also kein `hint`).
    - Auswertung direkt nach dem Spiel: je Rasterzeile `tile(h)` im Takt von `REVEAL` (wenn die Zeile fertig aufgedeckt ist), h = Hinweisnummer 1–5, 0 = nicht gelöst. Nicht beim Neuladen.
    - Serie steigt: `streak` beim Hochzählen; bei neuem Rekord stattdessen `record`. Auf dem perfekten Tag erst nach dem Lichtstrahl (`facetsEndMs`), damit es nicht mit den Facetten-Klängen kollidiert.
    - Perfekter Tag, synchron zu `FACETTEN_CONFIG`: `perfectStep(0–4)`, wenn ein Land golden wird; `perfectChord` beim Start der Kristallisierung; `perfectSparkle` beim Start des Lichtstrahls; wiederkehrender Glanz `glint`. Ebenso bei „Nochmal abspielen“ und Taste F. Statischer Endzustand (Neuladen): kein Klang, auch kein `glint`. Bei „Bewegung reduzieren“ kommen die Klänge im selben Takt, ohne Animation. Auf dem perfekten Tag keine `tile`-Klänge.
  - Geplante Klänge der Auswertung (`soundAt`) bricht `render()` ab (`stopSounds`), die der Facetten `stopFacets`. Versteckter Tab: `Sound.play` spielt nichts.
  - Ton an/aus: runder Button zwischen „?“ und Hell/Dunkel (Lautsprecher bzw. durchgestrichen, aria-label „Ton aus“/„Ton an“ = was der Klick tut). Wahl in `localStorage` (`sechzehn-ton`: `an`/`aus`), Standard an; beim Einschalten einmal leise `select`. Auf schmalen Handys (≤ 420px) sind Kopfzeilen-Knöpfe und Titel etwas kleiner, damit fünf Knöpfe passen (geprüft 375px).
  - Browser erlauben Ton erst nach einer Nutzeraktion. `Sound.play` plant vorher nichts (`navigator.userActivation`), sonst kämen alle bis dahin geplanten Klänge beim ersten Klick auf einmal (z. B. `?dev=1&demo=perfekt` direkt nach dem Laden: erst klicken, dann Taste F). Teiltöne über der Nyquist-Grenze werden weggelassen (hohe Funkeltöne).
  - Geprüft 2026-10 (Protokoll der `Sound.play`-Aufrufe): ganzes Spiel mit Fehltipps, Volltreffer und nicht gelöster Runde (`hint` jeweils 250 ms nach `wrong`, `tile` im 380-ms-Takt mit richtiger Hinweisnummer, `streak`); perfekter Tag mit Rekord (Schritte im 380-ms-Takt, Akkord bei 2,3 s, Funkeln bei 3,3 s, `record` nach dem Strahl, `glint` alle 10–14 s); Neuladen 16 s stumm; „Nochmal abspielen“, Taste F, „Bewegung reduzieren“; Ton aus → Neuladen → bleibt aus → an.
  - Verworfen: Entwurf 2 mit reinen Sinus-Blips (wirkte zu steril).
- Darstellung in `app.js`: `buildGame` baut die Spielansicht einmal, `updateGame` schaltet danach nur Klassen und Texte um (Karte bleibt dasselbe SVG). Nie wieder alles neu rendern, sonst laufen CSS-Übergänge nicht. Einmalige Effekte über `fx` und `replay()`.
- Frühere Hinweise stehen über der Hinweiskarte, vollständig und umbrochen (nicht mit „…“ kürzen). Keine Platzhalter-Balken für noch nicht aufgedeckte Hinweise (verworfen: standen über der aktuellen Karte, widersprachen der Reihenfolge); den Fortschritt zeigen „Hinweis X von 5“ und die Punkteskala.
- Handyansicht, Spiel (überarbeitet 2026-10; alles außer dem Desktop-Raster, also nicht `(min-width: 880px) and (min-height: 540px)`; Desktop unverändert). Prinzip: **wachsender Block über fester Karte.**
  - Hinweisblock (`.hintblock`, auf dem Desktop `display: contents`): frühere Hinweise, aktuelle Hinweiskarte und direkt darunter die Punkteleiter, ohne Leerraum. Deckender Hintergrund in Seitenfarbe, unten ein 16-px-Verlauf in die Karte (Teil des Blocks), liegt per z-index über der Karte und fängt Berührungen ab. Wächst mit jedem Hinweis weich nach unten (250 ms, Sicherung per Timer).
  - Kartenbereich (`.mapwrap`) = ganzer Bereich zwischen Rundenleiste und Aktionsleiste (overflow: hidden). Die Karte darin ist unten verankert; ihre Höhe berechnet `sizeMap` → `mobileMapHeight` einmal je Runde so, dass sie unter dem Block bei Hinweis 1 (Karte des ersten Hinweises + Punkteleiter, unsichtbar gemessen in `cardHeight`) ganz sichtbar ist. Danach ändert sie sich in der Runde nicht; wächst der Block, verschwindet der Norden nach und nach darunter.
  - Sobald der Block die Karte überdeckt, lässt sie sich auch bei 1× mit einem Finger senkrecht verschieben (`mapZoom`: viewBox darf um den überdeckten Teil nach oben über den Kartenrand hinaus; Nordspitze bis knapp unter den Block, Südspitze bis zur Aktionsleiste). „Ganze Karte“ (unten rechts, sobald gezoomt oder verschoben) und „Tipp abgeben“ stellen den Ausgangszustand her (1×, unten verankert). Am Rundenende (`showLand`) wird die Karte so weit verschoben, dass das Lösungsland unter dem Block sichtbar ist.
  - Beschriftungen falsch getippter Länder, die teilweise unter dem Block liegen, rücken in den sichtbaren Teil des Landes (`fitLabels`); liegt ein Land ganz darunter, wird es durch Verschieben der Karte sichtbar (eine eigene Liste der falschen Tipps gibt es nicht).
  - Frühere Hinweise einzeilig mit „…“ und Kategoriefarbe; Antippen klappt eine Zeile aus/ein (`.open`). Auf dem Handy kein Einsatz-Text über der Punkteleiter, Hinweistext 1,1rem.
  - Gemessen (Hinweis 1–5, Kartengröße gleich, kein Scrollen): 390×844 → Karte 431 px (51 %), Block überdeckt bei Hinweis 5 die oberen 80 px; 375×667 → 282 px (42 %), überdeckt 73 px. Schleswig-Holstein und Hamburg nach Ziehen antippbar, beim Ziehen keine Auswahl, Tippen auf den Block wählt nichts, Lösungsland (auch SH, MV, HH) sichtbar.
  - Verworfen 2026-10: feste Kartenhöhe mit Platzreserve für Hinweis 5 (Punkteleiter und Karte unten verankert) – erzeugte eine große leere Fläche zwischen Hinweiskarte und Punkteleiter und eine kleine Karte (29–44 % der Höhe).
  - Zoom (`mapZoom`, `ZOOM` in app.js) über die viewBox: Pinch 1×–4× um den Punkt zwischen den Fingern, ein Finger verschiebt (gezoomt), Begrenzung an den Rändern, Doppeltippen 2,5× bzw. zurück auf 1× (nimmt die Auswahl des ersten Tipps zurück). Tippen wählt nur bei < 8 px Bewegung und ohne zweiten Finger; danach wird der Klick verschluckt. „Tipp abgeben“: sanft (250 ms) auf 1× (am Rundenende mit dem Lösungsland im Bild), Punkte-Abzeichen erst danach; neue Runde bei 1×. „Ganze Karte“ unten rechts, nur gezoomt oder verschoben. Pointer Events, `touch-action: none` nur auf der Karte, Seitenzoom bleibt erlaubt. Konturen non-scaling, `--u` wird gegengerechnet: Namen wachsen beim Zoomen von 11 px höchstens auf die Desktop-Größe 17 px. Animation mit Sicherung per Timer (läuft auch, wenn requestAnimationFrame ruht).
  - Tippflächen: Berlin, Bremen, Hamburg und (nur Handy) Saarland mindestens 44×44 px auf dem Bildschirm (`touchHits`, Radius 22 px, beim Zoom gegengerechnet, nie kleiner als die Desktop-Radien `SMALL`). Sie verdecken bei 390×844 Teile der Nachbarn (Brandenburg 38 %, Niedersachsen 32 %, Schleswig-Holstein 30 %, Rheinland-Pfalz 22 %), die aber großflächig treffbar bleiben.
  - Einmaliger Hinweis „Mit zwei Fingern vergrößern“ beim ersten Spiel auf einem Touch-Gerät (`pointer: coarse`), 4 s bzw. bis zum ersten Zoom; `localStorage` `sechzehn-zoomtipp`.
  - Getestet in der Geräte-Emulation mit simulierten Touch-Pointern: Pinch, Verschieben, Rand, Doppeltippen hin und zurück, „Ganze Karte“, Tipp abgeben → 1×, neue Runde 1×, keine Auswahl nach Pinch/Verschieben, kleine Länder bei 1× treffbar. Auf einem echten Handy noch nicht getestet.
- Handy, Startbildschirm: Die Karte oben füllt den ganzen freien Platz, Überschrift, Schritte und Kacheln sitzen unten direkt über dem Button; auf niedrigen Handys (max-height 740px) verdichtet, kein Scrollen (geprüft 375×667, 430×932). Auswertung ohne Karte.
- Startbildschirm (`renderIntro`), solange der Tag nicht abgeschlossen ist. Linke Spalte ruhig und neutral, die Farbe kommt von der Karte (einzige Farbe links: das goldene „100“). Gleiche Kopfzeile wie im Spiel; auf dem Desktop ist die linke Spalte (Text und Button) vertikal zur Karte zentriert (eigene Zeilen im Raster für `data-view="intro"`). Von oben: Überschrift; drei Schritte als Liste mit feinen Trennlinien (große gedämpfte Ziffer in der Anzeigeschrift, fette Kurzüberschrift, eine Erklärung in gedämpfter Farbe): „Hinweis lesen“, „Daneben? Nächster Hinweis“ mit Punkteleiter (100 in Gold, Rest neutral), „Fünf Runden, jeden Tag neu“; drei neutrale Kacheln im Stil der Statistik: „Heute – Tag X“, „Maximal – 500 Punkte“ und je nach Lage „Dein Ergebnis – X Punkte“ (heute schon gespielt, z. B. in anderem Tab), „Deine Serie – X Tage“ oder „Neues Rätsel – 0:00 Uhr“; darunter „Spielen“/„Weiterspielen“ (Fokus beim Laden ohne sichtbaren Rahmen). Keine Datumszeile mehr (Datum als Tooltip der Kachel „Heute“). Die Startkarte ist nicht anklickbar. Testen: `?tag=5&dev=1&demo=start` (mit Demo-Serie) bzw. `&serie=0` (Erstbesucher).
  - Demo (`startIntroDemo`): Nach der Einblend-Animation (1,6 s) „spielt“ im Hintergrund ruhig jemand eine Runde, in Dauerschleife, in **exakt den Farben des Spiels** (Hover-Hervorhebung, Fehltipp `--bad` und beim nächsten Tipp `--land-wrong`, richtig `--ok`). In etwa jeder vierten Runde ist der erste Tipp richtig: Volltreffer, das Land wird golden (`--gold` flach, ohne Konfetti). Tempo und Wahrscheinlichkeiten in `DEMO_CONFIG` (app.js).
  - Ablauf: Land antippen = Hover-Hervorhebung (1 s); in 75 % der Runden zuerst ein Fehltipp, dann 0–1 weitere; dann die Lösung, 1,5 s stehen lassen, alles zurückblenden, 2 s komplett neutral. Abstand zweier Tipps 1,9 s, alle Färbungen blenden 0,8 s ease-in-out ein und aus.
  - Verworfen: gedämpfte Demo-Farben (Mischungen mit der Landfarbe, blassere und dünnere Hover-Kontur). Die linke Spalte ist jetzt neutral, daher darf die Karte die Farben des Spiels zeigen. Keine Kategoriefarben, keine Bewegung, keine Umsortierung: nur Klassen an den Länderpfaden (CSS-Übergänge auf fill) und der Hover-Pfad.
  - Länder rein zufällig (nicht aus dem Tageslevel, verrät also nichts), Lösung nie zweimal hintereinander dieselbe, Fehltipps aus den vier nächstgelegenen Ländern der Lösung.
  - Stoppt sofort beim Klick auf „Spielen“/„Weiterspielen“ und beim Verlassen des Startbildschirms (`stopIntroDemo`, Karte sofort neutral); pausiert, solange der Tab nicht sichtbar ist (nur sichtbare Zeit zählt); bei „Bewegung reduzieren“ keine Demo.
  - Geprüft 2026-10 (ruhige Fassung): je 40 s in hell und dunkel, Runden 6,1/8,1/9,9 s, zwischen den Runden jeweils 2,8 s neutral (0,8 s Ausblenden + 2 s Pause), Median 7 ms je Frame.
- Karte (`buildMap`, `outline`, `updateMap` in `app.js`), neu aufgebaut 2026-10. Prinzip: **nur Farbe und Kontur, keine Bewegung.**
  - Basiskarte: ein Pfad je Land (`path.st`), Füllung `--land`, Kontur in Hintergrundfarbe 1,3 px (`vector-effect: non-scaling-stroke`, `stroke-linejoin: round`, `fill-rule: evenodd`). Die Grenzen entstehen so als feine Linien in Hintergrundfarbe. Zeichenreihenfolge `DRAW`: Berlin, Bremen und Hamburg zuletzt, über den umgebenden Ländern (`ORDER` bleibt unverändert, davon hängt das Tageslevel ab).
  - Die Länderpfade werden **nie** umsortiert, ausgeblendet, kopiert oder transformiert. Zustände ändern nur die Füllung: falsch getippt `--land-wrong` (mit rotem Aufblinken), auf der Auswertungskarte gelöst `--ok`, nicht gelöst `--bad`.
  - Hervorhebung: eigene Ebene über den Ländern (unter den Beschriftungen) mit **genau zwei Pfaden**, unten Auswahl, oben Hover. Sie übernehmen per `setAttribute('d', …)` den Umriss des Landes (kein `<use>`, kein Klonen), `pointer-events: none`, Kontur 2 px in `--ink` (hell dunkel, dunkel hell), `non-scaling-stroke`, `stroke-linejoin: round`, Übergang nur auf fill (120 ms ease-out). Ohne `.on` ist die Füllung durchsichtig und die Kontur aus; der Umriss darf liegen bleiben.
  - Hover-Erkennung: `pointerover` auf der Basisgruppe (Länder und Klickflächen der Stadtstaaten), `pointerleave` auf derselben Gruppe, nicht pro Land. Nur bei echter Maus und `@media (hover: hover)`; Tastaturfokus zeigt dieselbe Hervorhebung. Hover über dem ausgewählten Land zeigt die Auswahlfarbe.
  - Lösung am Rundenende: der Auswahl-Pfad mit grüner (gelöst) bzw. roter (nicht gelöst) Füllung und derselben Kontur, dazu das Schild an der Beschriftung.
  - Gemessen 2026-10 (1920×1080, dreimal 64 schnelle Wechsel): Median 7 ms je Frame, längster 7,2 ms; alle 16 Länder, Reihenfolge der Pfade unverändert, keine Transforms.
  - Verworfen 2026-10, nicht wieder einführen:
    - Land beim Hovern per `appendChild` nach vorn holen: löst sofort neue mouseover/mouseout-Ereignisse aus, Hovern ruckelt und reagiert verzögert.
    - Vergrößern per `scale`: Geisterbild des Originals in Originalgröße (v. a. Inseln von Schleswig-Holstein); mit ausgeblendetem Original dafür Lücken an Einbuchtungen.
    - „Aufblähen“ per breiter Kontur (`<use>`-Ebenen mit Rand und Fläche): rundet Küsten ab („bubbly“), braucht Sonderlogik für Aussparungen (Bremen, Berlin) und Inseln; auch mit `miter`-Ecken keine überzeugende Form.
    - Schatten per `drop-shadow`: teuer bei jeder Bewegung, im hellen Modus zu kräftig.
    - Außenkontur um Deutschland (als Kopie jedes Landes oder als Filter über die Silhouette): Geisterbilder bzw. ungleich dicke Kontur.
    - Die alten Kartendaten (500 Einheiten breit, stark und ohne gemeinsame Topologie vereinfacht): zackige Grenzen.
- Kartenfarben (Token in `style.css`):
  - Hell: Hintergrund `#FFFFFF`, Land `#B9C1CB`, Hover `#8E99A6`, Auswahl `#3A4554`, Kontur `#121417`, falsch getippt hellrot `#F2B8BB`.
  - Dunkel: Hintergrund `#111315`, Land `#353B42`, Hover `#4E5761`, Auswahl `#C9D1DA`, Kontur `#F1F3F5`, falsch getippt gedämpftes Dunkelrot `#6B2F34`.
  - Auswahl ist bewusst neutral (nicht rot/grün, keine Kategoriefarbe). Richtig: `--ok` grün, nicht gelöst: `--bad` rot.
- Kartenbeschriftung (`LABELS`, `buildLabel`, `layoutLabels` in `app.js`): feste Position je Land, lange Namen zweizeilig am Bindestrich (Mecklenburg-/Vorpommern, Nordrhein-/Westfalen, Baden-/Württemberg, Schleswig-/Holstein, Rheinland-/Pfalz, Sachsen-/Anhalt). Berlin, Bremen, Hamburg und Saarland stehen außerhalb mit dezenter Hinweislinie.
  - Größe: bei 1920×1080 17 px, Lösungsschild 19,5 px tatsächliche Bildschirmgröße. Die SVG-Karte skaliert, deshalb rechnet CSS mit `--u` (Karteneinheiten pro Bildschirmpixel, aus `sizeMap()`) um und begrenzt nach oben auf 19,5 bzw. 22,4 Karteneinheiten (Karte 800 Einheiten breit): auf kleineren Karten werden die Namen proportional kleiner statt über Grenzen zu wachsen.
  - Normale Namen in Textfarbe mit Kontur in Hintergrundfarbe (lesbar auf jeder Landesfarbe). Die Lösung steht auf einem kräftigen Schild in Textfarbe.
  - Bei 1920×1080 per Skript geprüft (Spiel und Auswertung): alle 16 Namen gleichzeitig sowie jedes Lösungsschild zwischen den 15 anderen Namen, ohne Überlappung und ohne Grenzüberschreitung. Beim Verschieben von Positionen oder Ändern der Schriftgröße erneut so prüfen.
- Treffer: „+Punkte“ als grünes Abzeichen über dem gelösten Land (`pointsBadge`); nur Position/Deckkraft animieren, keine Skalierung (sonst unscharf).
- Hell- und Dunkelmodus über CSS-Variablen in `style.css`. Schriften: Bricolage Grotesque (Anzeige), Figtree (Text), selbst gehostet in `assets/fonts/` (je eine variable woff2-Datei, nur Latin, Bricolage 600–800 mit opsz-Achse, Figtree 400–700; SIL Open Font License, Lizenztexte daneben). Keine Anfragen an Google Fonts.
  - Umschalter (Sonne/Mond, zeigt den aktuellen Modus) rechts neben „?“ in der Kopfzeile. Ohne eigene Wahl gilt die Systemeinstellung; eine Wahl steht in `localStorage` (`sechzehn-theme`, try/catch) und als `data-theme` am `<html>`, das die Farbtoken überschreibt.
  - Ein kleines Inline-Script im `<head>` von `index.html` setzt `data-theme` vor dem ersten Zeichnen (kein Aufblitzen). Umschalten tauscht nur Token, Spielstand und laufende Animationen bleiben unberührt (getestet mitten in einer Runde).
- Verworfen: Geldscheine als Belohnungssymbol (Euro ist nicht deutsch, passt nicht zur Punktestaffel, Glücksspiel-Anmutung).

## Projektstruktur

- `index.html`, `style.css`, `app.js` – das Spiel (reines HTML/CSS/JS, kein Build-Schritt). `sound.js` – Klänge (Web Audio API), `teilen.js` – Teilen-Bilder (Canvas); beide vor `app.js` geladen.
- `data/fakten.csv` – der Faktenpool (Semikolon-getrennt, UTF-8). **Einzige Quelle für Inhalte.**
- `data/map.json` – Umrisse der Bundesländer als SVG-Pfade (`{w, h, states: {BW: {name, d, c}, …}}`, 800 × 1082,3 Einheiten). Quelle: github.com/isellsoap/deutschlandGeoJSON, `2_bundeslaender/2_hoch.geo.json` (gemeinfrei). Vereinfacht mit mapshaper `-simplify 8% keep-shapes` (topologieerhaltend: Nachbarländer teilen sich exakt dieselbe Grenzlinie, keine eigene Punktausdünnung), Projektion x = Länge × cos(51,2°), y = −Breite, auf 800 Einheiten Breite skaliert, 1 Nachkommastelle, jede Teilfläche ein eigener Unterpfad; `c` = Flächenschwerpunkt der größten Teilfläche. 3837 Punkte, 44 KB.
  - Neu erzeugen (kein Node nötig): Spielserver starten, `& .\tools\karte-speichern.ps1` starten (wartet auf localhost:8001), dann http://localhost:8000/tools/karte-erzeugen.html öffnen und „An karte-speichern.ps1 senden“ drücken. Die Seite lädt mapshaper 0.7.80 (`www/modules.js` und `www/mapshaper.js` von unpkg) und die Quelle direkt von GitHub, zeigt eine Vorschau und bietet die Datei auch zum Herunterladen an.
  - Fest hinterlegte Kartenkoordinaten (`LABELS`, `SMALL` in `app.js`) beziehen sich auf diese Karte. Beim Wechsel von der alten 500er-Karte galt x' = 1,6·x, y' = 1,6·y − 2,25.
- Lokal starten: Kein Python/Node auf dem Rechner; der Server läuft über PowerShell (`.claude/launch.json`, Name „sechzehn“, Port 8000). Dann http://localhost:8000. Mit `?tag=3` lässt sich ein beliebiger Tag testen (nur lokal).
- `tools/stufen-luecken.ps1`, `tools/pruefung-einspielen.ps1` (Faktenpool, siehe unten), `tools/screenshots.ps1` (Screenshots, siehe Entwicklermodus).

## Entwicklermodus (`?dev=1`)

Zum Prüfen von Serienlogik, Statistik und Darstellung, nicht für Spieler. Wirkt nur lokal (localhost), online nicht. Mit `?dev=1` erscheint unten rechts ein Feld „Entwicklermodus“:
- **Als gespielt eintragen:** trägt Tag N mit den Hinweisnummern der fünf Runden ein (Feld „Hinweise“, z. B. `1,2,x,3,1`, x = nicht gelöst, vorbelegt mit Zufallswerten; die Punkte werden daraus berechnet). Läuft über dieselbe Funktion `recordDay` wie das Spiel, vorhandene Tage bleiben unverändert. Danach springt das Feld auf Tag N+1.
- **Vortage zufällig füllen:** trägt die N Tage vor „heute“ mit zufälligen Hinweisen ein (meist früh gelöst, selten gar nicht). Mit 9 Vortagen und dem heute gespielten Tag ergeben sich 10 Tage.
- **35 Tage simulieren:** ersetzt die Statistik durch die 35 Tage vor „heute“ (`simulateHistory`): einzelne Lücken (ca. 15 %, nie in den letzten 6 Tagen), zwei perfekte Tage (vor 20 und vor 3 Tagen), sonst Zufallswerte; mit Ländern aus dem jeweiligen Tageslevel.
- **Statistik löschen:** entfernt `sechzehn-statistik`.
- Darunter: aktuelle Serie, längste Serie, gespielte Tage, gezählte Runden, Zeitraum.
- „Heute“ verschiebt man mit `?tag=N&dev=1`; im Entwicklermodus zählen auch so gespielte Tage für die Statistik.

Demo-Spielstände (nur mit `?dev=1`, kein Startbildschirm, nichts wird gespeichert, Statistik mit neun festen Vortagen nur im Speicher):
- `&demo=spiel`: erste Runde mit zwei falschen Tipps (die beiden Länder, die der Lösung am nächsten liegen); `&falsch=0…4` ändert die Zahl, `&hover=SH` hebt ein Land wie unter dem Mauszeiger hervor. `tools/screenshots.ps1 -Faktor 2` rendert mit doppelter Pixeldichte für Detailausschnitte.
- `&demo=ende`: Auswertung mit festem Ergebnis.
- `&demo=perfekt`: perfekte Auswertung (500/500) mit voller Facetten-Animation; `&statisch=1` zeigt den Endzustand wie nach Neuladen. Taste F spielt die Animation erneut ab.
- `&verlauf=1`: Demo-Statistik mit dem 35-Tage-Verlauf statt neun Vortagen. `&statistik=1`: Statistikfenster gleich offen (für Screenshots), z. B. `?tag=40&dev=1&demo=ende&verlauf=1&statistik=1` (`screenshots/statistik-hell.png`, `statistik-dunkel.png`).
- `&theme=light|dark`: Modus erzwingen, ohne die Wahl zu speichern.
- `tools/screenshots.ps1` erzeugt daraus mit Edge im Hintergrundmodus echte 1920×1080-Screenshots (`screenshots/spiel-hell.png`, `spiel-dunkel.png`, `ende-hell.png`, `ende-dunkel.png`; Größe und Tag per Parameter). Eigene Ansichten mit `-Ansichten 'name=parameter'`, z. B. `'hover-sh-hell=demo=spiel&falsch=0&hover=SH&theme=light'`. Der Server muss laufen. Die Bildschirmemulation im Browser-Fenster von Claude liefert bei 1920×1080 nur stark verkleinerte Bilder, daher dieser Weg.

Bewährte Testfälle (2026-10 durchgespielt):
1. **Drei Tage am Stück:** `?tag=10&dev=1`, Tag 8 und 9 eintragen, Tag 10 spielen → Serie 2 → 3 mit Animation, „Neuer Rekord: 3 Tage am Stück!“.
2. **Zweimal derselbe Tag:** danach Spielstand löschen (`sessionStorage.clear()` oder neuer Tab) und Tag 10 erneut spielen → Statistik unverändert, Hinweis „erstes Ergebnis zählt“.
3. **Ausgelassener Tag:** `?tag=12&dev=1` (Tag 11 fehlt) → vor dem Spiel Serie 0, danach 1; längste Serie bleibt 3, kein Rekordhinweis.
4. **35-Tage-Verlauf:** `?tag=40&dev=1`, „35 Tage simulieren“, Tag 40 perfekt spielen → Diamant-Zähler 2 → 3, Kalender heute als Diamant-Kästchen, Abzeichen „× 3“ mit heutigem Datum, Statistikzeile mit „Neuer Rekord!“ (falls die Serie die längste ist). Fenster in hell/dunkel bei 1920×1080 und 400px geprüft: Tooltip, Esc, Klick daneben, Fokus zurück, kein waagerechtes Scrollen (2026-10).
Testdaten danach mit „Statistik löschen“ entfernen.

## Datenformat `data/fakten.csv`

| Spalte | Bedeutung |
|---|---|
| id | `LAND-KAT-NNN`, z. B. `RP-GEO-001`. KAT: GEO, GES, POL, WIR, KUL, SPO, PER, ALL. Die ID bleibt fest, auch wenn sich die Kategorie später ändert (z. B. `RP-KUL-001` ist heute Persönlichkeiten). |
| land | BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH |
| kategorie | Spielkategorie (siehe Kategoriensystem): Geografie, Geschichte, Politik, Wirtschaft, Kultur, Sport, Persönlichkeiten, Alltag |
| thema | Unterthema, muss zur Kategorie passen (siehe Kategoriensystem) |
| denkweg | Wissen, Herleitung oder Wiedererkennung |
| stufe | 1–5 (siehe unten) |
| text | Hinweistext, wie er im Spiel erscheint |
| trifft_auch_zu | weitere Länder, auf die der Hinweis passt (Kürzel, kommagetrennt) |
| quelle | Link als Beleg (Pflicht) |
| zeitabhaengig | ja/nein – Aussagen mit „seit“, „aktuell“, Amtsinhabern usw. |
| stand | Monat der letzten Prüfung, `JJJJ-MM` |
| status | `entwurf`, `geprüft`, `unsicher`, `falsch` |
| pruefnotiz | Begründung der Prüfung |

Das Spiel liest Spalten über ihre Namen (`parseCSV`); zusätzliche Spalten stören nicht. Fakten mit einer Kategorie, die nicht in `CATEGORIES` (app.js) steht, sortiert `usable()` **ohne Fehlermeldung** aus. Neue Kategorie also immer gleichzeitig in `CATEGORIES`, `style.css` (`--c-…`, hell und zweimal dunkel), `tools/pruefung-einspielen.ps1` und `tools/stufen-luecken.ps1` eintragen.

### Kategoriensystem (entschieden 2026-10)
Zwei Ebenen: Die **Spielkategorie** steht farbig auf der Hinweiskarte und bestimmt die Regel „fünf verschiedene Kategorien pro Runde“. Das **Thema** ist nur Metadatum für Verteilung und Suche. Grundlage war ein externer Entwurf mit 18 Kategorien (`sechzehn_hinweiskatalog.docx`); 18 Farben und lange Namen passen nicht auf die Karte, „Fun Facts“ ist als Auffangkategorie entfallen (Superlative gibt es in jeder Kategorie).

| Spielkategorie | Farbe | Themen |
|---|---|---|
| Geografie | `--c-geografie` | Geografie (Lage, Grenzen, Gewässer, Berge), Natur und Umwelt, Bevölkerung und Städte |
| Geschichte | `--c-geschichte` | Geschichte |
| Politik | `--c-politik` | Politik und Verwaltung |
| Wirtschaft | `--c-wirtschaft` | Wirtschaft und Industrie (inkl. Landwirtschaft, Weinbau), Unternehmen und Marken, Infrastruktur und Verkehr |
| Kultur | `--c-kultur` | Kultur und Kunst, Medien und Popkultur, Architektur und Sehenswürdigkeiten, Wissenschaft und Bildung |
| Sport | `--c-sport` | Sport |
| Persönlichkeiten | `--c-personen` (Bordeaux, hell `#8E2F4B`, dunkel `#B4486A`) | Persönlichkeiten |
| Alltag | `--c-alltag` | Essen und Produkte, Sprache und Identität, Feste und Bräuche |

Zuordnungsregeln:
- Die Kategorie richtet sich nach dem Hauptgegenstand des Hinweises. „Person X wurde hier geboren / stammt von hier / wirkte hier“ → Persönlichkeiten. Ein Werk, ein Ort, ein Ereignis oder eine Institution → Fachkategorie (Wagner-Festspiele → Kultur, Wartburg → Kultur, Merkels Wahlkreis → Politik, Fritz Walter beim FCK → Sport).
- Personen aus Sport und Politik gehören in Sport bzw. Politik, wenn es um ihre Rolle dort geht.
- Landwirtschaftliche Erzeugung ist Wirtschaft; ein Gericht oder eine regionale Spezialität ist Alltag.

Denkweg (wie kommt man auf die Lösung?):
- **Wissen:** Man muss eine bestimmte Tatsache kennen (Bildungs- oder Spezialwissen).
- **Herleitung:** Lösbar durch Überlegen, Karte, Ausschluss oder Wortbestandteile („Landgrenzen zu drei Staaten“, „Weimarer Republik“).
- **Wiedererkennung:** Ein bekannter Name aus Sport, Marken, Medien, Alltag oder Landeskunde verrät die Region (Hansa Rostock, BMW, Zugspitze, „Rundstück“).
Herleitung passt besonders gut auf Stufe 1–2, Wiedererkennung auf Stufe 4–5.

Ziele für den Ausbau (pro Land, bei ca. 20 Fakten):
- je Stufe mindestens 3 Fakten, damit sich Runden abwechseln können;
- mindestens 6 der 8 Kategorien; Geschichte und Politik zusammen höchstens 30 %;
- jeder Denkweg mindestens 4-mal. Stand 2026-10 nach Etappe 1 (191 Fakten): Wissen 94, Wiedererkennung 60, Herleitung 37 → weiter gezielt Herleitung suchen.
- Etappe 1 (2026-10, erledigt): die sechs Länder ohne Fakten (BE 23, BB 20, HB 21, HE 22, NW 24, ST 21). Alle sechs erfüllen die Ziele bis auf: HE und ST haben nur 2 geprüfte Fakten auf Stufe 5. Nächste Etappe: die übrigen zehn Länder (je 5–6 Fakten) auf ca. 20 auffüllen.
- Kein künstlicher Hinweis: Eine offene Stelle ist besser als ein schwacher oder unklarer Fakt.

Präzisionsregeln (für Erzeugung und Prüfung):
- Hauptsitz, Gründungsort und Produktionsstandort unterscheiden; ebenso Geburtsort, Herkunft, Wohnort und Wirkungsort; Drehort, Handlungsort und Produktionsort.
- Historische Orte auf das heutige Land beziehen und das kenntlich machen („heute in …“, „Geburtsland“ nur im heutigen Sinn).
- Superlative („größte“, „älteste“, „erste“, „einzige“) nur mit klarer Kennzahl, Bezugsjahr und Quelle; aktiv nach Gegenbeispielen in allen 16 Ländern suchen.
- Regionale Wörter und Gerichte enden selten an Landesgrenzen: Verbreitung prüfen, `trifft_auch_zu` füllen.
- Mehrdeutigkeit ist auf Stufe 1–2 erlaubt und gewollt (dokumentiert in `trifft_auch_zu`), Stufe 5 muss eindeutig sein.
- Eine Runde ist eine Kette: Ein Hinweis darf keinen anderen desselben Landes bloß umformulieren (gleicher Kern, z. B. zweimal „Vereine aus Stadt X“).
- Bei Stadtstaaten verrät fast jeder Stadtbezug das Land: dort bewusst indirekt formulieren.

Was gut ankommt (Bewertungsprobe 2026-10, 20 ausgedachte Hinweise, 1–10, Schnitt 7,7):
- **9–10:** Hinweise mit Denkschritt oder kleinem Aha: Karte abzählen („grenzt an sechs Länder, an keinen Staat“), eine bekannte Zahl umschreiben („jeder fünfte Einwohner Deutschlands“), zwei bekannte Dinge kombinieren (EZB + größter Flughafen), eine Falle mit Auflösung („BER liegt nicht in der Hauptstadt, sondern hier“), Alltagswissen und Märchen (Bremer Stadtmusikanten), ein eindeutiges Regionalwort („Schrippe“), eine Person mit Verwechslungsgefahr (Luther, Eisleben).
- **8:** Zweistufige Hinweise (Goethe → größte Stadt → Land), Verwaltungsbesonderheiten, auch fachliche (Bezirke/Abgeordnetenhaus, Landschaftsverbände), bekannte Namen mit Zuordnungsfalle (Brocken), Medien (Sendung mit der Maus).
- **5–6, sparsam einsetzen:** reines Bildungswissen aus Kunst- und Kulturgeschichte oder Archäologie (Bauhaus Dessau, Himmelsscheibe von Nebra), Essen, das sich viele Länder teilen (Grünkohl mit Pinkel), sehr breite Herleitung ohne Pfiff („Hauptstadt ist nicht die größte Stadt“), „Bembel“ (Grund unklar; „Schrippe“ bekam 9).

### Stufen
Gemessen wird nicht, wie obskur ein Fakt ist, sondern: *Welcher Anteil der Spieler nennt mit diesem Hinweis allein das richtige Land?*

| Stufe | Anteil | Typisch |
|---|---|---|
| 1 | < 10 % | Fachwissen oder kaum eingrenzend |
| 2 | 10–30 % | grenzt auf wenige Länder ein |
| 3 | 30–55 % | eindeutig, aber nicht allgemein bekannt |
| 4 | 55–80 % | eindeutig, vielen bekannt |
| 5 | > 80 % | fast die Lösung |

Fehler aus dem ersten Test: „Grenzt an Frankreich, Luxemburg und Belgien“ war als Stufe 2 zu leicht (verrät das Land). Besser: „Grenzt an drei andere Staaten“ (trifft auf RP und BW zu).

### Regeln für eine Runde (in `app.js`, `buildRound`)
- 5 Fakten zum selben Land, je einer pro Stufe 1→5, alle aus verschiedenen Kategorien.
- Stufe 5 muss eindeutig sein (`trifft_auch_zu` leer).
- Nur Status `geprüft` (`CONFIG.ALLOW_DRAFTS: false`; `true` nur zum Testen, dann zählen auch `entwurf` und `unsicher`).
- Spielstand: `CONFIG.KEEP_PROGRESS: true` → localStorage, der Tag lässt sich nicht durch Neuladen oder einen neuen Tab neu spielen (`false` = sessionStorage, nur zum Testen).
- Tageslevel wird deterministisch aus der Tagesnummer erzeugt (gleicher Seed für alle).

### Inhaltliche Leitlinien
- Keine wörtlichen Zitate realer Personen, außer mit Primärquelle.
- Zahlen nur mit Quelle; eine falsche Zahl kann den Hinweis auf ein anderes Land verschieben.
- Politisch neutral formulieren; keine Wertungen über Parteien oder Personen.
- Startziel: ca. 20 geprüfte Fakten pro Land (≈ 320 gesamt).

## Prüf-Agent

Definition: `../.claude/agents/faktenpruefer.md` (Subagent `faktenpruefer`, Tools: Read, Write, WebSearch, WebFetch). Er ändert die CSV nicht selbst, sondern schreibt pro Auftrag eine JSON-Datei; `tools/pruefung-einspielen.ps1 <datei.json> …` überträgt sie in `data/fakten.csv` (setzt `stand`, erhält BOM und Zeilenenden). Bewährt: ein Agent pro 3 Länder, mehrere parallel. Erster Lauf: 2026-10, 50 Fakten → 37 geprüft, 13 unsicher, 0 falsch. Nach zwei Überarbeitungs- und Nachprüfrunden: alle 50 geprüft. Das Einspielskript übernimmt nur die Felder, die im JSON stehen (`quelle`, `trifft_auch_zu`, `zeitabhaengig`, `status`, `pruefnotiz`, `text`, `stufe`, `kategorie`, `thema`, `denkweg`), prüft Kategorie, Thema (passend zur Kategorie) und Denkweg gegen das Kategoriensystem und setzt `stand` nur, wenn `status` dabei ist (eine reine Einordnung ist keine Prüfung). Für menschliche Überarbeitungen von `text`/`stufe` den Status auf `entwurf` setzen und erneut prüfen lassen. 2026-10 wurden alle 60 Fakten nach dem Kategoriensystem eingeordnet (6 von Kultur nach Persönlichkeiten); alle 10 Länder blieben spielbar.

Achtung Stufenlücken: Jede Stufenänderung kann einem Land die Runde nehmen, solange es nur einen Fakt pro Stufe hat. `tools/stufen-luecken.ps1 [-NurGeprueft]` zeigt pro Land, ob eine Runde möglich ist und welche Stufe/Kategorie fehlt. Stand 2026-10: alle 16 Länder spielbar, auch nur mit geprüften Fakten (in 200 simulierten Tagen kommt jedes Land 52- bis 79-mal vor, kein Tag unvollständig).

## Erzeuger-Agent

Definition: `../.claude/agents/faktenerzeuger.md` (Subagent `faktenerzeuger`, Tools: Read, Write, WebSearch, WebFetch). Aufruf mit Länderkürzel, Anzahl und Ausgabepfad. Sammelt ca. 30–35 Ideen, wählt nach den Ausbauzielen und „Was gut ankommt“ aus, belegt jeden Fakt mit einer tatsächlich abgerufenen Quelle und schreibt ein JSON-Array mit allen CSV-Spalten außer `stand` (Status `entwurf`, IDs `LAND-KAT-NNN` fortlaufend ohne Kollision, `pruefnotiz` beginnt mit „Erzeugt:“ und nennt offene Punkte für den Prüfer). Ändert die CSV nicht.

Ablauf (bewährt in Etappe 1): ein Erzeuger pro Land parallel → `tools/pruefung-einspielen.ps1 erzeugt-XX.json` hängt die Zeilen an → ein `faktenpruefer` pro Land mit den offenen Punkten des Erzeugers im Auftrag → einspielen → unsichere Fakten nach den Vorschlägen des Prüfers überarbeiten (Text/Stufe per JSON, Status `entwurf`) → Nachprüfung nur der offenen Frage → einspielen; was danach unsicher bleibt, entscheidet der Mensch. Etappe 1: 131 Fakten erzeugt; erste Prüfung 104 geprüft, 27 unsicher, 0 falsch; nach einer Überarbeitungsrunde 129 geprüft, 2 unsicher. Das Sitzungskontingent reichte nicht für alle Prüfläufe am Stück: Prüfer schreiben Teilergebnisse, offene IDs danach in eine neue Datei prüfen lassen (nicht überschreiben).

`tools/pruefung-einspielen.ps1` hängt Zeilen mit unbekannter ID an. Pflichtfelder: id, land, kategorie, thema, denkweg, stufe, text; die ID muss zu Land und Kategorie passen; eine neue ID, die in den Eingaben mehrfach vorkommt, wird ganz abgelehnt; fehlt `status`, gilt `entwurf`; `stand` bleibt bei neuen Entwürfen leer. Mit `-Csv pfad` arbeitet das Skript auf einer anderen Datei (zum Testen an einer Kopie).

Prüft jeden Fakt mit Status `entwurf` gegen seine Quelle, nicht gegen eigenes Wissen:
1. **Richtigkeit:** Quelle aufrufen; deckt sie die Aussage? Präzisionsregeln (Abschnitt Kategoriensystem) anwenden.
2. **Eindeutigkeit:** Trifft der Hinweis auch auf andere Länder zu? → `trifft_auch_zu` füllen. Passt er dadurch nicht mehr zur Stufe, Stufe vorschlagen.
3. **Haltbarkeit:** zeitabhängige Aussagen markieren.
4. **Einordnung:** Kategorie, Thema und Denkweg prüfen und bei Bedarf korrigieren; Dopplung mit anderen Fakten desselben Landes melden.
Ergebnis: `status` auf `geprüft` / `unsicher` / `falsch`, Begründung in `pruefnotiz`, `stand` setzen. Der Mensch prüft nur `unsicher`.

## Hosting und Veröffentlichen

- Online seit 2026-10-17: **https://julienlb2002.github.io/sechzehn/** (Repository https://github.com/julienlb2002/sechzehn, öffentlich, Branch `main`; Pages-Quelle „GitHub Actions“).
- Werkzeuge: Git (Git for Windows) und GitHub CLI per winget installiert, angemeldet als `julienlb2002` (`gh auth login`, Git nutzt dessen Anmeldung). Commits mit der privaten GitHub-Adresse `339765953+julienlb2002@users.noreply.github.com`. In bereits offenen Fenstern fehlen `git`/`gh` evtl. im PATH: neues Terminal öffnen oder `& 'C:\Program Files\Git\cmd\git.exe'` bzw. `& 'C:\Program Files\GitHub CLI\gh.exe'`.
- Hosting: GitHub Pages (vorerst ohne eigene Domain), Repository „sechzehn“. Öffentliche Adresse steht **nur** in `CONFIG.SITE_URL` (`app.js`): Teilen-Text und Teilen-Bilder lesen sie direkt, die Link-Vorschau in `index.html` enthält den Platzhalter `%SITE_URL%`, den der Workflow beim Veröffentlichen ersetzt (Workflow bricht ab, wenn `SITE_URL` noch `GITHUB-NAME` enthält).
- Repository = Ordner `Sechszehn` (mit `.claude/`, `.github/`, `sechzehn/`). `.gitignore`: `sechzehn/screenshots/`, `*.zip`, lokale Einstellungen.
- Veröffentlicht wird nur die Website (`.github/workflows/pages.yml`): `index.html`, `impressum.html`, `datenschutz.html`, `app.js`, `style.css`, `sound.js`, `teilen.js`, `manifest.webmanifest`, `data/`, `assets/` (+ `.nojekyll`). Nicht: `tools/`, `CLAUDE.md`, `.claude/`, Screenshots. Neue Website-Dateien in die `cp`-Zeile des Workflows aufnehmen.
- Link-Vorschau: Open Graph und Twitter Card im `<head>` (Titel „Sechzehn“, Beschreibung „Fünf Hinweise, ein Bundesland. Jeden Tag ein neues Rätsel.“, `assets/brand/og-image.png` 1200×630 mit absoluter URL, `og:type` website, `og:locale` de_DE). Symbole: `favicon.ico` (Standard), `favicon-32.png`, `apple-touch-icon.png`; Web-App-Manifest `manifest.webmanifest` (icon-192, icon-512, icon-maskable-512 mit `purpose: maskable`, Farben `#111315`, `display: standalone`, `lang: de`).
- Entwicklermodus, Demo- und Testparameter (`?dev=1`, `&demo=…`, `?tag=N`, `&theme=…`) wirken nur auf localhost/127.0.0.1 (`LOCAL` in `app.js`, auch im Inline-Script von `index.html`). Online sind sie wirkungslos (sonst ließen sich künftige Tage spielen).
- Impressum (`impressum.html`) und Datenschutzerklärung (`datenschutz.html`): eigene schlichte Seiten im Stil des Spiels (Spielschriften, Hell/Dunkel aus `sechzehn-theme`), verlinkt dezent im Hilfe-Blatt („?“) und unten auf dem Startbildschirm (`LEGAL_LINKS` in `app.js`). Impressum: Angaben nach § 5 DDG, Kontakt, Verantwortlich nach § 18 Abs. 2 MStV, privates nicht kommerzielles Projekt, Haftung, Spielinhalte, Kartengrundlage und Schriftlizenzen. Datenschutz (Stand Oktober 2026): keine Cookies/Tracking/Dienste Dritter, Hosting GitHub Pages (Server-Logs, Art. 6 Abs. 1 lit. f DSGVO, USA/Data Privacy Framework „nach Angaben des Anbieters“), localStorage (§ 25 Abs. 2 Nr. 2 TDDDG; Schlüssel `sechzehn-statistik`, `sechzehn-tag-N`, `sechzehn-theme`, `sechzehn-ton`), Teilen lokal, E-Mail-Kontakt, Betroffenenrechte, Beschwerde z. B. bei der LDI NRW.
  - **Regel:** Die Datenschutzerklärung muss beschreiben, was die Website tatsächlich tut. Jede neue Funktion, die Daten erhebt oder überträgt (z. B. Bestenliste, Statistik-Server, eingebundene Inhalte, externe Schriften/Skripte/Bilder, Analyse, neue localStorage-Schlüssel mit anderem Zweck), erfordert vor dem Veröffentlichen eine Anpassung von `datenschutz.html` (und „Stand“). Geprüft 2026-10: Die veröffentlichten Dateien laden nur eigene Dateien (`data/`, `assets/`); fremde Adressen gibt es nur in `tools/karte-erzeugen.html`, das nicht veröffentlicht wird.

- Online geprüft 2026-10-17: alle Website-Dateien 200 mit richtigem Dateityp (woff2 `font/woff2`, Manifest `application/manifest+json`), `CLAUDE.md` und `tools/` 404; Spiel lädt (Karte, Fakten, Tageslevel), Schriften aus dem Projekt, keine Anfragen an fremde Server; `?dev=1&tag=99&demo=ende` online wirkungslos; Teilen-Text und Teilen-Bild mit `julienlb2002.github.io/sechzehn`; Link-Vorschau mit opengraph.xyz geprüft (Titel, Beschreibung, Bild 1200×630, `summary_large_image`).
- Hinweis aus dem Workflow-Protokoll: Die Actions (checkout@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4) laufen auf Node 20, das GitHub ausmustert; bei Gelegenheit auf neuere Hauptversionen anheben.

**So bringe ich Änderungen online:** im Ordner `Sechszehn` `git add -A`, `git commit -m "…"`, `git push`. Der Workflow „Website veröffentlichen“ läuft automatisch (Fortschritt unter Actions im GitHub-Repository) und ist nach ca. 1 Minute online. Vorher lokal prüfen; bei neuen Fakten `tools/stufen-luecken.ps1 -NurGeprueft`.
## Offene Punkte / nächste Schritte

1. Vier `unsicher`-Fakten entscheiden (siehe `pruefnotiz`): BY-SPO-001 (Stufe 4 statt 3?), HH-ALL-001 („Rundstück“ heute kaum gebräuchlich, Text und `trifft_auch_zu` SH,NI klären), HE-WIR-001 („Abraumhalde“ → „Salzhalde“?), HE-ALL-002 (Ebbelwoi auch am bayerischen Untermain: `trifft_auch_zu` BY und Stufe 4, oder BY verwerfen und Stufe 5).
2. Etappe 2 des Faktenausbaus: die zehn übrigen Länder auf ca. 20 Fakten auffüllen (Erzeuger-Agent, siehe oben); dabei HE und ST je einen weiteren Stufe-5-Fakt geben. Gemeldete, aber belassene Stadt-Dopplungen in verschiedenen Stufen: NW Köln (NW-ALL-003/NW-KUL-001), Bonn (NW-PER-002/NW-GES-002), ST Magdeburg (beide Stufe 5, unkritisch).
3. Ländernamen ragen auf sehr kleinen Karten (unter ca. 460px Breite, Mindestgröße 11 px) über Grenzen; beim Zoomen nicht. Auswertung auf dem Handy weiterhin ohne Karte. Handy-Layout auf echten Geräten prüfen (bisher nur Geräte-Emulation).
4. Eigene Domain: dann nur `CONFIG.SITE_URL` in `app.js` ändern (Workflow setzt sie in die Link-Vorschau ein), in GitHub unter Settings → Pages die Domain eintragen und eine `CNAME`-Datei in die Website-Liste des Workflows aufnehmen.
5. Wiederverwendungssperre: ein Fakt frühestens nach X Tagen erneut (Tagespläne vorab erzeugen und speichern).
6. Bremerhaven fehlt in den Geodaten (auch in `2_hoch.geo.json` besteht Bremen nur aus einer Fläche) – andere Quelle oder Ergänzung prüfen.
7. `favicon.svg` fehlt noch in `assets/brand/` (derzeit favicon.ico + favicon-32.png).
8. Später: Bestenliste/Score-Vergleich, „alle 16 Länder sammeln“. Die persönliche Statistik liegt nur im Browser: Gerätewechsel oder gelöschte Website-Daten setzen sie zurück.
9. Punktestaffel final festlegen.
