// Sechzehn – Spiellogik
// Lädt Karte und Faktenpool, stellt das Tageslevel deterministisch zusammen (gleich für alle Spieler) und steuert das Spiel.

const CONFIG = {
  POINTS: [100, 75, 50, 30, 10],
  ROUNDS: 5,
  START_DATE: '2026-10-15',      // Tag 1 des Spiels
  ALLOW_DRAFTS: false,           // nur geprüfte Fakten (true = auch "entwurf" und "unsicher", nur zum Testen)
  KEEP_PROGRESS: true,           // Spielstand im localStorage: Neuladen und neue Tabs setzen den Tag fort (false = nur pro Tab)
  // Öffentliche Adresse, EINZIGE Stelle: Teilen-Text, Teilen-Bilder und (beim Veröffentlichen per Workflow eingesetzt) die
  // Link-Vorschau in index.html (og:image, og:url). Domainwechsel = nur diese Zeile ändern. Ohne Schrägstrich am Ende.
  SITE_URL: 'https://julienlb2002.github.io/sechzehn',
};
// Entwicklermodus, Demo- und Testparameter (?dev=1, ?demo=…, ?tag=N, ?theme=…) wirken nur lokal, online nicht.
const LOCAL = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

const CATEGORIES = {
  Politik: 'politik', Geografie: 'geografie', Geschichte: 'geschichte', Kultur: 'kultur',
  Sport: 'sport', Wirtschaft: 'wirtschaft', Alltag: 'alltag', 'Persönlichkeiten': 'personen',
};
// Kartenbeschriftung: at = Mitte des Textes (Karteneinheiten der Karte mit 800 Einheiten Breite), | = Zeilenumbruch.
// Kleine Länder stehen außerhalb (anchor = Textausrichtung) mit einer Hinweislinie, die bei "from" im Land beginnt.
const LABELS = {
  BW: { at: [278, 916], text: 'Baden-|Württemberg' },
  BY: { at: [486, 862] },
  BB: { at: [691, 411] },
  BE: { at: [627, 305], anchor: 'end', from: [654, 350] },
  HE: { at: [272, 625] },
  MV: { at: [579, 177], text: 'Mecklenburg-|Vorpommern' },
  NI: { at: [339, 334] },
  HB: { at: [211, 260], anchor: 'end', from: [251, 268] },
  NW: { at: [147, 507], text: 'Nordrhein-|Westfalen' },
  RP: { at: [104, 689], text: 'Rheinland-|Pfalz' },
  SL: { at: [83, 875], from: [91, 795] },
  ST: { at: [502, 449], text: 'Sachsen-|Anhalt' },
  SN: { at: [659, 561] },
  SH: { at: [339, 126], text: 'Schleswig-|Holstein' },
  TH: { at: [451, 580] },
  HH: { at: [342, 267], anchor: 'start', from: [366, 206] },
};
const SMALL = { BE: 21, HB: 18, HH: 19 }; // unsichtbare Klickflächen (Radius) für die Stadtstaaten
const ORDER = ['BW', 'BY', 'BB', 'BE', 'HE', 'MV', 'NI', 'HB', 'NW', 'RP', 'SL', 'ST', 'SN', 'SH', 'TH', 'HH']; // Reihenfolge fürs Tageslevel, nie ändern
const DRAW = ORDER.filter(id => !['BE', 'HB', 'HH'].includes(id)).concat('BE', 'HB', 'HH'); // Zeichenreihenfolge: Stadtstaaten zuletzt, über den umgebenden Ländern
const VIEW = m => `-10 -10 ${m.w + 20} ${m.h + 20}`; // viewBox mit etwas Rand
const NS = 'http://www.w3.org/2000/svg';
const $ = s => document.querySelector(s);

let MAP, NAMES, LEVEL, DAYNO;
let state, fx = null, shownTotal = 0, ui = null;
let introOpen = false, ticker = null; // Startbildschirm offen? / Countdown auf dem Endbildschirm

/* ---------- Daten laden ---------- */

function parseCSV(text) {
  // Semikolon-getrennt, Felder dürfen in "..." stehen (dann sind ; und "" erlaubt).
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/* ---------- Tageslevel zusammenstellen ---------- */

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function usable(f) {
  if (!CATEGORIES[f.kategorie]) return false;
  if (f.status === 'geprüft') return true;
  return CONFIG.ALLOW_DRAFTS && (f.status === 'entwurf' || f.status === 'unsicher');
}

// Wählt für ein Land 5 Fakten: je einer pro Stufe 1–5, alle aus verschiedenen Kategorien,
// Stufe 5 muss eindeutig sein. Gibt null zurück, wenn der Pool das nicht hergibt.
function buildRound(land, facts, rand) {
  const byStufe = [1, 2, 3, 4, 5].map(s => shuffle(facts.filter(f => f.land === land && +f.stufe === s && (s < 5 || !f.trifft_auch_zu)), rand));
  const pick = [], used = new Set();
  const go = i => {
    if (i === 5) return true;
    for (const f of byStufe[i]) {
      if (used.has(f.kategorie)) continue;
      used.add(f.kategorie); pick.push(f);
      if (go(i + 1)) return true;
      used.delete(f.kategorie); pick.pop();
    }
    return false;
  };
  return go(0) ? { a: land, h: pick.map(f => [f.kategorie, f.text, f.id]) } : null;
}

function buildLevel(facts, dayNo) {
  const rand = rng(dayNo * 7919 + 17);
  const pool = facts.filter(usable);
  const rounds = [];
  for (const land of shuffle(ORDER, rand)) {
    const r = buildRound(land, pool, rand);
    if (r) rounds.push(r);
    if (rounds.length === CONFIG.ROUNDS) break;
  }
  return rounds;
}

function dayNumber() {
  const p = new URLSearchParams(location.search).get('tag'); // ?tag=3 zum Testen (nur lokal, sonst ließen sich künftige Tage spielen)
  if (LOCAL && p && /^\d+$/.test(p)) return +p;
  const start = new Date(CONFIG.START_DATE + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((now - start) / 864e5) + 1);
}

/* ---------- Spielzustand ---------- */

function fresh() { return { round: 0, hint: 0, wrong: [], sel: null, done: false, results: [] }; }
function cur() { return LEVEL[state.round]; }
function total() { return state.results.reduce((s, r) => s + r.pts, 0); }
function catVar(c) { return `var(--c-${CATEGORIES[c]})`; }

/* ---------- Darstellung ---------- */
// Die Spielansicht wird einmal aufgebaut (buildGame) und danach nur gezielt aktualisiert (updateGame).
// Karte, Rundenleiste und Punkteleiter bleiben so dieselben Elemente, damit CSS-Übergänge und Animationen laufen können.

function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

// Startet eine CSS-Animation neu, auch wenn die Klasse noch gesetzt ist.
function replay(e, cls) {
  e.classList.remove(cls); void e.getBoundingClientRect(); e.classList.add(cls);
  e.addEventListener('animationend', () => e.classList.remove(cls), { once: true });
}

function renderStatus() {
  const p = $('#pips');
  if (p.children.length !== CONFIG.ROUNDS) { p.innerHTML = ''; for (let i = 0; i < CONFIG.ROUNDS; i++) el('span', 'pip', p); }
  [...p.children].forEach((d, i) => {
    const r = state.results[i];
    d.classList.toggle('ok', !!r && r.pts > 0); d.classList.toggle('bad', !!r && r.pts === 0);
    d.classList.toggle('gold', !!r && r.pts > 0 && r.hint === 0); // Volltreffer
    d.classList.toggle('now', !r && i === state.round);
    d.textContent = r ? (r.pts > 0 ? '✓' : '✕') : i + 1;
  });
  const t = total();
  if (t !== shownTotal) { countUp(shownTotal, t); shownTotal = t; } else $('#total').textContent = t;
}

// Zählt eine Zahl im Element weich von "from" auf "to" hoch.
function tween(out, from, to, dur) {
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); out.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  out.textContent = from; requestAnimationFrame(step);
}

function countUp(from, to) {
  const out = $('#total');
  if (reducedMotion() || to < from) { out.textContent = to; return; }
  setTimeout(() => { tween(out, from, to, 900); replay($('#score'), 'bump'); }, 450);
}

// Spielkarte (interactive) oder reine Anzeige (Endbildschirm). Beschriftungen sind vorbereitet und werden per .show eingeblendet.
// Basiskarte: ein Pfad je Land, Grenzen als feine Linien in Hintergrundfarbe (.st in style.css), Stadtstaaten zuletzt gezeichnet.
// Die Länderpfade werden nie umsortiert, ausgeblendet oder transformiert; Zustände (falsch, gelöst) ändern nur ihre Füllfarbe.
// Hervorhebung: eigene Ebene mit genau zwei Pfaden, unten Auswahl (am Rundenende: Lösung), oben Hover. Sie übernehmen per
// setAttribute('d', …) den Umriss des Landes (kein <use>, kein Klonen), haben keine Mausereignisse und ändern nur Füllung und Kontur.
// Keine Bewegung, kein Schatten, keine Außenkontur.
const CAN_HOVER = matchMedia('(hover: hover)');
function buildMap(interactive = true) {
  const svg = svgEl('svg', { viewBox: VIEW(MAP), role: 'group',
    'aria-label': interactive ? 'Deutschlandkarte ohne Beschriftung' : 'Deutschlandkarte mit den Bundesländern des Tages' });
  const base = svgEl('g', {}, svg); // Länder und Klickflächen: hier hängen die Hover-Ereignisse
  const m = { svg, lands: svgEl('g', { class: 'lands' }, base), path: {}, hit: {}, lab: {}, hovId: null };
  for (const id of DRAW) m.path[id] = svgEl('path', { d: MAP.states[id].d, class: 'st', 'data-id': id }, m.lands);
  const hits = svgEl('g', {}, base);
  if (interactive) {
    // Verlauf für "gelöst": Stopps normal grün, beim Volltreffer golden (.jackpot, style.css)
    const grad = svgEl('linearGradient', { id: 'gold-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, svgEl('defs', {}, svg)); // senkrecht, wie --gold-grad
    for (const o of [0, 1]) svgEl('stop', { offset: o }, grad);
    const hl = svgEl('g', { class: 'hls', 'aria-hidden': 'true' }, svg);
    m.selPath = svgEl('path', { class: 'hl sel' }, hl);
    m.hovPath = svgEl('path', { class: 'hl hov' }, hl);
  }
  const labs = svgEl('g', {}, svg);
  for (const id of ORDER) m.lab[id] = buildLabel(id, labs);
  if (!interactive) return m;
  for (const id in SMALL) { const [x, y] = MAP.states[id].c; m.hit[id] = svgEl('circle', { cx: x, cy: y, r: SMALL[id], class: 'hit', 'data-id': id }, hits); }
  // Hover (nur bei echter Maus und @media (hover: hover)) oder Tastaturfokus: Umriss des Landes auf den Hover-Pfad legen
  m.hover = id => {
    if (id && (state.done || state.wrong.includes(id))) id = null; // nur wählbare Länder hervorheben
    if (m.hovId === id) return;
    m.hovId = id;
    outline(m.hovPath, id);
    m.hovPath.classList.toggle('issel', !!id && id === state.sel);
  };
  const idOf = e => e.target.dataset && e.target.dataset.id;
  base.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && CAN_HOVER.matches) m.hover(idOf(e) || null); });
  base.addEventListener('pointerleave', () => m.hover(null));
  base.addEventListener('focusin', e => m.hover(idOf(e) || null));
  base.addEventListener('focusout', () => m.hover(null));
  svg.addEventListener('mousedown', e => e.preventDefault()); // Mausklick setzt keinen Fokus (sonst Fokusrahmen um das Land)
  svg.addEventListener('click', e => { const id = idOf(e); if (id) pick(id); });
  svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && idOf(e)) { e.preventDefault(); pick(idOf(e)); } });
  return m;
}

// Legt den Umriss eines Landes auf einen Hervorhebungspfad (id = null: Hervorhebung aus). Der Umriss bleibt danach stehen, nur .on
// wird entfernt: Kontur verschwindet sofort, die Füllung blendet in 120 ms auf durchsichtig aus (CSS), ohne das Land darunter zu verdecken.
function outline(p, id) {
  if (id) p.setAttribute('d', MAP.states[id].d);
  p.classList.toggle('on', !!id);
}

// Eine Beschriftung: Hinweislinie (nur kleine Länder), Hintergrund für die hervorgehobene Lösung, Text (ggf. zweizeilig, vertikal zentriert).
function buildLabel(id, parent) {
  const L = LABELS[id], g = svgEl('g', { class: 'lab' }, parent);
  if (L.from) { g.lead = svgEl('line', { class: 'lead', x1: L.from[0], y1: L.from[1] }, g); g.dot = svgEl('circle', { class: 'dot', cx: L.from[0], cy: L.from[1] }, g); }
  g.pill = svgEl('rect', { class: 'pill' }, g);
  g.text = svgEl('text', { x: L.at[0], y: L.at[1], 'text-anchor': L.anchor || 'middle' }, g);
  const lines = (L.text || NAMES[id]).split('|');
  lines.forEach((s, i) => { svgEl('tspan', { x: L.at[0], dy: i ? '1.1em' : `${0.35 - (lines.length - 1) * 0.55}em` }, g.text).textContent = s; });
  return g;
}

