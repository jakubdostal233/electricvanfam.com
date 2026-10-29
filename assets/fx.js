/* Electric Van Fam - creative layer. Plain JS, no dependencies, no build.

   Loaded after site.js on every page. It draws a canvas into each element
   with data-fx: aria-hidden, no pointer events, no preventDefault. Without JS
   the page is as it was.
   - one field of electric symbols for the whole page: every element shows
     the same slowly drifting noise at its place on the page, on one grid
     aligned to the page's top left corner, with one cell size and one clock,
     so the header's pattern runs on into the photo's
   - data-fx="field" (home hero): the field, dimmed behind the text; no
     colour layer
   - data-fx="header" (every page): the field, none on the title image, the
     menu links, the pickers and the social icons, over three flowing blobs
     of colour; still while the title strip is scrolled away
   - data-fx="band" (under the header: the title band, the van page's top):
     the field run on from the header, none on the text (headings and
     paragraphs by the box of their words, buttons), fading out over the
     band's lower third; opaque content such as a photo covers it itself;
     the header's blobs reach into it at half their opacity, clear at its top
     and bottom edges; its state follows the header's
   - heat: a fine pointer's path warms the field like a vapour trail, narrow
     and strong at the pointer, wider and fainter behind it; a click makes it
     bloom; both light the field's own cells, then fade back to the field
   - colours: --fx-* on the element (site.css, "creative layer"), any CSS
     colour syntax, read again on a theme change
   - reduced motion: one still frame, no heat
   - data-fx-state on the element: running, paused or static; data-fx-stuck
     on the header: true while its title strip is scrolled away
   Remove it: delete data-fx from an element, or delete the fx.js script line
   from every page and run site/tools/check-page-parity.py. */
