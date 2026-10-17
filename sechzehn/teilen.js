/* Teilen-Bilder "Sechzehn" (Canvas, keine Bibliothek). Wird vor app.js geladen, nutzt zur Laufzeit dessen Daten (MAP, DRAW, FACETS, CONFIG).
   Formate: Story 1080×1920 (dunkel; am perfekten Tag mit Diamantkarte), Sticker 1080×1080 (transparent, für Instagram-Stories über ein
   eigenes Foto), Quadrat 1080×1080 (im aktuellen Modus).
   Spoiler-Regel: Kein Bild zeigt, welche Länder heute gefragt waren. Karten sind nur Silhouette bzw. Diamant (alle 16 Länder gleich behandelt),
   nie Ländernamen, nie markierte Länder. Eingabe ist nur shareImageData() (Punkte, Raster, Tag, Serie, Adresse). */

const SHARE_FORMATS = { story: [1080, 1920], sticker: [1080, 1080], quadrat: [1080, 1080] };
const SHARE_FONT = { display: '"Bricolage Grotesque", "Arial Black", Arial, sans-serif', body: '"Figtree", "Segoe UI", Arial, sans-serif' };
// Farben wie im Spiel (style.css). Gold als flacher senkrechter Verlauf, Eis für den perfekten Tag, Facetten-Töne wie die Animation.
const SHARE_PAL = {
  dark: { bg: '#111315', ink: '#F1F3F5', muted: '#9AA1AA', land: '#181B1F', empty: '#2C3137', emptyEdge: 'rgba(255,255,255,.07)', pill: '#1C1F23',
    ok: '#4CC271', bad: '#F06A6E', gold: ['#EFC255', '#EDBB3F', '#EBB329'], iceText: ['#E4F6FF', '#9ACDEB', '#5C9CC6'], iceCell: ['#E4F6FF', '#9ACDEB', '#5C9CC6'],
    kicker: '#9ACDEB', tones: ['#2C6893', '#4F92C2', '#8EC6E8', '#D8F1FF'], edge: 'rgba(255,255,255,.85)', glow: 'rgba(150,215,255,.45)' },
  light: { bg: '#FFFFFF', ink: '#121417', muted: '#6A717B', land: '#F2F4F6', empty: '#DFE3E8', emptyEdge: 'rgba(0,0,0,.04)', pill: '#F3F4F6',
    ok: '#2E9E4F', bad: '#D64045', gold: ['#E1A614', '#D19A12', '#C08E11'], iceText: ['#A9D3EC', '#7FB4D6', '#2D6E96'], iceCell: ['#D6EEFA', '#A9D3EC', '#7FB4D6'],
    kicker: '#2D6E96', tones: ['#3F7FAE', '#6FA9D1', '#A6D3EE', '#DDF1FC'], edge: 'rgba(255,255,255,.95)', glow: 'rgba(70,150,210,.35)' },
};