// Passt Hintergrund und Hinweislinie an die tatsächliche Textgröße an (die Schrift hängt von --u ab, also von der Kartengröße).
function layoutLabels(m) {
  if (!m.svg.getClientRects().length) return; // Karte ausgeblendet (z. B. Auswertung auf dem Handy): nichts zu messen
  const u = parseFloat(m.svg.style.getPropertyValue('--u')) || 1, clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  for (const id of ORDER) {
    const g = m.lab[id]; if (!g.classList.contains('show')) continue;
    const b = g.text.getBBox(), px = 7 * u, py = 3 * u, x = b.x - px, y = b.y - py, w = b.width + 2 * px, h = b.height + 2 * py;
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, rx: Math.min(h / 2, 10 * u) })) g.pill.setAttribute(k, v.toFixed(1));
    if (g.lead) {
      const [fx, fy] = LABELS[id].from; // Linie endet am Rand des (ggf. unsichtbaren) Hintergrunds, also kurz vor dem Text
      g.lead.setAttribute('x2', clamp(fx, x, x + w).toFixed(1)); g.lead.setAttribute('y2', clamp(fy, y, y + h).toFixed(1));
      g.dot.setAttribute('r', (2.6 * u).toFixed(2));
    }
  }
}

// Mittelpunkt eines Landes für Effekte (kleine Länder: der Punkt im Land, nicht die Beschriftung außerhalb)
function anchorOf(id) { const L = LABELS[id]; return L.from || L.at; }

// Kartengröße und Schriftmaß. Auf dem Handy wird die Karte so groß, als wäre der Hinweis drei Zeilen lang:
// kürzere Hinweise lassen etwas mehr Luft um die Karte, die Karte selbst bleibt immer gleich groß.
const DESKTOP = matchMedia('(min-width: 880px) and (min-height: 540px)');
function sizeMap() {
  if (!ui || !ui.map) return;
  const svg = ui.map.svg, wrap = ui.mapwrap, p = ui.cardSlot && ui.cardSlot.querySelector('.card p');
  svg.style.top = svg.style.height = '';
  if (!DESKTOP.matches && p) {
    const spare = Math.max(0, 3 * parseFloat(getComputedStyle(p).lineHeight) - p.offsetHeight);
    const h = Math.max(wrap.clientHeight - spare, 120);
    svg.style.height = h + 'px'; svg.style.top = (wrap.clientHeight - h) / 2 + 'px';
  }
  const ctm = svg.getScreenCTM(); if (ctm && ctm.a) svg.style.setProperty('--u', (1 / ctm.a).toFixed(3));
  layoutLabels(ui.map);
}

function updateMap() {
  const m = ui.map, q = cur(), wrong = new Set(state.wrong), res = state.results[state.round];
  for (const id of ORDER) {
    const p = m.path[id], ans = state.done && id === q.a, w = wrong.has(id), active = !state.done && !w;
    p.classList.toggle('right', ans && res.pts > 0);
    p.classList.toggle('miss', ans && res.pts === 0);
    p.classList.toggle('wrong', w);
    p.classList.toggle('sel', active && state.sel === id);
    if (active) { p.setAttribute('tabindex', '0'); p.setAttribute('aria-label', 'Unbeschriftetes Bundesland'); }
    else { p.removeAttribute('tabindex'); p.removeAttribute('aria-label'); }
    if (m.hit[id]) m.hit[id].classList.toggle('off', !active);
    const lab = m.lab[id]; lab.classList.toggle('show', w || ans); lab.classList.toggle('wrong', w); lab.classList.toggle('answer', ans);
  }
  // Auswahl-Pfad: gewähltes Land, am Rundenende die Lösung (grün gelöst, rot nicht gelöst) mit derselben Kontur
  m.selPath.classList.toggle('right', state.done && res.pts > 0);
  m.selPath.classList.toggle('miss', state.done && res.pts === 0);
  outline(m.selPath, state.done ? q.a : state.sel);
  if (state.done) m.lab[q.a].parentNode.appendChild(m.lab[q.a]); // Beschriftung der Lösung nach vorn (nur die Beschriftungsebene)
  const h = m.hovId; m.hovId = undefined; m.hover(h); // Hover neu bewerten (z. B. Land ist jetzt falsch getippt oder ausgewählt)
}

function pick(id) {
  if (state.done || state.wrong.includes(id)) return;
  state.sel = state.sel === id ? null : id; fx = null;
  if (state.sel) Sound.play('select'); // nur beim Markieren, nicht beim Abwählen
  render();
}

function guess() {
  if (!state.sel || state.done) return;
  const q = cur();
  // Ton: kein eigener Klang für den Tipp, direkt das Ergebnis. Neue Hinweiskarte 250 ms nach "falsch", damit sich nichts überlagert.
  if (state.sel === q.a) {
    Sound.play(state.hint === 0 ? 'jackpot' : 'right');
    state.results[state.round] = { pts: CONFIG.POINTS[state.hint], hint: state.hint }; state.done = true; fx = { win: CONFIG.POINTS[state.hint] };
  } else {
    Sound.play('wrong');
    state.wrong.push(state.sel); fx = { flash: state.sel, shake: true };
    if (state.hint >= 4) { state.results[state.round] = { pts: 0, hint: 5 }; state.done = true; }
    else { state.hint++; setTimeout(() => Sound.play('hint'), 250); }
  }
  state.sel = null; save(); render();
}

function next() {
  fx = null;
  document.querySelectorAll('canvas.confetti').forEach(c => c.remove()); // Volltreffer-Reste nicht in die nächste Runde mitnehmen
  if (ui && ui.map) ui.map.svg.classList.remove('jackpot');
  if (state.round < CONFIG.ROUNDS - 1) Object.assign(state, { round: state.round + 1, hint: 0, wrong: [], sel: null, done: false });
  else { state.round = CONFIG.ROUNDS; fx = { reveal: true }; } // Auswertung direkt nach dem Spiel: Raster aufdecken
  save(); render(); window.scrollTo({ top: 0 });
}

// Teilen-Text, spoilerfrei (nie Ländernamen): je Runde die Fehltipps 🟥 und am Ende der Treffer (🟨 Volltreffer, 🟩 gelöst),
// nicht gelöst = fünf 🟥. Kein Auffüllen mit ⬜. Perfekter Tag: 💎 hinter der Punktzahl.
function shareRows() { return state.results.map(r => (r.pts > 0 ? '🟥'.repeat(r.hint) + (r.hint === 0 ? '🟨' : '🟩') : '🟥'.repeat(CONFIG.ROUNDS))); }
function shareText() {
  return `Sechzehn #${DAYNO} · ${total()}/${CONFIG.ROUNDS * CONFIG.POINTS[0]}${isPerfect() ? ' 💎' : ''}\n` + shareRows().join('\n') + '\n' + CONFIG.SITE_URL;
}

function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

// Füllt Platz i der Hinweisliste (Farbquadrat der Kategorie + Text) oder leert ihn (h = null → ausgeblendet).
function fillSlot(i, h) {
  const row = ui.slots[i];
  row.classList.toggle('empty', !h);
  row.querySelector('i').style.background = h ? catVar(h[0]) : '';
  row.querySelector('span').textContent = h ? h[1] : '';
  return row;
}