(function () {
  "use strict";

  var els = document.querySelectorAll("[data-fx]");
  if (!els.length || !window.requestAnimationFrame) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(pointer: fine)");
  var darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  /* ---- tuning ---- */
  var LEVELS = [0.45, 0.58, 0.7, 0.8, 0.94]; // intensity where each level starts
  var NOISE_SCALE = 170; // px per noise cell, first octave
  var DRIFT_X = 16, DRIFT_Y = -12; // px/s
  var MORPH = 8; // s: the pattern changes shape over about 8 s
  // Blobs: period across the width (s); size, bob and centre height as shares
  // of the element; centre height and opacity on a light and a dark background.
  var BLOB = { T: [36, 46, 58], w: 0.4, h: 1.2, bob: 0.06, y: [0.3, 0.36], a: [0.45, 0.6] };
  // The band's blobs: opacity a share of the header's, reaching down to reach
  // of the band's height; the page's colour covers them at the top, clear from
  // clear[0] to clear[1] of the height, back to full at the bottom.
  var UNDER = { a: 0.5, reach: 0.8, clear: [30, 45] };
  // Heat, added to the field's intensity. A trail point every step px of a
  // fine pointer's path: radius r0 to r1 px as (age / life)^0.6, strength s to
  // 0 as (1 - age / life)^1.5; the oldest go above max. A click's bloom: radius
  // 0 to r px over grow s (ease-out), strength 0 to s over rise s and back to 0
  // by life s; the oldest go above max.
  var TRAIL = { step: 8, r0: 10, r1: 70, s: 0.85, life: 1.6, max: 200 };
  var BLOOM = { r: 140, grow: 1.2, s: 0.7, rise: 0.3, life: 2.6, max: 6 };
  var JUMP = 200; // px: a longer move between two events starts a new path
  // The header's content, where its field is none; full MARGIN px away.
  var CONTENT = ".brand img, .site-nav > ul > li > a, .picker, .icon-link, .menu-toggle";
  var MARGIN = 12;
  // The band's text and button, where its field is none; full TEXT_MARGIN px away.
  var TEXT = "h1, p, .btn", TEXT_MARGIN = 32;
  var STILL_T = 12; // s: the moment the reduced-motion frame shows
  var IGNORE = "a, button, input, select, textarea, label, summary, [role='button']";
  var TAU = 6.283185;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { return v * v * (3 - 2 * v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---- colours: any CSS colour, normalised by a 2D context to #rrggbb or
     rgba(); one it keeps as written (oklch()) is painted and read back ---- */
  var dot = document.createElement("canvas");
  dot = dot.getContext && dot.getContext("2d", { willReadFrequently: true });
  function rgb(v, fallback) {
    dot.fillStyle = fallback;
    dot.fillStyle = (v || "").trim();
    var s = dot.fillStyle, m = /^#(\w\w)(\w\w)(\w\w)$/.exec(s) || /^rgba?\((\d+), (\d+), (\d+)/.exec(s);
    if (m) return [1, 2, 3].map(function (i) { return parseInt(m[i], s[0] === "#" ? 16 : 10); });
    dot.clearRect(0, 0, 1, 1);
    dot.fillRect(0, 0, 1, 1);
    var d = dot.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  // Reads the element's colours; true when they differ from the last read.
  function readColours(fx) {
    var s = getComputedStyle(fx.el), old = fx.key, bg = fx.bg = rgb(s.getPropertyValue("--bg"), "#000");
    fx.ink = rgb(s.getPropertyValue("--fx-ink"), "#7cc8ff");
    fx.glows = fx.mode.glows.map(function (name) { return rgb(s.getPropertyValue(name), "#1f8fff"); });
    fx.dark = bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11 < 128;
    fx.key = [fx.ink, bg].concat(fx.glows).join(" ");
    return fx.key !== old;
  }

  /* ---- noise: 3D value noise (x, y, time), two octaves ---- */
  function hash(x, y, z) {
    var h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x6c8e9cf5);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }
  function noise(x, y, z) {
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    var u = smooth(x - X), v = smooth(y - Y), w = smooth(z - Z);
    var a = lerp(hash(X, Y, Z), hash(X + 1, Y, Z), u);
    var b = lerp(hash(X, Y + 1, Z), hash(X + 1, Y + 1, Z), u);
    var c = lerp(hash(X, Y, Z + 1), hash(X + 1, Y, Z + 1), u);
    var d = lerp(hash(X, Y + 1, Z + 1), hash(X + 1, Y + 1, Z + 1), u);
    return lerp(lerp(a, b, v), lerp(c, d, v), w);
  }
  // At a point of the page: about a third of the cells reach the first level,
  // 0.35 % the bolt.
  function field(x, y, t) {
    var s = NOISE_SCALE, z = t / MORPH;
    x -= t * DRIFT_X; y -= t * DRIFT_Y;
    var n = noise(x / s, y / s, z) + 0.5 * noise(x * 2 / s + 31.7, y * 2 / s - 17.3, z * 1.6 + 5);
    return (n / 1.5 - 0.325) / 0.55;
  }

  /* ---- symbols, drawn once per colour into small bitmaps of one cell ----
     Kinds in a 24-unit box: 0 small dot, 1 dot, 2 plus, 3 larger plus, 4 bolt
     (#i-bolt), 5 minus, 6 larger minus. A bitmap: a canvas source costs a
     snapshot on every drawImage. */
  var BOLT = "M13.5 1.5 3.8 13.6h6.6l-1.6 8.9 10-12.6h-6.7z";
  var off = window.OffscreenCanvas && new OffscreenCanvas(1, 1).getContext("2d");
  function drawSymbol(c, kind) {
    if (kind < 2) {
      c.beginPath(); c.arc(12, 12, kind ? 3 : 2, 0, TAU); c.fill();
    } else if (kind === 4) {
      c.translate(12, 12); c.scale(0.9, 0.9); c.translate(-12, -12);
      c.fill(new Path2D(BOLT));
    } else {
      var big = kind === 3 || kind === 6, a = big ? 7 : 5, b = big ? 1.4 : 1.1;
      c.fillRect(12 - a, 12 - b, 2 * a, 2 * b);
      if (kind < 4) c.fillRect(12 - b, 12 - a, 2 * b, 2 * a);
    }
  }
  // fx.grid[kind] in --fx-ink
  function build(fx) {
    var size = Math.round(fx.cell * fx.ratio);
    fx.grid = [0, 1, 2, 3, 4, 5, 6].map(function (kind) {
      var s = off ? new OffscreenCanvas(size, size) : document.createElement("canvas");
      s.width = s.height = size;
      var c = s.getContext("2d");
      c.scale(size / 24, size / 24);
      c.fillStyle = rgba(fx.ink, 1);
      drawSymbol(c, kind);
      return off ? s.transferToImageBitmap() : s;
    });
  }

  /* ---- modes ----
     layout(fx) sets per cell fx.weight, the share of the field (and of the
     heat) it shows; alpha caps a symbol's opacity; glows names the blobs'
     colours; strip stills the layer when off screen; under: the blobs are the
     header's. */
  // Weight: none inside the boxes of the element's sel, full m px outside
  // them, so the field flows around the content and the text keeps its
  // contrast; a heading or a paragraph by the box of its words.
  var words = document.createRange();
  function around(fx, sel, m) {
    var box = fx.el.getBoundingClientRect(), qs = [];
    fx.el.querySelectorAll(sel).forEach(function (n) {
      var t = n.matches("h1, p");
      if (t) words.selectNodeContents(n);
      var q = (t ? words : n).getBoundingClientRect();
      if (q.width && q.bottom > box.top && q.top < box.bottom) qs.push(q);
    });
    for (var k = 0; k < fx.n; k++) {
      var x = fx.px[k] + box.left, y = fx.py[k] + box.top, d = m;
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i], dx = Math.max(q.left - x, 0, x - q.right), dy = Math.max(q.top - y, 0, y - q.bottom);
        d = Math.min(d, Math.sqrt(dx * dx + dy * dy));
      }
      fx.weight[k] = smooth(d / m);
    }
  }
  var MODES = {
    field: {
      glows: [], alpha: 0.55,
      // Dim the field in an ellipse around the text (0.3 at its centre, 1 at the
      // edges) and strengthen it a little along the bottom edge.
      layout: function (fx) {
        var box = fx.el.getBoundingClientRect(), l = 1e9, t = 1e9, r = -1e9, b = -1e9;
        fx.el.querySelectorAll("h1, p").forEach(function (n) {
          var q = n.getBoundingClientRect();
          if (!q.width) return;
          l = Math.min(l, q.left); t = Math.min(t, q.top);
          r = Math.max(r, q.right); b = Math.max(b, q.bottom);
        });
        var cx = fx.w / 2, cy = fx.h / 2, rx = fx.w / 4, ry = fx.h / 4;
        if (r > l) {
          cx = (l + r) / 2 - box.left; cy = (t + b) / 2 - box.top;
          rx = (r - l) * 0.58 + 40; ry = (b - t) * 0.55 + 30;
        }
        for (var k = 0; k < fx.n; k++) {
          var dx = (fx.px[k] - cx) / rx, dy = (fx.py[k] - cy) / ry;
          var m = 0.3 + 0.7 * smooth(clamp((Math.sqrt(dx * dx + dy * dy) - 0.55) / 0.7));
          fx.weight[k] = m * (1 + 0.3 * smooth(clamp((fx.py[k] / fx.h - 0.8) / 0.2)));
        }
      }
    },
    header: {
      glows: ["--fx-c1", "--fx-c2", "--fx-c3"], alpha: 0.45, strip: ".header-top",
      layout: function (fx) { around(fx, CONTENT, MARGIN); }
    },
    band: {
      glows: ["--fx-c1", "--fx-c2", "--fx-c3"], alpha: 0.45, strip: ".header-top", under: 1,
      // Around the text, and fading out over the lower third.
      layout: function (fx) {
        around(fx, TEXT, TEXT_MARGIN);
        for (var k = 0; k < fx.n; k++) fx.weight[k] *= smooth(clamp(3 - 3 * fx.py[k] / fx.h));
      }
    }
  };

  /* ---- colour layer: soft elliptical blobs as the canvas's CSS background;
     blob i crosses the width and back in BLOB.T[i] s and bobs a little; the
     band's are the header's, at their place on the page ---- */
  var head = null;
  function drawGlows(fx, t) {
    var g = fx.mode.under ? head : fx;
    if (!g || !g.n) return;
    var w = g.w, h = g.h, d = fx.dark ? 1 : 0, a = BLOB.a[d] * (g === fx ? 1 : UNDER.a);
    var ox = g.ox - fx.ox, oy = g.oy - fx.oy, bg = fx.bg, c = UNDER.clear;
    var layers = fx.glows.map(function (col, i) {
      var p = TAU * t / BLOB.T[i] + 2.1 * i, y = oy + h * (BLOB.y[d] + BLOB.bob * Math.sin(1.7 * p + i));
      return "radial-gradient(ellipse " + Math.round(w * BLOB.w / 2) + "px " +
        Math.round(g === fx ? h * BLOB.h / 2 : fx.h * UNDER.reach - y) + "px at " +
        (ox + w * (0.5 + 0.46 * Math.sin(p))).toFixed(1) + "px " + y.toFixed(1) + "px," +
        rgba(col, a) + "," + rgba(col, a * 0.45) + " 45%," + rgba(col, 0) + ")";
    });
    if (g !== fx) layers.unshift("linear-gradient(" + rgba(bg, 1) + "," + rgba(bg, 0) + " " + c[0] + "%," +
      rgba(bg, 0) + " " + c[1] + "%," + rgba(bg, 1) + ")");
    fx.canvas.style.backgroundImage = layers.join(",");
  }

  /* ---- heat: trail points and blooms at their place on the page; a cell
     takes the strongest source over it: all of its strength out to 0.63 of
     its radius, then a smooth fall to none at the radius ---- */
  var trail = [], blooms = [];
  function warm(fx, x, y, r, s) {
    if (!(s > 0 && r > 0)) return;
    x -= fx.ox; y -= fx.oy;
    var cell = fx.cell, rr = r * r, cols = fx.cols, hv = fx.heat;
    var c0 = Math.max(0, Math.ceil((x - r - fx.x0) / cell)), c1 = Math.min(cols - 1, Math.floor((x + r - fx.x0) / cell));
    var r0 = Math.max(0, Math.ceil((y - r - fx.y0) / cell)), r1 = Math.min(fx.rows - 1, Math.floor((y + r - fx.y0) / cell));
    for (var row = r0; row <= r1; row++) {
      var dy = fx.y0 + row * cell - y;
      for (var col = c0; col <= c1; col++) {
        var dx = fx.x0 + col * cell - x, q = 1 - (dx * dx + dy * dy) / rr, k = row * cols + col;
        if (q <= 0) continue;
        q = s * smooth(q > 0.6 ? 1 : q / 0.6);
        if (q > hv[k]) { hv[k] = q; fx.hot = 1; }
      }
    }
  }
  function heatUp(fx, t) {
    trail.forEach(function (p) {
      var u = (t - p.t) / TRAIL.life;
      warm(fx, p.x, p.y, TRAIL.r0 + (TRAIL.r1 - TRAIL.r0) * Math.pow(u, 0.6), TRAIL.s * Math.pow(1 - u, 1.5));
    });
    blooms.forEach(function (b) {
      var a = t - b.t, g = 1 - Math.min(1, a / BLOOM.grow);
      warm(fx, b.x, b.y, BLOOM.r * (1 - g * g * g), BLOOM.s * (a < BLOOM.rise ? smooth(a / BLOOM.rise) :
        1 - smooth(clamp((a - BLOOM.rise) / (BLOOM.life - BLOOM.rise)))));
    });
  }

  /* ---- grid: one symbol per cell, chosen by the field plus the heat ----
     Levels: small dot, dot, plus or minus, larger plus or minus, bolt. */
  function drawGrid(fx, t) {
    var c = fx.ctx, cell = fx.cell, half = cell / 2, sp = fx.grid, top = fx.mode.alpha;
    for (var k = 0; k < fx.n; k++) {
      var m = fx.weight[k];
      if (!m) continue;
      var x = fx.px[k], y = fx.py[k], v = (field(x + fx.ox, y + fx.oy, t) + fx.heat[k]) * m;
      if (v < LEVELS[0]) continue;
      var lv = 0;
      while (lv < 4 && v >= LEVELS[lv + 1]) lv++;
      if (fx.minus[k] && (lv === 2 || lv === 3)) lv += 3;
      c.globalAlpha = Math.min(top, 0.2 + (v - LEVELS[0]) * 0.75);
      c.drawImage(sp[lv], x - half, y - half, cell, cell);
    }
    c.globalAlpha = 1;
  }

  /* ---- one frame, with the heat when live ---- */
  var all = [], clock = 0, last = 0, raf = 0;
  function render(fx, t, live) {
    if (!fx.n) return;
    fx.ctx.clearRect(0, 0, fx.w, fx.h);
    if (fx.glows.length) drawGlows(fx, t);
    if (fx.hot) { fx.heat.fill(0); fx.hot = 0; }
    if (live) heatUp(fx, t);
    drawGrid(fx, t);
  }
  // A still or resized layer's frame.
  function frame(fx) { render(fx, fx.still ? STILL_T : clock, false); }

  /* ---- size: one grid for the page, from its top left corner; the cell is
     13 px at 390 px wide, 16 px at 1440; a cell's plus or minus is a hash of
     its column and row on the page ---- */
  // The element's padding box on the page; a sticky element where the flow
  // puts it, without the shift sticking adds.
  function origin(el) {
    var sticky = getComputedStyle(el).position === "sticky", p = el.style.position;
    if (sticky) el.style.position = "static";
    var b = el.getBoundingClientRect();
    if (sticky) el.style.position = p;
    return [b.left + el.clientLeft + window.pageXOffset, b.top + el.clientTop + window.pageYOffset];
  }
  function resize(fx) {
    var w = fx.el.clientWidth, h = fx.el.clientHeight, vw = document.documentElement.clientWidth;
    if (!w || !h) return;
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var cell = Math.round(Math.min(16, Math.max(13, 13 + (vw - 390) * 3 / 1050)));
    var o = origin(fx.el);
    fx.w = w; fx.h = h; fx.ox = o[0]; fx.oy = o[1];
    fx.canvas.width = Math.round(w * ratio);
    fx.canvas.height = Math.round(h * ratio);
    fx.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (cell !== fx.cell || ratio !== fx.ratio) {
      fx.cell = cell; fx.ratio = ratio;
      build(fx);
    }
    // The page's cells that overlap the element.
    var c0 = Math.floor(fx.ox / cell), r0 = Math.floor(fx.oy / cell);
    var cols = Math.ceil((fx.ox + w) / cell) - c0, rows = Math.ceil((fx.oy + h) / cell) - r0;
    fx.cols = cols; fx.rows = rows; fx.n = cols * rows;
    fx.x0 = (c0 + 0.5) * cell - fx.ox; fx.y0 = (r0 + 0.5) * cell - fx.oy;
    fx.px = new Float32Array(fx.n); fx.py = new Float32Array(fx.n);
    fx.weight = new Float32Array(fx.n); fx.heat = new Float32Array(fx.n); fx.hot = 0;
    fx.minus = new Uint8Array(fx.n);
    for (var k = 0; k < fx.n; k++) {
      var col = k % cols, row = (k - col) / cols;
      fx.px[k] = fx.x0 + col * cell; fx.py[k] = fx.y0 + row * cell;
      fx.minus[k] = hash(c0 + col, r0 + row, 7) < 0.5 ? 1 : 0;
    }
    fx.mode.layout(fx);
    frame(fx);
  }
  function layoutAll() { all.forEach(resize); }

  /* ---- loop: one for the page, one clock; rAF, 30 frames per second, every
     frame while there is heat ---- */
  function running() { return all.some(function (fx) { return fx.state === "running"; }); }
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    if (!trail.length && !blooms.length && now - last < 30) return;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    while (trail.length && clock - trail[0].t >= TRAIL.life) trail.shift();
    while (blooms.length && clock - blooms[0].t >= BLOOM.life) blooms.shift();
    all.forEach(function (fx) { if (fx.state === "running") render(fx, clock, true); });
  }
  function wake() { if (!raf && running()) raf = requestAnimationFrame(loop); }

  /* ---- state: running; paused off screen or in a hidden tab; static (one
     frame, no heat) under reduced motion or with the strip away ---- */
  function setState(fx, s) {
    if (fx.state === s) return;
    fx.state = s;
    fx.el.setAttribute("data-fx-state", s);
  }
  function update(fx) {
    var still = reduceMotion.matches, calm = still || !fx.top;
    fx.still = still;
    if (fx === head) fx.el.setAttribute("data-fx-stuck", !fx.top);
    if (still) { trail = []; blooms = []; from = null; }
    if (calm || !fx.visible || document.hidden) {
      setState(fx, calm ? "static" : "paused");
      if (calm) frame(fx);
    } else {
      setState(fx, "running");
      wake();
    }
  }

  /* ---- start: one canvas per [data-fx] element ---- */
  els.forEach(function (el) {
    var mode = MODES[el.getAttribute("data-fx")];
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!mode || !ctx || !dot || !window.Path2D) return;
    canvas.className = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    el.appendChild(canvas);
    var fx = {
      el: el, mode: mode, canvas: canvas, ctx: ctx, n: 0, cell: 0, ratio: 0, key: "",
      state: "", still: null, visible: true, top: true
    };
    all.push(fx);
    if (mode === MODES.header) head = fx;
    readColours(fx);
    update(fx);
    resize(fx);

    // fx.visible: the element is on screen; fx.top: the header's strip is
    // (-1px: the sticky header parks the strip's bottom edge at the viewport's
    // top).
    var strip = mode.strip && document.querySelector(mode.strip);
    if ("IntersectionObserver" in window) {
      [[el, "visible", "0px"], [strip, "top", "-1px 0px 0px"]].forEach(function (o) {
        if (o[0]) new IntersectionObserver(function (entries) {
          fx[o[1]] = entries[entries.length - 1].isIntersecting;
          update(fx);
        }, { rootMargin: o[2] }).observe(o[0]);
      });
    }

    // A click or tap makes the field bloom, except on a control, on the text,
    // or at the end of a text selection.
    el.addEventListener("click", function (e) {
      var sel = window.getSelection(), hit = e.target.closest("h1, p");
      if (fx.state !== "running" || e.target.closest(IGNORE) || (hit && el.contains(hit)) || (sel && String(sel))) return;
      blooms.push({ x: e.clientX + window.pageXOffset, y: e.clientY + window.pageYOffset, t: clock });
      if (blooms.length > BLOOM.max) blooms.shift();
    });
  });

  // One element's size or place changes the others' place on the page.
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(layoutAll);
    all.forEach(function (fx) {
      ro.observe(fx.el);
      var text = fx.el.querySelector("h1, p");
      if (text && text.parentElement !== fx.el) ro.observe(text.parentElement);
    });
  } else {
    window.addEventListener("resize", layoutAll);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);

  // A fine pointer moved with no button held warms the field every TRAIL.step
  // px along its path, anywhere on the page; a drag selects or scrolls and
  // warms nothing.
  var from = null, travel = 0;
  window.addEventListener("pointermove", function (e) {
    if (!raf || reduceMotion.matches || !finePointer.matches || e.pointerType === "touch" || e.buttons) { from = null; return; }
    var f = from, x = e.clientX, y = e.clientY;
    from = { x: x, y: y };
    var dx = f ? x - f.x : 0, dy = f ? y - f.y : 0, len = Math.sqrt(dx * dx + dy * dy);
    if (!f || len > JUMP) { travel = 0; return; }
    travel += len;
    while (travel >= TRAIL.step) {
      travel -= TRAIL.step;
      var g = 1 - travel / len; // where on this move the step was reached
      trail.push({ x: f.x + dx * g + window.pageXOffset, y: f.y + dy * g + window.pageYOffset, t: clock });
    }
    if (trail.length > TRAIL.max) trail.splice(0, trail.length - TRAIL.max);
  });
  window.addEventListener("pointerout", function (e) { if (!e.relatedTarget) from = null; });

  function updateAll() { all.forEach(update); }
  document.addEventListener("visibilitychange", updateAll);
  reduceMotion.addEventListener("change", updateAll);

  // Colours follow the theme: theme.js sets data-theme on <html>, and "auto"
  // follows the system's colour scheme.
  function recolour() {
    all.forEach(function (fx) {
      if (!readColours(fx) || !fx.cell) return;
      build(fx);
      if (fx.state !== "running") frame(fx);
    });
  }
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  darkScheme.addEventListener("change", recolour);
})();
