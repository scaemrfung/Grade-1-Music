/* Grade 1 Music · Studio tools
   Plain JavaScript + Web Audio. No libraries, no network requests, no tracking.
   Every sound is synthesized in the browser; audio starts only after a tap. */
(function () {
  "use strict";
  if (window.G1StudioTools) return;

  /* ---------- Audio engine ---------- */
  var AC = null, master = null, bus = null, noiseBuf = null;

  function audio() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      AC = new C();
      var comp = AC.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      master = AC.createGain();
      master.gain.value = 0.85;
      master.connect(comp);
      comp.connect(AC.destination);
      bus = AC.createGain();
      bus.connect(master);
    }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function now() { return audio().currentTime; }
  /* Fade out and drop everything the current tool scheduled. */
  function silence() {
    if (!AC) return;
    var old = bus, t = AC.currentTime;
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 0.06);
    setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 200);
    bus = AC.createGain();
    bus.connect(master);
  }
  function env(t, peak, attack, dur, dest) {
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest || bus);
    return g;
  }
  function osc(type, freq, t, dur, dest) {
    var o = AC.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  function noiseSrc() {
    if (!noiseBuf) {
      var n = AC.sampleRate * 2;
      noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = AC.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }
  function noiseHit(t, dur, peak, ftype, freq, q, attack) {
    var s = noiseSrc(), f = AC.createBiquadFilter();
    f.type = ftype; f.frequency.value = freq; if (q) f.Q.value = q;
    var g = env(t, peak, attack || 0.002, dur);
    s.connect(f); f.connect(g);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  var pluckCache = {};
  function pluckBuffer(freq, bright) {
    var key = freq + ":" + bright;
    if (pluckCache[key]) return pluckCache[key];
    var sr = AC.sampleRate, len = Math.floor(sr * 1.6), buf = AC.createBuffer(1, len, sr);
    var d = buf.getChannelData(0), p = Math.max(2, Math.round(sr / freq)), i;
    for (i = 0; i < p; i++) d[i] = Math.random() * 2 - 1;
    var damp = bright ? 0.998 : 0.994;
    for (i = p; i < len; i++) d[i] = damp * 0.5 * (d[i - p] + d[i - p + 1]);
    pluckCache[key] = buf;
    return buf;
  }

  var S = {
    mallet: function (f, t, v) {
      t = t || now(); v = v == null ? 1 : v;
      osc("sine", f, t, 1.3, env(t, 0.55 * v, 0.004, 1.3));
      osc("sine", f * 4, t, 0.3, env(t, 0.12 * v, 0.002, 0.3));
      osc("triangle", f * 2, t, 0.5, env(t, 0.08 * v, 0.002, 0.5));
    },
    chime: function (f, t, v) {
      t = t || now(); v = v == null ? 1 : v;
      osc("sine", f, t, 2.6, env(t, 0.45 * v, 0.003, 2.6));
      osc("sine", f * 2.76, t, 1.2, env(t, 0.12 * v, 0.002, 1.2));
      osc("sine", f * 5.4, t, 0.5, env(t, 0.05 * v, 0.001, 0.5));
    },
    tone: function (f, t, dur, v, type) {
      t = t || now(); v = v == null ? 1 : v;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.02);
      g.gain.setValueAtTime(0.35 * v, t + Math.max(0.03, dur - 0.06));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(bus);
      osc(type || "triangle", f, t, dur, g);
    },
    drum: function (t, v, low) {
      t = t || now(); v = v == null ? 1 : v;
      var g = env(t, 0.95 * v, 0.003, low ? 0.6 : 0.42), o = AC.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(low ? 120 : 180, t);
      o.frequency.exponentialRampToValueAtTime(low ? 48 : 70, t + 0.3);
      o.connect(g); o.start(t); o.stop(t + 0.65);
      noiseHit(t, 0.05, 0.25 * v, "lowpass", 1800);
    },
    shaker: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      noiseHit(t, 0.12, 0.35 * v, "bandpass", 6500, 1.1, 0.025);
      noiseHit(t + 0.08, 0.1, 0.2 * v, "bandpass", 6000, 1.1, 0.02);
    },
    triangle: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      osc("sine", 1250, t, 2.2, env(t, 0.22 * v, 0.001, 2.2));
      osc("sine", 3470, t, 1.4, env(t, 0.1 * v, 0.001, 1.4));
      osc("sine", 5320, t, 0.8, env(t, 0.06 * v, 0.001, 0.8));
    },
    woodblock: function (t, v, high) {
      t = t || now(); v = v == null ? 1 : v;
      var f = high ? 1250 : 850;
      osc("sine", f, t, 0.12, env(t, 0.8 * v, 0.001, 0.12));
      osc("triangle", f * 2.3, t, 0.05, env(t, 0.15 * v, 0.001, 0.05));
      noiseHit(t, 0.02, 0.2 * v, "bandpass", f * 1.5, 4);
    },
    tambourine: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      osc("sine", 220, t, 0.08, env(t, 0.3 * v, 0.002, 0.08));
      for (var i = 0; i < 4; i++) noiseHit(t + i * 0.012, 0.28 - i * 0.04, 0.22 * v, "highpass", 7000, 0.8, 0.001);
      noiseHit(t, 0.3, 0.12 * v, "bandpass", 9500, 6);
    },
    sticks: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      osc("sine", 2200, t, 0.05, env(t, 0.6 * v, 0.001, 0.05));
      noiseHit(t, 0.03, 0.25 * v, "bandpass", 3200, 3);
    },
    handbell: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      S.chime(1318.5, t, 0.8 * v);
    },
    clap: function (t, v) {
      t = t || now(); v = v == null ? 1 : v;
      for (var i = 0; i < 3; i++) noiseHit(t + i * 0.011, 0.03, 0.45 * v, "bandpass", 1300, 1.5);
      noiseHit(t + 0.033, 0.16, 0.35 * v, "bandpass", 1200, 1.2);
    },
    pluck: function (f, t, v, bright) {
      t = t || now(); v = v == null ? 1 : v;
      var s = AC.createBufferSource(), g = env(t, 0.7 * v, 0.002, 1.5);
      s.buffer = pluckBuffer(f, bright);
      s.connect(g); s.start(t);
    },
    brass: function (f, t, dur, v) {
      t = t || now(); v = v == null ? 1 : v; dur = dur || 0.7;
      var fl = AC.createBiquadFilter(), g = AC.createGain();
      fl.type = "lowpass"; fl.Q.value = 2;
      fl.frequency.setValueAtTime(400, t);
      fl.frequency.linearRampToValueAtTime(2600, t + 0.08);
      fl.frequency.linearRampToValueAtTime(1600, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.06);
      g.gain.setValueAtTime(0.22 * v, t + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      fl.connect(g); g.connect(bus);
      osc("sawtooth", f, t, dur, fl);
    },
    reed: function (f, t, dur, v) {
      t = t || now(); v = v == null ? 1 : v; dur = dur || 0.7;
      var fl = AC.createBiquadFilter(), g = AC.createGain();
      fl.type = "lowpass"; fl.frequency.value = 1800; fl.Q.value = 1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.05);
      g.gain.setValueAtTime(0.18 * v, t + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      fl.connect(g); g.connect(bus);
      osc("square", f, t, dur, fl);
      osc("sawtooth", f * 1.003, t, dur, fl);
    },
    bowed: function (f, t, dur, v) {
      t = t || now(); v = v == null ? 1 : v; dur = dur || 0.9;
      var fl = AC.createBiquadFilter(), g = AC.createGain(), o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain();
      fl.type = "lowpass"; fl.frequency.value = 3000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.18);
      g.gain.setValueAtTime(0.2 * v, t + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.type = "sawtooth"; o.frequency.value = f;
      lfo.frequency.value = 5.5; lg.gain.value = f * 0.008;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(fl); fl.connect(g); g.connect(bus);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
  };

  var NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C3: 130.81, F3: 174.61, G3: 196.0, A3: 220.0, E3: 164.81, D3: 146.83 };
  var SOLFA = { mi: NOTE.E4, so: NOTE.G4, la: NOTE.A4 };

  /* ---------- Small helpers ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function btn(label, cls, onclick, extra) {
    var a = { type: "button", class: "btn " + (cls || "btn-ghost") + " g1t-btn" };
    if (extra) for (var k in extra) a[k] = extra[k];
    var b = h("button", a, label);
    if (onclick) b.addEventListener("click", onclick);
    return b;
  }
  /* Instant response for instruments: fire on pointerdown, keep keyboard (click) working. */
  function onTap(el, fn) {
    el.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      el._tapAt = Date.now();
      fn(e);
    });
    el.addEventListener("click", function (e) {
      if (Date.now() - (el._tapAt || 0) < 700) return;
      fn(e);
    });
  }
  function flash(el, cls, ms) {
    cls = cls || "is-on";
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    later(function () { el.classList.remove(cls); }, ms || 220);
  }
  function seg(options, value, onchange, label) {
    var wrap = h("div", { class: "g1t-seg", role: "group", "aria-label": label || "" });
    var buttons = options.map(function (o) {
      var b = h("button", { type: "button", "aria-pressed": o.value === value ? "true" : "false" }, o.label);
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        onchange(o.value);
      });
      wrap.appendChild(b);
      return b;
    });
    if (label) wrap.insertBefore(h("span", { class: "g1t-seg-label" }, label), wrap.firstChild);
    return wrap;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* Timers owned by the open tool (cleared when it closes). */
  var timers = [], intervals = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function every(fn, ms) { var id = setInterval(fn, ms); intervals.push(id); return id; }
  function at(t, fn) { return later(fn, Math.max(0, (t - AC.currentTime) * 1000)); }
  function clearOwned() {
    timers.forEach(clearTimeout); intervals.forEach(clearInterval);
    timers = []; intervals = [];
  }
  /* Look-ahead scheduler: step(time) plays at `time` and returns seconds to the next step. */
  function Loop(step) {
    var next = 0, id = null, on = false;
    function tick() { while (on && next < AC.currentTime + 0.12) next += step(next); }
    return {
      start: function () { audio(); on = true; next = AC.currentTime + 0.08; tick(); id = every(tick, 25); },
      stop: function () { on = false; if (id) clearInterval(id); id = null; },
      isOn: function () { return on; }
    };
  }
  function success() { var t = now(); [NOTE.C5, NOTE.E5, NOTE.G5].forEach(function (f, i) { S.chime(f, t + i * 0.09, 0.5); }); }
  function oops() { var t = now(); S.tone(NOTE.E4, t, 0.18, 0.6, "triangle"); S.tone(NOTE.C4 * 0.94, t + 0.2, 0.3, 0.6, "triangle"); }

  var HAND = {
    do: { e: "✊", w: "fist", r: 0 }, re: { e: "🫳", w: "slants up", r: -30 }, mi: { e: "🫳", w: "flat hand", r: 0 },
    fa: { e: "👎", w: "thumb down", r: 0 }, so: { e: "🤚", w: "palm faces you", r: 0 }, la: { e: "🫳", w: "hand droops", r: 40 },
    ti: { e: "☝️", w: "points up", r: 0 }
  };
  function handSign(name, big) {
    var s = HAND[name];
    return h("span", { class: "g1t-hand" + (big ? " big" : ""), title: name + " hand sign: " + s.w }, [
      h("span", { class: "g1t-hand-e", "aria-hidden": "true", style: s.r ? "transform:rotate(" + s.r + "deg)" : null }, s.e),
      h("span", { class: "g1t-hand-w" }, s.w)
    ]);
  }
  var BW = { C: "#e53935", D: "#fb8c00", E: "#fdd835", F: "#8bc34a", G: "#00897b", A: "#5e35b1", B: "#d81b60" };
  var DARK_TEXT = { E: true, F: true };

  /* ---------- Generic listening game ---------- */
  function listeningGame(cfg) {
    var mode = cfg.modes[0].value, round = null, stars = 0, tries = 0;
    var root = h("div", { class: "g1t-game" });
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, cfg.intro);
    var score = h("p", { class: "g1t-score" }, "");
    var answersBox = h("div", { class: "g1t-answers" });
    var playBtn = btn("▶ Play the sound", "btn-primary g1t-xl", function () { play(false); });
    var againBtn = btn("🔁 Hear again", "btn-ghost g1t-xl", function () { play(true); });
    function renderScore() { score.textContent = tries ? "⭐ " + stars + " of " + tries : ""; }
    function renderAnswers() {
      answersBox.innerHTML = "";
      cfg.answers(mode).forEach(function (a) {
        var b = h("button", { type: "button", class: "g1t-answer", "data-answer": a.id }, [
          h("span", { class: "g1t-answer-e", "aria-hidden": "true" }, a.emoji), h("span", null, a.label)
        ]);
        b.addEventListener("click", function () { answer(a, b); });
        answersBox.appendChild(b);
      });
    }
    function play(again) {
      audio();
      if (!round || (!again && round.done)) round = cfg.makeRound(mode);
      silence();
      round.play(now() + 0.08);
      status.textContent = cfg.ask(mode);
      playBtn.textContent = "▶ Play the sound";
    }
    function answer(a, b) {
      if (!round || round.done) { status.textContent = "Tap ▶ Play the sound first."; return; }
      tries++;
      if (a.id === round.answer) {
        stars++; round.done = true;
        status.textContent = "Yes! " + a.label + " " + a.emoji + "  Tap ▶ for the next one.";
        flash(b, "is-right", 900); success();
        playBtn.textContent = "▶ Next sound";
      } else {
        status.textContent = "Not quite. Listen again 🔁 and try once more.";
        flash(b, "is-wrong", 600);
      }
      renderScore();
    }
    var modeCtl = seg(cfg.modes, mode, function (v) { mode = v; round = null; renderAnswers(); status.textContent = cfg.intro; playBtn.textContent = "▶ Play the sound"; }, "Game");
    renderAnswers();
    var row = h("div", { class: "g1t-row" }, [playBtn, againBtn]);
    if (cfg.demo) row.appendChild(btn(cfg.demo.label, "btn-ghost g1t-xl", function () { audio(); silence(); cfg.demo.play(now() + 0.08, mode); status.textContent = cfg.demo.say(mode); }));
    root.appendChild(h("div", { class: "g1t-controls" }, [modeCtl]));
    root.appendChild(row);
    root.appendChild(status);
    root.appendChild(answersBox);
    root.appendChild(score);
    return { el: root, stop: function () { silence(); } };
  }

  function animalFor(bpm) {
    if (bpm < 60) return { e: "🐌", w: "Snail slow" };
    if (bpm < 80) return { e: "🐢", w: "Turtle slow" };
    if (bpm < 104) return { e: "🚶", w: "Walking" };
    if (bpm < 132) return { e: "🐇", w: "Rabbit hop" };
    return { e: "🐆", w: "Cheetah fast" };
  }

  /* ---------- Tool: steady beat ---------- */
  function toolBeat() {
    var bpm = 90, group = 4, sound = "wood", beat = 0, taps = [];
    var circle = h("div", { class: "g1t-pulse", "aria-hidden": "true" });
    var circleE = h("span", { class: "g1t-pulse-e" }, "🚶");
    var circleN = h("span", { class: "g1t-pulse-n" }, "");
    circle.appendChild(circleE); circle.appendChild(circleN);
    var dots = h("div", { class: "g1t-dots", "aria-hidden": "true" });
    var readout = h("p", { class: "g1t-readout", "aria-live": "polite" });
    var slider = h("input", { type: "range", min: 40, max: 180, step: 1, value: bpm, "aria-label": "Tempo in beats per minute", class: "g1t-range" });
    var start = btn("▶ Start the beat", "btn-primary g1t-xl", toggle);
    var loop = Loop(function (t) {
      var n = group > 1 ? beat % group : 0, accent = group > 1 && n === 0, v = accent ? 1 : 0.7;
      if (sound === "wood") S.woodblock(t, v, accent);
      else if (sound === "drum") S.drum(t, v);
      else if (sound === "clap") S.clap(t, v);
      else if (sound === "sticks") S.sticks(t, v);
      at(t, function () {
        circleN.textContent = group > 1 ? String(n + 1) : "";
        circle.classList.toggle("accent", accent);
        flash(circle, "is-on", Math.min(260, 30000 / bpm));
        Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle("is-on", i === n); });
      });
      beat++;
      return 60 / bpm;
    });
    function renderDots() {
      dots.innerHTML = "";
      for (var i = 0; i < Math.max(group, 1); i++) dots.appendChild(h("span", { class: "g1t-dot" }));
      dots.style.display = group > 1 ? "" : "none";
    }
    function setBpm(v) {
      bpm = Math.max(40, Math.min(180, Math.round(v)));
      slider.value = bpm;
      var a = animalFor(bpm);
      circleE.textContent = a.e;
      readout.textContent = bpm + " beats a minute · " + a.e + " " + a.w;
    }
    function toggle() {
      audio();
      if (loop.isOn()) { loop.stop(); start.textContent = "▶ Start the beat"; circleN.textContent = ""; }
      else { beat = 0; loop.start(); start.textContent = "⏹ Stop"; }
    }
    slider.addEventListener("input", function () { setBpm(Number(slider.value)); });
    function tapTempo() {
      audio(); S.woodblock(now(), 0.6);
      var t = performance.now();
      taps = taps.filter(function (x) { return t - x < 2500; });
      taps.push(t);
      if (taps.length >= 3) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
      else readout.textContent = "Keep tapping the beat…";
    }
    var presets = h("div", { class: "g1t-row" }, [
      [50, "🐌", "Snail"], [66, "🐢", "Turtle"], [90, "🚶", "Walk"], [120, "🐇", "Rabbit"], [150, "🐆", "Cheetah"]
    ].map(function (p) { return btn([h("span", { class: "g1t-emo", "aria-hidden": "true" }, p[1]), " " + p[2]], "btn-ghost g1t-lg", function () { setBpm(p[0]); }); }));
    var el = h("div", { class: "g1t-beat" }, [
      h("div", { class: "g1t-beat-top" }, [circle, dots]),
      readout,
      h("div", { class: "g1t-tempo" }, [
        btn("🐢 Slower", "btn-ghost g1t-lg", function () { setBpm(bpm - 5); }),
        slider,
        btn("Faster 🐇", "btn-ghost g1t-lg", function () { setBpm(bpm + 5); })
      ]),
      presets,
      h("div", { class: "g1t-row" }, [start, btn("👆 Tap the beat", "btn-ghost g1t-xl", tapTempo)]),
      h("div", { class: "g1t-controls" }, [
        seg([{ value: 1, label: "No groups" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }], group, function (v) { group = v; beat = 0; renderDots(); }, "Beats in a group"),
        seg([{ value: "wood", label: "Woodblock" }, { value: "drum", label: "Drum" }, { value: "clap", label: "Clap" }, { value: "sticks", label: "Sticks" }, { value: "none", label: "Silent" }], sound, function (v) { sound = v; }, "Sound")
      ]),
      h("p", { class: "hint" }, "Pat, march or tap along with the circle. Tap “Tap the beat” in time with a song to match its speed.")
    ]);
    renderDots(); setBpm(bpm);
    return { el: el, stop: function () { loop.stop(); silence(); } };
  }

  /* ---------- Tool: xylophone and chime bells ---------- */
  function toolXylo() {
    var notes = [
      { s: "do", l: "C", f: NOTE.C4 }, { s: "re", l: "D", f: NOTE.D4 }, { s: "mi", l: "E", f: NOTE.E4 }, { s: "fa", l: "F", f: NOTE.F4 },
      { s: "so", l: "G", f: NOTE.G4 }, { s: "la", l: "A", f: NOTE.A4 }, { s: "ti", l: "B", f: NOTE.B4 }, { s: "do", l: "C", f: NOTE.C5 }
    ];
    var labels = "solfa", voice = "mallet", focus = false, keys = "asdfghjk", bars = [];
    var wrap = h("div", { class: "g1t-xylo", role: "group", "aria-label": "Xylophone, C major" });
    function hit(i) {
      var b = bars[i];
      if (b.disabled) return;
      audio();
      (voice === "mallet" ? S.mallet : S.chime)(notes[i].f, now(), 1);
      flash(b, "is-on", 260);
    }
    notes.forEach(function (n, i) {
      var b = h("button", { type: "button", class: "g1t-bar", style: "--bar:" + BW[n.l] + ";--h:" + (100 - i * 5) + "%;color:" + (DARK_TEXT[n.l] ? "#2a1f3d" : "#fff"), "aria-label": n.s + " (" + n.l + ")" });
      onTap(b, function () { hit(i); });
      bars.push(b); wrap.appendChild(b);
    });
    function render() {
      notes.forEach(function (n, i) {
        var b = bars[i];
        b.innerHTML = "";
        var main = labels === "letters" ? n.l : n.s, sub = labels === "letters" ? n.s : n.l;
        b.appendChild(h("span", { class: "g1t-bar-peg", "aria-hidden": "true" }));
        if (labels === "hands") b.appendChild(handSign(n.s));
        b.appendChild(h("span", { class: "g1t-bar-main" }, main));
        b.appendChild(h("span", { class: "g1t-bar-sub" }, sub));
        b.appendChild(h("span", { class: "g1t-bar-key", "aria-hidden": "true" }, keys[i].toUpperCase()));
        b.appendChild(h("span", { class: "g1t-bar-peg", "aria-hidden": "true" }));
        var off = focus && !(n.s === "so" || n.s === "mi" || n.s === "la");
        b.disabled = off; b.classList.toggle("is-off", off);
      });
    }
    function demo() {
      audio(); silence(); clearOwned();
      var t = now() + 0.08, order = focus ? [4, 2, 4, 2, 5, 4, 2] : [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0];
      order.forEach(function (i, k) {
        var tt = t + k * 0.32;
        (voice === "mallet" ? S.mallet : S.chime)(notes[i].f, tt, 0.9);
        at(tt, function () { flash(bars[i], "is-on", 260); });
      });
    }
    render();
    var el = h("div", null, [
      h("div", { class: "g1t-controls" }, [
        seg([{ value: "solfa", label: "do re mi" }, { value: "letters", label: "C D E" }, { value: "hands", label: "Hand signs" }], labels, function (v) { labels = v; render(); }, "Labels"),
        seg([{ value: "mallet", label: "Xylophone" }, { value: "chime", label: "Chime bells" }], voice, function (v) { voice = v; }, "Sound"),
        seg([{ value: false, label: "All 8 notes" }, { value: true, label: "so · mi · la only" }], focus, function (v) { focus = v; render(); }, "Notes")
      ]),
      wrap,
      h("div", { class: "g1t-row" }, [btn("🎶 Play it for me", "btn-ghost g1t-lg", demo)]),
      h("p", { class: "hint" }, "Bar colours match classroom boomwhackers. On a keyboard, press A S D F G H J K. Hand signs are the Curwen/Kodály signs.")
    ]);
    return { el: el, stop: silence, key: function (k) { var i = keys.indexOf(k); if (i >= 0) { hit(i); return true; } } };
  }

  /* ---------- Tool: percussion pad ---------- */
  function tambourineSvg() {
    var s = '<svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#f6e2b3" stroke="#a06a2c" stroke-width="6"/>';
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3, x = 32 + 24 * Math.cos(a), y = 32 + 24 * Math.sin(a); s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="#d9d9d9" stroke="#8a8a8a" stroke-width="1.5"/>'; }
    return s + "</svg>";
  }
  function toolDrums() {
    var pads = [
      { name: "Drum", e: "🥁", c: "#e53935", play: function (t) { S.drum(t); } },
      { name: "Big drum", e: "🪘", c: "#8d5524", play: function (t) { S.drum(t, 1, true); } },
      { name: "Egg shaker", e: "🥚", c: "#fb8c00", play: function (t) { S.shaker(t); } },
      { name: "Triangle", e: "🔺", c: "#00897b", play: function (t) { S.triangle(t); } },
      { name: "Woodblock", e: "🪵", c: "#a1662f", play: function (t) { S.woodblock(t); } },
      { name: "Tambourine", svg: true, c: "#5e35b1", play: function (t) { S.tambourine(t); } },
      { name: "Rhythm sticks", e: "🥢", c: "#d81b60", play: function (t) { S.sticks(t); } },
      { name: "Hand bell", e: "🔔", c: "#b08a1e", play: function (t) { S.handbell(t); } }
    ];
    var rec = null, recording = false, els = [];
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, "Tap a pad. Press ⏺ Record to save a pattern, then ▶ Play it back.");
    function hit(i) {
      audio();
      pads[i].play(now());
      flash(els[i], "is-on", 180);
      if (recording) {
        var t = performance.now();
        if (!rec.length) rec.t0 = t;
        rec.push({ i: i, dt: (t - rec.t0) / 1000 });
      }
    }
    var grid = h("div", { class: "g1t-pads" });
    pads.forEach(function (p, i) {
      var b = h("button", { type: "button", class: "g1t-pad", style: "--pad:" + p.c, "aria-label": p.name }, [
        h("span", { class: "g1t-pad-e", "aria-hidden": "true", html: p.svg ? tambourineSvg() : null }, p.svg ? null : p.e),
        h("span", { class: "g1t-pad-n" }, p.name),
        h("span", { class: "g1t-pad-k", "aria-hidden": "true" }, String(i + 1))
      ]);
      onTap(b, function () { hit(i); });
      els.push(b); grid.appendChild(b);
    });
    var recBtn = btn("⏺ Record", "btn-ghost g1t-lg", function () {
      if (recording) { recording = false; recBtn.textContent = "⏺ Record"; status.textContent = rec.length ? "Saved " + rec.length + " taps. Press ▶ Play back." : "Nothing recorded yet."; return; }
      rec = []; recording = true; recBtn.textContent = "⏹ Stop recording"; status.textContent = "Recording… play your pattern.";
    });
    var playBtn = btn("▶ Play back", "btn-primary g1t-lg", function () {
      if (recording) recBtn.click();
      if (!rec || !rec.length) { status.textContent = "Record a pattern first."; return; }
      audio(); silence();
      var t0 = now() + 0.1;
      rec.forEach(function (r) { var t = t0 + r.dt; pads[r.i].play(t); at(t, function () { flash(els[r.i], "is-on", 180); }); });
      status.textContent = "Listen… now echo it back!";
    });
    var el = h("div", null, [grid, h("div", { class: "g1t-row" }, [recBtn, playBtn]), status,
      h("p", { class: "hint" }, "Keys 1–8 play the pads. Great for echo rhythms: you play, the class echoes. Or record a student and play it back.")]);
    return { el: el, stop: function () { recording = false; silence(); }, key: function (k) { var i = "12345678".indexOf(k); if (i >= 0) { hit(i); return true; } } };
  }

  /* ---------- Tool: so-mi-la echo game ---------- */
  function toolEcho() {
    var level = "sm", len = 3, showMe = true, pattern = null, input = [], busy = false, stars = 0, tries = 0;
    var names = ["la", "so", "mi"], colors = { la: BW.A, so: BW.G, mi: BW.E };
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, "Press ▶ Listen. Then tap the bars to play it back.");
    var progress = h("div", { class: "g1t-progress", "aria-hidden": "true" });
    var score = h("p", { class: "g1t-score" });
    var barsEl = h("div", { class: "g1t-echo" }), bars = {};
    names.forEach(function (n) {
      var b = h("button", { type: "button", class: "g1t-echo-bar g1t-echo-" + n, style: "--bar:" + colors[n] + ";color:" + (n === "mi" ? "#2a1f3d" : "#fff"), "aria-label": n }, [
        handSign(n, true), h("span", { class: "g1t-echo-name" }, n), h("span", { class: "g1t-echo-hl" }, n === "la" ? "highest" : n === "mi" ? "lowest" : "middle")
      ]);
      onTap(b, function () { tap(n); });
      bars[n] = b; barsEl.appendChild(b);
    });
    function renderProgress() {
      progress.innerHTML = "";
      if (!pattern) return;
      for (var i = 0; i < pattern.length; i++) progress.appendChild(h("span", { class: "g1t-pdot" + (i < input.length ? " is-on" : "") }, i < input.length ? input[i] : "?"));
    }
    function renderLevel() { bars.la.style.display = level === "sm" ? "none" : ""; }
    function makePattern() {
      var pool = level === "sm" ? ["so", "mi"] : ["so", "mi", "la"], p;
      do {
        p = [Math.random() < 0.7 ? "so" : pick(pool)];
        while (p.length < len) p.push(pick(pool));
      } while (p.every(function (x) { return x === p[0]; }) || (level === "sml" && p.indexOf("la") < 0));
      return p;
    }
    function playPattern(p, light, then) {
      audio(); silence(); busy = true;
      var t = now() + 0.1, gap = 0.55;
      p.forEach(function (n, i) {
        var tt = t + i * gap;
        S.mallet(SOLFA[n], tt, 1);
        if (light) at(tt, function () { flash(bars[n], "is-on", 380); });
      });
      later(function () { busy = false; if (then) then(); }, (p.length * gap + 0.2) * 1000);
    }
    function listen(again) {
      if (!pattern || (!again && pattern.done)) pattern = makePattern();
      if (again) pattern.done = false;
      input = []; renderProgress();
      status.textContent = "👂 Listen…";
      playPattern(pattern, showMe, function () { status.textContent = "Your turn! Tap " + pattern.length + " notes."; });
    }
    function tap(n) {
      audio();
      S.mallet(SOLFA[n], now(), 1);
      flash(bars[n], "is-on", 260);
      if (!pattern || pattern.done || busy) return;
      input.push(n); renderProgress();
      if (input.length < pattern.length) return;
      tries++;
      var ok = input.every(function (x, i) { return x === pattern[i]; });
      if (ok) {
        stars++; pattern.done = true;
        status.textContent = "Great echo! ⭐ Press ▶ Listen for a new one.";
        later(success, 350);
      } else {
        busy = true;
        status.textContent = "Almost! It was " + pattern.join(" – ") + ". Watch and try again.";
        later(oops, 300);
        later(function () { playPattern(pattern, true, function () { input = []; renderProgress(); status.textContent = "Your turn again! Tap " + pattern.length + " notes."; }); }, 1100);
      }
      score.textContent = "⭐ " + stars + " of " + tries;
    }
    renderLevel();
    var el = h("div", null, [
      h("div", { class: "g1t-controls" }, [
        seg([{ value: "sm", label: "so · mi" }, { value: "sml", label: "so · mi · la" }], level, function (v) { level = v; pattern = null; input = []; renderLevel(); renderProgress(); }, "Notes"),
        seg([{ value: 3, label: "3 notes" }, { value: 4, label: "4 notes" }], len, function (v) { len = v; pattern = null; input = []; renderProgress(); }, "Length"),
        seg([{ value: true, label: "Light up" }, { value: false, label: "Ears only" }], showMe, function (v) { showMe = v; }, "Help")
      ]),
      h("div", { class: "g1t-row" }, [btn("▶ Listen", "btn-primary g1t-xl", function () { listen(false); }), btn("🔁 Hear again", "btn-ghost g1t-xl", function () { listen(!!pattern); })]),
      status, progress, barsEl, score,
      h("p", { class: "hint" }, "Sing it back with hand signs first, then let a student tap it. High sounds are at the top, low sounds at the bottom.")
    ]);
    return { el: el, stop: silence };
  }

  /* ---------- Tools: listening games ---------- */
  function toolHighLow() {
    return listeningGame({
      intro: "Press ▶ and listen. Is it high like a bird or low like a bear?",
      modes: [{ value: "one", label: "High or low?" }, { value: "updown", label: "Going up or down?" }],
      ask: function (m) { return m === "one" ? "High or low?" : "Did the notes go up or down?"; },
      answers: function (m) {
        return m === "one" ? [{ id: "high", emoji: "🐦", label: "High" }, { id: "low", emoji: "🐻", label: "Low" }]
          : [{ id: "up", emoji: "🚀", label: "Up" }, { id: "down", emoji: "🍂", label: "Down" }];
      },
      makeRound: function (m) {
        if (m === "one") {
          var high = Math.random() < 0.5, f = high ? pick([880, 987.77, 1046.5, 1174.66]) : pick([164.81, 174.61, 196, 220]);
          return { answer: high ? "high" : "low", play: function (t) { for (var i = 0; i < 3; i++) S.mallet(f, t + i * 0.45, high ? 0.8 : 1.2); } };
        }
        var sc = [NOTE.C4, NOTE.D4, NOTE.E4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.B4, NOTE.C5], up = Math.random() < 0.5, s = Math.floor(Math.random() * 5), seq = sc.slice(s, s + 4);
        if (!up) seq.reverse();
        return { answer: up ? "up" : "down", play: function (t) { seq.forEach(function (f, i) { S.mallet(f, t + i * 0.4, 1); }); } };
      },
      demo: { label: "🐦🐻 Hear high, then low", say: function () { return "That was high 🐦 … then low 🐻."; }, play: function (t) { S.mallet(1046.5, t, 0.8); S.mallet(1046.5, t + 0.45, 0.8); S.mallet(174.61, t + 1.3, 1.2); S.mallet(174.61, t + 1.75, 1.2); } }
    });
  }
  var TUNE = ["so", "mi", "so", "so", "mi", "la", "so", "mi"];
  function playTune(t, gap, vols) {
    TUNE.forEach(function (n, i) { S.mallet(SOLFA[n], t + i * gap, typeof vols === "function" ? vols(i) : vols); });
  }
  function toolLoudSoft() {
    return listeningGame({
      intro: "Press ▶ and listen. Is the music loud like a lion or soft like a mouse?",
      modes: [{ value: "one", label: "Loud or soft?" }, { value: "change", label: "Getting louder or softer?" }],
      ask: function (m) { return m === "one" ? "Loud or soft?" : "Did it get louder or softer?"; },
      answers: function (m) {
        return m === "one" ? [{ id: "loud", emoji: "🦁", label: "Loud" }, { id: "soft", emoji: "🐭", label: "Soft" }]
          : [{ id: "cresc", emoji: "📢", label: "Getting louder" }, { id: "dim", emoji: "🤫", label: "Getting softer" }];
      },
      makeRound: function (m) {
        if (m === "one") { var loud = Math.random() < 0.5; return { answer: loud ? "loud" : "soft", play: function (t) { playTune(t, 0.36, loud ? 1.5 : 0.1); } }; }
        var up = Math.random() < 0.5;
        return { answer: up ? "cresc" : "dim", play: function (t) { playTune(t, 0.4, function (i) { var x = i / 7; return up ? 0.05 + x * 1.5 : 1.55 - x * 1.5; }); } };
      },
      demo: { label: "🦁🐭 Hear loud, then soft", say: function () { return "That was loud 🦁 … then soft 🐭."; }, play: function (t) { playTune(t, 0.3, 1.5); playTune(t + 2.8, 0.3, 0.1); } }
    });
  }
  function toolFastSlow() {
    function tune(t, gaps) {
      var tt = t;
      TUNE.forEach(function (n, i) { S.mallet(SOLFA[n], tt, 1); S.drum(tt, 0.5); tt += gaps(i); });
    }
    return listeningGame({
      intro: "Press ▶ and listen. Is the music fast like a rabbit or slow like a turtle?",
      modes: [{ value: "one", label: "Fast or slow?" }, { value: "change", label: "Speeding up or slowing down?" }],
      ask: function (m) { return m === "one" ? "Fast or slow?" : "Did it speed up or slow down?"; },
      answers: function (m) {
        return m === "one" ? [{ id: "fast", emoji: "🐇", label: "Fast" }, { id: "slow", emoji: "🐢", label: "Slow" }]
          : [{ id: "acc", emoji: "🏃", label: "Speeding up" }, { id: "rit", emoji: "🐌", label: "Slowing down" }];
      },
      makeRound: function (m) {
        if (m === "one") { var fast = Math.random() < 0.5; return { answer: fast ? "fast" : "slow", play: function (t) { tune(t, function () { return fast ? 0.2 : 0.75; }); } }; }
        var acc = Math.random() < 0.5;
        return { answer: acc ? "acc" : "rit", play: function (t) { tune(t, function (i) { var x = i / 7; return acc ? 0.85 - x * 0.7 : 0.15 + x * 0.7; }); } };
      },
      demo: { label: "🐇🐢 Hear fast, then slow", say: function () { return "That was fast 🐇 … then slow 🐢."; }, play: function (t) { tune(t, function () { return 0.2; }); tune(t + 2.2, function () { return 0.75; }); } }
    });
  }

  /* ---------- Tool: melody maker on a 3-line staff ---------- */
  function toolCompose() {
    var notes = ["so", "mi", "so", "mi", "so", "so", "mi", null], bpm = 100, playing = -1;
    var W = 70 + 8 * 60 + 10, Y = { la: 70, so: 90, mi: 130 }, NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " 200");
    svg.setAttribute("class", "g1t-staff");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Three-line staff with la in the space, so on the middle line and mi on the bottom line");
    var cells = h("div", { class: "g1t-cells" });
    function sv(tag, a, text) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (text != null) e.textContent = text; return e; }
    function sound(n) { if (n) { audio(); S.mallet(SOLFA[n], now(), 1); } }
    function setNote(i, n) { notes[i] = notes[i] === n ? null : n; sound(notes[i]); render(); }
    function cycle(i) { var order = [null, "so", "mi", "la"]; notes[i] = order[(order.indexOf(notes[i]) + 1) % order.length]; sound(notes[i]); render(); }
    function render() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      for (var i = 0; i < 8; i++) svg.appendChild(sv("rect", { x: 70 + i * 60, y: 30, width: 56, height: 125, rx: 8, fill: playing === i ? "#e8dff5" : "transparent" }));
      [50, 90, 130].forEach(function (y) { svg.appendChild(sv("line", { x1: 60, x2: W - 10, y1: y, y2: y, stroke: "#2a1f3d", "stroke-width": 2 })); });
      [["la", 70], ["so", 90], ["mi", 130]].forEach(function (p) { svg.appendChild(sv("text", { x: 50, y: p[1] + 6, "text-anchor": "end", "font-size": 17, fill: "#6b5f7a", "font-family": "Figtree, sans-serif", "font-weight": 600 }, p[0])); });
      svg.appendChild(sv("line", { x1: W - 10, x2: W - 10, y1: 50, y2: 130, stroke: "#2a1f3d", "stroke-width": 4 }));
      notes.forEach(function (n, i) {
        var cx = 70 + i * 60 + 26, fill = playing === i ? "#5c3d8a" : "#2a1f3d";
        if (n) {
          svg.appendChild(sv("ellipse", { cx: cx, cy: Y[n], rx: 13, ry: 10, fill: fill, transform: "rotate(-18 " + cx + " " + Y[n] + ")" }));
          svg.appendChild(sv("line", { x1: cx + 12, x2: cx + 12, y1: Y[n] - 3, y2: Y[n] - 50, stroke: fill, "stroke-width": 2.5 }));
        } else {
          svg.appendChild(sv("text", { x: cx, y: 104, "text-anchor": "middle", "font-size": 34, "font-weight": 700, fill: fill, "font-family": "Newsreader, Georgia, serif" }, "Z"));
        }
        svg.appendChild(sv("text", { x: cx, y: 185, "text-anchor": "middle", "font-size": 16, fill: "#6b5f7a", "font-family": "Figtree, sans-serif" }, n || "rest"));
        [["la", 30, 50], ["so", 80, 30], ["mi", 110, 45]].forEach(function (z) {
          var r = sv("rect", { x: 70 + i * 60, y: z[1], width: 56, height: z[2], fill: "transparent", class: "g1t-zone" });
          r.addEventListener("click", function () { setNote(i, z[0]); });
          svg.appendChild(r);
        });
      });
      cells.innerHTML = "";
      notes.forEach(function (n, i) {
        var b = h("button", { type: "button", class: "g1t-cell" + (n ? " filled" : "") + (playing === i ? " now" : ""), "aria-label": "Beat " + (i + 1) + ": " + (n || "rest") + ". Tap to change." }, [h("small", null, String(i + 1)), n || "rest"]);
        b.addEventListener("click", function () { cycle(i); });
        cells.appendChild(b);
      });
    }
    function play() {
      audio(); silence(); clearOwned();
      var t = now() + 0.1, gap = 60 / bpm;
      notes.forEach(function (n, i) {
        var tt = t + i * gap;
        if (n) S.mallet(SOLFA[n], tt, 1);
        at(tt, function () { playing = i; render(); });
      });
      at(t + notes.length * gap, function () { playing = -1; render(); });
    }
    function surprise() {
      var pool = ["so", "mi", "la", "so", "mi", "so"];
      notes = notes.map(function (_, i) { return i === 7 ? null : i === 0 ? "so" : pick(pool); });
      if (Math.random() < 0.5) notes[3] = null;
      render(); play();
    }
    render();
    var el = h("div", null, [
      h("div", { class: "g1t-staff-wrap" }, svg),
      cells,
      h("div", { class: "g1t-row" }, [
        btn("▶ Play my tune", "btn-primary g1t-xl", play),
        btn("🎲 Surprise tune", "btn-ghost g1t-lg", surprise),
        btn("🧹 Clear", "btn-ghost g1t-lg", function () { clearOwned(); notes = [null, null, null, null, null, null, null, null]; playing = -1; render(); })
      ]),
      h("div", { class: "g1t-controls" }, [seg([{ value: 70, label: "🐢 Slow" }, { value: 100, label: "🚶 Walking" }, { value: 130, label: "🐇 Fast" }], bpm, function (v) { bpm = v; }, "Speed")]),
      h("p", { class: "hint" }, "Tap the staff to put a note on la (the space), so (middle line) or mi (bottom line). Tap it again for a rest (Z). Or tap the boxes to change each beat. Each note is one beat (ta).")
    ]);
    return { el: el, stop: function () { silence(); playing = -1; } };
  }

  /* ---------- Tool: pitch pipe ---------- */
  function toolPitch() {
    var list = [["C", NOTE.C4], ["D", NOTE.D4], ["E", NOTE.E4], ["F", NOTE.F4], ["G", NOTE.G4], ["A", NOTE.A4], ["B", NOTE.B4], ["C'", NOTE.C5]];
    var cur = null, sel = 4, node = null, stopId = null, btns = [];
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, "Tap a note to hear a long starting pitch. Tap again to stop.");
    var soLabel = h("span", { class: "badge g1t-badge" }, "so = G");
    function stopTone() {
      if (node && AC) {
        var t = AC.currentTime, n = node;
        n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0, t + 0.15);
        setTimeout(function () { n.o.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 250);
      }
      node = null;
      if (stopId) clearTimeout(stopId);
      cur = null; btns.forEach(function (b) { b.classList.remove("is-on"); });
    }
    function startTone(i) {
      audio(); stopTone();
      var f = list[i][1], t = AC.currentTime, g = AC.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.08);
      g.gain.setValueAtTime(0.28, t + 5.5); g.gain.linearRampToValueAtTime(0, t + 6);
      g.connect(bus);
      var o1 = osc("sine", f, t, 6.1, g), o2 = AC.createOscillator(), g2 = AC.createGain();
      o2.type = "triangle"; o2.frequency.value = f; g2.gain.value = 0.35; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + 6.1);
      node = { g: g, o: [o1, o2] }; cur = i; btns[i].classList.add("is-on");
      stopId = later(stopTone, 6000);
      status.textContent = list[i][0] + (list[i][0] === "A" ? " (A 440, the tuning note)" : "") + " · sounding for 6 seconds.";
    }
    var grid = h("div", { class: "g1t-pipe" });
    list.forEach(function (n, i) {
      var letter = n[0].replace("'", "");
      var b = h("button", { type: "button", class: "g1t-pipe-note", style: "--bar:" + BW[letter] + ";color:" + (DARK_TEXT[letter] ? "#2a1f3d" : "#fff"), "aria-label": n[0] === "C'" ? "high C" : n[0] }, [h("span", null, n[0]), n[0] === "A" ? h("small", null, "440") : null]);
      b.addEventListener("click", function () { if (cur === i) stopTone(); else startTone(i); sel = i; soLabel.textContent = "so = " + list[sel][0]; });
      btns.push(b); grid.appendChild(b);
    });
    function soMi() {
      audio(); stopTone(); silence();
      var so = list[sel][1], mi = so * Math.pow(2, -3 / 12), t = now() + 0.08;
      [[so, 0], [mi, 0.6], [so, 1.2], [mi, 1.8]].forEach(function (p) { S.tone(p[0], t + p[1], 0.5, 0.9, "triangle"); });
      status.textContent = "so – mi – so – mi. Now: “Ready, sing!”";
    }
    var el = h("div", null, [grid,
      h("div", { class: "g1t-row" }, [btn("⏹ Stop", "btn-ghost g1t-lg", stopTone), btn("🎤 Sing so–mi from here", "btn-primary g1t-lg", soMi), soLabel]),
      status,
      h("p", { class: "hint" }, "Most Grade 1 songs sit well with so on G or A. Pick a note, hear so–mi, then count the class in.")]);
    return { el: el, stop: function () { stopTone(); silence(); } };
  }

  /* ---------- Tool: classroom timer with music ---------- */
  function toolTimer() {
    var total = 120, left = 120, running = false, endAt = 0, music = true, chime = true, tick = null;
    var R = 88, CIRC = 2 * Math.PI * R;
    var ring = h("div", { class: "g1t-ring", html: '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--color-line)" stroke-width="14"/><circle class="g1t-ring-bar" cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--color-primary)" stroke-width="14" stroke-linecap="round" transform="rotate(-90 100 100)" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="0"/></svg>' });
    var display = h("div", { class: "g1t-time", role: "timer" }, "2:00");
    ring.appendChild(display);
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, "Pick a time, then press Start.");
    var startBtn = btn("▶ Start", "btn-primary g1t-xl", toggle);
    var scale = [NOTE.C4, NOTE.D4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.C5, NOTE.D5], step = 0;
    var bass = [NOTE.C3, NOTE.A3 / 2, NOTE.F3 / 2 * 2, NOTE.G3];
    var loop = Loop(function (t) {
      if (step % 8 === 0) S.tone(bass[(step / 8) % 4], t, 2.3, 0.6, "sine");
      if (Math.random() < 0.7) S.chime(pick(scale), t, 0.25);
      step++;
      return 0.3;
    });
    function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    function render() {
      display.textContent = fmt(left);
      ring.querySelector(".g1t-ring-bar").setAttribute("stroke-dashoffset", (CIRC * (1 - Math.max(0, left) / total)).toFixed(1));
    }
    function remaining() { return running ? (endAt - performance.now()) / 1000 : left; }
    function set(s) {
      var was = running;
      if (running) toggle();
      total = left = Math.max(10, Math.min(3600, Math.round(s)));
      ring.classList.remove("is-done"); render();
      status.textContent = "Ready: " + fmt(total) + ". Press Start.";
      if (was) toggle();
    }
    function finish() {
      running = false; left = 0; render(); loop.stop(); if (tick) clearInterval(tick);
      startBtn.textContent = "▶ Start";
      ring.classList.add("is-done");
      status.textContent = "⏰ Time’s up! 🎉";
      if (chime) { var t = now() + 0.05; [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C5 * 2].forEach(function (f, i) { S.chime(f, t + i * 0.25, 0.9); }); }
    }
    function toggle() {
      audio();
      if (running) {
        left = remaining(); running = false; loop.stop(); if (tick) clearInterval(tick);
        startBtn.textContent = "▶ Keep going"; status.textContent = "Paused."; return;
      }
      if (left <= 0) left = total;
      ring.classList.remove("is-done");
      running = true; endAt = performance.now() + left * 1000;
      if (music) { step = 0; loop.start(); }
      tick = every(function () { left = remaining(); if (left <= 0) finish(); else render(); }, 200);
      startBtn.textContent = "⏸ Pause"; status.textContent = music ? "🎵 Timing with calm music…" : "Timing…";
    }
    var presets = h("div", { class: "g1t-row" }, [[30, "30 sec"], [60, "1 min"], [120, "2 min"], [180, "3 min"], [300, "5 min"], [600, "10 min"]].map(function (p) {
      return btn(p[1], "btn-ghost g1t-lg", function () { set(p[0]); });
    }));
    var el = h("div", { class: "g1t-timer" }, [ring, status, presets,
      h("div", { class: "g1t-row" }, [startBtn, btn("↺ Reset", "btn-ghost g1t-xl", function () { if (running) toggle(); set(total); }),
        btn("− 30 sec", "btn-ghost g1t-lg", function () { set(remaining() - 30); }),
        btn("+ 30 sec", "btn-ghost g1t-lg", function () { set(remaining() + 30); })]),
      h("div", { class: "g1t-controls" }, [
        seg([{ value: true, label: "🎵 Music on" }, { value: false, label: "Quiet" }], music, function (v) { music = v; if (running) { if (v) loop.start(); else { loop.stop(); silence(); } } }, "While timing"),
        seg([{ value: true, label: "🔔 Chime" }, { value: false, label: "No chime" }], chime, function (v) { chime = v; }, "At the end")
      ])]);
    render();
    return { el: el, stop: function () { running = false; loop.stop(); silence(); } };
  }

  /* ---------- Tool: freeze dance ---------- */
  function toolFreeze() {
    var speed = 120, auto = true, state = "idle", step = 0, bar = 0;
    var emo = h("span", { class: "g1t-freeze-e" }, "🎵"), word = h("span", { class: "g1t-freeze-t" }, "Press Start, then dance!");
    var stage = h("div", { class: "g1t-freeze", "aria-live": "polite" }, [emo, word]);
    var startBtn = btn("▶ Start", "btn-primary g1t-xl", function () { if (state === "idle") go(); else stopAll(); });
    var freezeBtn = btn("🧊 Freeze now", "btn-ghost g1t-xl", function () { if (state === "dance") freeze(); else go(); });
    var chords = [[NOTE.C4, NOTE.E4, NOTE.G4], [NOTE.F4, NOTE.A4, NOTE.C5], [NOTE.G4, NOTE.B4, NOTE.D5], [NOTE.C4, NOTE.E4, NOTE.G4]];
    var roots = [NOTE.C3, NOTE.F3, NOTE.G3, NOTE.C3];
    var mel = [[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.D5], [NOTE.C5, NOTE.A4, NOTE.F4 * 2, NOTE.A5 / 1], [NOTE.D5, NOTE.B4, NOTE.G5, NOTE.G4], [NOTE.E5, NOTE.C5, NOTE.G4, NOTE.G5]];
    var riff = [];
    function newRiff() { riff = []; for (var i = 0; i < 8; i++) riff.push(i === 0 || Math.random() < 0.55 ? Math.floor(Math.random() * 4) : -1); }
    var loop = Loop(function (t) {
      var e = 60 / speed / 2, s = step % 8, c = bar % 4;
      if (s === 0 || s === 4) S.drum(t, 0.8);
      if (s === 2 || s === 6) S.clap(t, 0.45);
      S.shaker(t, s % 2 ? 0.3 : 0.18);
      if (s % 2 === 0) S.pluck(roots[c] * (s === 4 ? 2 : 1), t, 0.8);
      if (s === 0 || s === 3 || s === 6) chords[c].forEach(function (f) { S.mallet(f, t, 0.22); });
      if (riff[s] >= 0) S.mallet(mel[c][riff[s]], t, 0.5);
      step++;
      if (step % 8 === 0) { bar++; if (bar % 4 === 0) newRiff(); }
      return e;
    });
    function show(e, t, cls) { stage.className = "g1t-freeze " + (cls || ""); emo.textContent = e; word.textContent = t; }
    function go() {
      audio(); silence(); clearOwned();
      state = "dance"; step = 0; bar = 0; newRiff(); loop.start();
      show("💃", "DANCE!", "is-dance"); startBtn.textContent = "⏹ Stop"; freezeBtn.textContent = "🧊 Freeze now";
      if (auto) later(freeze, 4000 + Math.random() * 9000);
    }
    function freeze() {
      loop.stop(); silence(); clearOwned();
      state = "freeze"; show("🧊", "FREEZE!", "is-freeze"); freezeBtn.textContent = "💃 Dance again";
      S.handbell(now() + 0.02, 0.6);
      if (auto) later(go, 2500 + Math.random() * 2500);
    }
    function stopAll() { loop.stop(); silence(); clearOwned(); state = "idle"; show("🎵", "Press Start, then dance!", ""); startBtn.textContent = "▶ Start"; freezeBtn.textContent = "🧊 Freeze now"; }
    var el = h("div", null, [stage,
      h("div", { class: "g1t-row" }, [startBtn, freezeBtn]),
      h("div", { class: "g1t-controls" }, [
        seg([{ value: 96, label: "🐢 Slow" }, { value: 120, label: "🚶 Medium" }, { value: 144, label: "🐇 Fast" }], speed, function (v) { speed = v; }, "Speed"),
        seg([{ value: true, label: "Surprise stops" }, { value: false, label: "Teacher stops" }], auto, function (v) {
          auto = v; clearOwned();
          if (v && state === "dance") later(freeze, 4000 + Math.random() * 9000);
          if (v && state === "freeze") later(go, 2500);
        }, "Stops")
      ]),
      h("p", { class: "hint" }, "Surprise stops: the music freezes at random and starts again by itself. Teacher stops: use “Freeze now” and “Dance again”. The music is made fresh every time.")]);
    return { el: el, stop: function () { loop.stop(); silence(); state = "idle"; } };
  }

  /* ---------- Tool: instrument sorter ---------- */
  function toolSort() {
    var bins = [{ id: "blow", e: "🌬️", name: "Blow" }, { id: "hit", e: "👋", name: "Hit or shake" }, { id: "pluck", e: "🤏", name: "Pluck or bow" }];
    var items = [
      { e: "🎺", n: "trumpet", b: "blow", s: function (t) { S.brass(NOTE.G4, t, 0.35); S.brass(NOTE.C5, t + 0.35, 0.6); } },
      { e: "🎷", n: "saxophone", b: "blow", s: function (t) { S.reed(NOTE.E4, t, 0.4); S.reed(NOTE.G4, t + 0.4, 0.6); } },
      { e: "📯", n: "horn", b: "blow", s: function (t) { S.brass(NOTE.C4 / 1.5, t, 0.9); } },
      { e: "🥁", n: "drum", b: "hit", s: function (t) { S.drum(t); S.drum(t + 0.25, 0.7); } },
      { e: "🪘", n: "hand drum", b: "hit", s: function (t) { S.drum(t, 1, true); S.drum(t + 0.3, 0.7, true); } },
      { e: "🔔", n: "bell", b: "hit", s: function (t) { S.handbell(t); } },
      { e: "🎻", n: "violin", b: "pluck", s: function (t) { S.bowed(NOTE.A4, t, 0.9); } },
      { e: "🎸", n: "guitar", b: "pluck", s: function (t) { [NOTE.C4, NOTE.E4, NOTE.G4].forEach(function (f, i) { S.pluck(f, t + i * 0.05, 0.7); }); } },
      { e: "🪕", n: "banjo", b: "pluck", s: function (t) { S.pluck(NOTE.G4, t, 0.8, true); S.pluck(NOTE.D5, t + 0.12, 0.7, true); } }
    ];
    var selected = null, placed = 0;
    var status = h("p", { class: "g1t-status", "aria-live": "polite" }, "Tap an instrument to hear it, then tap how you play it.");
    var tray = h("div", { class: "g1t-tray" }), binEls = {}, binRow = h("div", { class: "g1t-bins" });
    bins.forEach(function (b) {
      var el = h("button", { type: "button", class: "g1t-bin", "data-bin": b.id }, [h("span", { class: "g1t-bin-e", "aria-hidden": "true" }, b.e), h("span", { class: "g1t-bin-n" }, b.name), h("span", { class: "g1t-bin-got" })]);
      el.addEventListener("click", function () { drop(b, el); });
      binEls[b.id] = el; binRow.appendChild(el);
    });
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function reset() {
      selected = null; placed = 0;
      tray.innerHTML = "";
      Object.keys(binEls).forEach(function (k) { binEls[k].querySelector(".g1t-bin-got").textContent = ""; });
      shuffle(items).forEach(function (it) {
        var b = h("button", { type: "button", class: "g1t-item", "aria-pressed": "false", "data-item": it.b }, [h("span", { class: "g1t-item-e", "aria-hidden": "true" }, it.e), h("span", null, cap(it.n))]);
        b.addEventListener("click", function () {
          audio(); silence(); it.s(now() + 0.03);
          Array.prototype.forEach.call(tray.querySelectorAll(".g1t-item"), function (x) { x.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true"); selected = { it: it, el: b };
          status.textContent = "How do you play the " + it.n + "? Tap a box.";
        });
        tray.appendChild(b);
      });
      status.textContent = "Tap an instrument to hear it, then tap how you play it.";
    }
    function drop(bin, el) {
      if (!selected) { status.textContent = "First tap an instrument."; flash(el, "is-wrong", 500); return; }
      if (selected.it.b === bin.id) {
        el.querySelector(".g1t-bin-got").textContent += selected.it.e;
        selected.el.remove(); placed++;
        flash(el, "is-right", 700); success();
        status.textContent = "Yes! " + cap(bin.name) + ": the " + selected.it.n + ". " + (placed === items.length ? "🎉 All sorted!" : "");
        selected = null;
        if (placed === items.length) tray.appendChild(btn("🔀 Play again", "btn-primary g1t-xl", reset));
      } else {
        flash(el, "is-wrong", 600); oops();
        status.textContent = "Hmm. Pretend to play the " + selected.it.n + ". Is that “" + bin.name.toLowerCase() + "”? Try another box.";
      }
    }
    reset();
    var el = h("div", null, [status, tray, binRow, h("p", { class: "hint" }, "Pictures are emoji, so they look a little different on each device. All sounds are made by the computer, not recordings.")]);
    return { el: el, stop: silence };
  }

  /* ---------- Picker and stage ---------- */
  var TOOLS = [
    { id: "beat", e: "💓", name: "Steady beat", blurb: "Big pulse, tempo slider, snail to cheetah", make: toolBeat },
    { id: "xylophone", e: "🌈", name: "Xylophone & bells", blurb: "C major bars in boomwhacker colours, with hand signs", make: toolXylo },
    { id: "percussion", e: "🥁", name: "Percussion pad", blurb: "Drum, shaker, triangle, woodblock, tambourine and more", make: toolDrums },
    { id: "echo", e: "🦜", name: "So–mi–la echo", blurb: "Listen to a pattern, then play it back", make: toolEcho },
    { id: "highlow", e: "🐦", name: "High or low?", blurb: "Bird or bear? Going up or down?", make: toolHighLow },
    { id: "loudsoft", e: "🦁", name: "Loud or soft?", blurb: "Lion or mouse? Getting louder or softer?", make: toolLoudSoft },
    { id: "fastslow", e: "🐇", name: "Fast or slow?", blurb: "Rabbit or turtle? Speeding up or slowing down?", make: toolFastSlow },
    { id: "compose", e: "🎼", name: "Melody maker", blurb: "Write so, mi and la on a 3-line staff", make: toolCompose },
    { id: "pitch", e: "🎵", name: "Pitch pipe", blurb: "Starting notes and so–mi to sing from", make: toolPitch },
    { id: "timer", e: "⏱️", name: "Music timer", blurb: "Countdown with calm music and a chime", make: toolTimer },
    { id: "freeze", e: "🧊", name: "Freeze dance", blurb: "Music stops at surprise moments", make: toolFreeze },
    { id: "sort", e: "🎻", name: "Instrument sorter", blurb: "Blow, hit or shake, pluck or bow", make: toolSort }
  ];
  var CLASSICS = [
    { e: "🔢", name: "Rhythm pad", blurb: "ta, ti-ti and rest on eight beats" },
    { e: "🎹", name: "So–mi–la piano", blurb: "Tap so, mi, la, do, re" },
    { e: "❓", name: "Name the sound", blurb: "Mystery sound quiz" }
  ];

  var CSS = ".g1t{--g1t-gap:14px;min-width:0;max-width:100%}\n.g1t [hidden]{display:none!important}\n.g1t-picker{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--g1t-gap);margin:8px 0}\n.g1t-card{font:inherit;text-align:left;cursor:pointer;background:var(--color-paper);border:1px solid var(--color-line);border-radius:var(--radius-lg);box-shadow:var(--shadow-paper);padding:16px;min-height:128px;display:flex;flex-direction:column;gap:6px;color:inherit;transition:transform .12s,border-color .12s}\n.g1t-card:hover,.g1t-card:focus-visible{border-color:var(--color-primary);transform:translateY(-2px)}\n.g1t-card:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}\n.g1t-card-e{font-size:40px;line-height:1}\n.g1t-card-n{font-weight:700;font-size:16.5px}\n.g1t-card-b{color:var(--color-muted);font-size:13.5px;line-height:1.35}\n.g1t-card.is-classic{background:var(--color-surface);border-style:dashed}\n.g1t-sub{font-family:var(--font-display);font-size:20px;margin:22px 0 8px}\n.g1t-stage{background:var(--color-paper);border:1px solid var(--color-line);border-radius:var(--radius-xl);box-shadow:var(--shadow-paper);padding:16px 18px 20px;margin:8px 0 24px;scroll-margin-top:84px}\n.g1t-stagebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}\n.g1t-stagebar h2{margin:0;flex:1;font-size:26px;display:flex;align-items:center;gap:10px;outline:none}\n.g1t-stage.is-big{position:fixed;inset:0;z-index:80;margin:0;border-radius:0;overflow:auto;padding:20px clamp(16px,4vw,48px);background:var(--color-bg)}\n.g1t-btn{cursor:pointer;touch-action:manipulation}\n.g1t-lg{min-height:52px;font-size:16px;padding:12px 18px}\n.g1t-xl{min-height:60px;font-size:18px;padding:14px 24px}\n.g1t-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}\n.g1t-controls{display:flex;flex-wrap:wrap;gap:10px 18px;margin:10px 0}\n.g1t-seg{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}\n.g1t-seg-label{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-subtle);margin-right:4px}\n.g1t-seg button{font:inherit;cursor:pointer;min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid var(--color-line);background:#fff;color:var(--color-fg);font-weight:650;font-size:14.5px;touch-action:manipulation}\n.g1t-seg button[aria-pressed=true]{background:var(--color-primary);border-color:var(--color-primary);color:var(--color-primary-fg)}\n.g1t-status{font-size:clamp(18px,2.4vw,24px);font-weight:650;margin:12px 0;min-height:1.4em}\n.g1t-score{font-size:18px;font-weight:700;color:var(--color-primary);margin:8px 0}\n.g1t-emo{font-size:1.25em}\n.g1t-answers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}\n.g1t-answer{font:inherit;cursor:pointer;min-height:140px;border-radius:var(--radius-xl);border:2px solid var(--color-line);background:#fff;color:var(--color-fg);font-size:clamp(20px,3vw,28px);font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;touch-action:manipulation}\n.g1t-answer-e{font-size:clamp(48px,7vw,72px);line-height:1}\n.g1t-answer:hover{border-color:var(--color-primary)}\n.g1t .is-right{animation:g1t-pop .5s ease;border-color:#2f7d6b!important;background:#d7efe6!important}\n.g1t .is-wrong{animation:g1t-shake .45s ease;border-color:#c62828!important}\n@keyframes g1t-pop{0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}\n@keyframes g1t-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}\n.g1t-beat-top{display:flex;flex-direction:column;align-items:center;gap:14px;margin:8px 0}\n.g1t-pulse{width:clamp(150px,30vw,240px);aspect-ratio:1;border-radius:50%;background:var(--color-primary-soft);border:6px solid var(--color-primary);display:grid;place-items:center;position:relative;transition:transform .18s ease,background .18s}\n.g1t-pulse.is-on{transform:scale(1.12);background:#d7efe6;transition:none}\n.g1t-pulse.accent.is-on{background:#f6e9c0;border-color:#c4a035}\n.g1t-pulse-e{font-size:clamp(56px,11vw,96px);line-height:1}\n.g1t-pulse-n{position:absolute;bottom:12%;font-weight:800;font-size:22px;color:var(--color-primary)}\n.g1t-dots{display:flex;gap:12px}\n.g1t-dot{width:22px;height:22px;border-radius:50%;background:var(--color-line)}\n.g1t-dot.is-on{background:var(--color-primary)}\n.g1t-dot:first-child.is-on{background:#c4a035}\n.g1t-readout{text-align:center;font-size:clamp(18px,2.4vw,24px);font-weight:700;margin:6px 0}\n.g1t-tempo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.g1t-range{flex:1;min-width:160px;height:44px;accent-color:var(--color-primary)}\n.g1t-xylo{display:flex;align-items:center;gap:clamp(4px,1vw,10px);height:clamp(240px,40vw,340px);padding:10px 0}\n.g1t-bar{font:inherit;cursor:pointer;flex:1 1 0;min-width:0;height:var(--h);background:var(--bar);border:0;border-radius:12px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.15);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10px 2px;font-weight:800;touch-action:manipulation;transition:transform .1s;user-select:none;-webkit-user-select:none}\n.g1t-bar.is-on{transform:translateY(4px) scale(.97);filter:brightness(1.2)}\n.g1t-bar.is-off{opacity:.25;cursor:not-allowed}\n.g1t-bar-peg{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.7);box-shadow:0 0 0 2px rgba(0,0,0,.2)}\n.g1t-bar-main{font-size:clamp(18px,3vw,28px)}\n.g1t-bar-sub{font-size:13px;opacity:.85;font-weight:650}\n.g1t-bar-key{font-size:11px;opacity:.6;font-weight:600}\n.g1t-hand{display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.1}\n.g1t-hand-e{font-size:28px;display:inline-block}\n.g1t-hand-w{font-size:11px;font-weight:650;text-align:center;max-width:7em}\n.g1t-hand.big .g1t-hand-e{font-size:36px}\n.g1t-pads{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}\n.g1t-pad{font:inherit;cursor:pointer;min-height:clamp(120px,16vw,170px);border-radius:var(--radius-xl);border:0;background:var(--pad);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.12);position:relative;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:transform .08s}\n.g1t-pad.is-on{transform:scale(.95);filter:brightness(1.25)}\n.g1t-pad-e{font-size:clamp(44px,6vw,64px);line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2))}\n.g1t-pad-n{font-weight:750;font-size:16px;text-shadow:0 1px 2px rgba(0,0,0,.3)}\n.g1t-pad-k{position:absolute;top:8px;right:12px;font-size:12px;opacity:.75}\n.g1t-echo{display:grid;gap:10px;max-width:560px}\n.g1t-echo-bar{font:inherit;cursor:pointer;min-height:84px;border:0;border-radius:var(--radius-xl);background:var(--bar);display:flex;align-items:center;gap:16px;padding:8px 20px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18);touch-action:manipulation;transition:transform .1s;user-select:none;-webkit-user-select:none}\n.g1t-echo-la{width:88%}\n.g1t-echo-so{width:94%}\n.g1t-echo-mi{width:100%;margin-top:24px}\n.g1t-echo-bar.is-on{transform:scale(1.03);filter:brightness(1.25);box-shadow:0 0 0 5px rgba(92,61,138,.35)}\n.g1t-echo-name{font-size:30px;font-weight:800;flex:1;text-align:left}\n.g1t-echo-hl{font-size:13px;font-weight:700;opacity:.85;text-transform:uppercase;letter-spacing:.06em}\n.g1t-progress{display:flex;gap:8px;margin:6px 0 14px;min-height:44px}\n.g1t-pdot{min-width:52px;height:44px;border-radius:12px;border:2px dashed var(--color-line);display:grid;place-items:center;font-weight:700;color:var(--color-subtle)}\n.g1t-pdot.is-on{border-style:solid;border-color:var(--color-primary);color:var(--color-primary);background:var(--color-primary-soft)}\n.g1t-staff-wrap{overflow-x:auto;background:#fff;border:1px solid var(--color-line);border-radius:var(--radius-lg);padding:6px}\n.g1t-staff{display:block;width:100%;height:auto}\n.g1t-zone{cursor:pointer}\n.g1t-zone:hover{fill:rgba(92,61,138,.08)}\n.g1t-cells{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin-top:10px}\n.g1t-cell{font:inherit;cursor:pointer;min-height:60px;border-radius:12px;border:1px solid var(--color-line);background:var(--color-surface);font-weight:750;font-size:17px;color:var(--color-fg);display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:manipulation}\n.g1t-cell small{font-size:11px;color:var(--color-subtle);font-weight:600}\n.g1t-cell.filled{background:var(--color-primary-soft);color:var(--color-primary)}\n.g1t-cell.now{outline:3px solid var(--color-primary)}\n.g1t-pipe{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}\n.g1t-pipe-note{font:inherit;cursor:pointer;aspect-ratio:1;min-height:64px;border-radius:50%;border:0;background:var(--bar);font-size:clamp(20px,3vw,30px);font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 -5px 0 rgba(0,0,0,.18);touch-action:manipulation;transition:transform .12s}\n.g1t-pipe-note small{font-size:12px;font-weight:650}\n.g1t-pipe-note.is-on{box-shadow:0 0 0 6px rgba(92,61,138,.35);transform:scale(1.06)}\n.g1t-badge{font-size:14px;padding:8px 12px}\n.g1t-timer{display:flex;flex-direction:column;align-items:center}\n.g1t-timer .g1t-row,.g1t-timer .g1t-controls{justify-content:center}\n.g1t-ring{position:relative;width:clamp(220px,40vw,340px);aspect-ratio:1}\n.g1t-ring svg{width:100%;height:100%;display:block}\n.g1t-ring-bar{transition:stroke-dashoffset .2s linear}\n.g1t-time{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-display);font-weight:700;font-size:clamp(52px,10vw,92px);font-variant-numeric:tabular-nums}\n.g1t-ring.is-done .g1t-time{color:#c62828;animation:g1t-pop .6s ease 3}\n.g1t-freeze{border-radius:var(--radius-xl);min-height:clamp(220px,36vw,340px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--color-surface);border:2px solid var(--color-line);text-align:center;padding:16px}\n.g1t-freeze-e{font-size:clamp(64px,12vw,120px);line-height:1}\n.g1t-freeze-t{font-family:var(--font-display);font-weight:700;font-size:clamp(28px,6vw,64px)}\n.g1t-freeze.is-dance{background:#d7efe6;border-color:#2f7d6b}\n.g1t-freeze.is-dance .g1t-freeze-e{animation:g1t-bounce .5s ease-in-out infinite alternate}\n.g1t-freeze.is-freeze{background:#dbeafe;border-color:#3b82f6}\n@keyframes g1t-bounce{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-14px) rotate(6deg)}}\n.g1t-tray{display:flex;flex-wrap:wrap;align-items:center;gap:10px;min-height:96px;margin:8px 0 16px}\n.g1t-item{font:inherit;cursor:pointer;min-width:110px;min-height:96px;border-radius:var(--radius-lg);border:2px solid var(--color-line);background:#fff;color:var(--color-fg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:700;touch-action:manipulation}\n.g1t-item[aria-pressed=true]{border-color:var(--color-primary);box-shadow:0 0 0 4px rgba(92,61,138,.25);background:var(--color-primary-soft)}\n.g1t-item-e{font-size:44px;line-height:1}\n.g1t-bins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n.g1t-bin{font:inherit;cursor:pointer;min-height:170px;border-radius:var(--radius-xl);border:3px dashed var(--color-hover-line);background:var(--color-surface);color:var(--color-fg);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;padding:14px 8px;touch-action:manipulation}\n.g1t-bin-e{font-size:44px;line-height:1}\n.g1t-bin-n{font-weight:800;font-size:19px}\n.g1t-bin-got{font-size:34px;letter-spacing:4px;min-height:1.2em}\n@media (max-width:640px){\n.g1t-picker{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}\n.g1t-card{min-height:118px;padding:12px}\n.g1t-card-e{font-size:34px}\n.g1t-stage{padding:12px 12px 16px}\n.g1t-pads{grid-template-columns:repeat(2,minmax(0,1fr))}\n.g1t-cells{grid-template-columns:repeat(4,minmax(0,1fr))}\n.g1t-pipe{grid-template-columns:repeat(4,minmax(0,1fr))}\n.g1t-bins{grid-template-columns:1fr}\n.g1t-bin{min-height:96px;flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center}\n.g1t-answer{min-height:120px}\n.g1t-xylo{gap:3px;height:260px}\n.g1t-bar{border-radius:8px}\n.g1t-bar-sub,.g1t-bar-key,.g1t-hand-w{display:none}\n.g1t-hand-e{font-size:22px}\n.g1t-stagebar h2{font-size:21px;flex-basis:100%;order:-1}\n.g1t-xl{min-height:56px;font-size:17px;padding:12px 18px}\n.g1t-echo-name{font-size:26px}\n}\n@media (prefers-reduced-motion:reduce){.g1t-freeze.is-dance .g1t-freeze-e,.g1t .is-right,.g1t .is-wrong,.g1t-ring.is-done .g1t-time{animation:none}}\n@media print{.g1t{display:none!important}}\n";
  var mounted = null;

  function mount(container) {
    if (!container) return;
    unmount();
    if (!document.getElementById("g1t-style")) document.head.appendChild(h("style", { id: "g1t-style" }, CSS));
    var root = h("div", { class: "g1t" });
    var picker = h("div", { class: "g1t-picker", role: "list", "aria-label": "Music tools" });
    var stage = h("section", { class: "g1t-stage", hidden: true });
    var title = h("h2", { tabindex: "-1" });
    var bigBtn = btn("⛶ Big screen", "btn-ghost", toggleBig);
    var body = h("div", { class: "g1t-body" });
    var classicsTitle = h("h3", { class: "g1t-sub" }, "Also on this page");
    var classics = h("div", { class: "g1t-picker", role: "list", "aria-label": "More tools further down this page" });
    var current = null;
    stage.appendChild(h("div", { class: "g1t-stagebar" }, [btn("← All tools", "btn-ghost g1t-back", close), title, bigBtn]));
    stage.appendChild(body);

    TOOLS.forEach(function (t) {
      var c = h("button", { type: "button", class: "g1t-card", role: "listitem", "data-tool": t.id }, [
        h("span", { class: "g1t-card-e", "aria-hidden": "true" }, t.e), h("span", { class: "g1t-card-n" }, t.name), h("span", { class: "g1t-card-b" }, t.blurb)
      ]);
      c.addEventListener("click", function () { open(t); });
      picker.appendChild(c);
    });
    CLASSICS.forEach(function (t) {
      var c = h("button", { type: "button", class: "g1t-card is-classic", role: "listitem" }, [
        h("span", { class: "g1t-card-e", "aria-hidden": "true" }, t.e), h("span", { class: "g1t-card-n" }, t.name), h("span", { class: "g1t-card-b" }, t.blurb + " · further down ↓")
      ]);
      c.addEventListener("click", function () { var tgt = document.getElementById("studio-classics"); if (tgt) tgt.scrollIntoView({ behavior: "smooth", block: "start" }); });
      classics.appendChild(c);
    });

    function setHash(id) {
      try { history.replaceState(history.state, "", location.pathname + location.search + (id ? "#" + id : "")); } catch (e) {}
    }
    function closeCurrent() {
      clearOwned();
      if (current && current.stop) { try { current.stop(); } catch (e) {} }
      current = null;
      body.innerHTML = "";
    }
    function open(t) {
      closeCurrent();
      title.innerHTML = "";
      title.appendChild(h("span", { "aria-hidden": "true" }, t.e));
      title.appendChild(document.createTextNode(t.name));
      current = t.make();
      current.id = t.id;
      body.appendChild(current.el);
      picker.hidden = true; classics.hidden = true; classicsTitle.hidden = true;
      stage.hidden = false;
      root.setAttribute("data-open", t.id);
      setHash(t.id);
      stage.scrollIntoView({ block: "start" });
      try { title.focus({ preventScroll: true }); } catch (e) {}
    }
    function close() {
      var was = current && current.id;
      closeCurrent();
      if (stage.classList.contains("is-big")) toggleBig();
      stage.hidden = true; picker.hidden = false; classics.hidden = false; classicsTitle.hidden = false;
      root.removeAttribute("data-open");
      setHash("");
      var card = was && picker.querySelector('[data-tool="' + was + '"]');
      if (card) card.focus();
    }
    function toggleBig() {
      var on = !stage.classList.contains("is-big");
      stage.classList.toggle("is-big", on);
      bigBtn.textContent = on ? "✕ Exit big screen" : "⛶ Big screen";
      try {
        if (on && stage.requestFullscreen && !document.fullscreenElement) stage.requestFullscreen().catch(function () {});
        if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {});
      } catch (e) {}
    }
    function onFs() {
      if (!document.fullscreenElement && stage.classList.contains("is-big")) { stage.classList.remove("is-big"); bigBtn.textContent = "⛶ Big screen"; }
    }
    function onKey(e) {
      if (!current || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { if (stage.classList.contains("is-big") && !document.fullscreenElement) toggleBig(); return; }
      if (e.repeat) return;
      if (current.key && current.key(String(e.key).toLowerCase())) e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);

    root.appendChild(picker);
    root.appendChild(stage);
    root.appendChild(classicsTitle);
    root.appendChild(classics);
    container.appendChild(root);
    mounted = {
      root: root,
      open: function (id) { var t = TOOLS.filter(function (x) { return x.id === id; })[0]; if (t) open(t); },
      destroy: function () {
        closeCurrent();
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("fullscreenchange", onFs);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
    var hash = (location.hash || "").slice(1);
    if (hash) mounted.open(hash);
  }

  function unmount() {
    if (!mounted) return;
    try { mounted.destroy(); } catch (e) {}
    mounted = null;
    silence();
  }

  window.G1StudioTools = {
    mount: mount,
    unmount: unmount,
    open: function (id) { if (mounted) mounted.open(id); },
    tools: TOOLS.map(function (t) { return t.id; }),
    audioState: function () { return AC ? AC.state : "none"; }
  };
})();