// Die verbrauchte Hinweiskarte schrumpft von ihrer alten Position in das Farbquadrat ihrer neuen Listenzeile.
// Sie fliegt als losgelöste Kopie (position: fixed), damit das Layout darunter sofort an den neuen Stand springen kann.
function flyIntoList(card, from, row) {
  const dot = row.querySelector('i'), to = dot.getBoundingClientRect(), text = row.querySelector('span');
  const sx = to.width / from.width, sy = to.height / from.height, dur = 420;
  card.classList.add('ghost');
  Object.assign(card.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.appendChild(card);
  for (const c of card.children) c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
  card.animate([
    { transform: 'none', borderRadius: '16px' },
    { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sx}, ${sy})`, borderRadius: `${3 / sx}px / ${3 / sy}px` },
  ], { duration: dur, easing: 'cubic-bezier(.5,0,.15,1)' }).finished.then(() => card.remove(), () => card.remove());
  dot.animate([{ opacity: 0 }, { opacity: 0, offset: .97 }, { opacity: 1 }], { duration: dur });
  text.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, delay: dur - 120, easing: 'ease-out', fill: 'backwards' });
}

// Mittelpunkt eines Landes in Koordinaten des Kartenrahmens (.mapwrap)
function landPoint(id) {
  const svg = ui.map.svg, [x, y] = anchorOf(id), box = ui.mapwrap.getBoundingClientRect();
  const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
  const p = pt.matrixTransform(svg.getScreenCTM());
  return { x: p.x - box.left, y: p.y - box.top, w: box.width, h: box.height };
}

// "+75" als Abzeichen, das über dem gelösten Land aufsteigt. Volltreffer: "Volltreffer! +100" in Gold, etwas größer.
function pointsBadge(id, pts, jackpot = false) {
  const p = landPoint(id), b = el('div', 'burst' + (jackpot ? ' gold' : ''), ui.mapwrap);
  b.textContent = (jackpot ? 'Volltreffer! ' : '') + '+' + pts;
  const half = b.offsetWidth / 2 + 4;
  b.style.left = Math.min(Math.max(p.x, half), p.w - half) + 'px';
  b.style.top = (p.y - 14) + 'px';
  setTimeout(() => b.remove(), 1700);
}

// Volltreffer (richtig mit dem ersten Hinweis): Land erst golden, nach JACKPOT.GOLD_MS grün (Auswahl-Pfad .gold), dazu ein kleiner
// Konfetti-Burst vom Mittelpunkt des Landes. Ein einzelnes Canvas über der Karte (pointer-events: none), nach JACKPOT.LIFE_MS entfernt;
// blockiert nichts. Bei "Bewegung reduzieren" kein Konfetti, nur die Färbung und der Text.
const JACKPOT = { GOLD_MS: 1000, LIFE_MS: 1500, PARTICLES: 50 };
function jackpot(id) {
  const svg = ui.map.svg, pip = $('#pips').children[state.round];
  svg.classList.add('jackpot');
  setTimeout(() => svg.classList.remove('jackpot'), JACKPOT.GOLD_MS);
  if (reducedMotion()) return; // nur Verlauf und Text, kein Konfetti, kein Glanz
  confetti(id);
  if (pip) { replay(pip, 'shine'); sparkles(pip); }
}

// Funkeln am goldenen Rundenindikator: 2–3 kleine vierzackige Sterne blenden versetzt auf und ab (je 0,6 s), danach entfernt.
function sparkles(pip) {
  const box = pip.parentNode, spots = [[-5, -6, 10], [pip.offsetWidth - 3, -4, 8], [pip.offsetWidth - 8, pip.offsetHeight - 4, 7]];
  spots.forEach(([dx, dy, size], i) => {
    const s = el('span', 'spark', box);
    Object.assign(s.style, { left: pip.offsetLeft + dx + 'px', top: pip.offsetTop + dy + 'px', width: size + 'px', height: size + 'px', animationDelay: i * 140 + 'ms' });
    setTimeout(() => s.remove(), 600 + i * 140 + 100);
  });
}
function confetti(id) {
  const p = landPoint(id), dpr = window.devicePixelRatio || 1, cv = el('canvas', 'confetti', ui.mapwrap);
  cv.width = Math.round(p.w * dpr); cv.height = Math.round(p.h * dpr);
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement), colors = [cs.getPropertyValue('--gold').trim(), cs.getPropertyValue('--ok').trim()];
  const parts = Array.from({ length: JACKPOT.PARTICLES }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3, v = 160 + Math.random() * 230; // nach oben gefächert
    return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
      w: 4 + Math.random() * 4, h: 3 + Math.random() * 3, c: colors[i % 2] };
  });
  const t0 = performance.now(); let last = t0;
  const frame = now => {
    const t = now - t0, dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (t >= JACKPOT.LIFE_MS || !cv.isConnected) { cv.remove(); return; }
    ctx.clearRect(0, 0, p.w, p.h);
    const alpha = Math.min(1, (JACKPOT.LIFE_MS - t) / 600); // in den letzten 0,6 s verblassen
    for (const q of parts) {
      q.vy += 900 * dt; q.vx *= 1 - 1.6 * dt; q.vy *= 1 - 0.6 * dt; // Schwerkraft und Luftwiderstand
      q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(q.x, q.y); ctx.rotate(q.r);
      ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function buildGame() {
  const main = $('#main'), bar = $('#bar'); main.innerHTML = ''; bar.innerHTML = '';
  const g = { key: '' };
  // Frühere Hinweise: vier Plätze über der aktuellen Hinweiskarte, leere sind ausgeblendet. Texte stehen vollständig da (mit Umbruch).
  g.earlier = el('ol', 'earlier', main); g.earlier.setAttribute('aria-label', 'Frühere Hinweise');
  g.slots = [0, 1, 2, 3].map(() => { const row = el('li', 'hint empty', g.earlier); el('i', '', row); el('span', '', row); return row; });
  g.cardSlot = el('div', 'cardslot', main);
  // Über der Punkteleiter steht im Spiel der Einsatz; nach der Runde legt sich das Ergebnis darüber.
  const stake = el('div', 'stake', main); g.stake = stake; g.cap = el('div', 'cap', stake);
  g.cap.textContent = 'Punkte bei richtigem Tipp';
  g.ladder = el('div', 'ladder', stake); el('span', 'thumb', g.ladder);
  g.rungs = CONFIG.POINTS.map(p => { const r = el('span', 'rung', g.ladder); r.textContent = p; return r; });
  g.verdict = el('div', 'verdict', stake); g.verdict.setAttribute('role', 'status');
  g.mapwrap = el('div', 'mapwrap', main);
  g.map = buildMap(); g.mapwrap.appendChild(g.map.svg);
  g.btn = el('button', 'btn', bar); g.btn.type = 'button';
  g.btn.onclick = () => (state.done ? next() : guess());
  return g;
}

function updateGame() {
  const g = ui, q = cur(), hi = state.done ? Math.min(state.hint, 4) : state.hint, res = state.results[state.round];

  const key = state.round + '-' + hi;
  if (key !== g.key) {
    // Gerade einen Hinweis verbraucht (gleiche Runde, nächster Hinweis)? Dann wandert die alte Karte animiert in die Liste.
    const consumed = g.key === state.round + '-' + (hi - 1);
    const oldCard = g.cardSlot.firstElementChild, from = consumed && oldCard ? oldCard.getBoundingClientRect() : null;
    g.key = key;
    if (!consumed) for (let i = 0; i < 4; i++) fillSlot(i, i < hi ? q.h[i] : null);
    const row = consumed ? fillSlot(hi - 1, q.h[hi - 1]) : null;
    g.earlier.classList.toggle('has', hi > 0);
    const [cat, txt] = q.h[hi];
    const card = el('div', 'card'); card.style.background = catVar(cat);
    card.innerHTML = `<div class="head"><span>${cat}</span><span>Hinweis ${hi + 1} von 5</span></div><p></p>`;
    card.querySelector('p').textContent = txt;
    g.cardSlot.replaceChildren(card);
    if (from && !reducedMotion()) {
      flyIntoList(oldCard, from, row);
      card.style.animation = 'none'; // statt "deal": erscheint, nachdem die alte Karte losgeflogen ist
      card.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: 160, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
    }
  }

  // Punkteskala: Markierung auf dem aktuellen Wert, verbrauchte Werte blass (nach der Runde liegt das Ergebnis darüber)
  g.stake.classList.toggle('done', state.done);
  g.ladder.style.setProperty('--i', Math.min(state.hint, 4));
  g.rungs.forEach((r, i) => { r.classList.toggle('gone', i < state.hint); r.classList.toggle('live', i === state.hint); });

  updateMap();

  g.verdict.className = 'verdict' + (state.done ? (res.pts > 0 ? ' ok' : ' bad') : '');
  g.verdict.textContent = !state.done ? '' : res.pts > 0 ? `${NAMES[q.a]}! +${res.pts} Punkte` : `Gesucht war ${NAMES[q.a]}.`;
  g.btn.textContent = state.done ? (state.round < CONFIG.ROUNDS - 1 ? 'Nächste Runde' : 'Zur Auswertung')
    : (state.sel ? 'Tipp abgeben' : 'Bundesland auf der Karte wählen');
  g.btn.disabled = !state.done && !state.sel;
  sizeMap();

  // Einmalige Effekte des letzten Spielzugs
  if (fx) {
    if (fx.flash) replay(g.map.path[fx.flash], 'flash');
    if (fx.shake) replay(g.btn, 'shake');
    if (fx.win) { const full = res.hint === 0; pointsBadge(q.a, fx.win, full); if (full) jackpot(q.a); }
    fx = null;
  }
}

// Takt des Aufdeckens: Versatz je Kästchen und je Zeile, Dauer einer Drehung (ms)
const REVEAL = { CELL: 70, ROW: 380, FLIP: 400 };

// Nächster Spieltag beginnt um 0:00 Uhr Ortszeit.
function nextMidnight() { const d = new Date(); d.setHours(24, 0, 0, 0); return d; }
function hms(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return [s / 3600, s / 60 % 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':'); }
function newPuzzle() { // mit ?tag=N (Test) zum nächsten Testtag, sonst neu laden: dayNumber() ergibt dann den neuen Tag
  const p = new URLSearchParams(location.search);
  if (LOCAL && p.has('tag')) { p.set('tag', DAYNO + 1); location.search = p; } else location.reload();
}

// Klänge der Auswertung, zeitlich zur Aufdeck-Animation geplant; render() bricht noch ausstehende ab.
let soundTimers = [];
function soundAt(ms, name, ...args) { soundTimers.push(setTimeout(() => Sound.play(name, ...args), ms)); }
function stopSounds() { soundTimers.forEach(clearTimeout); soundTimers = []; }

function renderEnd(main, bar) {
  // fresh: Auswertung direkt nach dem Spiel (oder "Nochmal abspielen"). Ton dann auch bei "Bewegung reduzieren", die Animation nicht.
  const fresh = !!(fx && fx.reveal), reveal = fresh && !reducedMotion(); fx = null;
  const rec = recordToday(), sum = todayStats(); // erster Abschluss des Tages: Ergebnis zählt für die Statistik
  // Reihenfolge: Punktzahl, Ergebnisraster, Countdown, Teilen (direkt darunter, nicht in der festen Leiste), eine Zeile Statistik
  // ("Serie · Ø Punkte · Alle Statistiken →", öffnet das Statistikfenster). Passt bei 1920×1080 ohne Scrollen.
  const perfect = isPerfect(); // "Sechzehn Facetten"
  const box = el('section', 'end' + (reveal ? ' reveal' : '') + (perfect ? ' perfect' : ''), main);
  box.innerHTML = `<div>${perfect ? '<p class="facet-kicker">Sechzehn Facetten</p><h2 class="facet-head">Perfekter Tag. Fünfmal mit dem ersten Hinweis.</h2>' : ''}<div class="big">${total()}</div><div class="of">von ${CONFIG.ROUNDS * CONFIG.POINTS[0]} Punkten · Tag ${DAYNO}</div></div><div class="grid"></div>
    <p class="next" role="timer">Nächstes Rätsel in <b></b></p><div class="actions"></div><p class="note" role="status"></p>
    ${statLineHTML(sum)}<p class="statnote"></p>`;
  const statnote = box.querySelector('.statnote'), actions = box.querySelector('.actions');
  statnote.textContent = !countsForStats() ? 'Testtag (?tag): zählt nicht für die Statistik.'
    : sum.today && sum.today.pts !== total() ? `Für die Statistik zählt dein erstes Ergebnis von heute: ${sum.today.pts} Punkte.` : '';
  statnote.hidden = !statnote.textContent;
  if (rec) rewardStreak(box, rec, reveal, fresh);
  const grid = box.querySelector('.grid'), times = []; let golds = 0;
  LEVEL.forEach((q, i) => {
    const r = state.results[i], row = el('div', 'grow', grid);
    // --d: Startzeit der Drehung; Name und Punkte erscheinen, wenn das letzte Kästchen der Zeile aufgedeckt ist
    // Volltreffer: erstes Feld golden statt grün (das Teilen-Raster bleibt unverändert)
    // Glanzlicht einmal beim Aufbau: nach dem Aufdecken bzw. sofort, je Volltreffer-Feld 150 ms versetzt
    const full = r.pts > 0 && r.hint === 0, sd = (reveal ? (CONFIG.ROUNDS - 1) * REVEAL.ROW + 4 * REVEAL.CELL + REVEAL.FLIP : 300) + 150 * golds;
    if (full) golds++;
    let cells = ''; for (let k = 0; k < 5; k++) cells += `<i class="cell ${k < r.hint ? 'r' : (k === r.hint ? (full ? 'gd shine' : 'g') : '')}" style="--d:${i * REVEAL.ROW + k * REVEAL.CELL}ms;--sd:${sd}ms"></i>`;
    const done = i * REVEAL.ROW + 4 * REVEAL.CELL + REVEAL.FLIP / 2; times.push(done);
    // Ton je Zeile, wenn sie fertig aufgedeckt ist: Hinweisnummer 1–5, 0 = nicht gelöst (perfekter Tag: eigene Klänge der Facetten)
    if (fresh && !perfect) soundAt(done, 'tile', r.pts > 0 ? r.hint + 1 : 0);
    row.innerHTML = cells + `<span style="--d:${done}ms">${NAMES[q.a]}</span><em style="--d:${done}ms"${full ? ' title="Volltreffer" aria-label="100 Punkte, Volltreffer"' : ''}>${r.pts}</em>`;
  });
  if (reveal && !perfect) tween(box.querySelector('.big'), 0, total(), (CONFIG.ROUNDS - 1) * REVEAL.ROW + 4 * REVEAL.CELL + REVEAL.FLIP);

  // Karte (nur Desktop): Länder des Tages grün (gelöst) bzw. rot, beschriftet. Beim Aufdecken im Takt des Rasters.
  // Perfekter Tag: die Facetten-Animation übernimmt Karte, Punktzahl und Diamant-Felder.
  const mapwrap = el('div', 'mapwrap static', main), map = buildMap(false);
  mapwrap.appendChild(map.svg); ui = { map, mapwrap };
  if (!perfect) LEVEL.forEach((q, i) => {
    const show = () => { map.path[q.a].classList.add(state.results[i].pts > 0 ? 'right' : 'miss'); map.lab[q.a].classList.add('show'); layoutLabels(map); };
    if (reveal) setTimeout(show, times[i]); else show();
  });
  sizeMap();
  if (perfect) {
    facetsStart(box, map, mapwrap, reveal, fresh);
    if (!reveal && !reducedMotion()) { // Endzustand nach Neuladen: Animation auf Wunsch noch einmal
      const again = el('button', 'facet-replay'); again.type = 'button'; again.textContent = 'Nochmal abspielen';
      again.onclick = () => { fx = { reveal: true }; render(); };
      box.querySelector('.of').after(again);
    }
  }

  const share = el('button', 'btn', actions); share.type = 'button'; share.textContent = 'Ergebnis teilen';
  share.onclick = openShare;

  // Countdown bis Mitternacht; danach "Neues Rätsel spielen" als Hauptbutton, Teilen tritt zurück.
  const until = nextMidnight(), next = box.querySelector('.next'), out = next.querySelector('b');
  const tick = () => {
    const ms = until - Date.now();
    if (ms > 0) { out.textContent = hms(ms); return; }
    clearInterval(ticker); next.textContent = 'Das neue Rätsel ist da.';
    const go = el('button', 'btn'); go.type = 'button'; go.textContent = 'Neues Rätsel spielen'; go.onclick = newPuzzle;
    share.classList.add('ghost'); actions.prepend(go);
  };
  clearInterval(ticker); ticker = setInterval(tick, 500); tick();
}

/* ---------- "Sechzehn Facetten": perfekter Tag (500/500) ---------- */
// Auf dem Endbildschirm wird die Karte zum Diamanten: Rückblick in Gold, dann werden die 16 Länder zu Facetten (Grenzen = Schliffkanten),
// ein Lichtstrahl zieht diagonal darüber, Funken blitzen auf. Danach, solange der Endbildschirm offen ist: wiederkehrender, dezenterer Glanz
// und vereinzeltes Nachglühen. Volle Anfangsanimation nur direkt nach dem Spiel (oder per "Nochmal abspielen"), sonst sofort der Endzustand.
// Pausiert bei verstecktem Tab (Zeitgeber starten beim Zurückkehren neu); bei "Bewegung reduzieren" nur der Endzustand.
// Alle Zeiten, Abstände und Helligkeiten stehen hier:
const FACETTEN_CONFIG = {
  RETRO_START_MS: 300,     // Rückblick: erstes Land golden
  RETRO_STEP_MS: 380,      // Abstand zwischen den fünf Ländern des Tages
  CRYSTAL_DELAY_MS: 500,   // Kristallisierung beginnt so lange nach dem letzten Gold
  CRYSTAL_STEP_MS: 55,     // Versatz je Land (diagonal von oben links nach unten rechts)
  CRYSTAL_FADE_MS: 700,    // Farbübergang eines Landes zur Facette
  CELL_STEP_MS: 90,        // Versatz der Diamant-Felder im Ergebnisraster
  BEAM_DELAY_MS: 1000,     // Lichtstrahl startet so lange nach Beginn der Kristallisierung
  BEAM_MS: 1400,           // Dauer des ersten Strahls (ease-in-out)
  BEAM_STRENGTH: 1,        // Helligkeit des ersten Strahls (0–1)
  SPARKS: [20, 25],        // Funken beim ersten Strahl (min, max)
  SPARK_MS: 900,           // Lebensdauer eines Funkens
  TITLE_DELAY_MS: 900,     // Überschrift so lange nach Start des ersten Strahls
  REPEAT_MS: [8000, 14000],// wiederkehrender Glanz: zufälliger Abstand
  REPEAT_BEAM_MS: 1800,    // Dauer des wiederkehrenden Strahls
  REPEAT_STRENGTH: 0.7,    // Helligkeit des wiederkehrenden Strahls
  REPEAT_SPARKS: [3, 5],   // Funken entlang des wiederkehrenden Strahls
  AFTERGLOW_MS: [4000, 6000], // Nachglühen: einzelner Funke in diesem Abstand
  BEAM_WIDTH: 260,         // Länge des Verlaufsvektors in Karteneinheiten (bestimmt die Breite des Streifens)
};

// Ende des ersten Lichtstrahls (ab Beginn der Auswertung): danach erst der Serien-/Rekordklang
function facetsEndMs() { const C = FACETTEN_CONFIG; return C.RETRO_START_MS + (CONFIG.ROUNDS - 1) * C.RETRO_STEP_MS + C.CRYSTAL_DELAY_MS + C.BEAM_DELAY_MS + C.BEAM_MS; }

function isPerfect(results = state.results) {
  return results.length === CONFIG.ROUNDS && results.every(r => r && r.pts > 0 && r.hint === 0);
}

// Feste Facette je Land: Ton (--t0 dunkel … --t3 hell, style.css) und Lichtrichtung in Grad. Benachbarte Länder haben nie denselben Ton,
// damit jede Grenze als Kante sichtbar bleibt. Winkel wie bei CSS linear-gradient: 0° = nach oben, im Uhrzeigersinn; der Verlauf läuft
// in diese Richtung von hell (Ton + 38 % Weiß) über den Ton (55 %) nach dunkel (Ton + 16 % Schwarz).
const FACETS = {
  SH: [2, 340], HH: [3, 25], HB: [2, 295], NI: [1, 70], MV: [3, 160], BB: [0, 25], BE: [1, 70], ST: [2, 160],
  NW: [2, 160], HE: [0, 340], TH: [3, 205], SN: [1, 70], RP: [3, 115], SL: [2, 160], BW: [1, 340], BY: [2, 250],
};

let facetCtl = null;
function stopFacets() { if (facetCtl) { facetCtl.stop(); facetCtl = null; } }

// box: Endbildschirm-Abschnitt, map/mapwrap: Auswertungskarte. full = volle Anfangsanimation.
function facetsStart(box, map, mapwrap, full, sound = full) { // sound: Klänge (auch bei "Bewegung reduzieren"), nicht beim Endzustand nach Neuladen
  stopFacets();
  const C = FACETTEN_CONFIG, timers = new Set(), still = reducedMotion();
  let raf = 0, alive = true, repeatT = 0, glowT = 0;
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
  const rnd = ([a, b]) => a + Math.random() * (b - a);
  const big = box.querySelector('.big'), cells = [...box.querySelectorAll('.cell.gd')], head = box.querySelector('.facet-head'), kicker = box.querySelector('.facet-kicker');
  const glow = el('div', 'facet-glow', mapwrap); mapwrap.prepend(glow);
  const order = DRAW.slice().sort((a, b) => (MAP.states[a].c[0] + MAP.states[a].c[1]) - (MAP.states[b].c[0] + MAP.states[b].c[1]));
  const mapShown = () => map.svg.getClientRects().length > 0;

  const defs = svgEl('defs', {}, map.svg), labs = map.lab[ORDER[0]].parentNode;
  // Facetten-Ebene über der Basiskarte (unter Strahl und Beschriftungen): je Land ein Pfad mit eigenem Verlauf (objectBoundingBox)
  // entlang seiner Lichtrichtung, weiße Schliffkante. Die Kristallisierung blendet diese Pfade ein; die Basispfade bleiben unverändert.
  const facets = svgEl('g', { class: 'facets', 'aria-hidden': 'true' }, null), fpath = {};
  for (const id of DRAW) {
    const [t, deg] = FACETS[id], a = deg * Math.PI / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2, tone = `var(--t${t})`;
    const g = svgEl('linearGradient', { id: 'f_' + id, x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }, defs);
    [[0, `color-mix(in srgb, ${tone} 62%, #fff)`], [0.55, tone], [1, `color-mix(in srgb, ${tone} 84%, #000)`]]
      .forEach(([o, c]) => svgEl('stop', { offset: o, style: 'stop-color:' + c }, g));
    fpath[id] = svgEl('path', { d: MAP.states[id].d, fill: `url(#f_${id})`, class: 'facet' }, facets);
  }
  map.svg.insertBefore(facets, labs);
  // Strahl-Ebene: alle Länderpfade noch einmal, gefüllt mit einem verschiebbaren Verlauf (Prisma-Saum), Mischmodus screen
  const grad = svgEl('linearGradient', { id: 'beam-grad', gradientUnits: 'userSpaceOnUse' }, defs);
  [[0, '#fff', 0], [0.4, '#fff', 0], [0.455, '#9fd8ff', 0.55], [0.5, '#ffffff', 1], [0.545, '#ffc2e0', 0.55], [0.6, '#fff', 0], [1, '#fff', 0]]
    .forEach(([o, c, a]) => svgEl('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, grad));
  const beam = svgEl('g', { class: 'beam', opacity: 0, 'aria-hidden': 'true' }, null);
  map.svg.insertBefore(beam, labs);
  for (const id of DRAW) svgEl('path', { d: MAP.states[id].d, fill: 'url(#beam-grad)' }, beam);
  // Strahl läuft entlang der Diagonale (1,1); der Streifen steht senkrecht dazu
  const diag = MAP.w + MAP.h, L = C.BEAM_WIDTH, k = Math.SQRT1_2;
  const beamAt = s => { // s = 0 … 1: Position des Streifens von oben links nach unten rechts
    const d = -L / 2 + s * (diag * k + L), cx = d * k, cy = d * k; // Abstand entlang der Diagonale, Mittelpunkt des Streifens
    grad.setAttribute('x1', cx - L / 2 * k); grad.setAttribute('y1', cy - L / 2 * k);
    grad.setAttribute('x2', cx + L / 2 * k); grad.setAttribute('y2', cy + L / 2 * k);
  };
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sweep = (ms, strength, sparks) => {
    if (still || !mapShown()) return false;
    cancelAnimationFrame(raf);
    beam.setAttribute('opacity', strength);
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms); beamAt(ease(t));
      if (t < 1 && alive) raf = requestAnimationFrame(step); else beam.setAttribute('opacity', 0);
    };
    raf = requestAnimationFrame(step);
    // Funken auf Landesgrenzen, jeweils dann, wenn der Strahl an ihrer Stelle ist
    const n = Math.round(rnd(sparks));
    for (let i = 0; i < n; i++) {
      const p = borderPoint(), s = ((p.x + p.y) * k + L / 2) / (diag * k + L); // Strahlposition, an der dieser Punkt hell wird
      const tt = Math.min(0.95, Math.max(0.05, s)); // als Zeitanteil (ease-in-out ist in der Mitte fast linear)
      later(tt * ms, () => spark(p));
    }
    return true;
  };
  const borderPoint = () => {
    const id = DRAW[Math.floor(Math.random() * DRAW.length)], p = map.path[id], len = p.getTotalLength();
    const q = p.getPointAtLength(Math.random() * len); return { x: q.x, y: q.y };
  };
  const spark = p => {
    if (!mapShown()) return;
    const pt = map.svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
    const s = pt.matrixTransform(map.svg.getScreenCTM()), box2 = mapwrap.getBoundingClientRect();
    const e = el('span', 'fspark', mapwrap); e.style.left = s.x - box2.left + 'px'; e.style.top = s.y - box2.top + 'px';
    e.style.animationDuration = C.SPARK_MS + 'ms';
    later(C.SPARK_MS + 50, () => e.remove()); setTimeout(() => e.remove(), C.SPARK_MS + 100); // auch nach Stopp aufräumen
  };

  // Endzustand (sofort oder als Ziel der Animation)
  const crystallize = (instant) => {
    if (instant) mapwrap.classList.add('facets-now');
    order.forEach((id, i) => {
      const p = fpath[id];
      p.style.setProperty('--fd', instant ? '0ms' : i * C.CRYSTAL_STEP_MS + 'ms'); p.style.setProperty('--ff', C.CRYSTAL_FADE_MS + 'ms');
      p.classList.add('on');
    });
    // Keine Sonderbehandlung der Länder des Tages: Beschriftungen und Hinweislinien weg, sobald die Kristallisierung beginnt
    for (const id of ORDER) map.lab[id].classList.remove('show');
    // Gold darunter verschwinden lassen, wenn alle Facetten deckend sind (nicht sichtbar, verhindert Goldsäume an den Kanten)
    const clear = () => LEVEL.forEach(q => map.path[q.a].classList.remove('fgold'));
    if (instant) clear(); else later((order.length - 1) * C.CRYSTAL_STEP_MS + C.CRYSTAL_FADE_MS, clear);
    glow.classList.add('on'); kicker.classList.add('on'); big.classList.add('ice'); big.textContent = total();
    cells.forEach((c, i) => (instant ? c.classList.add('dia') : later(i * C.CELL_STEP_MS, () => c.classList.add('dia'))));
    if (instant) { head.classList.add('on'); void mapwrap.offsetWidth; mapwrap.classList.remove('facets-now'); }
  };

  // Wiederkehrender Glanz und Nachglühen; beim Verstecken des Tabs anhalten, beim Zurückkehren neu planen
  const planRepeat = () => { clearTimeout(repeatT); repeatT = later(rnd(C.REPEAT_MS), () => { if (sweep(C.REPEAT_BEAM_MS, C.REPEAT_STRENGTH, C.REPEAT_SPARKS) && sound) Sound.play('glint'); planRepeat(); }); };
  const planGlow = () => { clearTimeout(glowT); glowT = later(rnd(C.AFTERGLOW_MS), () => { spark(borderPoint()); planGlow(); }); };
  const loops = () => { if (still) return; planRepeat(); planGlow(); };
  const onVis = () => {
    if (document.hidden) { clearTimeout(repeatT); clearTimeout(glowT); timers.delete(repeatT); timers.delete(glowT); cancelAnimationFrame(raf); beam.setAttribute('opacity', 0); }
    else loops();
  };
  document.addEventListener('visibilitychange', onVis);

  const tc = C.RETRO_START_MS + (CONFIG.ROUNDS - 1) * C.RETRO_STEP_MS + C.CRYSTAL_DELAY_MS; // Beginn der Kristallisierung
  if (!full || still) {
    crystallize(true); loops();
    if (sound) { // "Bewegung reduzieren": Endzustand sofort, die Klänge aber im gewohnten Takt
      LEVEL.forEach((q, i) => later(C.RETRO_START_MS + i * C.RETRO_STEP_MS, () => Sound.play('perfectStep', i)));
      later(tc, () => Sound.play('perfectChord')); later(tc + C.BEAM_DELAY_MS, () => Sound.play('perfectSparkle'));
    }
  }
  else {
    // a) Rückblick: Länder des Tages nacheinander golden, Punktzahl in 100er-Schritten
    big.textContent = '0';
    LEVEL.forEach((q, i) => later(C.RETRO_START_MS + i * C.RETRO_STEP_MS, () => {
      map.path[q.a].classList.add('fgold'); map.lab[q.a].classList.add('show'); layoutLabels(map);
      big.textContent = CONFIG.POINTS[0] * (i + 1); if (sound) Sound.play('perfectStep', i);
    }));
    later(tc, () => { crystallize(false); if (sound) Sound.play('perfectChord'); });                          // b) Kristallisierung
    later(tc + C.BEAM_DELAY_MS, () => { sweep(C.BEAM_MS, C.BEAM_STRENGTH, C.SPARKS); if (sound) Sound.play('perfectSparkle'); }); // c) + d) Lichtstrahl mit Funken
    later(tc + C.BEAM_DELAY_MS + C.TITLE_DELAY_MS, () => head.classList.add('on')); // e) Überschrift
    later(tc + C.BEAM_DELAY_MS + C.BEAM_MS, loops);                            // danach: Glanz und Nachglühen
  }
  facetCtl = { stop() { alive = false; timers.forEach(clearTimeout); timers.clear(); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); } };
}

// Belohnung für die Serie, direkt nach dem Abschluss: Steigt sie um 1, zählt die Serie in der Statistikzeile hoch und leuchtet kurz grün,
// sobald das Ergebnisraster aufgedeckt ist. Neuer Rekord (ab 2 Tagen): "· Neuer Rekord!" in derselben Zeile.
function rewardStreak(box, { before, after }, reveal, fresh = reveal) {
  const v = box.querySelector('.statline .streakv'), num = v.querySelector('span'), recordEl = box.querySelector('.statline .rec');
  const up = after.cur === before.cur + 1, record = after.longest > before.longest && after.longest >= 2;
  const at = (CONFIG.ROUNDS - 1) * REVEAL.ROW + 4 * REVEAL.CELL + REVEAL.FLIP + 150; // Ende des Aufdeckens
  // Ton beim Hochzählen; neuer Rekord statt "streak" mit "record". Perfekter Tag: nach dem Lichtstrahl, damit nichts kollidiert.
  if (fresh && (up || record)) soundAt(isPerfect() ? facetsEndMs() : at, record ? 'record' : 'streak');
  if (!reveal) { recordEl.hidden = !record; return; }
  if (up) num.textContent = before.cur;
  setTimeout(() => {
    if (up) { tween(num, before.cur, after.cur, 500); replay(v, 'up'); }
    if (record) { recordEl.hidden = false; replay(recordEl, 'pop'); }
  }, at);
}

// Text kopieren (Teilen-Fenster, "Text kopieren"): Clipboard-API, als Ersatz execCommand; klappt beides nicht, zeigt das Fenster den Text markiert.
// Ursache der früheren Meldung "Kopieren hat nicht geklappt": Desktop-Browser (Edge/Chrome unter Windows) haben navigator.share; nach dem
// Schließen des Teilen-Dialogs ist die Seite nicht mehr fokussiert bzw. die Nutzeraktion verbraucht, dann lehnt clipboard.writeText ab.
// Außerdem gibt es die Clipboard-API nur in sicheren Kontexten (https, localhost). Daher: Desktop kopiert direkt, mit execCommand als
// Ersatz; klappt beides nicht, steht der Text markiert in einem Feld zum Kopieren mit Strg+C.
async function copyText(txt) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; } } catch (e) { }
  const ta = el('textarea', 'copybuf', document.body); ta.value = txt; ta.setAttribute('readonly', '');
  ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
  ta.remove(); return ok;
}