// Daten für die Bilder. rows: je Runde fünf Kästchen 'r' (falscher Tipp), 'g' (gelöst), 'gd' (Volltreffer), 'dia' (perfekter Tag), 'e' (leer).
function shareImageData() {
  const perfect = isPerfect(), sum = todayStats();
  const rows = state.results.map(r => Array.from({ length: CONFIG.ROUNDS }, (_, k) => (r.pts === 0 ? 'r'
    : k < r.hint ? 'r' : k === r.hint ? (r.hint === 0 ? (perfect ? 'dia' : 'gd') : 'g') : 'e')));
  return { day: DAYNO, date: dateOfDay(DAYNO), pts: total(), max: CONFIG.ROUNDS * CONFIG.POINTS[0], perfect, rows,
    streak: sum.cur, url: CONFIG.SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') };
}

// Schriften des Spiels sicher geladen, bevor gezeichnet wird (sonst Ersatzschrift im Bild)
async function shareFonts() {
  try {
    await Promise.all(['800 100px', '600 100px'].map(w => document.fonts.load(`${w} "Bricolage Grotesque"`))
      .concat(['500 40px', '600 40px', '700 40px'].map(w => document.fonts.load(`${w} "Figtree"`))));
    await document.fonts.ready;
  } catch (e) { }
}

/* ---------- Zeichenhilfen ---------- */
let SHARE_PATHS = null; // Path2D und Begrenzungsrahmen je Land (Kartendaten: absolute M/L-Pfade)
function sharePaths() {
  if (SHARE_PATHS) return SHARE_PATHS;
  SHARE_PATHS = {};
  for (const id of DRAW) {
    const d = MAP.states[id].d, n = d.match(/-?\d+(\.\d+)?/g).map(Number); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    SHARE_PATHS[id] = { p: new Path2D(d), box: [x0, y0, x1 - x0, y1 - y0] };
  }
  return SHARE_PATHS;
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function mix(hex, other, t) { // Farbe hex mit other (#fff/#000) zu Anteil t mischen, wie color-mix im CSS
  const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(other.slice(i, i + 2), 16));
  return '#' + a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, '0')).join('');
}
function font(c, weight, size, fam = 'display') { c.font = `${weight} ${size}px ${SHARE_FONT[fam]}`; }
function text(c, s, x, y, { weight = 800, size = 40, fam = 'display', color = '#fff', align = 'left', spacing = 0 } = {}) {
  font(c, weight, size, fam); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.letterSpacing = spacing + 'px'; c.fillText(s, x, y); c.letterSpacing = '0px';
}
function textWidth(c, s, weight, size, fam = 'display') { font(c, weight, size, fam); return c.measureText(s).width; }
// Text mit Verlauf (Eis), diagonal über die Textfläche
function gradText(c, s, x, y, size, stops) {
  font(c, 800, size); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const w = c.measureText(s).width, g = c.createLinearGradient(x, y - size * 0.75, x + w, y);
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col)); c.fillStyle = g; c.fillText(s, x, y); return w;
}
// Ein Kästchen wie auf dem Endbildschirm, Eckenradius 22 %
function shareCell(c, x, y, s, type, pal, emptyFill = pal.empty, emptyEdge = pal.emptyEdge) {
  rrect(c, x, y, s, s, s * 0.22);
  if (type === 'e') { c.fillStyle = emptyFill; c.fill(); if (emptyEdge) { c.strokeStyle = emptyEdge; c.lineWidth = 2; c.stroke(); } return; }
  if (type === 'gd' || type === 'dia') {
    const g = type === 'gd' ? c.createLinearGradient(x, y, x, y + s) : c.createLinearGradient(x, y, x + s, y + s);
    const st = type === 'gd' ? pal.gold : pal.iceCell; st.forEach((col, i) => g.addColorStop(i / (st.length - 1), col)); c.fillStyle = g;
    if (type === 'dia') { c.save(); c.shadowColor = pal.glow; c.shadowBlur = s * 0.25; c.fill(); c.restore(); return; }
  } else c.fillStyle = type === 'r' ? pal.bad : pal.ok;
  c.fill();
}
function shareGrid(c, x, y, s, gap, rows, pal, emptyFill, emptyEdge) {
  rows.forEach((row, i) => row.forEach((t, k) => shareCell(c, x + k * (s + gap), y + i * (s + gap), s, t, pal, emptyFill, emptyEdge)));
  return CONFIG.ROUNDS * s + (CONFIG.ROUNDS - 1) * gap;
}
// Deutschland-Silhouette: alle Länder gleich, Grenzen in Hintergrundfarbe (keine Hervorhebung, kein Spoiler)
function shareSilhouette(c, x, y, width, fill, border) {
  const P = sharePaths(), k = width / MAP.w;
  c.save(); c.translate(x, y); c.scale(k, k); c.fillStyle = fill; c.strokeStyle = border; c.lineWidth = 2.4 / k; c.lineJoin = 'round';
  for (const id of DRAW) { c.fill(P[id].p, 'evenodd'); c.stroke(P[id].p); }
  c.restore();
}
// Diamantkarte wie die Facetten-Animation: Ton und Lichtrichtung je Land (FACETS), Verlauf über den Begrenzungsrahmen des Landes
// (hell = Ton + 38 % Weiß, 55 % Ton, dunkel = Ton + 16 % Schwarz), weiße Schliffkanten, weiches bläuliches Leuchten dahinter.
function shareDiamond(c, x, y, width, pal) {
  const P = sharePaths(), k = width / MAP.w, h = MAP.h * k;
  const glow = c.createRadialGradient(x + width / 2, y + h / 2, 0, x + width / 2, y + h / 2, h * 0.62);
  glow.addColorStop(0, pal.glow); glow.addColorStop(0.55, pal.glow.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.45).toFixed(3) + ')')); glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(x + width / 2, y + h / 2); c.scale(1, h / width * 0.92); c.translate(-(x + width / 2), -(y + h / 2));
  c.fillStyle = glow; c.fillRect(x - width * 0.3, y - h * 0.3, width * 1.6, h * 1.6); c.restore();
  c.save(); c.translate(x, y); c.scale(k, k); c.lineJoin = 'round';
  for (const id of DRAW) {
    const [t, deg] = FACETS[id], a = deg * Math.PI / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2, [bx, by, bw, bh] = P[id].box, tone = pal.tones[t];
    const g = c.createLinearGradient(bx + (0.5 - dx) * bw, by + (0.5 - dy) * bh, bx + (0.5 + dx) * bw, by + (0.5 + dy) * bh);
    g.addColorStop(0, mix(tone, '#ffffff', 0.38)); g.addColorStop(0.55, tone); g.addColorStop(1, mix(tone, '#000000', 0.16));
    c.fillStyle = g; c.fill(P[id].p, 'evenodd');
  }
  c.strokeStyle = pal.edge; c.lineWidth = 2.2 / k; for (const id of DRAW) c.stroke(P[id].p);
  c.restore();
  return h;
}
function shareFooter(c, W, H, pad, D, pal, ySerie) {
  if (D.streak > 0) {
    text(c, 'SERIE', pad, ySerie, { weight: 700, size: 26, fam: 'body', color: pal.muted, spacing: 4 });
    text(c, `${D.streak} ${D.streak === 1 ? 'Tag' : 'Tage'}`, pad, ySerie + 76, { weight: 800, size: 64, color: pal.ink });
  }
  text(c, D.url, W - pad, ySerie + 76, { weight: 600, size: 36, fam: 'body', color: pal.muted, align: 'right' });
}

