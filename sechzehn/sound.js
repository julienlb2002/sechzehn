/* Sounddesign "Sechzehn": dezente Hintergrundakustik, ganz ohne Audiodateien (Web Audio API). Wird vor app.js geladen.
   Klangfarben: Marimba (Treffer, Auswahl), Glas (Volltreffer), Kristall (perfekter Tag, Funkeln), dumpfes Dreieck (falsch), gefiltertes
   Rauschen (Klick, Hinweiskarte). Alles läuft über einen Master mit Kompressor (auch bei leiser Systemlautstärke hörbar) und etwas Hall.
   Lautstärke und Hall in SOUND_CONFIG. Abspielen nur über Sound.play(name, …); Ereignisse siehe CLAUDE.md, Abschnitt Sounddesign. */
const SOUND_CONFIG = { volume: 0.32, reverb: 0.18 };
const Sound = (() => {
  let ctx = null, master = null, wet = null;
  let enabled = true;
  try { enabled = localStorage.getItem('sechzehn-ton') !== 'aus'; } catch (e) {}

  function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = SOUND_CONFIG.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp).connect(ctx.destination);
    const conv = ctx.createConvolver(); const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = SOUND_CONFIG.reverb; wet.connect(conv).connect(master);
    return ctx;
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function out(node, dry = 1, rev = 1) { const g = ctx.createGain(); g.gain.value = dry; node.connect(g).connect(master); const r = ctx.createGain(); r.gain.value = rev; node.connect(r).connect(wet); }

  function tone(midi, t, { gain = .35, dur = null, fam = 'marimba', rev = 1 } = {}) {
    const f = hz(midi), now = ctx.currentTime + t;
    const spec = fam === 'glas' ? { parts: [[1,1],[2.76,.32],[5.4,.12],[8.93,.05]], dec: 1.6, att: .004 }
      : fam === 'kristall' ? { parts: [[1,1],[2.0,.18],[3.01,.22],[4.17,.12],[6.8,.06]], dec: 2.4, att: .003 }
      : { parts: [[1,1],[3.99,.35],[9.2,.06]], dec: .55, att: .002 };
    const d = dur ?? spec.dec;
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(gain, now + spec.att); bus.gain.exponentialRampToValueAtTime(.0008, now + d);
    spec.parts.forEach(([m, a], i) => {
      if (f * m > ctx.sampleRate * 0.45) return; // Teiltöne über der Nyquist-Grenze weglassen (hohe Funkeltöne), sonst Warnungen und Aliasing
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = ctx.createGain(); g.gain.value = a;
      if (i > 0) { g.gain.setValueAtTime(a, now); g.gain.exponentialRampToValueAtTime(.0005, now + d / (1 + i * 1.4)); }
      o.connect(g).connect(bus); o.start(now); o.stop(now + d + .05);
    });
    out(bus, 1, rev);
  }
  function noise(t, { dur = .03, freq = 2500, q = 1.2, gain = .12, type = 'bandpass' } = {}) {
    const now = ctx.currentTime + t, len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f).connect(g); out(g, 1, .3); s.start(now);
  }
  function dull(midi, t, { gain = .3, dur = .32 } = {}) {
    const now = ctx.currentTime + t, o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(midi);
    o.frequency.exponentialRampToValueAtTime(hz(midi) * .94, now + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = .7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + .008); g.gain.exponentialRampToValueAtTime(.0008, now + dur);
    o.connect(lp).connect(g); out(g, 1, .25); o.start(now); o.stop(now + dur + .05);
  }
  function sparkle(t, count, { lo = 88, span = 14, spread = .6, gain = .07 } = {}) {
    const pent = [0, 2, 4, 7, 9];
    for (let i = 0; i < count; i++) {
      const n = lo + pent[Math.floor(Math.random() * 5)] + 12 * Math.floor(Math.random() * (span / 12 + 1));
      tone(Math.min(n, 108), t + Math.random() * spread, { gain: gain * (0.6 + Math.random() * .6), dur: .5, fam: 'kristall', rev: 1.4 });
    }
  }

  const S = {
    start() { tone(67, 0, { gain: .16 }); tone(72, .09, { gain: .18 }); tone(79, .18, { gain: .2, dur: .8 }); },
    select() { noise(0, { dur: .018, freq: 3200, q: 2, gain: .16 }); tone(84, 0, { gain: .05, dur: .12 }); },
    wrong() { dull(55, 0); dull(50, .12, { dur: .42 }); },
    hint() { noise(0, { dur: .14, freq: 1400, q: .5, gain: .07 }); noise(.05, { dur: .1, freq: 2600, q: .6, gain: .04 }); },
    right() { [72, 76, 79].forEach((n, i) => tone(n, i * .085, { gain: .28 })); tone(84, .26, { gain: .18 }); },
    jackpot() { S.right(); tone(88, .36, { gain: .16, fam: 'glas' }); sparkle(.38, 9, { lo: 91, gain: .07, spread: .7 }); },
    tile(h) { if (h === 0) dull(52, 0, { gain: .22, dur: .25 }); else { tone(84 - (h - 1) * 3, 0, { gain: .22 }); if (h === 1) sparkle(.04, 3, { lo: 96, gain: .05, spread: .2 }); } },
    streak() { tone(79, 0, { gain: .2 }); tone(84, .09, { gain: .22 }); },
    record() { [72, 76, 79, 84].forEach((n, i) => tone(n, i * .11, { gain: .24 })); tone(88, .44, { gain: .18, dur: 1.2 }); },
    perfectStep(i) { tone([72, 74, 76, 79, 81][i], 0, { gain: .18 }); },
    perfectChord() { [60, 67, 72, 76, 79, 83, 86, 91].forEach((n, i) => tone(n, i * .055, { gain: .16 - i * .008, fam: 'kristall', rev: 1.6 })); },
    perfectSparkle() { sparkle(0, 16, { lo: 91, span: 17, spread: 1.6, gain: .06 }); },
    glint() { sparkle(0, 5, { lo: 96, span: 12, spread: .9, gain: .035 }); }
  };

  function play(name, ...args) {
    if (!enabled || document.hidden || !S[name]) return;
    // Vor der ersten Nutzeraktion (z. B. ?demo=perfekt direkt nach dem Laden) nichts planen: der AudioContext bliebe angehalten und
    // alle bis dahin geplanten Klänge kämen beim ersten Klick auf einmal.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { if (!audio()) return; if (ctx.state === 'suspended') ctx.resume(); S[name](...args); } catch (e) {}
  }
  function setEnabled(on) { enabled = on; try { localStorage.setItem('sechzehn-ton', on ? 'an' : 'aus'); } catch (e) {} }
  return { play, setEnabled, isEnabled: () => enabled };
})();