function render() {
  renderStatus();
  const view = state.round >= CONFIG.ROUNDS ? 'end' : introOpen ? 'intro' : 'game';
  document.body.dataset.view = view;
  document.body.classList.toggle('playing', view === 'game'); // Spielansicht (Rundenleiste sichtbar)
  if (view !== 'intro') stopIntroDemo();
  stopFacets(); stopSounds(); // Facetten-Zeitgeber und geplante Klänge beenden, renderEnd startet sie bei Bedarf neu
  if (view !== 'game') {
    clearInterval(ticker); ui = null;
    const main = $('#main'), bar = $('#bar'); main.innerHTML = ''; bar.innerHTML = '';
    (view === 'end' ? renderEnd : renderIntro)(main, bar); updateDiaBtn(); return;
  }
  if (!ui || !ui.cardSlot) ui = buildGame();
  updateGame();
}

// Dezente Links zu Impressum und Datenschutz (Hilfe-Blatt und Startbildschirm)
const LEGAL_LINKS = '<p class="legallinks"><a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p>';
function renderSheet() {
  $('#sheet').innerHTML = `<div class="sheet"><h2>So geht's</h2>
    <p>Lies den Hinweis und tippe auf der Karte auf ein Bundesland. Die Karte ist unbeschriftet. Jeder falsche Tipp deckt den nächsten, leichteren Hinweis auf. Je früher du richtig liegst, desto mehr Punkte gibt es.</p>
    <div class="cats">${Object.keys(CATEGORIES).map(c => `<span style="background:${catVar(c)}">${c}</span>`).join('')}</div>
    <p>Jeden Tag gibt es fünf neue Runden, für alle Spieler dieselben.</p>${LEGAL_LINKS}</div>`;
}

