// FARCIPAL EYE — логика интерфейса. Чистый JavaScript, без зависимостей.
(() => {
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CX = 505, CY = 248, PIVOT = 238, IR = 168, PR = 58;
  const UPPER = "M 68 282 C 170 150, 340 66, 540 64 C 720 62, 860 132, 936 206";
  const LOWER = "C 860 318, 720 404, 520 410 C 330 416, 160 370, 68 282";
  const EYE = UPPER + " " + LOWER + " Z";
  const SHADOW = UPPER + " C 870 210, 730 196, 540 200 C 340 204, 170 236, 68 282 Z";

  $("clipShape").setAttribute("d", EYE);
  $("sclera").setAttribute("d", EYE);
  $("upperLid").setAttribute("d", UPPER);
  $("lowerLid").setAttribute("d", "M 936 206 " + LOWER);
  $("shadow").setAttribute("d", SHADOW);

  const TAU = Math.PI * 2, FIBERS = 210;
  const fibersRoot = $("fibers");
  const fiberGroups = [0, 1, 2].map(() => {
    const g = document.createElementNS(SVGNS, "g");
    fibersRoot.appendChild(g);
    return g;
  });
  const fiberList = [];
  const tones = ["#174f2c", "#1b5e34", "#1f6c3c", "#247a44"];
  for (let i = 0; i < FIBERS; i++) {
    const a = (i / 210) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
    const r0 = PR + 2 + Math.random() * 12;
    const r1 = IR * (0.5 + Math.random() * 0.46);
    const bend = (Math.random() - 0.5) * 0.08;
    const am = a + bend, rm = (r0 + r1) / 2;
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d",
      `M ${(Math.cos(a) * r0).toFixed(1)} ${(Math.sin(a) * r0).toFixed(1)} Q ${(Math.cos(am) * rm).toFixed(1)} ${(Math.sin(am) * rm).toFixed(1)} ${(Math.cos(a + bend * 1.6) * r1).toFixed(1)} ${(Math.sin(a + bend * 1.6) * r1).toFixed(1)}`);
    const lighter = Math.random() < 0.18;
    const stroke = lighter ? "#2f9a58" : tones[(Math.random() * tones.length) | 0];
    const base = lighter ? 0.28 + Math.random() * 0.22 : 0.18 + Math.random() * 0.4;
    p.setAttribute("stroke", stroke);
    p.setAttribute("stroke-opacity", base.toFixed(2));
    p.setAttribute("stroke-width", (0.5 + Math.random() * 1.1).toFixed(2));
    p.setAttribute("fill", "none");
    const g = i % 3;
    fiberGroups[g].appendChild(p);
    fiberList.push({ el: p, a: (a + TAU) % TAU, g, stroke, base, e: 0 });
  }

  const scene = $("scene"), eyeSvg = $("eye");
  const lidsBack = $("lidsBack"), lidsFront = $("lidsFront"), clipShape = $("clipShape"), shadow = $("shadow");
  const irisMove = $("irisMove"), irisScale = $("irisScale"), pupilMove = $("pupilMove"), pupil = $("pupil");
  const glowMove = $("glowMove"), glow = $("glow"), rings = $("rings");
  const input = $("q"), form = $("form"), btn = $("btn");
  const progress = $("progress"), statusDot = $("statusDot"), statusText = $("statusText"), timerEl = $("timer");
  const pillDot = $("pillDot"), pillText = $("pillText");
  const logEl = $("log"), cardsEl = $("cards"), historyEl = $("history");

  const STATES = {
    idle:     { lid: 1.0,  opacity: .7,  glow: .1,  pupil: 1.0,  status: "ожидание", pill: "наблюдение" },
    scanning: { lid: 1.05, opacity: .92, glow: .12, pupil: .86,  status: "поиск",    pill: "поиск" },
    found:    { lid: .97,  opacity: .86, glow: .14, pupil: .8,   status: "готово",   pill: "найдено" },
    empty:    { lid: .86,  opacity: .55, glow: .05, pupil: 1.12, status: "пусто",    pill: "пусто" },
    error:    { lid: .6,   opacity: .72, glow: .06, pupil: .78,  status: "ошибка",   pill: "сбой" },
  };
  let state = "idle";
  const cur = { x: 0, y: 0, lid: 0.06, opacity: 0.2, glow: 0, pupil: 1.2, pupilX: 0, pupilY: 0 };
  let foundAt = -1e9, glowFlash = 0, nextBlink = performance.now() + 3200, blinkAt = -1e9;
  let lastKey = -1e9, focused = false;
  const born = performance.now();

  function setState(s) {
    state = s;
    const cfg = STATES[s];
    statusDot.dataset.s = s; pillDot.dataset.s = s;
    statusText.textContent = cfg.status; pillText.textContent = cfg.pill;
    scene.classList.toggle("dim", s === "empty");
    eyeSvg.classList.toggle("err", s === "error");
    pupil.setAttribute("stroke", s === "error" ? "#f87171" : "#3dcf6f");
    const now = performance.now();
    if (s === "error") {
      scene.classList.remove("tremor"); void scene.offsetWidth; scene.classList.add("tremor");
      for (let i = 0; i < 22; i++) spawnSignal(now, { dir: 1, color: "#ff8a8a", dur: 380 + Math.random() * 380 });
    }
    if (s === "found") { 
      scene.classList.remove("flash"); void scene.offsetWidth; scene.classList.add("flash");
      foundAt = now; glowFlash = 0.45;
      
      spawnRing(0); spawnRing(80); spawnRing(160);  spawnRing(240); spawnRing(320);
            tearPulse(now, 1100);
      for (let i = 0; i < 40; i++) spawnSignal(now + i * 6, { dir: 1, dur: 600 + Math.random() * 500, bright: 1 });
      fiberList.forEach((f) => excite(f, 0.55 + Math.random() * 0.35));
    }
  }

  function spawnRing(delay) {
    setTimeout(() => {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("class", "ring");
      c.setAttribute("cx", CX + cur.x); c.setAttribute("cy", CY + cur.y); c.setAttribute("r", IR);
      c.addEventListener("animationend", () => c.remove());
      rings.appendChild(c);
    }, delay);
  }

  const samples = [];
  let mouse = null;
  addEventListener("pointermove", (e) => {
    samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (samples.length > 240) samples.splice(0, 60);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse = null; samples.length = 0; });
  function delayedMouse(now) {
    while (samples.length > 1 && samples[1].t <= now - 500) samples.shift();
    if (samples.length && samples[0].t <= now - 500) mouse = samples[0];
    return mouse;
  }

  const SX = 150, SY_MIN = -54, SY_MAX = 62;
  const scan = { x: 0, y: 0, next: 0, queue: [], lid: 1.05, pupil: 0.86 };
  const vel = { x: 0, y: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function planScan() {
    const r = Math.random();
    if (r < 0.34) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 4 + ((Math.random() * 3) | 0);
      const y = rnd(SY_MIN + 10, SY_MAX - 10);
      let x = -dir * SX * rnd(0.6, 1);
      for (let i = 0; i < n; i++) {
        scan.queue.push({ x, y: y + rnd(-6, 6), hold: rnd(130, 280), lid: 1.0 });
        x = clamp(x + dir * ((SX * 2) / n) * rnd(0.8, 1.2), -SX, SX);
      }
    } else if (r < 0.6) {
      const s = Math.random() < 0.5 ? -1 : 1;
      scan.queue.push({ x: s * SX * rnd(0.85, 1), y: rnd(SY_MIN, SY_MIN + 50), hold: rnd(320, 620), lid: 1.1 });
      scan.queue.push({ x: -s * SX * rnd(0.85, 1), y: rnd(SY_MIN + 20, SY_MAX), hold: rnd(320, 680), lid: 1.1 });
    } else if (r < 0.8) {
      scan.queue.push({ x: rnd(-SX, SX), y: Math.random() < 0.5 ? SY_MIN : SY_MAX, hold: rnd(240, 520) });
    } else {
      const x = rnd(-SX, SX) * 0.8, y = rnd(SY_MIN, SY_MAX);
      scan.queue.push({ x, y, hold: rnd(160, 260) }, { x: x + rnd(-16, 16), y: y + rnd(-7, 7), hold: rnd(320, 600), lid: 0.95 });
    }
  }

  function nextFixation(now) {
    if (!scan.queue.length) planScan();
    const f = scan.queue.shift();
    scan.x = f.x; scan.y = f.y;
    scan.next = now + f.hold;
    scan.lid = f.lid ?? rnd(1.02, 1.08);
    scan.pupil = rnd(0.76, 0.95);
    if (Math.random() < 0.1 && now - blinkAt > 1600) blinkAt = now;
    const ang = Math.atan2(f.y - cur.y, f.x - cur.x);
    for (let i = 0; i < 5; i++) spawnSignal(now, { dir: -1, angle: ang + rnd(-0.5, 0.5), dur: rnd(260, 480), bright: 1 });
  }

  const micro = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };

  let hotColor = "#7dffae";
  const active = new Set();
  function excite(f, amt) {
    f.e = Math.min(1, f.e + amt);
    if (!active.has(f)) { active.add(f); f.el.setAttribute("stroke", hotColor); }
  }
  const fiberAt = (a) => fiberList[(Math.round((((a % TAU) + TAU) % TAU) / TAU * FIBERS)) % FIBERS];

  const sigRoot = $("signals");
  const signals = Array.from({ length: 72 }, () => {
    const el = document.createElementNS(SVGNS, "line");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("opacity", "0");
    sigRoot.appendChild(el);
    return { el, live: false };
  });
  function spawnSignal(now, o = {}) {
    if (reduced) return;
    const s = signals.find((p) => !p.live);
    if (!s) return;
    s.live = true;
    s.a = o.angle ?? Math.random() * TAU;
    s.dir = o.dir ?? (Math.random() < 0.5 ? 1 : -1);
    s.r0 = PR * cur.pupil + 5;
    s.r1 = IR * rnd(0.62, 0.96);
    s.t0 = now; s.dur = o.dur ?? rnd(520, 1200);
    s.len = rnd(6, 18);
    s.op = o.bright ? rnd(0.75, 1) : rnd(0.35, 0.75);
    s.curve = rnd(-0.12, 0.12);
    s.el.setAttribute("stroke", o.color ?? (Math.random() < 0.2 ? "#c9ffe0" : "#6dffa3"));
    s.el.setAttribute("stroke-width", rnd(0.7, 1.7).toFixed(2));
    excite(fiberAt(s.a), 0.4);
  }
  function updateSignals(now) {
    for (const s of signals) {
      if (!s.live) continue;
      const p = (now - s.t0) / s.dur;
      if (p < 0) continue;
      if (p >= 1) { s.live = false; s.el.setAttribute("opacity", "0"); continue; }
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const rr = s.dir > 0 ? s.r0 + (s.r1 - s.r0) * e : s.r1 - (s.r1 - s.r0) * e;
      const rt = rr - s.dir * s.len;
      const ah = s.a + s.curve * e, at = s.a + s.curve * Math.max(0, e - 0.08);
      s.el.setAttribute("x1", (Math.cos(at) * rt).toFixed(1));
      s.el.setAttribute("y1", (Math.sin(at) * rt).toFixed(1));
      s.el.setAttribute("x2", (Math.cos(ah) * rr).toFixed(1));
      s.el.setAttribute("y2", (Math.sin(ah) * rr).toFixed(1));
      s.el.setAttribute("opacity", (Math.sin(p * Math.PI) * s.op).toFixed(3));
    }
  }

  const groupRot = [0, 0, 0], groupSpin = [0.021, -0.015, 0.009];
  let sweepAngle = 0, sweepOp = 0;
  const sweepA = $("sweepA"), sweepB = $("sweepB");

  const markBlades = $("markBlades"), markOrbit = $("markOrbit"), markOrbitArc = $("markOrbitArc"), markCoreDot = $("markCoreDot");
  const mark = { h: 6.2, rot: 0, orbitOp: 0, spin: 0 };
  function drawMark(h, rot) {
    const R = 13.6, pts = [];
    for (let i = 0; i < 6; i++) {
      const t = rot + (i / 6) * TAU;
      pts.push([Math.cos(t) * h, Math.sin(t) * h]);
    }
    let d = "M " + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" L ") + " Z";
    for (let i = 0; i < 6; i++) {
      const v = pts[i], u = pts[(i + 5) % 6];
      let dx = v[0] - u[0], dy = v[1] - u[1];
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const b = v[0] * dx + v[1] * dy;
      const t = -b + Math.sqrt(b * b - (h * h - R * R));
      d += ` M ${v[0].toFixed(2)} ${v[1].toFixed(2)} L ${(v[0] + dx * t).toFixed(2)} ${(v[1] + dy * t).toFixed(2)}`;
    }
    markBlades.setAttribute("d", d);
  }

  const sclera = $("sclera");
  const dust = [];
  const makeDust = (root, n, near) => {
    for (let i = 0; i < n; i++) {
      const el = document.createElementNS(SVGNS, "circle");
      el.setAttribute("r", (near ? rnd(1.4, 2.6) : rnd(0.5, 1.3)).toFixed(2));
      el.setAttribute("fill", Math.random() < 0.3 ? "#d6ffe6" : "#7dffae");
      el.setAttribute("opacity", "0");
      root.appendChild(el);
      const sp = rnd(0.004, 0.012), dir = Math.random() * TAU;
      dust.push({
        el, near, x: rnd(-60, 1060), y: rnd(-30, 540),
        vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp - 0.002,
        base: near ? rnd(0.12, 0.28) : rnd(0.18, 0.5),
        tw: rnd(0.0006, 0.0018), ph: Math.random() * TAU, o: 0,
      });
    }
  };
  makeDust($("dustFar"), 12, false);
  makeDust($("dustNear"), 6, true);
  const dustPoint = new DOMPoint();
  function updateDust(now, dt, px, py, breathWave) {
    for (const d of dust) {
      if (!reduced) {
        d.vx += Math.sin(now * 0.0003 + d.ph) * 0.00002 * dt;
        d.vy += Math.cos(now * 0.00025 + d.ph * 1.7) * 0.00002 * dt;
        const sp = Math.hypot(d.vx, d.vy), max = d.near ? 0.016 : 0.012;
        if (sp > max) { d.vx *= max / sp; d.vy *= max / sp; }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < -80) d.x = 1080; else if (d.x > 1080) d.x = -80;
        if (d.y < -50) d.y = 560; else if (d.y > 560) d.y = -50;
      }
      dustPoint.x = d.x; dustPoint.y = d.y;
      const inside = sclera.isPointInFill(dustPoint);
      const twinkle = 0.65 + Math.sin(now * d.tw + d.ph) * 0.35;
      const target = inside ? 0 : d.base * twinkle * (1 + breathWave * 0.3);
      d.o += (target - d.o) * ease(0.05, dt);
      const depth = d.near ? 2.2 : -0.6;
      d.el.setAttribute("cx", (d.x + px * depth).toFixed(1));
      d.el.setAttribute("cy", (d.y + py * depth).toFixed(1));
      d.el.setAttribute("opacity", d.o.toFixed(3));
    }
  }

  // ---------- подтёк: вытекает из нижнего века под зрачком, сужается в острие ----------
  const tearGlowEl = $("tearGlowPath"), tearBody = $("tearBody"), tearCore = $("tearCore"), tearDrop = $("tearDrop");
  const tearGrads = ["tearFill", "tearEdge", "tearCoreFill"].map((id) => $(id));
  const TX = 503;
  const tear = { len: 190, next: performance.now() + 2200, t0: -1e9, dur: 2400 };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const tearProfile = (t) => Math.pow(1 - t, 0.55) * (0.85 + 0.15 * smooth(0, 0.1, t));
  function tearPulse(now, dur) { tear.t0 = now; tear.dur = dur; tear.next = now + dur + rnd(3500, 7000); }
  function updateTear(now, dt, lidScale, breathWave) {
    const lidY = PIVOT + (410 - PIVOT) * lidScale;
    const y0 = Math.max(lidY, 255);
    const lenT = state === "scanning" ? 232 : state === "found" ? 320 : state === "empty" ? 140 : state === "error" ? 104 : 196;
    tear.len += (lenT - tear.len) * ease(0.05, dt);
    const len = tear.len * (1 + breathWave * 0.015);
    const wmax =
(
  state === "found"
    ? 34
    : 22
)
*
(1 + breathWave * 0.05)
*
(state === "error" ? 0.8 : 1);
    const sway = reduced ? 0 : state === "error" ? 5 : 2.6;
    const ph = now * 0.0008;
    const N = 28, L = [], R = [], Lc = [], Rc = [];
    const cxAt = (t) => TX + sway * Math.sin(t * 2.4 + ph) * t;
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = (y0 + t * len).toFixed(1);
      const jit = state === "error" ? (Math.random() - 0.5) * 0.8 : 0;
      const cx = cxAt(t) + jit, hw = (wmax / 2) * tearProfile(t), hc = hw * 0.26;
      L.push(`${(cx - hw).toFixed(1)} ${y}`); R.push(`${(cx + hw).toFixed(1)} ${y}`);
      Lc.push(`${(cx - hc).toFixed(1)} ${y}`); Rc.push(`${(cx + hc).toFixed(1)} ${y}`);
    }
    const d = "M " + L.join(" L ") + " L " + R.reverse().join(" L ") + " Z";
    tearBody.setAttribute("d", d);
    tearGlowEl.setAttribute("d", d);
    tearCore.setAttribute("d", "M " + Lc.join(" L ") + " L " + Rc.reverse().join(" L ") + " Z");
    for (const g of tearGrads) { g.setAttribute("y1", y0.toFixed(1)); g.setAttribute("y2", (y0 + len).toFixed(1)); }
    tearGlowEl.setAttribute("opacity",
  (
    state === "found"
      ? 0.65
      : 0.3 + (state === "scanning" ? 0.14 : 0)
  ).toFixed(2)
);
    if (!reduced && now >= tear.next) {
      tear.t0 = now;
      tear.dur = state === "scanning" ? rnd(900, 1300) : rnd(2000, 2800);
      tear.next = now + tear.dur + (state === "scanning" ? rnd(200, 700) : rnd(3500, 7000));
    }
    const p = (now - tear.t0) / tear.dur;
    if (p >= 0 && p < 1) {
      const e = p * p * (3 - 2 * p), t = 0.06 + e * 0.78;
      let hw = (wmax / 2) * tearProfile(t);

if (t < 0.12) {
  hw *= t / 0.12;
}      tearDrop.setAttribute("cx", cxAt(t).toFixed(1));
      tearDrop.setAttribute("cy", (y0 + t * len).toFixed(1));
      tearDrop.setAttribute("rx", Math.max(0.8, hw * 0.34).toFixed(2));
      tearDrop.setAttribute("ry", (9 + 9 * t).toFixed(1));
      tearDrop.setAttribute("opacity", (Math.sin(p * Math.PI) * 0.6).toFixed(3));
    } else {
      tearDrop.setAttribute("opacity", "0");
    }
  }

  const para = { x: 0, y: 0 };
  const breath = { phase: 0, freq: 0.0012, amp: 0.02 };

  let last = performance.now();
  const ease = (k, dt) => 1 - Math.pow(1 - k, dt / 16.67);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lidT = (s) => `translate(0 ${PIVOT}) scale(1 ${s.toFixed(4)}) translate(0 ${-PIVOT})`;

  function frame(now) {
    const dt = Math.min(64, now - last); last = now;
    const cfg = STATES[state];
    let tx = 0, ty = 0, k = 0.06;
    let lidTarget = cfg.lid, opTarget = cfg.opacity, glowTarget = cfg.glow, pupilTarget = cfg.pupil;
    const drift = reduced ? 0 : 1;

    if (state === "idle") {
      const typing = focused && now - lastKey < 1800;
      if (typing) {
        const len = input.value.length;
        tx = -70 + ((len * 9) % 140);
        ty = 44;
        lidTarget = 1.03; opTarget = .84; pupilTarget = .94; k = 0.1;
      } else if (focused) {
        tx = Math.sin(now * 0.0004) * 10 * drift; ty = 40; opTarget = .78; lidTarget = 1.02;
      } else {
        const m = delayedMouse(now);
        if (m) {
          const r = eyeSvg.getBoundingClientRect();
          const ex = r.left + r.width * (CX / 1000), ey = r.top + r.height * (CY / 480);
          tx = clamp((m.x - ex) / (innerWidth * 0.5), -1, 1) * 105;
          ty = clamp((m.y - ey) / (innerHeight * 0.55), -1, 1) * 52;
        }
        tx += (Math.sin(now * 0.00027) * 22 + Math.sin(now * 0.00061) * 8) * drift;
        ty += (Math.cos(now * 0.00033) * 10 + Math.sin(now * 0.00047) * 5) * drift;
        k = 0.035;
      }
    } else if (state === "scanning") {
      if (now >= scan.next) nextFixation(now);
      tx = scan.x + (Math.sin(now * 0.031) * 1.3 + Math.sin(now * 0.019) * 1.1) * drift;
      ty = scan.y + Math.cos(now * 0.027) * 1.1 * drift;
      lidTarget = scan.lid;
      pupilTarget = scan.pupil;
      glowTarget += Math.sin(now * 0.004) * 0.05;
    } else if (state === "found") {
      k = 0.16;
    } else if (state === "empty") {
      tx = -82; ty = 46; k = 0.04;
    } else if (state === "error") {
      ty = 12; k = 0.12;
    }

    if ((state === "idle" || state === "found") && now >= nextBlink && now - born > 2500) {
      blinkAt = now; nextBlink = now + 8000;
    }
    const bd = now - blinkAt;
    let blink = 1;
    if (bd < 90) blink = 1 - (bd / 90) * 0.94;
    else if (bd < 130) blink = 0.06;
    else if (bd < 300) blink = 0.06 + ((bd - 130) / 170) * 0.94;

    const opening = now - born < 2400;
    if (state === "scanning" && !reduced) {
      for (let s = dt; s > 0; s -= 16.67) {
        const f = Math.min(1, s / 16.67);
        vel.x += (tx - cur.x) * 0.2 * f; vel.y += (ty - cur.y) * 0.2 * f;
        vel.x *= Math.pow(0.58, f); vel.y *= Math.pow(0.58, f);
        cur.x += vel.x * f; cur.y += vel.y * f;
      }
    } else {
      cur.x += (tx - cur.x) * ease(k, dt);
      cur.y += (ty - cur.y) * ease(k, dt);
      vel.x = vel.y = 0;
    }

    if (state !== "scanning" && !reduced && now >= micro.next) {
      micro.tx = rnd(-5, 5); micro.ty = rnd(-3, 3);
      micro.next = now + rnd(900, 2600);
    }
    if (state === "scanning" || reduced) { micro.tx = 0; micro.ty = 0; }
    micro.x += (micro.tx - micro.x) * ease(0.35, dt);
    micro.y += (micro.ty - micro.y) * ease(0.35, dt);

    lidTarget *= 1 - clamp(cur.y, -60, 70) * 0.0013;
    cur.lid += (lidTarget - cur.lid) * ease(opening ? 0.022 : 0.09, dt);
    cur.opacity += (opTarget - cur.opacity) * ease(opening ? 0.02 : 0.05, dt);
    cur.glow += (glowTarget - cur.glow) * ease(0.05, dt);
    cur.pupil += (pupilTarget - cur.pupil) * ease(0.06, dt);
    cur.pupilX += (cur.x * 0.1 - cur.pupilX) * ease(0.08, dt);
    cur.pupilY += (cur.y * 0.1 - cur.pupilY) * ease(0.08, dt);
    glowFlash *= Math.pow(0.94, dt / 16.67);

    let irisS = 1;
    const fd = now - foundAt;
    if (fd < 550) irisS = 1 + Math.sin((fd / 550) * Math.PI) * 0.05;

    const lt = lidT(cur.lid * blink);
    lidsBack.setAttribute("transform", lt);
    lidsFront.setAttribute("transform", lt);
    clipShape.setAttribute("transform", lt);
    shadow.setAttribute("transform", lt);

    const move = `translate(${(CX + cur.x + micro.x).toFixed(2)} ${(CY + cur.y + micro.y).toFixed(2)})`;
    irisMove.setAttribute("transform", move);
    glowMove.setAttribute("transform", move);
    irisScale.setAttribute("transform", `scale(${irisS.toFixed(4)})`);
    const breathFreq = state === "scanning" ? 0.0042 : 0.0012;
    const breathAmp = reduced || state === "found" ? 0 : state === "scanning" ? 0.024 : 0.02;
    breath.freq += (breathFreq - breath.freq) * ease(0.03, dt);
    breath.amp += (breathAmp - breath.amp) * ease(state === "found" ? 0.14 : 0.04, dt);
    breath.phase += dt * breath.freq;
    const breathWave = Math.sin(breath.phase);
    const pupilS = cur.pupil * (1 + breathWave * breath.amp);
    pupilMove.setAttribute("transform", `translate(${cur.pupilX.toFixed(2)} ${cur.pupilY.toFixed(2)}) scale(${pupilS.toFixed(4)})`);

    let pxT = 0, pyT = 0;
    const lastSample = samples[samples.length - 1];
    if (!reduced && lastSample) {
      pxT = clamp((lastSample.x / innerWidth) * 2 - 1, -1, 1) * 9;
      pyT = clamp((lastSample.y / innerHeight) * 2 - 1, -1, 1) * 6;
    }
    para.x += (pxT - para.x) * ease(0.035, dt);
    para.y += (pyT - para.y) * ease(0.035, dt);
    eyeSvg.style.transform = `translate3d(${para.x.toFixed(2)}px, ${para.y.toFixed(2)}px, 0)`;
    updateDust(now, dt, para.x, para.y, breathWave * (breath.amp / 0.02));
    updateTear(now, dt, cur.lid * blink, breathWave * (breath.amp / 0.02));
    glow.setAttribute("opacity", Math.max(0, cur.glow + glowFlash).toFixed(3));
    scene.style.opacity = cur.opacity.toFixed(3);

    const scanning = state === "scanning";
    hotColor = state === "error" ? "#ff8a8a" : "#7dffae";
    if (!reduced) {
      const rate = scanning ? 20 : state === "empty" ? 1600 : state === "error" ? 900 : 420;
      if (Math.random() < dt / rate) spawnSignal(now);
      if (scanning && Math.random() < dt / 40) spawnSignal(now, { bright: 1, dur: rnd(300, 600) });

      for (let i = 0; i < 3; i++) {
        if (scanning) groupRot[i] += groupSpin[i] * dt;
        const sway = Math.sin(now * 0.00045 + i * 2.1) * 1.4 + Math.sin(now * 0.0011 + i) * 0.5;
        fiberGroups[i].setAttribute("transform", `rotate(${(groupRot[i] + sway).toFixed(2)})`);
      }

      sweepAngle += dt * (scanning ? 0.0068 : 0.0009);
      sweepOp += ((scanning ? 0.55 : 0) - sweepOp) * ease(0.06, dt);
      sweepA.setAttribute("transform", `rotate(${(sweepAngle * 57.2958).toFixed(1)})`);
      sweepB.setAttribute("transform", `rotate(${(-sweepAngle * 1.6 * 57.2958).toFixed(1)})`);
      sweepA.setAttribute("opacity", sweepOp.toFixed(3));
      sweepB.setAttribute("opacity", (sweepOp * 0.7).toFixed(3));

      if (scanning) {
        for (const f of fiberList) {
          const fa = f.a + (groupRot[f.g] * Math.PI) / 180;
          let d = Math.abs(((fa - sweepAngle) % TAU + TAU) % TAU);
          d = Math.min(d, TAU - d);
          if (d < 0.07) excite(f, 0.35);
        }
        if (Math.random() < dt / 30) excite(fiberList[(Math.random() * FIBERS) | 0], 0.8);
      } else if (Math.random() < dt / 260) {
        excite(fiberList[(Math.random() * FIBERS) | 0], 0.35);
      }
    }

    const decay = Math.pow(scanning ? 0.9 : 0.94, dt / 16.67);
    for (const f of active) {
      f.e *= decay;
      if (f.e < 0.02) {
        f.e = 0; f.el.setAttribute("stroke", f.stroke); f.el.setAttribute("stroke-opacity", f.base.toFixed(2)); active.delete(f);
      } else {
        f.el.setAttribute("stroke-opacity", (f.base + f.e * (0.9 - f.base)).toFixed(3));
      }
    }
    updateSignals(now);

    const markH = scanning ? 4.4 + Math.sin(now * 0.009) * 1.6 : state === "found" ? 7.6 : state === "error" ? 2.6 : state === "empty" ? 7.2 : 6.2 + Math.sin(now * 0.0012) * 0.4;
    mark.h += (markH - mark.h) * ease(0.1, dt);
    mark.rot = 0.35 - mark.h * 0.06;
    drawMark(mark.h, mark.rot);
    mark.spin += dt * (scanning ? 0.36 : 0.02);
    mark.orbitOp += ((scanning ? 0.9 : 0) - mark.orbitOp) * ease(0.08, dt);
    markOrbit.setAttribute("transform", `rotate(${mark.spin.toFixed(1)})`);
    markOrbitArc.setAttribute("opacity", mark.orbitOp.toFixed(3));
    markCoreDot.setAttribute("opacity", (state === "found" ? 0.95 : scanning ? 0.6 + Math.sin(now * 0.012) * 0.3 : 0.35).toFixed(3));
    markCoreDot.setAttribute("fill", state === "error" ? "#f87171" : "url(#markCore)");

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const tick = () => { const d = new Date(); $("clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  tick(); setInterval(tick, 1000);

  let timerStart = 0, timerRaf = 0;
  const fmtTimer = (ms) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms % 1000), 3)}`;
  function runTimer() { timerEl.textContent = fmtTimer(performance.now() - timerStart); timerRaf = requestAnimationFrame(runTimer); }

  const stamp = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`; };
  function log(msg, cls) {
    const p = document.createElement("p");
    const t = document.createElement("time"); t.textContent = stamp();
    const s = document.createElement("span"); s.textContent = msg; if (cls) s.className = cls;
    p.append(t, s); logEl.appendChild(p);
    while (logEl.children.length > 14) logEl.firstElementChild.remove();
  }


  // ---------- demo-режим: работает без бэкенда, все данные вымышленные ----------
  const DEMO = !!(window.FARCIPAL && window.FARCIPAL.demo);
  if (DEMO) { const sub = document.querySelector(".brand-sub"); if (sub) sub.textContent = "eye · demo"; }
  const demoDb = { id: 0, sessions: {}, history: ["Иванов Иван 1990 Москва", "demo_user", "test@example.com"] };
  const hash36 = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h).toString(36); };
  const demoCand = (src, title, score, evidence) => ({
    source: src, url: `https://example.com/demo/${src}/${hash36(title + src)}`, title, score,
    label: score >= 80 ? "высокая" : score >= 55 ? "средняя" : "низкая", links: [], evidence,
  });
  function demoResult(raw) {
    const t = raw.trim();
    if (/ошибк|error|fail/i.test(t)) return { type: "error", text: "Ошибка: демонстрационный сбой источника" };
    if (t.includes("@")) return { type: "text", text: `📧 Email: ${t}\n\n✅ Регистрации (3):\n• example.com\n• demo.example.org\n• sample.example.net\n\nℹ️ HIBP: ключ не задан (демо)` };
    if (!/\s/.test(t)) return { type: "text", text: `👤 Демо-профиль · https://example.com/demo/profile/${hash36(t)}\nДР: 16.4\n🔒 профиль закрыт\n\n🔎 Аккаунтов с таким ником: 2 (совпадение ника не доказывает, что это один человек)\nhttps://example.com/demo/a/${hash36(t)}\nhttps://example.com/demo/b/${hash36(t)}` };
    const words = t.split(/\s+/), name = words.slice(0, 2).join(" ");
    const year = (t.match(/\b(?:19|20)\d{2}\b/) || [])[0];
    const city = words.slice(2).filter((w) => !/^(?:\d{1,2}\.\d{1,2}\.)?(?:19|20)\d{2}$/.test(w) && !/(ович|евич|овна|евна|ична)$/i.test(w)).join(" ");
    const notes = ["ℹ️ Demo-режим: все данные вымышленные, ссылки ведут на example.com."];
    if (/пуст|empty|nothing/i.test(t)) return { type: "person", query: name, year: year || null, city, vk: [], tg: [], web: [], vk_name_matches: 0, need_context: !(year || city), notes };
    const ev = [["✓", "ФИО совпало", 40]];
    if (year) ev.push(["✓", `год рождения ${year}`, 35]);
    if (city) ev.push(["✓", `город ${city}`, 25]);
    const vk = demoCand("vk", name, Math.min(100, ev.reduce((a, e) => a + e[2], 0) + 10), [...ev, ["✓", "тот же логин в Telegram", 10], ["~", "тот же ник на других площадках — не подтверждено", 0]]);
    const tg = demoCand("tg", name, 75, [["✓", "ФИО совпало", 40], ["✓", city ? `в био упомянут ${city}` : "логин похож на ФИО", 20], ["✓", "тот же логин, что у VK-кандидата", 15]]);
    const web = demoCand("web", `${name} · открытый реестр`, 60, [["✓", "ФИО в тексте", 40], ["✓", "открытый реестр", 20]]);
    [vk, tg, web].forEach((c) => (c.evidence = c.evidence.map(([mark, text, pts]) => ({ mark, text, pts }))));
    return { type: "person", query: name, year: year || null, city, vk: [vk], tg: [tg], web: [web], vk_name_matches: 4, need_context: !(year || city), notes };
  }
  async function demoApi(path, opts) {
    await new Promise((r) => setTimeout(r, 120));
    if (path.startsWith("/history")) return demoDb.history.map((query) => ({ query }));
    if (path === "/search") {
      const q = JSON.parse(opts.body).query, id = ++demoDb.id;
      demoDb.sessions[id] = { q, t0: Date.now() };
      demoDb.history = [q, ...demoDb.history.filter((x) => x !== q)].slice(0, 24);
      return { id };
    }
    const m = path.match(/^\/result\/(\d+)/);
    if (m) {
      const s = demoDb.sessions[m[1]], el = (Date.now() - s.t0) / 1000, full = demoResult(s.q), person = full.type === "person";
      const steps = person
        ? [[0.9, "VK: готово"], [1.6, "Веб: готово"], [2.2, "Telegram: готово"], [2.5, "Сканеры: проверяю логины…"], [3.3, "Сканеры: готово"]]
        : [[1.2, "запрос выполнен"]];
      const progress = steps.filter(([t]) => el >= t).map(([, msg]) => msg);
      if (el >= (person ? 3.5 : 1.8)) return { id: +m[1], status: "done", duration: el, progress, result: full };
      const partial = person && el >= 1.0 ? { vk: full.vk, ...(el >= 2.3 ? { tg: full.tg, web: full.web } : {}) } : {};
      return { id: +m[1], status: "running", progress, partial };
    }
    throw new Error("demo: неизвестный путь " + path);
  }

  // ---------- API ----------
  async function api(path, opts = {}) {
    if (DEMO) return demoApi(path, opts);
    const res = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      setTimeout(() => location.reload(), 150);
      throw new Error("401 · нужен вход, перезагрузка…");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${t ? " · " + t.slice(0, 120) : ""}`);
    }
    return res.json();
  }

  // ---------- история ----------
  const historyList = [];
  function renderHistoryChips() {
    historyEl.replaceChildren(...historyList.map((h) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = h; b.title = h;
      b.addEventListener("click", () => { if (btn.disabled) return; input.value = h; search(h); });
      return b;
    }));
  }
  function pushHistory(q) {
    const i = historyList.indexOf(q); if (i !== -1) historyList.splice(i, 1);
    historyList.unshift(q); if (historyList.length > 8) historyList.pop();
    renderHistoryChips();
  }
  async function loadHistory() {
    try {
      const rows = await api("/history?limit=24");
      if (!Array.isArray(rows)) return;
      historyList.length = 0;
      rows.forEach((r) => { if (r && r.query && !historyList.includes(r.query) && historyList.length < 8) historyList.push(r.query); });
      renderHistoryChips();
    } catch { /* история не критична */ }
  }

  // ---------- отрисовка результатов (всё, что пришло из сети, только через textContent) ----------
  function safeHref(u) {
    u = String(u || "").trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(u)) return "https://" + u;
    return "";
  }
  function linkLabel(u) {
    try {
      const url = new URL(u, location.origin);
      const path = url.pathname.replace(/^\/+|\/+$/g, "");
      return path || url.hostname.replace(/^www\./, "");
    } catch { return "ссылка"; }
  }
  const SOURCE_LABEL = { vk: "VK", tg: "Telegram", web: "Веб" };
  const SOURCE_COLOR = { vk: "#a5b4fc", tg: "#7dd3fc", web: "#c4b5fd" };

  function countUp(el, to, dur, delay) {
    const start = performance.now() + delay;
    const step = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function chipLink(href, label, title) {
    const a = document.createElement("a");
    a.className = "link-chip"; a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = label; if (title) a.title = title;
    return a;
  }

  function buildCard(c, idx) {
    const score = Math.max(0, Math.min(100, Math.round(c.score || 0)));
    const a = document.createElement("article");
    a.className = "card";
    a.style.setProperty("--c", SOURCE_COLOR[c.__src] || "#a5b4fc");
    a.style.animationDelay = `${idx * 100}ms`;

    const h = document.createElement("h3");
    h.textContent = c.title || c.url || "—";

    const pct = document.createElement("div");
    pct.className = "pct " + (score >= 80 ? "hi" : score >= 55 ? "mid" : "lo");
    const num = document.createElement("span"); num.textContent = "0";
    const pc = document.createElement("small"); pc.textContent = "%";
    pct.append(num, pc);

    const u = document.createElement("div");
    u.className = "url"; u.textContent = c.url || "";

    const meta = document.createElement("div");
    meta.className = "meta";
    const srcTag = document.createElement("span");
    srcTag.className = "tag"; srcTag.textContent = SOURCE_LABEL[c.__src] || c.__src || "";
    meta.appendChild(srcTag);
    if (c.label) {
      const lbl = document.createElement("span");
      lbl.className = "tag"; lbl.textContent = c.label;
      meta.appendChild(lbl);
    }
    const sep = document.createElement("span"); sep.className = "sep"; meta.appendChild(sep);
    const href = safeHref(c.url);
    if (href) meta.appendChild(chipLink(href, "открыть"));
    (c.links || []).slice(0, 3).forEach((l) => {
      const ll = safeHref(l);
      if (ll) meta.appendChild(chipLink(ll, linkLabel(ll), l));
    });

    a.append(h, pct, u, meta);

    if (c.evidence?.length) {
      const ev = document.createElement("div");
      ev.className = "ev";
      c.evidence.forEach((e) => {
        const row = document.createElement("div");
        const m = document.createElement("span"); m.className = "m"; m.textContent = e.mark || "·";
        const t = document.createElement("span"); t.textContent = e.text || "";
        row.append(m, t);
        if (e.pts) {
          const p = document.createElement("span"); p.className = "p";
          p.textContent = (e.pts > 0 ? "+" : "") + e.pts;
          row.appendChild(p);
        }
        ev.appendChild(row);
      });
      a.appendChild(ev);
    }

    countUp(num, score, 900, idx * 100);
    return a;
  }

  function notice(text, cls) {
    const n = document.createElement("div");
    n.className = "notice" + (cls ? " " + cls : "");
    n.textContent = text;
    return n;
  }

  function renderPerson(result, preliminary) {
    const flat = [];
    ["vk", "tg", "web"].forEach((k) => (result[k] || []).forEach((c) => flat.push({ ...c, __src: k })));
    const nodes = [];
    if (preliminary) {
      nodes.push(notice("Предварительные результаты — идёт сверка и склейка…", "dim"));
    } else if (result.need_context) {
      nodes.push(notice(`Без года рождения или города точность низкая (в VK не меньше ${result.vk_name_matches} профилей с таким ФИО). Добавьте уточнение, например «${result.query} 16.04.1990 Москва».`));
    }
    nodes.push(...flat.map((c, i) => buildCard(c, i)));
    if (!preliminary) (result.notes || []).forEach((n) => nodes.push(notice(n, "dim")));
    cardsEl.replaceChildren(...nodes);
  }

  function linkify(pre, text) {
    String(text || "").split(/(https?:\/\/[^\s<>"']+)/g).forEach((part, i) => {
      if (i % 2 === 1 && safeHref(part)) {
        const a = document.createElement("a");
        a.href = part; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = part;
        pre.appendChild(a);
      } else {
        pre.appendChild(document.createTextNode(part));
      }
    });
  }
  function renderText(text) {
    const a = document.createElement("article");
    a.className = "card";
    a.style.setProperty("--c", "#a5b4fc");
    const h = document.createElement("h3"); h.textContent = "ответ";
    const pre = document.createElement("pre");
    linkify(pre, text);
    a.append(h, pre);
    cardsEl.replaceChildren(a);
  }
  const textHasData = (t) => /(https?:\/\/|👤|✅|🔥|📧.*\n.*•)/.test(t || "");

  function placeholder(text) {
    const p = document.createElement("p"); p.className = "placeholder"; p.textContent = text;
    cardsEl.replaceChildren(p);
  }

  // ---------- поиск ----------
  let timers = [];
  let searching = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function search(raw) {
    const q = raw.trim();
    if (!q || searching) { if (!q) { input.focus(); lastKey = performance.now(); } return; }

    timers.forEach(clearTimeout); timers = [];
    cancelAnimationFrame(timerRaf);
    searching = true;
    pushHistory(q);
    btn.disabled = true;
    input.blur();

    setState("scanning");
    scan.queue.length = 0; scan.x = cur.x; scan.y = cur.y; scan.next = performance.now() + 260;
    progress.className = "progress on";
    timerStart = performance.now(); runTimer();
    logEl.replaceChildren();
    log(`запрос «${q.length > 24 ? q.slice(0, 24) + "…" : q}»`);

    try {
      const created = await api("/search", { method: "POST", body: JSON.stringify({ query: q }) });
      log(`сессия #${created.id}`, "ok");
      await pollResult(created.id, q);
    } catch (err) {
      finishWith("error", null, q, String(err.message || err));
    } finally {
      searching = false;
      btn.disabled = false;
    }
  }

  async function pollResult(sid, q) {
    let seenProgress = 0, failures = 0, lastPartial = "";
    while (true) {
      await sleep(800);
      let data;
      try {
        data = await api("/result/" + sid);
        failures = 0;
      } catch (err) {
        if (++failures >= 4) throw err;
        continue;
      }
      const prog = data.progress || [];
      for (let i = seenProgress; i < prog.length; i++) log(prog[i], /готово/.test(prog[i]) ? "ok" : "");
      seenProgress = prog.length;

      if (data.status === "done" || data.status === "error") {
        finishWith(data.status, data.result, q, null, data.duration);
        return;
      }
      // промежуточные результаты: модули заканчивают в разное время
      const part = data.partial || {};
      const n = (part.vk || []).length + (part.tg || []).length + (part.web || []).length;
      const key = JSON.stringify(part);
      if (n > 0 && key !== lastPartial) {
        lastPartial = key;
        renderPerson(part, true);
        spawnRing(0);
      }
    }
  }

  function finishWith(status, result, q, errText, duration) {
    cancelAnimationFrame(timerRaf);
    const ms = duration != null ? duration * 1000 : (performance.now() - timerStart);
    timerEl.textContent = fmtTimer(ms);

    if (status === "error" || result?.type === "error") {
      const msg = result?.text || errText || "неизвестная ошибка";
      log(msg, "err");
      progress.className = "progress";
      placeholder("Взгляд сорвался. " + msg);
      setState("error");
      return;
    }

    if (result?.type === "text") {
      const has = textHasData(result.text);
      progress.className = has ? "progress done" : "progress";
      if (has) timers.push(setTimeout(() => (progress.className = "progress"), 1400));
      log(has ? "текстовый ответ" : "следов нет", has ? "ok" : "");
      renderText(result.text || "");
      setState(has ? "found" : "empty");
      return;
    }

    if (result?.type === "person") {
      const vk = result.vk || [], tg = result.tg || [], web = result.web || [];
      const total = vk.length + tg.length + web.length;
      (result.notes || []).forEach((n) => log(n));

      if (total === 0) {
        progress.className = "progress";
        log("следов нет");
        const nodes = [notice(result.need_context
          ? "Мало контекста — добавьте год рождения или город."
          : "Он смотрел внимательно. Здесь ничего нет.", result.need_context ? "" : "dim")];
        (result.notes || []).forEach((n) => nodes.push(notice(n, "dim")));
        cardsEl.replaceChildren(...nodes);
        setState("empty");
        return;
      }

      progress.className = "progress done";
      timers.push(setTimeout(() => (progress.className = "progress"), 1400));
      log(`найдено · ${total} след${total === 1 ? "" : total < 5 ? "а" : "ов"}`, "ok");
      renderPerson(result, false);
      setState("found");
      return;
    }

    progress.className = "progress";
    placeholder("Неизвестный формат ответа.");
    setState("empty");
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); if (!btn.disabled) search(input.value); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.preventDefault(); });
  input.addEventListener("input", () => {
    lastKey = performance.now();
    if (state !== "idle" && state !== "scanning") {
      setState("idle");
      timerEl.textContent = "00:00.000";
    }
  });
  input.addEventListener("focus", () => { focused = true; });
  input.addEventListener("blur", () => { focused = false; });
  scene.addEventListener("animationend", (e) => {
    if (e.animationName === "foundFlash") scene.classList.remove("flash");
  });
  loadHistory();
})();