/* ---------- Formate ---------- */
function drawStory(c, D) {
  const W = 1080, H = 1920, pad = 100, pal = SHARE_PAL.dark;
  c.fillStyle = pal.bg; c.fillRect(0, 0, W, H);
  if (!D.perfect) shareSilhouette(c, 330, 500, 900, pal.land, pal.bg); // rechts unten angeschnitten, ab Höhe der Punktzahl
  text(c, 'Sechzehn', pad, pad + 70, { size: 76, color: pal.ink });
  text(c, `Tag ${D.day} · ${D.date}`, pad, pad + 128, { weight: 500, size: 34, fam: 'body', color: pal.muted });
  if (D.perfect) {
    const w = gradText(c, String(D.pts), pad - 8, 560, 260, pal.iceText);
    text(c, 'SECHZEHN FACETTEN', pad + w + 36, 468, { weight: 700, size: 26, fam: 'body', color: pal.kicker, spacing: 4 });
    text(c, 'Perfekter Tag', pad + w + 36, 532, { size: 52, color: pal.ink });
    shareDiamond(c, 140, 640, 800, pal);
  } else {
    text(c, String(D.pts), pad - 10, 640, { size: 300, color: pal.ink });
    text(c, `von ${D.max} Punkten`, pad, 712, { weight: 500, size: 40, fam: 'body', color: pal.muted });
    shareGrid(c, pad, 800, 104, 16, D.rows, pal);
  }
  shareFooter(c, W, H, pad, D, pal, 1730);
}
function drawSticker(c, D) {
  const W = 1080, pal = SHARE_PAL.dark, white = '#FFFFFF';
  c.clearRect(0, 0, W, W);
  c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 22; c.shadowOffsetY = 3; // Texte und Raster auf hellen und dunklen Fotos lesbar
  text(c, 'Sechzehn', W / 2, 170, { size: 64, color: white, align: 'center' });
  const big = String(D.pts), slash = `/${D.max}`, wb = textWidth(c, big, 800, 220), ws = textWidth(c, slash, 700, 72), x0 = (W - wb - ws - 8) / 2;
  if (D.perfect) { c.save(); c.shadowColor = 'rgba(0,30,60,.5)'; gradText(c, big, x0, 420, 220, ['#FFFFFF', '#CDEBFA', '#8EC6E8']); c.restore(); }
  else text(c, big, x0, 420, { size: 220, color: white });
  text(c, slash, x0 + wb + 8, 420, { weight: 700, size: 72, color: white });
  const s = 84, gap = 13, gw = 5 * s + 4 * gap;
  shareGrid(c, (W - gw) / 2, 480, s, gap, D.rows, pal, 'rgba(255,255,255,.28)', null);
  const foot = [`Tag ${D.day}`].concat(D.streak > 0 ? [`Serie ${D.streak}`] : [], [D.url]).join(' · ');
  text(c, foot, W / 2, 1022, { weight: 700, size: 34, fam: 'body', color: white, align: 'center' });
  c.restore();
}
function drawSquare(c, D, theme) {
  const W = 1080, pad = 80, pal = SHARE_PAL[theme] || SHARE_PAL.dark;
  c.fillStyle = pal.bg; c.fillRect(0, 0, W, W);
  shareSilhouette(c, 470, 170, 720, pal.land, pal.bg); // sehr dezent, rechts angeschnitten
  text(c, 'Sechzehn', pad, pad + 56, { size: 60, color: pal.ink });
  text(c, `Tag ${D.day}`, W - pad, pad + 56, { weight: 600, size: 40, fam: 'body', color: pal.muted, align: 'right' });
  if (D.perfect) gradText(c, String(D.pts), pad - 6, 600, 220, pal.iceText);
  else text(c, String(D.pts), pad - 8, 600, { size: 220, color: pal.ink });
  text(c, `von ${D.max} Punkten`, pad, 662, { weight: 500, size: 36, fam: 'body', color: pal.muted });
  const s = 76, gap = 12, gw = 5 * s + 4 * gap; shareGrid(c, W - pad - gw, 330, s, gap, D.rows, pal);
  if (D.streak > 0) {
    const label = `Serie ${D.streak} ${D.streak === 1 ? 'Tag' : 'Tage'}`, w = textWidth(c, label, 700, 34, 'body') + 56;
    rrect(c, pad, W - pad - 64, w, 64, 32); c.fillStyle = pal.pill; c.fill(); if (theme === 'light') { c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; c.stroke(); }
    text(c, label, pad + 28, W - pad - 20, { weight: 700, size: 34, fam: 'body', color: pal.ink });
  }
  text(c, D.url, W - pad, W - pad - 20, { weight: 600, size: 34, fam: 'body', color: pal.muted, align: 'right' });
}

// Erzeugt das Bild in voller Auflösung. theme nur für "quadrat" (aktueller Modus).
async function shareImage(format, theme, canvas = document.createElement('canvas')) {
  await shareFonts();
  const [w, h] = SHARE_FORMATS[format], D = shareImageData(); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  if (format === 'story') drawStory(c, D); else if (format === 'sticker') drawSticker(c, D); else drawSquare(c, D, theme);
  return canvas;
}
function canvasBlob(canvas) { return new Promise(r => canvas.toBlob(r, 'image/png')); }