/* ---------- Startbildschirm ---------- */
// Erscheint, solange der Tag nicht abgeschlossen ist: kurze Regeln links, rechts (Handy: oben) setzt sich die Karte aus den 16 Ländern zusammen.
// Gibt es schon einen Spielstand, heißt der Button "Weiterspielen".

function dateOfDay(n) {
  const d = new Date(CONFIG.START_DATE + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderIntro(main, bar) {
  const box = el('section', 'intro', main);
  // Dritte Kachel: Ergebnis von heute (falls schon in einem anderen Tab gespielt), sonst laufende Serie, sonst wann das nächste Rätsel kommt
  const sum = todayStats(), third = sum.today ? ['Dein Ergebnis', `${sum.today.pts} Punkte`]
    : sum.cur > 0 ? ['Deine Serie', `${sum.cur} ${sum.cur === 1 ? 'Tag' : 'Tage'}`] : ['Neues Rätsel', '0:00 Uhr'];
  const ladder = CONFIG.POINTS.map((p, i) => `<span${i ? '' : ' class="gd"'}>${p}</span>`).join('');
  box.innerHTML = `
    <h2 class="tag">Fünf Hinweise, ein Bundesland.<br>Fünf Runden pro Tag.</h2>
    <ol class="steps">
      <li><span class="num" aria-hidden="true">1</span><div><b>Hinweis lesen</b><p>Tippe auf der unbeschrifteten Karte das passende Bundesland an.</p></div></li>
      <li><span class="num" aria-hidden="true">2</span><div><b>Daneben? Nächster Hinweis</b><p>Jeder Hinweis ist leichter als der vorige, bringt aber weniger Punkte.</p>
        <div class="ladder-mini" aria-label="Punkte je Hinweis: ${CONFIG.POINTS.join(', ')}">${ladder}</div></div></li>
      <li><span class="num" aria-hidden="true">3</span><div><b>Fünf Runden, jeden Tag neu</b><p>Für alle Spieler dieselben. Um Mitternacht gibt es ein neues Rätsel.</p></div></li>
    </ol>
    <div class="facts">
      <div class="fact" title="${dateOfDay(DAYNO)}"><span>Heute</span><b>Tag ${DAYNO}</b></div>
      <div class="fact"><span>Maximal</span><b>${CONFIG.ROUNDS * CONFIG.POINTS[0]} Punkte</b></div>
      <div class="fact"><span>${third[0]}</span><b>${third[1]}</b></div>
    </div>${LEGAL_LINKS}`;
  const wrap = el('div', 'mapwrap logo', main);
  const logo = svgEl('svg', { viewBox: VIEW(MAP), 'aria-hidden': 'true' }, wrap);
  const lands = svgEl('g', { class: 'lands' }, logo), paths = {};
  DRAW.forEach((id, i) => { paths[id] = svgEl('path', { d: MAP.states[id].d, style: `--i:${i}` }, lands); });
  const hov = svgEl('path', { class: 'hl hov' }, svgEl('g', { class: 'hls' }, logo));
  stopIntroDemo(); introDemoStop = startIntroDemo(paths, hov);
  const go = el('button', 'btn', bar); go.type = 'button'; go.textContent = load() ? 'Weiterspielen' : 'Spielen';
  go.onclick = () => {
    stopIntroDemo(); // Demo sofort beenden, Karte wieder neutral
    Sound.play('start'); // Auftakt direkt im Klick (verzögert würde der Browser den Ton blockieren)
    save(); // ab jetzt gilt das Spiel als begonnen: Neuladen zeigt "Weiterspielen"
    introOpen = false;
    if (reducedMotion()) { render(); return; }
    [box, wrap, go].forEach(e => e.classList.add('out'));
    setTimeout(() => { render(); enterGame(); }, 280);
  };
  go.focus({ preventScroll: true, focusVisible: false }); // Fokus für Enter/Leertaste, ohne sichtbaren Rahmen beim Laden
}

// Demo auf der Startkarte: Nach der Einblend-Animation "spielt" im Hintergrund ruhig jemand eine Runde, in den Farben des Spiels (Land
// antippen = Hover-Hervorhebung, Fehltipp rot und beim nächsten Tipp blassrot, Lösung grün bzw. golden beim Volltreffer, dann alles sanft zurück).
// Länder rein zufällig (nicht aus dem Tageslevel), Lösung nie zweimal hintereinander dieselbe, Fehltipps bevorzugt in der Nähe der Lösung.
// Nur Füllfarben der Länder (Klassen, CSS-Übergänge) und der Hover-Pfad; keine Bewegung, keine Umsortierung. Pausiert, solange der
// Tab nicht sichtbar ist; bei "Bewegung reduzieren" gar nicht. Gibt eine Stopp-Funktion zurück, die alles sofort neutral macht.
// Alle Zeiten und Deckkräfte stehen in DEMO_CONFIG; die Farbwerte gibt startIntroDemo als CSS-Variablen an die Karte weiter.
const DEMO_CONFIG = {
  START_MS: 1600,         // Beginn nach der Einblend-Animation der Karte
  TAP_MS: 1000,           // so lange ist die Hervorhebung ("Antippen") zu sehen
  MARK_MS: 900,           // nach dem Einfärben bis zum nächsten Tipp; Abstand zweier Tipps = TAP_MS + MARK_MS
  SOLVED_MS: 1500,        // gelöstes Land stehen lassen (nach dem Einblenden)
  FADE_MS: 800,           // Ein- und Ausblenden aller Färbungen (ease-in-out)
  ROUND_PAUSE_MS: 2000,   // Karte komplett neutral zwischen zwei Runden
  MISS_CHANCE: 0.75,      // Anteil der Runden mit (mindestens einem) Fehltipp; sonst Volltreffer im ersten Tipp (Land golden)
  SECOND_MISS_CHANCE: 0.5,// danach noch ein zweiter Fehltipp
  NEIGHBORS: 4,           // Fehltipps aus den n nächstgelegenen Ländern der Lösung
};
// Farben: exakt wie im Spiel (Hover-Hervorhebung, Fehltipp --bad und danach --land-wrong, richtig --ok, Volltreffer --gold), in style.css.
let introDemoStop = null;
function stopIntroDemo() { if (introDemoStop) { introDemoStop(); introDemoStop = null; } }
function startIntroDemo(paths, hov) {
  if (reducedMotion()) return () => {};
  const C = DEMO_CONFIG, wrap = hov.closest('.mapwrap');
  wrap.style.setProperty('--demo-fade', C.FADE_MS + 'ms');

  let alive = true, timer = 0, lastAnswer = null;
  const ids = Object.keys(paths), CLS = ['demo-wrong', 'demo-pale', 'demo-right', 'demo-gold'];
  const neutral = () => { for (const id of ids) paths[id].classList.remove(...CLS); outline(hov, null); };
  // Warten, wobei nur sichtbare Zeit zählt (Tab im Hintergrund: Demo steht)
  const sleep = ms => new Promise(done => {
    let left = ms, last = performance.now();
    const step = () => {
      if (!alive) return;
      const now = performance.now(); if (!document.hidden) left -= now - last; last = now;
      if (left <= 0) done(); else timer = setTimeout(step, document.hidden ? 250 : Math.min(left, 100));
    };
    timer = setTimeout(step, Math.min(ms, 100));
  });
  const dist = (a, b) => Math.hypot(MAP.states[a].c[0] - MAP.states[b].c[0], MAP.states[a].c[1] - MAP.states[b].c[1]);
  const pickFrom = list => list[Math.floor(Math.random() * list.length)];
  // Ein Tipp: Hervorhebung zeigen, dann ausblenden; währenddessen wird ein vorheriger Fehltipp blass
  const tap = async (id, prevMiss) => {
    if (prevMiss) paths[prevMiss].classList.replace('demo-wrong', 'demo-pale');
    outline(hov, id); await sleep(C.TAP_MS); if (alive) outline(hov, null);
  };
  (async () => {
    await sleep(C.START_MS);
    while (alive) {
      const answer = pickFrom(ids.filter(id => id !== lastAnswer)); lastAnswer = answer;
      const misses = Math.random() < C.MISS_CHANCE ? 1 + (Math.random() < C.SECOND_MISS_CHANCE ? 1 : 0) : 0;
      const pool = ids.filter(id => id !== answer).sort((a, b) => dist(a, answer) - dist(b, answer)).slice(0, C.NEIGHBORS);
      let prev = null;
      for (let k = 0; k < misses && alive; k++) {
        const w = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        await tap(w, prev); if (!alive) break;
        paths[w].classList.add('demo-wrong'); prev = w; await sleep(C.MARK_MS);
      }
      if (!alive) break;
      await tap(answer, prev); if (!alive) break;
      paths[answer].classList.add(misses ? 'demo-right' : 'demo-gold'); await sleep(C.FADE_MS + C.SOLVED_MS); if (!alive) break; // erster Tipp richtig = Volltreffer
      for (const id of ids) paths[id].classList.remove(...CLS); // sanft zurück (Übergang in style.css)
      await sleep(C.FADE_MS + C.ROUND_PAUSE_MS);
    }
  })();
  return () => { alive = false; clearTimeout(timer); neutral(); };
}

// Spielfeld baut sich nach dem Startbildschirm von oben nach unten auf.
function enterGame() {
  [$('.status'), ...$('#main').children].forEach((part, i) => part.animate(
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: 380, delay: 140 + i * 70, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }));
}

/* ---------- Statistik (nur im eigenen Browser, localStorage) ---------- */
// Gespeichert wird pro abgeschlossenem Kalendertag: { days: { 'JJJJ-MM-TT': { pts, hints: [h1..h5] } } }, hints = Hinweisnummer, mit der die
// Runde gelöst wurde (1–5), 0 = nicht gelöst. Ältere Einträge sind nur eine Zahl (Punkte): sie zählen für Kennzahlen und Serie, nicht für
// "Gelöst mit Hinweis". Jeder Tag zählt einmal (erstes Ergebnis gilt).
// Serie = aufeinanderfolgende Kalendertage mit abgeschlossenem Rätsel. Die aktuelle Serie endet heute oder, solange heute noch offen ist,
// gestern; ein ausgelassener Tag setzt sie auf 0. Mit ?tag=N gespielte Tage zählen nur im Entwicklermodus (?dev=1).

const STATS_KEY = 'sechzehn-statistik';
const HINT_LABELS = ['1', '2', '3', '4', '5', '✕']; // Spalten von "Gelöst mit Hinweis"; Index 5 = nicht gelöst
const DEV = LOCAL && new URLSearchParams(location.search).get('dev') === '1';
const DEMO = DEV ? new URLSearchParams(location.search).get('demo') : null; // feste Spielstände für Screenshots, siehe demoState()
let demoStore = null; // im Demo-Modus liegt die Statistik nur im Speicher

function isoOfDay(n) {
  const d = new Date(CONFIG.START_DATE + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayIndex(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); } // Kalendertag als fortlaufende Zahl
function countsForStats() { return DEV || !LOCAL || !new URLSearchParams(location.search).has('tag'); }

function loadStats() {
  if (DEMO) return demoStore || (demoStore = demoStats());
  try { const s = JSON.parse(localStorage.getItem(STATS_KEY)); if (s && s.days && typeof s.days === 'object') return s; } catch (e) { }
  return { days: {} };
}
function saveStats(s) { if (DEMO) { demoStore = s; return true; } try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }

// Ein gespeicherter Tag in einheitlicher Form { pts, hints, lands } (hints/lands = null bei alten Einträgen), ungültige Einträge = null.
// lands = die fünf Länder des Tages in Rundenreihenfolge (zu hints passend).
function validHints(h) { return Array.isArray(h) && h.length === CONFIG.ROUNDS && h.every(x => Number.isInteger(x) && x >= 0 && x <= 5); }
function validLands(l) { return Array.isArray(l) && l.length === CONFIG.ROUNDS && l.every(id => ORDER.includes(id)); }
function entryOf(v) {
  if (Number.isFinite(v)) return { pts: v, hints: null, lands: null };
  if (v && Number.isFinite(v.pts)) return { pts: v.pts, hints: validHints(v.hints) ? v.hints : null, lands: validLands(v.lands) ? v.lands : null };
  return null;
}
function hintsOfState() { return state.results.map(r => (r.pts > 0 ? r.hint + 1 : 0)); }
function pointsOfHints(h) { return h.reduce((sum, x) => sum + (x ? CONFIG.POINTS[x - 1] : 0), 0); }

// Länder eines Tages aus dem Tageslevel (dasselbe Level wie damals, solange der Faktenpool es noch so ergibt). Für alte Einträge ohne Länder.
let FACTS = null;
function dayNoOf(iso) { return dayIndex(iso) - dayIndex(isoOfDay(1)) + 1; }
function landsOfDay(n) { if (!FACTS) return null; const l = buildLevel(FACTS, n); return l.length === CONFIG.ROUNDS ? l.map(q => q.a) : null; }
// Einmal beim Start: Einträge mit Hinweisen, aber ohne Länder, um die Länder ergänzen (Einträge nur mit Punktzahl bleiben, wie sie sind)
function migrateStats() {
  const s = loadStats(); let changed = false;
  for (const iso of Object.keys(s.days)) {
    const e = entryOf(s.days[iso]); if (!e || !e.hints || e.lands || !/^\d{4}-\d\d-\d\d$/.test(iso)) continue;
    const lands = landsOfDay(dayNoOf(iso)); if (lands) { s.days[iso] = { pts: e.pts, hints: e.hints, lands }; changed = true; }
  }
  if (changed) saveStats(s);
}

// Trägt einen abgeschlossenen Tag ein. Ist er schon gespeichert, bleibt das erste Ergebnis (false).
function recordDay(s, iso, entry) { if (entryOf(s.days[iso])) return false; s.days[iso] = entry; return saveStats(s); }

// Kennzahlen, bezogen auf den Kalendertag "today" (ISO). dist: Runden je Spalte von "Gelöst mit Hinweis" (1–5, ✕).
function summarize(s, today) {
  const days = Object.keys(s.days).filter(k => /^\d{4}-\d\d-\d\d$/.test(k) && entryOf(s.days[k])).sort();
  const entries = days.map(k => entryOf(s.days[k])), pts = entries.map(e => e.pts), idx = days.map(dayIndex), has = new Set(idx), t = dayIndex(today);
  let longest = 0, run = 0;
  idx.forEach((d, i) => { run = i && d === idx[i - 1] + 1 ? run + 1 : 1; longest = Math.max(longest, run); });
  const end = has.has(t) ? t : t - 1; let cur = 0;
  while (has.has(end - cur)) cur++;
  const dist = [0, 0, 0, 0, 0, 0], col = h => (h ? h - 1 : 5);
  entries.forEach(e => e.hints && e.hints.forEach(h => dist[col(h)]++));
  const todayEntry = entryOf(s.days[today]), perfect = days.filter((k, i) => entries[i].pts === CONFIG.ROUNDS * CONFIG.POINTS[0]);
  const firstHit = new Set(); // Länder, die je mit dem ersten Hinweis gelöst wurden
  entries.forEach(e => e.hints && e.lands && e.hints.forEach((h, i) => h === 1 && firstHit.add(e.lands[i])));
  return { played: days.length, cur, longest, dist, rounds: dist.reduce((a, b) => a + b, 0), legacy: entries.filter(e => !e.hints).length,
    diamonds: perfect.length, lastDiamond: perfect[perfect.length - 1] || null, // perfekte Tage (500/500)
    firstHit, ptsByDay: Object.fromEntries(days.map((k, i) => [k, entries[i].pts])),
    today: todayEntry, todayCols: new Set(todayEntry && todayEntry.hints ? todayEntry.hints.map(col) : []),
    avg: days.length ? Math.round(pts.reduce((a, b) => a + b, 0) / days.length) : 0, best: days.length ? Math.max(...pts) : 0 };
}
function todayStats() { return summarize(loadStats(), isoOfDay(DAYNO)); }

// Heutiges Ergebnis eintragen (beim ersten Abschluss des Tages). Vorher/Nachher für die Belohnung auf dem Endbildschirm.
// Alter Eintrag von heute ohne Hinweise: aus dem Spielstand ergänzen, wenn die Punkte übereinstimmen (sonst war es ein anderer Durchgang).
function recordToday() {
  if (!countsForStats()) return null;
  const s = loadStats(), iso = isoOfDay(DAYNO), before = summarize(s, iso), old = entryOf(s.days[iso]), hints = hintsOfState(), lands = LEVEL.map(q => q.a);
  if (old) { if ((!old.hints || !old.lands) && old.pts === total()) { s.days[iso] = { pts: old.pts, hints, lands }; saveStats(s); } return null; }
  if (!recordDay(s, iso, { pts: total(), hints, lands })) return null;
  return { before, after: summarize(s, iso) };
}

/* ---------- Statistikfenster ---------- */
// Seitenfenster von rechts (Desktop ca. 560px, Handy ganze Breite), Rest abgedunkelt. Öffnet über das Statistik-Symbol, das Diamant-Symbol
// in der Kopfzeile und "Alle Statistiken" auf dem Endbildschirm. Schließen per ✕, Klick daneben oder Esc; Fokus wandert hinein und zurück.
// Inhalt: Kennzahlen, Abzeichen, Kalender der letzten 5 Wochen, "Gelöst mit Hinweis" (waagerechte Balken), Volltreffer-Karte.
const PERFECT = () => CONFIG.ROUNDS * CONFIG.POINTS[0];
function isoOfIndex(d) { return new Date(d * 864e5).toISOString().slice(0, 10); } // Umkehrung von dayIndex
function longDate(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(dayIndex(iso) * 864e5).toLocaleDateString('de-DE', { ...opts, timeZone: 'UTC' });
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Kleiner Diamant im Facetten-Stil: Krone und Unterteil aus Facetten in Eisblau-Verläufen, Kanten in --ice-edge. uid: eindeutige Verlaufs-IDs.
let gemUid = 0;
function gemSVG(size = 20) {
  const u = 'gem' + (++gemUid), stops = (a, b) => `<stop offset="0" style="stop-color:var(${a})"/><stop offset="1" style="stop-color:var(${b})"/>`;
  return `<svg class="gem" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><defs>
    <linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1">${stops('--ice-3', '--ice-2')}</linearGradient>
    <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1">${stops('--ice-2', '--ice-1')}</linearGradient>
    <linearGradient id="${u}c" x1="1" y1="0" x2="0" y2="1">${stops('--ice-1', '--t0')}</linearGradient></defs>
    <g stroke="var(--ice-edge)" stroke-width=".7" stroke-linejoin="round">
    <path d="M3 9 7.5 3.5H12L9.5 9Z" fill="url(#${u}a)"/><path d="M12 3.5h4.5L14.5 9h-5Z" fill="url(#${u}a)"/><path d="M16.5 3.5 21 9h-6.5Z" fill="url(#${u}b)"/>
    <path d="M3 9h6.5L12 21Z" fill="url(#${u}b)"/><path d="M9.5 9h5L12 21Z" fill="url(#${u}a)"/><path d="M14.5 9H21L12 21Z" fill="url(#${u}c)"/></g></svg>`;
}
function sixteenSVG(size = 40) { // Abzeichen "Alle Sechzehn": goldene Plakette mit 16
  return `<svg class="medal" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="var(--gold)"/>
    <circle cx="20" cy="20" r="14.5" fill="none" stroke="var(--on-gold)" stroke-opacity=".25" stroke-width="1.2"/>
    <text x="20" y="25.5" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="15" fill="var(--on-gold)">16</text></svg>`;
}

function badgesHTML(sum) {
  const n = sum.diamonds, all = sum.firstHit.size === ORDER.length;
  const card = (on, icon, title, text) => `<div class="badge${on ? '' : ' locked'}"><div class="bicon">${icon}</div><div><b>${title}</b><p>${text}</p></div></div>`;
  return `<section class="ps"><h3>Abzeichen</h3><div class="badges">
    ${n ? card(true, gemSVG(40), `Sechzehn Facetten × ${n}`, `${plural(n, 'perfekter Tag', 'perfekte Tage')} mit 500 von 500 Punkten. Zuletzt am ${longDate(sum.lastDiamond)}.`)
        : card(false, gemSVG(40), 'Sechzehn Facetten', 'Noch kein perfekter Tag. Löse alle fünf Runden mit dem ersten Hinweis.')}
    ${card(all, sixteenSVG(), 'Alle Sechzehn', all ? 'Alle 16 Bundesländer mit dem ersten Hinweis erraten.'
      : `Errate jedes Bundesland einmal mit dem ersten Hinweis. Bisher ${sum.firstHit.size} von ${ORDER.length}.`)}
  </div></section>`;
}

// Kalender: 5 Wochen à 7 Tage (Mo–So), die letzte Zeile enthält heute. Stufen: nicht gespielt, < 300, 300–399, 400–499, 500 (Diamant).
function calLevel(p) { return p == null ? '' : p >= PERFECT() ? 'dia' : p >= 400 ? 'l3' : p >= 300 ? 'l2' : 'l1'; }
function calendarHTML(sum, today) {
  const t = dayIndex(today), dow = (new Date(t * 864e5).getUTCDay() + 6) % 7, first = t - dow - 28;
  let cells = '';
  for (let d = first; d < first + 35; d++) {
    if (d > t) { cells += '<i class="future"></i>'; continue; }
    const iso = isoOfIndex(d), p = sum.ptsByDay[iso], tip = `${longDate(iso, { weekday: 'short', day: 'numeric', month: 'long' })}: ${p == null ? 'nicht gespielt' : p + ' Punkte'}`;
    cells += `<i class="${calLevel(p)}${d === t ? ' today' : ''}" role="img" aria-label="${tip}${d === t ? ' (heute)' : ''}" data-tip="${tip}"></i>`;
  }
  const leg = [['', 'nicht gespielt'], ['l1', '< 300'], ['l2', '300–399'], ['l3', '400–499'], ['dia', '500']];
  return `<section class="ps"><h3>Letzte 5 Wochen</h3><div class="cal">
    <div class="calgrid">${['M', 'D', 'M', 'D', 'F', 'S', 'S'].map(w => `<span>${w}</span>`).join('')}${cells}</div><div class="caltip" hidden></div></div>
    <div class="legend">${leg.map(([c, l]) => `<span><i class="${c}"></i>${l}</span>`).join('')}</div></section>`;
}

// "Gelöst mit Hinweis": waagerechte Balken 1–5 und ✕, neutral grau, nur der höchste Wert grün, Anzahl am Balkenende.
function hintBarsHTML(sum) {
  const max = Math.max(...sum.dist);
  const rows = HINT_LABELS.map((label, i) => {
    const n = sum.dist[i], what = i === 5 ? 'Nicht gelöst' : `Mit Hinweis ${label} gelöst`;
    return `<div class="hrow${n && n === max ? ' hmax' : ''}" role="listitem" aria-label="${what}: ${plural(n, 'Runde', 'Runden')}"><span aria-hidden="true">${label}</span>
      <div class="htrack"><i style="width:${max ? (n / max * 100).toFixed(1) : 0}%"></i><em>${n}</em></div></div>`;
  }).join('');
  const cap = [sum.rounds ? plural(sum.rounds, 'Runde', 'Runden') : 'Noch keine Runden'];
  if (sum.legacy) cap.push(`${plural(sum.legacy, 'älterer Tag', 'ältere Tage')} ohne Hinweisdaten`);
  return `<section class="ps"><h3>Gelöst mit Hinweis</h3><div class="hbars" role="list">${rows}</div><p class="cap">${cap.join(' · ')}</p></section>`;
}

// Volltreffer-Karte: Länder, die je mit dem ersten Hinweis gelöst wurden, in Gold (gleiche Kartendaten wie das Spiel).
function hitMapHTML(sum) {
  const k = sum.firstHit.size, paths = DRAW.map(id => `<path d="${MAP.states[id].d}"${sum.firstHit.has(id) ? ' class="hit"' : ''}><title>${NAMES[id]}</title></path>`).join('');
  return `<section class="ps"><h3>Deine Volltreffer-Karte</h3><div class="hitmap">
    <svg viewBox="${VIEW(MAP)}" role="img" aria-label="${k} von 16 Bundesländern mit dem ersten Hinweis erraten">${paths}</svg>
    <div><b>${k} / ${ORDER.length}</b><p>Bundesländer, die du schon mit dem ersten Hinweis erraten hast. Alle 16 ergeben ein eigenes Abzeichen.</p></div></div></section>`;
}

function statsPanelHTML(sum, today) {
  const kpi = (v, label) => `<div class="kpi"><b>${v}</b><span>${label}</span></div>`;
  return `<div class="phead"><h2 id="stats-title">Deine Statistik</h2><button class="iconbtn pclose" type="button" aria-label="Statistik schließen">✕</button></div>
    <div class="kpis">${kpi(sum.played, 'Gespielt')}${kpi(sum.cur, 'Serie')}${kpi(sum.longest, 'Längste Serie')}${kpi(sum.avg, 'Ø Punkte')}</div>
    ${badgesHTML(sum)}${calendarHTML(sum, today)}${hintBarsHTML(sum)}${hitMapHTML(sum)}`;
}

// Gemeinsamer Baustein für Statistik- und Teilen-Fenster: abgedunkelter Hintergrund, Schließen per ✕ (.pclose), Klick daneben oder Esc,
// Fokus springt hinein (auf ✕), bleibt im Fenster (Tab im Kreis) und geht beim Schließen zum auslösenden Element zurück. 200 ms Übergang (CSS).
function makeDrawer(id, cls, labelledby, onClose = () => { }) {
  const d = el('div', 'drawer ' + cls, document.body); d.id = id; d.hidden = true;
  d.innerHTML = `<div class="scrim"></div><aside class="panel" role="dialog" aria-modal="true" aria-labelledby="${labelledby}"></aside>`;
  const ctl = {
    el: d, panel: d.querySelector('.panel'), opener: null, t: 0,
    isOpen: () => !d.hidden && d.classList.contains('open'),
    open(opener) {
      clearTimeout(ctl.t); ctl.opener = opener || document.activeElement;
      d.hidden = false; document.body.classList.add('noscroll'); void d.offsetWidth; d.classList.add('open');
      const x = d.querySelector('.pclose'); if (x) x.focus({ preventScroll: true });
    },
    close() {
      if (d.hidden) return;
      d.classList.remove('open'); document.body.classList.remove('noscroll');
      ctl.t = setTimeout(() => { d.hidden = true; }, reducedMotion() ? 0 : 200);
      if (ctl.opener && ctl.opener.isConnected) ctl.opener.focus({ preventScroll: true });
      ctl.opener = null; onClose();
    },
  };
  d.querySelector('.scrim').onclick = () => ctl.close();
  d.addEventListener('click', e => { if (e.target.closest('.pclose')) ctl.close(); });
  // Esc schließt auch, wenn der Fokus (z. B. nach dem Entfernen eines Elements) außerhalb des Fensters gelandet ist
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !d.hidden && d.classList.contains('open')) { e.preventDefault(); ctl.close(); } });
  d.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return; // Fokus bleibt im Fenster
    const f = [...d.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent), a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  return ctl;
}

let statsCtl = null;
function statsDrawer() {
  if (statsCtl) return statsCtl.el;
  statsCtl = makeDrawer('statspanel', 'side', 'stats-title', () => $('#statsbtn').setAttribute('aria-expanded', 'false'));
  const d = statsCtl.el;
  // Tooltip im Kalender (Datum und Punkte)
  d.addEventListener('pointerover', e => {
    const c = e.target.closest('.calgrid i[data-tip]'), cal = e.target.closest('.cal'), tip = cal && cal.querySelector('.caltip');
    if (!tip) return; if (!c) { tip.hidden = true; return; }
    tip.textContent = c.dataset.tip; tip.hidden = false;
    const cb = c.getBoundingClientRect(), wb = cal.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(cb.left - wb.left + cb.width / 2 - w / 2, 0), wb.width - w) + 'px';
    tip.style.top = cb.top - wb.top - tip.offsetHeight - 6 + 'px';
  });
  d.addEventListener('pointerout', e => { if (e.target.closest('.calgrid') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.calgrid i[data-tip]'))) { const t = d.querySelector('.caltip'); if (t) t.hidden = true; } });
  return d;
}
function renderStatsPanel() { const p = statsDrawer().querySelector('.panel'), top = p.scrollTop; p.innerHTML = statsPanelHTML(todayStats(), isoOfDay(DAYNO)); p.scrollTop = top; }
function statsOpen() { return !!statsCtl && statsCtl.isOpen(); }
function openStats(e) {
  statsDrawer(); renderStatsPanel();
  statsCtl.open(e && e.currentTarget); $('#statsbtn').setAttribute('aria-expanded', 'true');
}
function closeStats() { if (statsCtl) statsCtl.close(); }

/* ---------- Teilen-Fenster ---------- */
// "Ergebnis teilen" öffnet einen Dialog (Desktop mittig, Handy von unten): Vorschau des Bildes mit Formatwahl Story | Sticker | Quadrat,
// "Bild teilen" (System-Teilen-Menü mit PNG, wo navigator.canShare({files}) es erlaubt, sonst Download), "Bild speichern" (Download),
// "Text kopieren" (Zwischenablage mit Ersatzwegen). Bilder in voller Auflösung (teilen.js), die Vorschau zeigt sie nur verkleinert.
// Das PNG wird beim Wählen des Formats schon erzeugt, damit "Bild teilen" direkt im Klick teilt (sonst verfällt die Nutzeraktion).
let shareCtl = null, shareFormat = 'story', shareFile = null, shareJob = 0;
function shareFileName() { return `sechzehn-tag-${DAYNO}.png`; }
function shareDrawer() {
  if (shareCtl) return shareCtl;
  shareCtl = makeDrawer('sharepanel', 'dialog', 'share-title');
  const p = shareCtl.panel;
  p.innerHTML = `<div class="phead"><h2 id="share-title">Ergebnis teilen</h2><button class="iconbtn pclose" type="button" aria-label="Teilen schließen">✕</button></div>
    <div class="sformats" role="radiogroup" aria-label="Bildformat">${[['story', 'Story'], ['sticker', 'Sticker'], ['quadrat', 'Quadrat']]
      .map(([v, l]) => `<label><input type="radio" name="sfmt" value="${v}"><span>${l}</span></label>`).join('')}</div>
    <div class="spreview"><canvas aria-label="Vorschau des Teilen-Bildes" role="img"></canvas></div>
    <div class="sactions"><button class="btn" type="button" data-act="share">Bild teilen</button>
      <button class="btn ghost" type="button" data-act="save">Bild speichern</button>
      <button class="btn ghost" type="button" data-act="text">Text kopieren</button></div>
    <p class="note" role="status"></p>`;
  p.addEventListener('change', e => { if (e.target.name === 'sfmt') { shareFormat = e.target.value; renderSharePreview(); } });
  p.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) shareAction(b.dataset.act, b); });
  return shareCtl;
}
async function renderSharePreview() {
  const p = shareCtl.panel, cv = p.querySelector('canvas'), job = ++shareJob;
  p.querySelector('.spreview').dataset.fmt = shareFormat; shareFile = null;
  p.querySelectorAll('[data-act="share"],[data-act="save"]').forEach(b => { b.disabled = true; });
  await shareImage(shareFormat, currentTheme(), cv); // voller Auflösung, CSS verkleinert
  const blob = await canvasBlob(cv); if (job !== shareJob) return;
  shareFile = new File([blob], shareFileName(), { type: 'image/png' });
  p.querySelectorAll('[data-act="share"],[data-act="save"]').forEach(b => { b.disabled = false; });
  cv.setAttribute('aria-label', `Vorschau: ${{ story: 'Story', sticker: 'Sticker', quadrat: 'Quadrat' }[shareFormat]}, ${total()} von ${CONFIG.ROUNDS * CONFIG.POINTS[0]} Punkten`);
}
function downloadFile(file) {
  const a = el('a', null, document.body), url = URL.createObjectURL(file);
  a.href = url; a.download = file.name; a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function shareAction(act, btn) {
  const note = shareCtl.panel.querySelector('.note'), old = shareCtl.panel.querySelector('.sharetext'); if (old) old.remove();
  note.textContent = '';
  if (act === 'text') {
    if (await copyText(shareText())) { flashLabel(btn, 'Kopiert'); return; }
    note.textContent = 'Automatisch kopieren ging nicht. Der Text ist markiert: mit Strg+C (Mac: ⌘+C) kopieren.';
    const ta = el('textarea', 'sharetext'); ta.value = shareText(); ta.readOnly = true; ta.rows = CONFIG.ROUNDS + 2;
    note.after(ta); ta.focus(); ta.select(); return;
  }
  if (!shareFile) return;
  if (act === 'share' && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], title: 'Sechzehn' }); } catch (e) { if (!e || e.name !== 'AbortError') { downloadFile(shareFile); note.textContent = 'Teilen ging nicht, das Bild wurde gespeichert.'; } }
    return;
  }
  downloadFile(shareFile); flashLabel(btn, 'Gespeichert');
}
function flashLabel(btn, label) {
  const old = btn.dataset.label || btn.textContent; btn.dataset.label = old; btn.textContent = label;
  clearTimeout(btn.flashT); btn.flashT = setTimeout(() => { btn.textContent = old; }, 1600);
}
function openShare(e) {
  const ctl = shareDrawer(), r = ctl.panel.querySelector(`input[value="${shareFormat}"]`); r.checked = true;
  ctl.panel.querySelector('.note').textContent = ''; const old = ctl.panel.querySelector('.sharetext'); if (old) old.remove();
  ctl.open(e && e.currentTarget); renderSharePreview();
}

// Kopfzeile: Diamant mit Anzahl der perfekten Tage (ab 1), öffnet ebenfalls die Statistik
function updateDiaBtn(sum = todayStats()) {
  const b = $('#diabtn'); b.hidden = !sum.diamonds;
  if (!sum.diamonds) return;
  if (!b.querySelector('.gem')) b.insertAdjacentHTML('afterbegin', gemSVG(16));
  b.querySelector('span').textContent = sum.diamonds;
  const label = `${plural(sum.diamonds, 'perfekter Tag', 'perfekte Tage')}, Statistik öffnen`; b.setAttribute('aria-label', label); b.title = label;
}

// Hilfe ("So geht's") bleibt das ausklappbare Blatt unter der Kopfzeile. Erneutes Antippen schließt es.
let sheetKind = null;
function toggleSheet(kind) {
  const sh = $('#sheet'), open = sh.hidden || sheetKind !== kind;
  sheetKind = open ? kind : null; sh.hidden = !open;
  if (open) renderSheet();
  $('#help').setAttribute('aria-expanded', sheetKind === 'help');
}
function refreshStats() { // nach Änderungen im Entwicklermodus
  if (statsOpen()) renderStatsPanel();
  const line = $('.end .statline'); if (line) line.outerHTML = statLineHTML(todayStats());
  updateDiaBtn();
}

// Endbildschirm: eine dezente Zeile statt der ganzen Statistik
function statLineHTML(sum) {
  return `<p class="statline">Serie: <b class="streakv"><span>${sum.cur}</span> ${sum.cur === 1 ? 'Tag' : 'Tage'}</b><em class="rec" hidden> · Neuer Rekord!</em> · Ø ${sum.avg} Punkte · <button class="linkbtn" type="button" data-stats>Alle Statistiken →</button></p>`;
}

// Entwicklermodus (?dev=1): vergangene Tage als gespielt eintragen (Hinweisnummer je Runde, Punkte werden daraus berechnet),
// mehrere Vortage zufällig füllen, Statistik löschen. "Heute" lässt sich mit ?tag=N verschieben; mit ?dev=1 zählen auch so gespielte Tage.
function randomHints(rand = Math.random) { // grob realistisch: meist früh gelöst, selten gar nicht
  const w = [30, 25, 18, 12, 8, 7];
  return Array.from({ length: CONFIG.ROUNDS }, () => { let r = rand() * 100, i = 0; while (r >= w[i]) r -= w[i++]; return i === 5 ? 0 : i + 1; });
}

// Demo-Modus (?dev=1&demo=spiel|ende): feste Spielstände für Screenshots und Sichtprüfung, ohne Startbildschirm. Nichts wird gespeichert
// (Spielstand, Statistik und Hell/Dunkel-Wahl bleiben im Speicher der Seite). Modus erzwingen mit &theme=light|dark.
function demoState() {
  const s = fresh();
  if (DEMO === 'start') return s; // Startbildschirm (Statistik aus demoStats, &serie=0 für Erstbesucher)
  if (DEMO === 'ende') { s.round = CONFIG.ROUNDS; s.results = [0, 2, 5, 1, 0].map(h => ({ hint: h, pts: h < 5 ? CONFIG.POINTS[h] : 0 })); }
  else if (DEMO === 'perfekt') { s.round = CONFIG.ROUNDS; s.results = LEVEL.map(() => ({ hint: 0, pts: CONFIG.POINTS[0] })); } // "Sechzehn Facetten"
  else { // erste Runde mit falschen Tipps (&falsch=N, Standard 2): die Länder, die der Lösung am nächsten liegen
    const a = LEVEL[0].a, [ax, ay] = MAP.states[a].c, dist = id => Math.hypot(MAP.states[id].c[0] - ax, MAP.states[id].c[1] - ay);
    const n = DEMO === 'volltreffer' ? 0 : Math.min(4, Math.max(0, +(new URLSearchParams(location.search).get('falsch') ?? 2) || 0));
    s.wrong = ORDER.filter(id => id !== a).sort((x, y) => dist(x) - dist(y)).slice(0, n); s.hint = n;
  }
  return s;
}
function demoHover() { // &hover=XX: Land wie unter dem Mauszeiger hervorheben (für Screenshots ohne Maus)
  const id = new URLSearchParams(location.search).get('hover');
  if (id && ui && ui.map && ui.map.hover && ORDER.includes(id)) ui.map.hover(id);
}
function demoStats() { // neun Vortage mit festen Zufallswerten (&serie=0: keine, &verlauf=1: 35 Tage wie "Verlauf simulieren"); heute trägt recordToday ein
  const rand = rng(DAYNO), s = { days: {} }, q = new URLSearchParams(location.search);
  if (q.get('serie') === '0') return s;
  if (q.has('verlauf')) return simulateHistory(s, rand);
  for (let n = DAYNO - 9; n < DAYNO; n++) s.days[isoOfDay(n)] = dayEntry(n, randomHints(rand));
  return s;
}
function dayEntry(n, hints) { const lands = landsOfDay(n); return lands ? { pts: pointsOfHints(hints), hints, lands } : { pts: pointsOfHints(hints), hints }; }
// Verlauf der 35 Tage vor heute: einzelne Lücken (ca. 15 %, nie in den letzten 6 Tagen, damit eine Serie steht), zwei perfekte Tage
// (vor 20 und vor 3 Tagen), sonst zufällige Hinweise. Ersetzt die gespeicherte Statistik.
function simulateHistory(s = { days: {} }, rand = rng(DAYNO * 31 + 7)) {
  s.days = {};
  for (let k = 35; k >= 1; k--) {
    const n = DAYNO - k, perfect = k === 20 || k === 3;
    if (!perfect && k > 6 && rand() < 0.15) continue;
    s.days[isoOfDay(n)] = dayEntry(n, perfect ? Array(CONFIG.ROUNDS).fill(1) : randomHints(rand));
  }
  return s;
}
function parseHints(txt) { const h = txt.split(/[\s,;]+/).filter(Boolean).map(x => (/^[x✕0]$/i.test(x) ? 0 : +x)); return validHints(h) ? h : null; }
function hintsText(h) { return h.map(x => x || 'x').join(','); }

function devPanel() {
  const box = el('details', 'devpanel', document.body);
  box.innerHTML = `<summary>Entwicklermodus</summary>
    <p>Heute = Tag ${DAYNO} (${isoOfDay(DAYNO)}). Anderer Tag: <code>?tag=N&amp;dev=1</code></p>
    <label>Tag <input type="number" id="dev-day" value="${DAYNO - 1}"></label>
    <label>Hinweise <input type="text" id="dev-hints" value="${hintsText(randomHints())}" title="Hinweisnummer je Runde, x = nicht gelöst"></label>
    <button type="button" id="dev-add">Als gespielt eintragen</button>
    <label>Vortage <input type="number" id="dev-n" value="9" min="1" max="60"></label>
    <button type="button" id="dev-fill">Vortage zufällig füllen</button>
    <button type="button" id="dev-sim">35 Tage simulieren (Lücken, 2 perfekte)</button>
    <button type="button" id="dev-clear">Statistik löschen</button>
    <output id="dev-out"></output>`;
  const out = $('#dev-out'), show = msg => {
    const s = todayStats(), days = Object.keys(loadStats().days).sort();
    out.textContent = `${msg}\nSerie ${s.cur}, längste ${s.longest}, gespielt ${s.played}, Runden ${s.rounds}\nTage: ${days.length > 4 ? days[0] + ' … ' + days[days.length - 1] : days.join(', ') || '–'}`;
    refreshStats();
  };
  const add = (n, hints) => { const s = loadStats(); return recordDay(s, isoOfDay(n), dayEntry(n, hints)); };
  $('#dev-sim').onclick = () => { const s = simulateHistory(); saveStats(s); show(`${Object.keys(s.days).length} Tage der letzten 35 eingetragen (heute bleibt offen).`); };
  $('#dev-add').onclick = () => {
    const n = Math.round(+$('#dev-day').value), hints = parseHints($('#dev-hints').value), iso = isoOfDay(n);
    if (!hints) return show(`Hinweise ungültig: ${CONFIG.ROUNDS} Werte 1–5 oder x, z. B. 1,2,x,3,1.`);
    if (add(n, hints)) { show(`Tag ${n} (${iso}) eingetragen: ${hintsText(hints)} = ${pointsOfHints(hints)} Punkte.`); $('#dev-day').value = n + 1; $('#dev-hints').value = hintsText(randomHints()); }
    else show(`Tag ${n} (${iso}) war schon eingetragen, erstes Ergebnis bleibt.`);
  };
  $('#dev-fill').onclick = () => {
    const k = Math.max(1, Math.round(+$('#dev-n').value)); let added = 0;
    for (let n = DAYNO - k; n < DAYNO; n++) if (add(n, randomHints())) added++;
    show(`${added} von ${k} Vortagen zufällig eingetragen (vorhandene bleiben).`);
  };
  $('#dev-clear').onclick = () => { try { localStorage.removeItem(STATS_KEY); } catch (e) { } show('Statistik gelöscht.'); };
  show('Bereit.');
}

/* ---------- Fortschritt speichern (pro Tag, nur im eigenen Browser) ---------- */
// KEEP_PROGRESS: localStorage (bleibt, bis der Tag vorbei ist). Sonst sessionStorage: übersteht Neuladen, endet mit dem Tab.

const KEY = () => 'sechzehn-tag-' + DAYNO;
function store() { return CONFIG.KEEP_PROGRESS ? localStorage : sessionStorage; }
function save() { if (DEMO) return; try { store().setItem(KEY(), JSON.stringify(state)); } catch (e) { } }
function load() { if (DEMO) return null; try { return JSON.parse(store().getItem(KEY())); } catch (e) { return null; } }

/* ---------- Hell/Dunkel ---------- */
// Ohne eigene Wahl gilt die Systemeinstellung. Eine Wahl steht in localStorage und als data-theme am <html>; beim Laden setzt sie das
// Inline-Script in index.html, bevor etwas gezeichnet wird. Umschalten tauscht nur die Farbtoken, Spielstand und Animationen bleiben.
const THEME_KEY = 'sechzehn-theme', SYSTEM_DARK = matchMedia('(prefers-color-scheme: dark)');
function currentTheme() { return document.documentElement.getAttribute('data-theme') || (SYSTEM_DARK.matches ? 'dark' : 'light'); }
function updateThemeButton() {
  const label = currentTheme() === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln', b = $('#themebtn');
  b.setAttribute('aria-label', label); b.title = label;
}
function toggleTheme() {
  const t = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if (!DEMO) try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
  updateThemeButton();
}
$('#themebtn').onclick = toggleTheme;

/* ---------- Ton an/aus ---------- */
// Wahl in localStorage (sechzehn-ton, in sound.js), Standard an. Beim Einschalten einmal leise "select" als Bestätigung.
function updateSoundButton() {
  const on = Sound.isEnabled(), b = $('#soundbtn'), label = on ? 'Ton aus' : 'Ton an';
  b.classList.toggle('muted', !on); b.setAttribute('aria-label', label); b.title = label;
}
$('#soundbtn').onclick = () => { Sound.setEnabled(!Sound.isEnabled()); updateSoundButton(); Sound.play('select'); };
updateSoundButton();
SYSTEM_DARK.addEventListener('change', updateThemeButton);
updateThemeButton();

/* ---------- Start ---------- */

async function start() {
  try {
    const [m, csv] = await Promise.all([fetch('data/map.json').then(r => r.json()), fetch('data/fakten.csv').then(r => r.text())]);
    MAP = m; NAMES = Object.fromEntries(Object.entries(MAP.states).map(([k, v]) => [k, v.name]));
    DAYNO = dayNumber();
    FACTS = parseCSV(csv); LEVEL = buildLevel(FACTS, DAYNO);
    if (LEVEL.length < CONFIG.ROUNDS) throw new Error(`Der Faktenpool reicht nur für ${LEVEL.length} von ${CONFIG.ROUNDS} Runden.`);
  } catch (e) {
    $('#main').innerHTML = `<p class="verdict bad">Spiel konnte nicht geladen werden. ${e.message}</p>`; console.error(e); return;
  }
  state = DEMO ? demoState() : load() || fresh();
  introOpen = (!DEMO || DEMO === 'start') && state.round < CONFIG.ROUNDS; // Tag noch offen: Startbildschirm (Spielen/Weiterspielen). Schon gespielt: direkt zur Auswertung.
  shownTotal = total(); $('#total').textContent = shownTotal;
  $('#help').onclick = () => toggleSheet('help');
  migrateStats(); // alte Einträge um die Länder der Runden ergänzen
  $('#statsbtn').onclick = openStats; $('#diabtn').onclick = openStats;
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-stats]'); if (b) openStats({ currentTarget: b }); });
  if (DEV && !DEMO) devPanel();
  // &demo=perfekt: perfekter Endbildschirm mit voller Facetten-Animation (&statisch=1: gleich der Endzustand wie nach dem Neuladen)
  if (DEMO === 'perfekt' && !new URLSearchParams(location.search).has('statisch')) fx = { reveal: true };
  render(); updateDiaBtn();
  if (DEMO) demoHover();
  if (DEV && new URLSearchParams(location.search).has('statistik')) openStats(); // &statistik=1: Statistikfenster gleich offen (Screenshots)
  // Teilen testen (mit &demo=ende oder &demo=perfekt): &teilen=story|sticker|quadrat öffnet das Teilen-Fenster mit diesem Format;
  // &bild=story|sticker|quadrat zeigt nur das Bild in voller Größe (1:1, für tools/screenshots.ps1 mit -Breite 1080 -Hoehe 1920/1080)
  const q = new URLSearchParams(location.search);
  if (DEV && state.round >= CONFIG.ROUNDS && SHARE_FORMATS[q.get('teilen')]) { shareFormat = q.get('teilen'); openShare(); }
  if (DEV && state.round >= CONFIG.ROUNDS && SHARE_FORMATS[q.get('bild')]) {
    stopFacets(); const cv = await shareImage(q.get('bild'), currentTheme());
    document.body.innerHTML = ''; document.body.className = 'sharebild'; document.body.appendChild(cv);
  }
  // Entwicklermodus: Taste F spielt die Facetten-Animation auf einem perfekten Endbildschirm erneut ab
  if (DEV) addEventListener('keydown', e => {
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && document.body.dataset.view === 'end' && isPerfect()
      && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { fx = { reveal: true }; render(); }
  });
  // &demo=volltreffer: erste Runde nach kurzer Zeit mit dem ersten Hinweis lösen (Volltreffer-Animation testen)
  if (DEMO === 'volltreffer') setTimeout(() => { pick(cur().a); guess(); }, +(new URLSearchParams(location.search).get('nach') || 700));
  addEventListener('resize', sizeMap);
  document.fonts.ready.then(sizeMap); // Zeilenhöhen stimmen erst mit geladenen Schriften
}
start();
