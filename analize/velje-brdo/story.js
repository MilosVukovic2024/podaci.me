/* Velje brdo — scenes. Data comes from #vb-data; every chart is drawn at its real pixel width
   (no horizontal page scroll on phones) and shows its true final values unless an entry animation is running.
   Lists and tables that carry text (radar table, chronology, network lists) are written into the HTML by tools/build.js;
   this file only adds behaviour to them. */
(function () {
  'use strict';
  var P = window.P;
  if (!P) return;

  function boot() {
    var D = JSON.parse(document.getElementById('vb-data').textContent);
    var $ = function (id) { return document.getElementById(id); };
    var nf = P.nf, S = P.svg, E = P.ease, NB = ' ';
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var bounce = function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; };

    function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
    function size(svg, w, h) { svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h); }
    // the hidden start state is painted first, then the transition runs from a later task: no forced layout
    function drawPath(path, ms, delay) {
      var len = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = len + ' ' + len;
      path.style.strokeDashoffset = P.reduce ? 0 : len;
      if (P.reduce) return;
      var went = false, run = function () { if (went) return; went = true; path.style.transition = 'stroke-dashoffset ' + ms + 'ms cubic-bezier(.65,0,.35,1)'; path.style.strokeDashoffset = 0; };
      setTimeout(function () { window.requestAnimationFrame(function () { window.requestAnimationFrame(run); }); setTimeout(run, 300); }, delay || 0);
    }
    function hidePath(path) { var len = path.getTotalLength(); path.style.transition = 'none'; path.style.strokeDasharray = len + ' ' + len; path.style.strokeDashoffset = len; }
    function hatch(svg, id, gray) {
      var defs = S('defs', null, svg), p = S('pattern', { id: id, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      S('rect', { width: 7, height: 7, fill: gray ? 'var(--n1)' : 'var(--accent-wash)' }, p);
      S('line', { x1: 1, y1: 0, x2: 1, y2: 7, stroke: gray ? 'var(--n3)' : 'var(--accent)', 'stroke-width': 2, opacity: .6 }, p);
    }
    function dtable(host, head, rows, caption) {
      host.innerHTML = '<table class="dtable"><caption>' + caption + '</caption><thead><tr>' + head.map(function (h) { return '<th scope="col"' + (h.r ? ' class="r"' : '') + '>' + h.t + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (head[i].r ? ' class="r"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    var tms = function (iso) { return Date.parse(iso + 'T00:00:00Z'); };
    function fmtDate(iso) { var p = iso.split('-'); return (+p[2]) + '.' + NB + (+p[1]) + '.' + NB + p[0] + '.'; }
    var MNAME = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
    function labelMonth(m) { return MNAME[+m.slice(5) - 1] + NB + m.slice(0, 4) + '.'; }
    function onReplay(id, fn) { var n = $(id); if (n) n.addEventListener('replay', fn); }
    // numbers with their units, and dates, never break across lines (text that comes from #vb-data)
    function nbt(s) { return String(s).replace(/(\d{1,2})\. (\d{1,2})\. (\d{4})/g, '$1.' + NB + '$2.' + NB + '$3').replace(/(\d) (€|m²|ha|km|mil\.|mlrd\.)/g, '$1' + NB + '$2').replace(/(mil\.|mlrd\.) €/g, '$1' + NB + '€'); }

    // charts are built only when the reader gets close. An anchor jump queues everything above its target and
    // builds it one section per frame (the click itself stays fast); podaci.js keeps the target aligned meanwhile.
    var pending = [], queue = [], pumping = false;
    function near(el, fn) {
      var job = { el: el, done: false, run: function () { if (job.done) return; job.done = true; if (job.io) job.io.disconnect(); fn(); } };
      pending.push(job);
      if (!('IntersectionObserver' in window)) { job.run(); return; }
      job.io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) job.run(); }, { rootMargin: '1400px 0px' });
      job.io.observe(el);
    }
    function pump() {
      var job = queue.shift();
      if (job) job.run();
      if (queue.length) window.requestAnimationFrame(function () { setTimeout(pump, 0); }); else pumping = false;
    }
    function buildUpTo(target) {
      pending.forEach(function (job) {
        if (job.done || queue.indexOf(job) >= 0) return;
        var pos = job.el.compareDocumentPosition(target);
        if (job.el === target || pos & Node.DOCUMENT_POSITION_FOLLOWING || pos & Node.DOCUMENT_POSITION_CONTAINED_BY) queue.unshift(job);
      });
      if (queue.length && !pumping) { pumping = true; setTimeout(pump, 0); }
    }
    P.jumpBusy = function () { return queue.length > 0; };
    document.addEventListener('p:jump', function (e) { if (e.detail) buildUpTo(e.detail); });

    // entry animations run only for a chart that comes up from below: it is reset while still off-screen and
    // plays when it arrives. A chart that is already on screen (anchor, reload, scrolling up) keeps its final values.
    function enterAnim(box, reset, play) {
      if (P.reduce || !('IntersectionObserver' in window)) return;
      var armed = false;
      var arm = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        arm.disconnect();
        if (box.getBoundingClientRect().top >= window.innerHeight) { armed = true; reset(); }
      }, { rootMargin: '0px 0px 60% 0px' });
      arm.observe(box);
      P.onEnter(box, function () { if (armed) play(); }, '0px 0px -12% 0px');
    }

    // ---------- derived numbers (one place) ----------
    var C = D.contract, TODAY = D.stanje;
    var contractPerM2 = (C.value + C.vat) / C.area;
    var PRICE_VAT = Math.round(contractPerM2 / 100) * 100;
    var netPerM2 = C.value / C.area;
    var perFlat = C.value / C.flats;
    var avgArea = C.area / C.flats;
    var projection = perFlat * D.promised;
    var phases = D.promised / C.flats, years = phases * C.months / 12, endYear = 2026 + years;
    var late = Math.max(0, Math.floor((tms(TODAY) - tms('2026-06-30')) / 864e5));

    // ---------- route ----------
    var ROUTE = D.route, rl = 0;
    for (var ri = 1; ri < ROUTE.length; ri++) rl += Math.hypot(ROUTE[ri][0] - ROUTE[ri - 1][0], ROUTE[ri][1] - ROUTE[ri - 1][1]);
    var routeKm = rl * D.routeMetersPerUnit / 1000;
    function smooth(pts) {
      var d = 'M' + pts[0][0] + ',' + pts[0][1];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0] + ',' + p2[1];
      }
      return d;
    }
    var ROUTE_D = smooth(ROUTE);
    ['heroRoute', 'heroGlow', 'heroComet', 'satRoute', 'satGlow', 'satComet'].forEach(function (id) { $(id).setAttribute('d', ROUTE_D); });
    var heroRoute = $('heroRoute'), RL = heroRoute.getTotalLength(), routeEnd = heroRoute.getPointAtLength(RL);
    [$('heroComet'), $('satComet')].forEach(function (c) { c.style.setProperty('--L', Math.round(RL + 70)); });
    [$('heroDot'), $('heroRing'), $('satRing')].forEach(function (c) { c.setAttribute('cx', routeEnd.x); c.setAttribute('cy', routeEnd.y); });
    $('kmRead').textContent = nf(routeKm, 1); $('kmStep').textContent = nf(routeKm, 1); $('satBig').textContent = nf(routeKm, 1) + ' km trase';

    // radar axes from the data; the route axis is measured from the digitised route
    var pct = function (v) { return nf(v * 100, v > 0 && v < 0.05 ? 1 : 0) + '%'; };
    var AXES = D.profile.map(function (a) {
      var route = a.from === 'route';
      return { k: a.k, s: a.s, d: a.d, v: route ? Math.min(1, routeKm / a.of) : a.have / a.of, f: route ? nf(routeKm, 1) + ' / ' + nf(a.of, 1) + NB + 'km' : a.f };
    });

    // ---------- cover: the route draws, the scan passes, the zero lands ----------
    (function () {
      // all cover motion ends within five seconds: route 0.4–2.4 s, comet and ring 2.4–4.6 s
      drawPath(heroRoute, 2000, 400); drawPath($('heroGlow'), 2000, 400);
      P.restartClass($('heroTerrain'), 'run');
      P.later(function () { $('heroComet').classList.add('on'); $('heroRing').classList.add('on'); }, 2400);
      P.later(function () { P.restartClass($('builtN'), 'zero-in'); }, 700);
    })();
    if ('IntersectionObserver' in window) {
      var loops = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('offscreen', !e.isIntersecting); }); });
      [$('heroTerrain'), $('satView'), $('net')].forEach(function (n) { if (n) loops.observe(n); });
    }

    // ---------- A2 promises: filter + stamps ----------
    near($('obecanja'), function () {
      var pw = $('promises'), cards = P.$$('.promise', pw), tallyB = P.$$('.tally button');
      // each counter's target comes from the cards themselves, never from the number currently on screen
      var tallyN = tallyB.map(function (b) {
        var f = b.getAttribute('data-f'), n = b.querySelector('.n');
        n._to = f === 'all' ? cards.length : cards.filter(function (c) { return c.getAttribute('data-s') === f; }).length;
        return n;
      });
      tallyB.forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.getAttribute('data-f');
          tallyB.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          cards.forEach(function (c) { c.classList.toggle('is-hidden', f !== 'all' && c.getAttribute('data-s') !== f); });
        });
      });
      function playPromises() {
        if (P.reduce) { pw.classList.remove('pre'); return; }
        pw.classList.add('pre'); pw.classList.remove('play-stamps'); void pw.offsetWidth;
        cards.forEach(function (c, i) { c.style.transitionDelay = (i * 70) + 'ms'; });
        setTimeout(function () { pw.classList.remove('pre'); }, 30);
        cards.forEach(function (c, i) {
          var dl = 750 + i * 170;
          c.querySelector('.stamp').style.animationDelay = dl + 'ms';
          setTimeout(function () { P.restartClass(c, 'hit'); }, dl + 320);
        });
        P.restartClass(pw, 'play-stamps');
        tallyN.forEach(function (n) { P.countTo(n, n._to, 1000, 0); });
        setTimeout(function () { cards.forEach(function (c) { c.style.transitionDelay = ''; }); }, 1600);
      }
      if (!P.reduce) pw.classList.add('pre');
      P.onEnter(pw, playPromises, '0px 0px -15% 0px');
      onReplay('obecanja', playPromises);
    });

    // ---------- B1 satellite: scroll through time ----------
    near($('teren'), function () {
      var satView = $('satView'), satStage = satView.parentNode, frames = P.$$('.sat__f', satView), satChips = P.$$('#satChips button'), satDate = $('satDate');
      var satRoute = $('satRoute'), satGlow = $('satGlow'), lastFrame = -1;
      var sat = P.scrolly($('satScrolly'), function (i) {
        var f = Math.min(i, 3);
        frames.forEach(function (fr, j) { fr.classList.toggle('is-on', j <= f); });
        satChips.forEach(function (c, j) { c.classList.toggle('done', j <= f); c.setAttribute('aria-current', j === f ? 'true' : 'false'); });
        if (f !== lastFrame) { satDate.textContent = nbt(D.frames[f].d); if (lastFrame >= 0) P.restartClass(satDate, 'flip'); }
        var had = satView.classList.contains('has-route'), has = D.frames[f].route;
        satView.classList.toggle('has-route', has);
        if (has && !had) { drawPath(satRoute, 1700, 450); drawPath(satGlow, 1700, 450); }
        satView.classList.toggle('is-measure', i === 4);
        $('satComet').classList.toggle('on', i === 4 && !P.reduce);
        $('satRing').classList.toggle('on', i === 4 && !P.reduce);
        satView.classList.toggle('is-heat', i === 5); satView.classList.toggle('is-gray', i === 5); satStage.classList.toggle('is-heat', i === 5);
        lastFrame = f;
      });
      satChips.forEach(function (c, j) { c.addEventListener('click', function () { sat.scrollTo(j); }); });
    });

    // ---------- B2 compare slider + heat ----------
    near($('uporedi'), function () {
      var cmp = $('compare'), cut = $('cut'), tagL = $('tagL'), tagR = $('tagR');
      function setCut(v) {
        cmp.style.setProperty('--cut', v + '%'); cut.value = Math.round(v);
        tagL.style.opacity = Math.min(1, v / 25); tagR.style.opacity = Math.min(1, (100 - v) / 25);
      }
      cut.addEventListener('input', function () { P.cancel('sweep'); setCut(+cut.value); });
      var drag = false, armed = false, sx = 0, sy = 0;
      function fromPointer(e) { var rc = cmp.getBoundingClientRect(); setCut(Math.max(0, Math.min(100, (e.clientX - rc.left) / rc.width * 100))); }
      // a touch only starts dragging once it moves sideways, so a vertical swipe over the image still scrolls the page
      function startDrag(e) { drag = true; armed = false; P.cancel('sweep'); cmp.classList.add('drag'); fromPointer(e); }
      function endDrag(e) { if (armed && e.type === 'pointerup') startDrag(e); drag = armed = false; cmp.classList.remove('drag'); }
      cmp.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { armed = true; sx = e.clientX; sy = e.clientY; } else { e.preventDefault(); startDrag(e); } });
      cmp.addEventListener('dragstart', function (e) { e.preventDefault(); });
      window.addEventListener('pointermove', function (e) { if (armed && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy) + 4) startDrag(e); else if (drag) fromPointer(e); });
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      P.onEnter(cmp, function () { P.tween(3000, function (t) { setCut(50 + 42 * Math.sin(t * Math.PI * 2)); }, function () { setCut(50); }, E.lin, 'sweep'); });
      var hsStage = $('hsStage'), hsHeat = $('hsHeat'), hsOp = $('hsOp'), hsOpV = $('hsOpV'), hsRing = $('hsRing');
      hsOp.addEventListener('input', function () { hsHeat.style.opacity = hsOp.value / 100; hsOpV.textContent = hsOp.value + '%'; });
      if (P.reduce) hsStage.classList.remove('is-pre');
      P.onEnter(hsStage, function () {
        setTimeout(function () { hsStage.classList.remove('is-pre'); }, 200);
        if (!P.reduce) { hsRing.style.animation = 'none'; void hsRing.getBoundingClientRect(); hsRing.style.animation = 'ring 2.2s cubic-bezier(.16,1,.3,1) .4s 2'; }
      });
    });

    // ---------- B3 radar (its table is static HTML) ----------
    near($('profil'), function () {
      $('radar').setAttribute('aria-label', 'Paukov dijagram ostvarenja: ' + AXES.map(function (a) { return a.k.toLowerCase() + ' ' + pct(a.v); }).join(', ') + '.');
      var RD = null, playing = false, live = null;
      function drawRadar(w) {
        var svg = $('radar'); clear(svg);
        var narrow = w < 480, H = Math.round(Math.min(w * (narrow ? 0.9 : 0.8), 560));
        var R = Math.max(70, Math.min(w / 2 - (narrow ? 40 : 108), H / 2 - (narrow ? 30 : 48)));
        var CX = w / 2, CY = H / 2 + 4, n = AXES.length;
        size(svg, w, H);
        var ang = function (i) { return -Math.PI / 2 + i * 2 * Math.PI / n; };
        var pt = function (i, r) { return [CX + Math.cos(ang(i)) * r, CY + Math.sin(ang(i)) * r]; };
        // rings at 25/50/75/100%; the dashed outline is 100% (said in the intro), every axis carries its own percentage
        [0.25, 0.5, 0.75, 1].forEach(function (q) {
          S('polygon', { points: AXES.map(function (a, i) { return pt(i, R * q).join(','); }).join(' '), fill: q === 1 ? 'var(--accent-wash)' : 'none', stroke: 'var(--hair-2)', 'stroke-width': 1 }, svg);
        });
        AXES.forEach(function (a, i) {
          var p = pt(i, R), c = Math.cos(ang(i)), s = Math.sin(ang(i));
          S('line', { x1: CX, y1: CY, x2: p[0], y2: p[1], stroke: 'var(--hair-2)', 'stroke-width': 1 }, svg);
          var lp = pt(i, R + (narrow ? 14 : 20)), anchor = Math.abs(c) < 0.2 ? 'middle' : (c > 0 ? 'start' : 'end');
          var lines = narrow ? [String(i + 1), pct(a.v)] : a.s.concat(pct(a.v)), nL = lines.length;
          var first = s < -0.5 ? -(nL - 1) * 1.2 : s > 0.5 ? 0.9 : 0.35 - (nL - 1) * 0.6;
          var t = S('text', { x: lp[0], y: lp[1], 'text-anchor': anchor, 'data-tip-k': pct(a.v), 'data-tip': a.k + ': ' + a.f + ' — ' + a.d }, svg);
          lines.forEach(function (ln, j) { S('tspan', { x: lp[0], dy: (j ? 1.2 : first) + 'em', 'class': j === nL - 1 ? 'rp' : (narrow ? 'rn' : null) }, t, ln); });
        });
        var promised = S('polygon', { points: AXES.map(function (a, i) { return pt(i, R).join(','); }).join(' '), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.6, 'stroke-dasharray': '7 6' }, svg);
        var actual = S('polygon', { fill: 'rgba(212,5,17,.22)', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
        var dots = AXES.map(function (a) { return S('circle', { r: 5, fill: 'var(--accent)', stroke: '#fff', 'stroke-width': 2, 'data-tip-k': pct(a.v), 'data-tip': a.k + ': ' + a.f }, svg); });
        S('circle', { cx: CX, cy: CY, r: 3, fill: 'var(--ink)' }, svg);
        var vals = AXES.map(function (a) { return a.v; });
        function render(v) {
          if (v) vals = v;
          actual.setAttribute('points', AXES.map(function (a, i) { return pt(i, R * vals[i]).join(','); }).join(' '));
          dots.forEach(function (d, i) { var p = pt(i, R * vals[i]); d.setAttribute('cx', p[0].toFixed(1)); d.setAttribute('cy', p[1].toFixed(1)); });
        }
        RD = { promised: promised, render: render };
        render(playing && live ? live.slice() : null);
      }
      P.mount($('radarBox'), drawRadar);
      var timers = [];
      function resetRadar() { playing = true; live = AXES.map(function () { return 0; }); RD.render(live.slice()); $('rtab').classList.add('pre'); }
      function playRadar() {
        var tab = $('rtab');
        if (P.reduce) return;
        // a replay stops the previous run completely before starting its own
        timers.forEach(clearTimeout); timers = [];
        AXES.forEach(function (a, i) { P.cancel('rad' + i); });
        playing = true;
        var run = live = AXES.map(function () { return 0; }); RD.render(run.slice());
        var poly = RD.promised, pts = poly.getAttribute('points').split(' ').map(function (s) { return s.split(',').map(Number); }), len = 0;
        for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
        tab.classList.add('pre'); timers.push(setTimeout(function () { tab.classList.remove('pre'); }, 700));
        poly.style.transition = 'none'; poly.style.strokeDasharray = len; poly.style.strokeDashoffset = len; void poly.getBoundingClientRect();
        timers.push(setTimeout(function () { poly.style.transition = 'stroke-dashoffset 1400ms cubic-bezier(.65,0,.35,1)'; poly.style.strokeDashoffset = 0; }, 100));
        timers.push(setTimeout(function () { poly.style.transition = 'none'; poly.style.strokeDasharray = '7 6'; poly.style.strokeDashoffset = 0; }, 1600));
        var left = AXES.length;
        AXES.forEach(function (a, i) {
          timers.push(setTimeout(function () {
            P.tween(1100, function (t) { if (live !== run) return; run[i] = a.v * t; RD.render(run.slice()); }, function () {
              if (live !== run || --left) return;
              playing = false; live = null; RD.render(AXES.map(function (x) { return x.v; }));
            }, E.back, 'rad' + i);
          }, 800 + i * 130));
        });
      }
      enterAnim($('radarBox'), resetRadar, playRadar);
      onReplay('profil', playRadar);
    });

    // ---------- C1 units: 20.000 → 557 → 185 → 0 ----------
    near($('razmjera'), function () {
      var units = $('units'), unitV = $('unitV'), unitL = $('unitL');
      for (var u = 0; u < 200; u++) {
        var sq = document.createElement('i'), aS = Math.max(0, Math.min(1, (D.blockA1 - u * 100) / 100)), cS = Math.max(0, Math.min(1, (C.flats - u * 100) / 100));
        if (aS > 0) { sq.classList.add('a'); sq.style.setProperty('--a', aS); sq.appendChild(document.createElement('span')).className = 't'; }
        if (cS > 0) { sq.classList.add('c'); sq.style.setProperty('--c', cS); sq.appendChild(document.createElement('span')).className = 'f'; }
        sq.style.setProperty('--dl', ((u % 25) + Math.floor(u / 25)) * 14 + 'ms');
        units.appendChild(sq);
      }
      units.classList.add('u0');
      var UV = [D.promised, D.blockA1, C.flats, 0], UL = ['obećano', 'Blok A1, u projektovanju', 'ugovoreno', 'izgrađeno'];
      if (!P.reduce) { units.classList.add('is-pre'); P.onEnter(units, function () { units.classList.remove('is-pre'); P.restartClass(units, 'is-pop'); }, '0px 0px -8% 0px'); }
      P.scrolly($('unitScrolly'), function (i, prev) {
        units.classList.remove('u0', 'u1', 'u2', 'u3'); units.classList.add('u' + i);
        unitL.textContent = UL[i]; unitV.classList.toggle('red', i === 3);
        if (prev >= 0) P.countTo(unitV, UV[i], 1100, UV[prev]); else unitV.textContent = nf(UV[i]);
      });
    });

    // ---------- C2 pace (our illustration) ----------
    near($('tempo'), function () {
      var PC = null, playing = false, lastT = 1;
      function drawPace(w) {
        var svg = $('pace'); clear(svg);
        var narrow = w < 600, H = narrow ? 220 : 250, x0 = 2, x1 = w - 4, y = narrow ? 112 : 122;
        size(svg, w, H); hatch(svg, 'hatchPace');
        var X = function (yr) { return x0 + (yr - 2026) / (endYear - 2026 + 4) * (x1 - x0); };
        [2026, 2100, 2200, 2300].forEach(function (yr) {
          S('line', { x1: X(yr), x2: X(yr), y1: y - 40, y2: y + 44, 'class': 'gl' }, svg);
          S('text', { x: X(yr), y: y + 62, 'text-anchor': yr === 2026 ? 'start' : 'middle', 'class': 'ax' }, svg, yr + '.');
        });
        var all = S('rect', { x: x0, y: y - 18, height: 36, fill: 'url(#hatchPace)', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'data-tip-k': 'Naša ilustracija', 'data-tip': '20.000 stanova tempom prve faze: oko ' + Math.round(endYear) + '. godine' }, svg);
        S('rect', { x: x0, y: y - 18, width: Math.max(3, X(2029.6) - x0), height: 36, fill: 'var(--accent)', 'data-tip-k': 'Ugovor', 'data-tip': 'Prva faza: 185 stanova, 2026–2029.' }, svg);
        var head = S('line', { y1: y - 28, y2: y + 28, stroke: 'var(--accent)', 'stroke-width': 2 }, svg);
        S('text', { x: x0, y: y - 34, 'class': 'lbl' }, svg, narrow ? 'Prva faza: 185 stanova' : 'Prva faza: 185 stanova, 2026–2029.');
        // the running end label has its own line, so it never sits on top of the first-phase label
        var endT = S('text', { y: y - 56, 'text-anchor': 'end', 'class': 'lbl-acc' }, svg);
        S('text', { x: x0, y: H - 8, 'class': 'ax' }, svg, nf(phases, 0) + ' faza × ' + C.months + ' mjeseci = ' + nf(years, 0) + ' godine');
        PC = {
          set: function (t) {
            lastT = t;
            var W = X(endYear) - x0, wv = Math.max(3, W * t);
            all.setAttribute('width', wv); head.setAttribute('x1', x0 + wv); head.setAttribute('x2', x0 + wv);
            endT.textContent = (narrow ? '20.000: oko ' : '20.000 stanova: oko ') + Math.round(2026 + years * t) + '.';
            endT.setAttribute('x', Math.min(x1, Math.max(x0 + (narrow ? 130 : 200), x0 + wv)));
          }
        };
        PC.set(playing ? lastT : 1);
      }
      P.mount($('paceBox'), drawPace);
      function playPace() {
        if (P.reduce) return;
        playing = true; PC.set(0);
        P.tween(3200, function (t) { PC.set(t); }, function () { playing = false; PC.set(1); }, E.io, 'pace');
      }
      enterAnim($('paceBox'), function () { playing = true; PC.set(0); }, playPace);
      onReplay('tempo', playPace);
      dtable($('paceTable'), [{ t: 'Stavka' }, { t: 'Vrijednost', r: 1 }], [
        ['Prva faza (ugovor): stanova', nf(C.flats)],
        ['Prva faza (ugovor): mjeseci', nf(C.months)],
        ['Obećano stanova', nf(D.promised)],
        ['Potrebno faza po 185 stanova', nf(phases, 1)],
        ['Broj godina, faze jedna za drugom', nf(years, 1)],
        ['Završetak tempom prve faze', 'oko ' + Math.round(endYear) + '.']
      ], 'Tempo gradnje, naša ilustracija razmjera, ne prognoza');
    });

    // ---------- C3 footprint: zoom out from the block to the zone ----------
    near($('projekat'), function () {
      var F = D.footprint, foot = $('foot'), FS = 300, a1 = Math.sqrt(F.blockA1Ha / F.zoneHa) * FS, zoomMax = FS / a1;
      var share = nf(F.blockA1Ha / F.zoneHa * 100, 1) + '%', a1ha = nf(F.blockA1Ha, 1) + NB + 'ha', zone = nf(F.zoneHa) + NB + 'ha';
      var defs = S('defs', null, foot), cp = S('clipPath', { id: 'fpClip' }, defs);
      S('rect', { x: 9, y: 9, width: FS + 2, height: FS + 2 }, cp);
      var g = S('g', { id: 'zoomG' }, S('g', { 'clip-path': 'url(#fpClip)' }, foot));
      S('rect', { x: 10, y: 10, width: FS, height: FS, fill: 'var(--accent-wash)', stroke: 'var(--ink)', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', 'data-tip': 'Zona naselja: ' + zone }, g);
      S('rect', { x: 10, y: 10, width: a1, height: a1, fill: 'var(--accent)', 'data-tip': 'Blok A1: ' + a1ha + ' (' + share + ' zone)' }, g);
      var lbl = S('text', { x: 10 + a1 + 8, y: 10 + a1 - 4, 'class': 'lbl-acc' }, foot, 'Blok A1 · ' + a1ha);
      var txt = S('text', { x: 10, y: FS + 40, 'class': 'ax' }, foot, 'Zona ' + zone + ' · Blok A1 je ' + share + ' zone');
      function zoomIn() { lbl.style.transition = ''; lbl.style.opacity = 0; g.setAttribute('transform', 'translate(10 10) scale(' + zoomMax + ') translate(-10 -10)'); txt.textContent = 'Blok A1: ' + a1ha; }
      function playFoot() {
        if (P.reduce) return;
        zoomIn();
        setTimeout(function () {
          P.tween(2600, function (t) {
            var s = zoomMax + (1 - zoomMax) * t;
            g.setAttribute('transform', 'translate(10 10) scale(' + s + ') translate(-10 -10)');
            var vis = F.zoneHa / (s * s); txt.textContent = 'U kadru: ' + nf(vis, vis < 100 ? 1 : 0) + NB + 'ha';
          }, function () { g.setAttribute('transform', ''); txt.textContent = 'Zona ' + zone + ' · Blok A1 je ' + share + ' zone'; lbl.style.transition = 'opacity .5s'; lbl.style.opacity = 1; }, E.io, 'zoom');
        }, 400);
      }
      enterAnim(foot, zoomIn, playFoot);
      onReplay('projekat', playFoot);
    });

    // ---------- D1 price: market → promise → ministry → contract ----------
    near($('cijena'), function () {
      var PE = {}, priceStep = 0, priceSeen = P.reduce;
      function contractAt(t) {
        var v = D.promisePrice + (contractPerM2 - D.promisePrice) * t, y = PE.Y(v), y0 = PE.Y(D.promisePrice);
        PE.cl.setAttribute('y1', y); PE.cl.setAttribute('y2', y); PE.clbl.setAttribute('y', y - 10);
        PE.band.setAttribute('y', Math.min(y, y0)); PE.band.setAttribute('height', Math.abs(y0 - y));
        PE.clbl.textContent = (PE.narrow ? 'ugovor: ' : '') + nf(Math.max(D.promisePrice, Math.round((D.promisePrice + (PRICE_VAT - D.promisePrice) * t) / 10) * 10)) + NB + '€ sa PDV-om' + (PE.narrow ? '' : ' · po računici iz ugovora');
      }
      function gapAt(t, show) {
        var gap = nf(Math.round((PRICE_VAT - D.promisePrice) * t / 10) * 10) + NB + '€';
        PE.gap.textContent = PE.narrow ? 'razlika ' + gap : gap;
        if (PE.br) { PE.br.style.opacity = show ? 1 : 0; PE.gapK.style.opacity = show ? 1 : 0; }
        PE.gap.style.opacity = show ? 1 : 0;
      }
      function priceApply(i, animate) {
        PE.pr.style.opacity = i >= 1 ? 1 : 0; PE.mi.style.opacity = i >= 2 ? 1 : 0; PE.ct.style.opacity = i >= 3 ? 1 : 0;
        if (i >= 3) {
          if (animate && !P.reduce) {
            contractAt(0); gapAt(0, false);
            P.tween(1500, contractAt, function () { gapAt(0, true); P.tween(900, function (t) { gapAt(t, true); }, null, E.out, 'gap'); }, E.back, 'contract');
          } else { P.cancel('contract'); P.cancel('gap'); contractAt(1); gapAt(1, true); }
        } else { P.cancel('contract'); P.cancel('gap'); contractAt(0); gapAt(0, false); }
      }
      function drawPrice(w) {
        var svg = $('price'); clear(svg);
        var narrow = PE.narrow = w < 600;
        var H = narrow ? Math.max(270, Math.min(360, Math.round(window.innerHeight * 0.46))) : Math.max(340, Math.min(520, Math.round(w * 0.72)));
        var x0 = narrow ? 42 : 64, x1 = w - (narrow ? 8 : 104), yT = 24, yB = H - 32, vmax = 3600, M = D.market;
        size(svg, w, H);
        var X = function (i) { return x0 + i * (x1 - x0) / (M.length - 1); }, Y = PE.Y = function (v) { return yB - v / vmax * (yB - yT); };
        [0, 1000, 2000, 3000].forEach(function (v) { S('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), 'class': 'gl' }, svg); S('text', { x: x0 - 8, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'ax' }, svg, nf(v) + (narrow ? '' : NB + '€')); });
        var ct = PE.ct = S('g', { 'class': 't-in' }, svg);
        PE.band = S('rect', { x: x0, width: x1 - x0, fill: 'var(--accent-wash)' }, ct);
        PE.cl = S('line', { x1: x0, x2: x1, stroke: 'var(--accent)', 'stroke-width': 3.5, 'data-tip-k': 'Računica iz ugovora', 'data-tip': nf(contractPerM2, 2) + NB + '€/m² sa PDV-om (48.460.227' + NB + '€ / 14.260' + NB + 'm²); bez PDV-a ' + nf(Math.floor(netPerM2)) + NB + '€/m²' }, ct);
        PE.clbl = S('text', { x: x0 + 8, 'class': 'lbl-acc' }, ct);
        if (!narrow) {
          var bx = x1 + 14, yc = Y(contractPerM2), yp = Y(D.promisePrice);
          PE.br = S('path', { d: 'M' + bx + ',' + yc + ' h8 V' + yp + ' h-8', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'class': 't-in' }, ct);
          PE.gapK = S('text', { x: bx + 16, y: (yc + yp) / 2 - 6, 'class': 'lbl-acc t-in' }, ct, 'razlika');
          PE.gap = S('text', { x: bx + 16, y: (yc + yp) / 2 + 12, 'class': 'lbl-acc t-in' }, ct);
        } else { PE.br = null; PE.gap = S('text', { x: x0 + 8, y: Y(3000), 'class': 'lbl-acc t-in' }, ct); }
        var pr = PE.pr = S('g', { 'class': 't-in' }, svg);
        S('line', { x1: x0, x2: x1, y1: Y(D.promisePrice), y2: Y(D.promisePrice), stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, pr);
        S('text', { x: x0 + 8, y: Y(D.promisePrice) + 20, 'class': 'lbl' }, pr, narrow ? 'obećano: 1.000' + NB + '€' : '1.000' + NB + '€ · obećana prodajna cijena');
        var mi = PE.mi = S('g', { 'class': 't-in' }, svg);
        S('line', { x1: x0, x2: x1, y1: Y(D.ministryPrice), y2: Y(D.ministryPrice), stroke: 'var(--n3)', 'stroke-width': 1.6, 'stroke-dasharray': '2 3' }, mi);
        S('text', { x: x1, y: Y(D.ministryPrice) - 8, 'text-anchor': 'end' }, mi, narrow ? 'ministarka: 1.067' + NB + '€ bez PDV-a' : '1.067' + NB + '€ bez PDV-a · po ministarki Adžović');
        var mk = S('g', null, svg);
        PE.ml = S('path', { d: M.map(function (r, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(r.v).toFixed(1); }).join(' '), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, mk);
        PE.pts = M.map(function (r, i) {
          var last = i === M.length - 1;
          if ((r.q.indexOf('I/') === 0 && (!narrow || X(M.length - 1) - X(i) > 70 || !i)) || last) S('text', { x: X(i), y: yB + 22, 'text-anchor': last && narrow ? 'end' : 'middle', 'class': 'ax' }, svg, r.q);
          return S('circle', { cx: X(i), cy: Y(r.v), r: narrow ? 4.5 : 5.5, fill: r.src === 'MONSTAT' ? 'var(--ink)' : 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 2, style: 'transform-box:fill-box;transform-origin:center', 'data-tip-k': r.q, 'data-tip': nf(r.v) + NB + '€/m² (' + (r.src === 'MONSTAT' ? 'MONSTAT' : 'medijski izvještaj o podacima MONSTAT-a') + ')' }, mk);
        });
        S('text', { x: X(0) + 6, y: Y(M[0].v) + 22, 'class': 'lbl' }, mk, nf(M[0].v) + NB + '€');
        S('text', { x: X(M.length - 1) - 10, y: Y(M[M.length - 1].v) - 14, 'text-anchor': 'end', 'class': 'lbl' }, mk, (narrow ? '' : 'tržište: ') + nf(M[M.length - 1].v) + NB + '€');
        if (!priceSeen) { hidePath(PE.ml); PE.pts.forEach(function (c) { c.style.transform = 'scale(0)'; }); }
        priceApply(priceStep, false);
      }
      P.mount($('priceBox'), drawPrice);
      P.onEnter($('priceBox'), function () {
        if (priceSeen) return; priceSeen = true;
        drawPath(PE.ml, 1900, 100);
        PE.pts.forEach(function (c, i) { setTimeout(function () { c.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)'; c.style.transform = 'scale(1)'; }, 200 + i * 170); });
      }, '0px 0px -12% 0px');
      P.scrolly($('priceScrolly'), function (i, prev) { priceStep = i; if (PE.cl) priceApply(i, prev >= 0 && i > prev); });
      dtable($('priceTable'), [{ t: 'Kvartal' }, { t: '€/m²', r: 1 }, { t: 'Izvor' }],
        D.market.map(function (r) { return [r.q, nf(r.v), r.src === 'MONSTAT' ? 'MONSTAT' : 'mediji, o podacima MONSTAT-a']; }).concat([
          ['Obećana prodajna cijena', nf(D.promisePrice), 'CdM, ' + fmtDate('2024-09-21')],
          ['Trošak po ministarki (bez PDV-a)', nf(D.ministryPrice), 'Analitika'],
          ['Računica iz ugovora (sa PDV-om)', nf(contractPerM2, 2), 'ugovor: 48.460.227' + NB + '€ / 14.260' + NB + 'm²'],
          ['Računica iz ugovora (bez PDV-a)', nf(netPerM2, 2), 'ugovor: 40.049.774' + NB + '€ / 14.260' + NB + 'm²; Investitor: najmanje 2.808' + NB + '€']
        ]), 'Cijena kvadrata: tržište, obećanje, ministarstvo i ugovor');
    });

    // ---------- D2, D3 horizontal bars: final values unless the entry animation is running ----------
    near($('novac'), function () {
      function bars(boxId, svgId, rows, fmt, max, marker, hatchId) {
        var B = null, playing = false, lastT = 1;
        function draw(w) {
          var svg = $(svgId); clear(svg);
          var narrow = w < 560, bh = narrow ? 22 : 28, gap = narrow ? 30 : 36, y0 = 22, valW = narrow ? 92 : 128;
          var span = w - valW - 4, H = y0 + rows.length * (bh + gap) - gap + 14;
          size(svg, w, H); hatch(svg, hatchId); hatch(svg, hatchId + 'g', true);
          if (marker) {
            var mx = marker.v / max * span;
            S('line', { x1: mx, x2: mx, y1: 4, y2: H - 4, stroke: 'var(--ink)', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }, svg);
          }
          var els = rows.map(function (r, i) {
            var y = y0 + i * (bh + gap), wv = Math.max(2, r.v / max * span);
            S('text', { x: 0, y: y - 7, 'class': 'lbl' }, svg, narrow && r.ks ? r.ks : r.k);
            var fill = r.proj ? 'url(#' + hatchId + (r.red ? '' : 'g') + ')' : (r.red ? 'var(--accent)' : (r.ink ? 'var(--ink)' : 'var(--n3)'));
            var rect = S('rect', { x: 0, y: y, height: bh, fill: fill, stroke: r.proj ? (r.red ? 'var(--accent)' : 'var(--n3)') : 'none', 'stroke-width': 1.5, 'stroke-dasharray': r.proj ? '5 3' : null, 'data-tip-k': r.proj ? 'Naša računica' : 'Dokument', 'data-tip': r.k + ': ' + fmt(r.v) }, svg);
            var val = S('text', { y: y + bh / 2 + 5, 'class': r.red ? 'lbl-acc' : 'lbl' }, svg);
            return { rect: rect, val: val, w: wv, v: r.v };
          });
          B = { set: function (t) { lastT = t; els.forEach(function (e) { var ww = Math.max(0, e.w * t); e.rect.setAttribute('width', ww); e.val.setAttribute('x', ww + 8); e.val.textContent = fmt(e.v * t); }); } };
          B.set(playing ? lastT : 1);
        }
        P.mount($(boxId), draw);
        function play() {
          if (P.reduce) return;
          playing = true; B.set(0);
          P.tween(1700, function (t) { B.set(t); }, function () { playing = false; B.set(1); }, E.out, svgId);
        }
        enterAnim($(boxId), function () { playing = true; B.set(0); }, play);
        return play;
      }
      var moneyFmt = function (v) { return v >= 1000 ? nf(v / 1000, 2) + NB + 'mlrd.' + NB + '€' : nf(v, v % 1 && v < 100 ? 2 : 0) + NB + 'mil.' + NB + '€'; };
      var MONEY = [
        { k: 'Projekcija: 20.000 stanova po cijeni iz ugovora', ks: 'Projekcija, 20.000 stanova', v: projection / 1e6, red: true, proj: true },
        { k: 'Cijeli državni budžet za 2026.', ks: 'Budžet za 2026.', v: D.budget2026, ink: true },
        { k: 'Ugovoreno do sada (bulevar, Blok A1, ostalo)', ks: 'Ugovoreno do sada', v: D.contractedSoFar },
        { k: 'U prijedlogu budžeta 2025. i u budžetu 2026. (po 10' + NB + 'mil.' + NB + '€)', ks: 'Prijedlog 2025. i budžet 2026.', v: D.budgeted }
      ];
      var playMoney = bars('moneyBox', 'money', MONEY, moneyFmt, 4500, { v: D.budget2026 }, 'hatchMoney');
      onReplay('novac', playMoney);
      var SUBSIDY = [
        { k: 'Po ministarki (1.067' + NB + '€/m²)', v: (D.ministryPrice - D.promisePrice) * avgArea, proj: true },
        { k: 'Po računici iz ugovora (2.808' + NB + '€/m² bez PDV-a)', ks: 'Po računici iz ugovora', v: perFlat - D.promisePrice * avgArea, red: true, proj: true }
      ];
      var subFmt = function (v) { return nf(Math.round(v / 100) * 100) + NB + '€'; };
      bars('subsidyBox', 'subsidy', SUBSIDY, subFmt, 150000, null, 'hatchSub');
      dtable($('moneyTable'), [{ t: 'Stavka' }, { t: 'Iznos', r: 1 }, { t: 'Vrsta' }], MONEY.map(function (r) { return [r.k, moneyFmt(r.v), r.proj ? 'naša projekcija' : 'dokument']; }), 'Projekcija troška naspram budžeta, milioni eura');
      dtable($('subsidyTable'), [{ t: 'Računica' }, { t: 'Po stanu', r: 1 }], SUBSIDY.map(function (r) { return [r.k, subFmt(r.v)]; }).concat([['Prosječna površina stana u prvoj fazi', nf(avgArea, 2) + NB + 'm²'], ['Cijena stana iz ugovora, bez PDV-a', nf(Math.round(perFlat)) + NB + '€']]), 'Subvencija po stanu, naša računica');
    });

    // ---------- E1 deadlines: each promise moves the date further ----------
    $('lateDays').textContent = nf(late);
    P.onEnter($('lateDays'), function () { P.countTo($('lateDays'), late, 1600, 0); });
    near($('rokovi'), function () {
      var SE = {}, slipStep = 0;
      var SL = [{ dx: 12, dy: 18, a: 'start' }, { dx: -12, dy: -24, a: 'end' }, { dx: -12, dy: -24, a: 'end' }, { dx: -12, dy: -10, a: 'end' }];
      function slipApply(i, animate) {
        SE.pts.forEach(function (g, k) {
          var on = k <= i;
          if (on && !g._on && animate && !P.reduce) {
            g.style.opacity = 0;
            P.tween(800, function (t) { g.style.transform = 'translateY(' + (-50 * (1 - t)) + 'px)'; g.style.opacity = Math.min(1, t * 2.5); }, null, bounce, 'slip' + k);
            if (g._ring) { g._ring.style.animation = 'none'; void g._ring.getBoundingClientRect(); g._ring.style.animation = 'ring 1.8s cubic-bezier(.16,1,.3,1) .7s 2'; }
          } else if (!(on && g._on)) { P.cancel('slip' + k); g.style.transform = 'none'; g.style.opacity = on ? 1 : 0; }
          g._on = on;
        });
        SE.segs.forEach(function (s, k) {
          if (!s) return;
          var on = k <= i;
          if (on && !s._on && animate && !P.reduce) drawPath(s, 650, 0);
          else if (!on) { s.style.transition = 'none'; s.style.strokeDasharray = ''; s.style.opacity = 0; }
          if (on) s.style.opacity = 1;
          s._on = on;
        });
      }
      function drawSlip(w) {
        var svg = $('slip'); clear(svg);
        var narrow = w < 600;
        var H = narrow ? Math.max(290, Math.min(380, Math.round(window.innerHeight * 0.48))) : Math.max(340, Math.min(500, Math.round(w * 0.66)));
        var sx0 = narrow ? 40 : 60, sx1 = w - (narrow ? 10 : 20), sy0 = H - 32, sy1 = 18;
        var dx0 = tms('2024-07-01'), dx1 = tms('2027-01-01'), dy0 = tms('2026-01-01'), dy1 = tms('2030-01-01');
        var SX = function (iso) { return sx0 + (tms(iso) - dx0) / (dx1 - dx0) * (sx1 - sx0); }, SY = function (iso) { return sy0 - (tms(iso) - dy0) / (dy1 - dy0) * (sy0 - sy1); };
        size(svg, w, H);
        ['2026', '2027', '2028', '2029', '2030'].forEach(function (yr) { var yy = SY(yr + '-01-01'); S('line', { x1: sx0, x2: sx1, y1: yy, y2: yy, 'class': 'gl' }, svg); S('text', { x: sx0 - 8, y: yy + 4, 'text-anchor': 'end', 'class': 'ax' }, svg, yr + '.'); });
        ['2025', '2026', '2027'].forEach(function (yr) { var xx = SX(yr + '-01-01'); S('line', { x1: xx, x2: xx, y1: sy0, y2: sy0 + 6, stroke: 'var(--n2)' }, svg); S('text', { x: xx, y: sy0 + 22, 'text-anchor': 'middle', 'class': 'ax' }, svg, yr + '.'); });
        S('rect', { x: sx0, y: SY(TODAY), width: sx1 - sx0, height: sy0 - SY(TODAY), fill: 'var(--accent-wash)' }, svg);
        S('line', { x1: sx0, x2: sx1, y1: SY(TODAY), y2: SY(TODAY), stroke: 'var(--ink)', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }, svg);
        S('text', { x: sx1, y: SY(TODAY) + 18, 'text-anchor': 'end', 'class': 'lbl' }, svg, narrow ? 'ispod linije: rok je prošao' : 'ispod linije: rok je već prošao (danas ' + fmtDate(TODAY) + ')');
        if (narrow) S('text', { x: sx1, y: SY(TODAY) - 6, 'text-anchor': 'end', 'class': 'ax' }, svg, 'danas, ' + fmtDate(TODAY));
        SE.segs = D.slips.map(function (r, k) { if (!k) return null; var p = D.slips[k - 1]; return S('path', { d: 'M' + SX(p.said) + ',' + SY(p.due) + ' L' + SX(r.said) + ',' + SY(r.due), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }, svg); });
        SE.pts = D.slips.map(function (r, k) {
          var missed = tms(r.due) < tms(TODAY), g = S('g', null, svg), L = SL[k];
          if (missed) g._ring = S('circle', { cx: SX(r.said), cy: SY(r.due), r: 8, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, style: 'transform-box:fill-box;transform-origin:center;opacity:0' }, g);
          S('circle', { cx: SX(r.said), cy: SY(r.due), r: 7, fill: missed ? 'var(--card)' : 'var(--accent)', stroke: 'var(--accent)', 'stroke-width': 2.5, 'data-tip-k': r.who + ', ' + fmtDate(r.said), 'data-tip': 'Obećani rok: ' + r.label + (missed ? ' Rok je prošao.' : '') }, g);
          S('text', { x: SX(r.said) + L.dx, y: SY(r.due) + L.dy, 'text-anchor': L.a, 'class': 'lbl-acc' }, g, nbt(r.label));
          S('text', { x: SX(r.said) + L.dx, y: SY(r.due) + L.dy + 15, 'text-anchor': L.a }, g, r.who);
          return g;
        });
        slipApply(slipStep, false);
      }
      P.mount($('slipBox'), drawSlip);
      P.scrolly($('slipScrolly'), function (i, prev) { slipStep = i; if (SE.pts) slipApply(i, prev >= 0); });
      dtable($('slipTable'), [{ t: 'Izgovoreno' }, { t: 'Ko' }, { t: 'Obećani rok' }, { t: 'Stanje ' + fmtDate(TODAY) }],
        D.slips.map(function (r) { return [fmtDate(r.said), nbt(r.who), nbt(r.label), tms(r.due) < tms(TODAY) ? 'rok je prošao' : 'rok nije prošao']; }), 'Pomjeranje roka za prve stanove');
    });

    // ---------- E2 calendar heat map + E3 chronology ----------
    near($('kalendar'), function () {
      var THEMES = D.themes, EVENTS = D.events, MONTHS = [];
      for (var yy = 2024, mm = 9; ; mm++) { if (mm > 12) { mm = 1; yy++; } MONTHS.push(yy + '-' + (mm < 10 ? '0' : '') + mm); if (yy === 2026 && mm === 10) break; }
      var NM = MONTHS.length, GRID = {}; EVENTS.forEach(function (e) { var k = e[0] + '|' + e[1]; (GRID[k] = GRID[k] || []).push(e[2]); });
      var MT = MONTHS.map(function (m) { return EVENTS.filter(function (e) { return e[0] === m; }).length; }), maxT = Math.max.apply(null, MT);
      var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      var CAL_COLORS = ['#f1efef', '#f7c4c7', '#ee7d86', '#d40511', '#7d020a'], EMPTY = THEMES.length - 1;
      var cal = $('cal'), calPick = $('calPick'), CE = { cells: [], bars: [] }, sel = null, playing = false;
      function pick(j, i, quiet) {
        var m = MONTHS[j], list = GRID[m + '|' + i] || [];
        CE.cells.forEach(function (c) { c.classList.remove('sel'); });
        sel = { j: j, i: i };
        var cell = CE.cells[i * NM + j]; if (cell) cell.classList.add('sel');
        calPick.innerHTML = '<h4>' + labelMonth(m) + ' · ' + esc(THEMES[i]) + '</h4>' + (list.length ? '<ul>' + list.map(function (t) { return '<li>' + esc(nbt(t)) + '</li>'; }).join('') + '</ul>' : '<p class="meta" style="margin-top:8px">' + (i === EMPTY ? 'Nijedan stan nije počeo da se gradi.' : 'Nema događaja.') + '</p>');
        if (!quiet) calPick.setAttribute('aria-live', 'polite');
      }
      function drawCal(w) {
        clear(cal); CE = { cells: [], bars: [] };
        var wide = w >= 640, H, lx, rx, cw, cs, top, rh, base;
        if (wide) {
          lx = Math.min(210, Math.round(w * 0.24)); rx = w - 46; cw = (rx - lx) / NM; top = 92; rh = 34; cs = Math.min(cw, rh) - 4; base = 80;
          H = top + THEMES.length * rh + 26; size(cal, w, H);
          S('text', { x: lx - 10, y: 30, 'text-anchor': 'end', 'class': 'mlbl' }, cal, 'događaja');
          S('text', { x: lx - 10, y: 44, 'text-anchor': 'end', 'class': 'mlbl' }, cal, 'po mjesecu');
          MONTHS.forEach(function (m, j) {
            var x = lx + j * cw, mo = +m.slice(5);
            if (mo === 1 || j === 0) { S('line', { x1: x, x2: x, y1: 18, y2: top + THEMES.length * rh, stroke: 'var(--ink)', 'stroke-width': 1 }, cal); S('text', { x: x + 3, y: 14, 'class': 'mlbl', style: 'fill:var(--ink)' }, cal, m.slice(0, 4) + '.'); }
            // every month when there is room, otherwise quarters only (tablet portrait)
            if (cw >= 24 || mo % 3 === 1) S('text', { x: x + cw / 2, y: top + THEMES.length * rh + 16, 'text-anchor': 'middle', 'class': 'mlbl' }, cal, ROMAN[mo - 1]);
          });
          S('text', { x: w - 2, y: top - 8, 'text-anchor': 'end', 'class': 'mlbl' }, cal, 'ukupno');
        } else {
          // phones: year labels, a strip of monthly totals with quarter ticks, then one strip per theme
          lx = 0; rx = w - 30; cw = (rx - lx) / NM; cs = Math.max(5, cw - 2); top = 74; rh = 52; base = 46;
          H = top + THEMES.length * rh + 4; size(cal, w, H);
          MONTHS.forEach(function (m, j) {
            var mo = +m.slice(5), x = lx + j * cw;
            if (mo === 1 || j === 0) S('text', { x: x + 1, y: 12, 'class': 'mlbl', style: 'fill:var(--ink)' }, cal, m.slice(0, 4) + '.');
            if (mo % 3 === 1) S('text', { x: x + cw / 2, y: 60, 'text-anchor': 'middle', 'class': 'mlbl' }, cal, ROMAN[mo - 1]);
          });
          S('text', { x: w - 2, y: 12, 'text-anchor': 'end', 'class': 'mlbl' }, cal, 'ukupno');
        }
        var bh = wide ? 50 : 24;
        MONTHS.forEach(function (m, j) {
          var x = lx + j * cw, h = MT[j] / maxT * bh;
          CE.bars.push(S('rect', { x: x + (wide ? 2 : 1), y: base - h, width: cw - (wide ? 4 : 2), height: h, fill: MT[j] ? 'var(--ink)' : 'none', 'data-h': h, 'data-b': base, 'data-tip-k': labelMonth(m), 'data-tip': MT[j] + ' događaja' }, cal));
        });
        THEMES.forEach(function (th, i) {
          var y = top + i * rh, empty = i === EMPTY, total = 0;
          if (wide) S('text', { x: lx - 12, y: y + rh / 2 + 4, 'text-anchor': 'end', 'class': 'rowlbl' + (empty ? ' empty' : '') }, cal, th);
          else S('text', { x: 0, y: y + 14, 'class': 'rowlbl' + (empty ? ' empty' : '') }, cal, th);
          MONTHS.forEach(function (m, j) {
            var list = GRID[m + '|' + i] || [], n = list.length; total += n;
            var x = lx + j * cw + (cw - cs) / 2, cy = wide ? y + (rh - cs) / 2 : y + 22, ch = wide ? cs : 16;
            if (!wide && (+m.slice(5) === 1)) S('line', { x1: lx + j * cw, x2: lx + j * cw, y1: y + 20, y2: y + 40, stroke: 'var(--hair-2)', 'stroke-width': 1 }, cal);
            var c = S('rect', { x: x, y: cy, width: cs, height: ch, fill: CAL_COLORS[Math.min(4, n)], stroke: empty ? 'var(--accent)' : 'none', 'stroke-width': empty ? 1 : 0, 'stroke-dasharray': empty ? '2 2' : null, 'class': 'cell', 'data-tip-k': labelMonth(m) + ' · ' + th, 'data-tip': n ? list.join(' · ') : (empty ? 'nijedan stan nije počeo da se gradi' : 'nema događaja') }, cal);
            c.style.transitionDelay = (j * 40 + i * 12) + 'ms';
            c.addEventListener('click', function () { pick(j, i); });
            CE.cells.push(c);
          });
          S('text', { x: w - 2, y: wide ? y + rh / 2 + 4 : y + 14, 'text-anchor': 'end', 'class': 'tot', style: empty ? 'fill:var(--accent-text);font-weight:500' : null }, cal, total);
          // phones: the whole row is the touch target. A tap picks the column under the finger; a sideways drag
          // scrubs through months; a vertical swipe just scrolls the page and changes nothing
          if (!wide) {
            var hit = S('rect', { x: lx, y: y, width: rx - lx, height: rh - 4, fill: 'transparent', 'class': 'hit' }, cal);
            var pickAt = function (e) { var r = cal.getBoundingClientRect(), j = Math.max(0, Math.min(NM - 1, Math.floor((e.clientX - r.left - lx) / cw))); pick(j, i); };
            var start = null, scrub = false;
            hit.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') { pickAt(e); scrub = true; return; } start = { x: e.clientX, y: e.clientY }; scrub = false; });
            hit.addEventListener('pointermove', function (e) {
              if (start && !scrub && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y) + 6) { scrub = true; if (hit.setPointerCapture) hit.setPointerCapture(e.pointerId); }
              if (scrub && (e.buttons || e.pointerType === 'touch')) pickAt(e);
            });
            hit.addEventListener('pointerup', function (e) { if (start && !scrub && Math.abs(e.clientY - start.y) < 10) pickAt(e); start = null; scrub = false; });
            hit.addEventListener('pointercancel', function () { start = null; scrub = false; });
          }
        });
        CE.scan = S('line', { x1: lx, x2: lx, y1: 18, y2: H - (wide ? 26 : 4), stroke: 'var(--accent)', 'stroke-width': 3, opacity: 0 }, cal);
        CE.lx = lx; CE.rx = rx;
        // the drawn labels are decoration for sighted readers; the list below and the table carry the content
        P.$$('text', cal).forEach(function (t) { t.setAttribute('aria-hidden', 'true'); });
        if (sel) pick(sel.j, sel.i, true);
      }
      P.mount($('calBox'), drawCal);
      // keyboard: the chart is one tab stop; arrows move through months and themes
      cal.addEventListener('keydown', function (e) {
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], Home: [-NM, 0], End: [NM, 0] }[e.key];
        if (!d) return;
        e.preventDefault();
        var s = sel || { j: 0, i: 0 };
        pick(Math.max(0, Math.min(NM - 1, s.j + (sel ? d[0] : 0))), Math.max(0, Math.min(THEMES.length - 1, s.i + (sel ? d[1] : 0))));
      });
      cal.addEventListener('focus', function () { if (!sel) pick(NM - 1, 0); });
      function playCal() {
        if (P.reduce) return;
        playing = true;
        cal.classList.add('pre'); void cal.getBoundingClientRect();
        setTimeout(function () { cal.classList.remove('pre'); }, 30);
        CE.scan.setAttribute('opacity', 1);
        P.tween(NM * 45 + 700, function (t) {
          var x = CE.lx + (CE.rx - CE.lx) * t; CE.scan.setAttribute('x1', x); CE.scan.setAttribute('x2', x);
          CE.bars.forEach(function (b, j) { var h = +b.getAttribute('data-h'), y0 = +b.getAttribute('data-b'), k = Math.max(0, Math.min(1, (t * NM - j) / 2)); b.setAttribute('height', h * k); b.setAttribute('y', y0 - h * k); });
        }, function () { playing = false; cal.classList.remove('pre'); CE.scan.setAttribute('opacity', 0); CE.bars.forEach(function (b) { var h = +b.getAttribute('data-h'); b.setAttribute('height', h); b.setAttribute('y', +b.getAttribute('data-b') - h); }); }, E.lin, 'cal');
      }
      enterAnim($('calBox'), function () { cal.classList.add('pre'); }, playCal);
      onReplay('kalendar', playCal);
      dtable($('calTable'), [{ t: 'Mjesec' }, { t: 'Događaja', r: 1 }, { t: 'Po temama' }],
        MONTHS.map(function (m, j) { return [labelMonth(m), MT[j], THEMES.map(function (th, i) { var n = (GRID[m + '|' + i] || []).length; return n ? esc(th) + NB + n : ''; }).filter(Boolean).join(' · ') || '—']; })
          .concat([['Svih 26 mjeseci', EVENTS.length, esc(THEMES[EMPTY]) + NB + '0: nijedan stan nije počeo da se gradi']]),
        'Događaji po mjesecu i temi, ' + labelMonth(MONTHS[0]) + ' – ' + labelMonth(MONTHS[NM - 1]));

      // chronology: the list and the chips are static HTML; this adds search and filtering
      var chronQ = $('chronQ'), chronCount = $('chronCount'), theme = -1, chips = P.$$('#chronChips button');
      var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); };
      var norm0 = norm; norm = function (s) { return norm0(s).replace(/ /g, ' '); };
      var items = P.$$('#chron li').map(function (li) { var tx = li.querySelector('.tx'), t = tx.textContent; return { li: li, tx: tx, t: t, n: norm(t), k: +li.getAttribute('data-k') }; });
      chips.forEach(function (b) {
        b.addEventListener('click', function () { theme = +b.getAttribute('data-k'); chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); filterChron(); });
      });
      function filterChron() {
        // words change their ending by case ("Mareza", "Marezu"), so a longer query also matches its stem
        var q = norm(chronQ.value.trim()), stem = q.length >= 5 ? q.slice(0, -1) : q, shown = 0;
        items.forEach(function (it) {
          var key = !q ? '' : it.n.indexOf(q) >= 0 ? q : it.n.indexOf(stem) >= 0 ? stem : null;
          var ok = (theme < 0 || it.k === theme) && key !== null;
          it.li.hidden = !ok;
          if (ok) {
            shown++;
            var at = key ? it.n.indexOf(key) : -1;
            it.tx.innerHTML = at < 0 ? esc(it.t) : esc(it.t.slice(0, at)) + '<mark>' + esc(it.t.slice(at, at + key.length)) + '</mark>' + esc(it.t.slice(at + key.length));
          }
        });
        chronCount.textContent = shown ? 'Prikazano ' + shown + ' od ' + items.length + ' događaja' : (theme === EMPTY && !q ? 'Gradnja stanova: nijedan događaj. Nijedan stan nije počeo da se gradi.' : 'Nema događaja za ovaj izbor.');
      }
      chronQ.addEventListener('input', filterChron);
      filterChron();
    });

    // ---------- F1 network (desktop graph; the phone lists are static HTML) ----------
    near($('mreza'), function () {
      var NODES = D.nodes, LINKS = D.links, byId = {};
      var GROUP = { projekat: 'Projekat', vlast: 'Vlast', izvodjaci: 'Izvođači', kontrola: 'Institucije', kritika: 'Kritičari i mediji' };
      var TYPE = { nadleznost: 'nadležnost', ugovor: 'ugovor ili nagrada', kontrola: 'kontrola i uslovi', kritika: 'kritika i mediji' };
      NODES.forEach(function (n) { byId[n.id] = n; n.deg = 0; var p = D.positions[n.id]; n.x = p[0]; n.y = p[1]; n.side = p[2]; });
      LINKS.forEach(function (l) { byId[l[0]].deg++; byId[l[1]].deg++; });
      var GCOL = { projekat: 'var(--accent)', vlast: 'var(--ink)', izvodjaci: 'var(--accent)', kontrola: 'var(--n3)', kritika: 'var(--card)' };
      var net = $('net'), NW = 1000, NH = 660, netInfo = $('netInfo');
      var netEdges = [], netNodes = [], netMoney = [], netFlows = [], hiddenT = {};
      function edgePath(a, b) { var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, k = 0.12; return 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' Q' + (mx - dy * k).toFixed(1) + ',' + (my + dx * k).toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1); }
      function linkText(l) { return byId[l[0]].l + ' → ' + byId[l[1]].l + ': ' + l[3] + (l[4] ? ' (' + nf(l[4]) + NB + '€)' : '') + ' · ' + TYPE[l[2]]; }
      // edges, flows and amounts are decoration for sighted readers; the nodes and the lists carry the content
      var gE = S('g', { 'aria-hidden': 'true' }, net), gF = S('g', { 'aria-hidden': 'true' }, net), gM = S('g', { 'aria-hidden': 'true' }, net), gN = S('g', null, net);
      LINKS.forEach(function (l) {
        var a = byId[l[0]], b = byId[l[1]], w = l[2] === 'ugovor' ? (l[4] ? Math.max(1.6, 1.2 + 1.6 * Math.log10(l[4] / 50000 + 1) * 1.6) : 1.6) : null;
        var p = S('path', { d: edgePath(a, b), 'class': 'edge t-' + l[2], 'data-tip': linkText(l) }, gE);
        if (w) p.style.strokeWidth = w;
        p._l = l; netEdges.push(p);
        if (l[2] === 'ugovor' && l[4]) {
          var fl = S('path', { d: edgePath(a, b), 'class': 'flow' }, gF); fl._l = l; netFlows.push(fl);
          var t = S('text', { 'class': 'money' }, gM, l[4] >= 1e6 ? nf(l[4] / 1e6, 2) + NB + 'mil.' + NB + '€' : nf(l[4]) + NB + '€'); t._l = l; netMoney.push(t);
        }
      });
      NODES.forEach(function (n) {
        // the tooltip shows the actor next to the pointer; the panel (beside or under the graph) lists the links
        var g = S('g', { 'class': 'node g-' + n.g, tabindex: 0, role: 'button', 'aria-label': n.l + ': ' + n.i, 'data-tip-k': n.l, 'data-tip': nbt(n.i) }, gN);
        var r = n.r = n.g === 'projekat' ? 24 : 6 + 2.2 * Math.sqrt(n.deg);
        if (n.g === 'projekat') S('circle', { r: 24, 'class': 'halo on' }, g);
        S('circle', { r: r, fill: GCOL[n.g], 'class': 'c' }, g);
        var at = { l: [-(r + 6), 4, 'end'], r: [r + 6, 4, 'start'], t: [0, -(r + 8), 'middle'], b: [0, r + (n.g === 'projekat' ? 20 : 15), 'middle'] }[n.side];
        S('text', { x: at[0], y: at[1], 'text-anchor': at[2], 'aria-hidden': 'true' }, g, n.l);
        g._n = n; n._g = g; netNodes.push(g);
      });
      function placeNet(prog) {
        var p = prog == null ? 1 : prog;
        NODES.forEach(function (n) { var x = NW / 2 + (n.x - NW / 2) * p, y = NH / 2 + (n.y - NH / 2) * p; n._g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'); n.cx = x; n.cy = y; });
        netEdges.concat(netFlows).forEach(function (e) { var a = byId[e._l[0]], b = byId[e._l[1]]; e.setAttribute('d', edgePath({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy })); });
        netMoney.forEach(function (t) { var b = byId[t._l[1]]; t.setAttribute('x', b.cx + b.r + 6); t.setAttribute('y', b.cy + 18); });
      }
      placeNet(1);
      function info(n) {
        var rel = LINKS.filter(function (l) { return l[0] === n.id || l[1] === n.id; });
        var m10 = rel.length % 10, m100 = rel.length % 100, word = m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ' veze' : ' veza';
        netInfo.innerHTML = '<p class="meta">' + GROUP[n.g] + ' · ' + rel.length + word + '</p><p class="net-info__h">' + esc(n.l) + '</p><p class="net-info__t">' + esc(n.i) + '</p><ul>' +
          rel.map(function (l) { var out = l[0] === n.id, o = byId[out ? l[1] : l[0]]; return '<li><span class="lt">' + TYPE[l[2]] + '</span> ' + (out ? '→ ' : '← ') + '<b>' + esc(o.l) + '</b>: ' + esc(l[3]) + (l[4] ? ' <span class="m">' + nf(l[4]) + NB + '€</span>' : '') + '</li>'; }).join('') + '</ul>';
      }
      function focusNode(n) {
        P.$$('.on', net).forEach(function (x) { if (!x.classList.contains('halo')) x.classList.remove('on'); });
        if (!n) { net.classList.remove('focus'); return; }
        net.classList.add('focus'); n._g.classList.add('on'); info(n);
        netEdges.forEach(function (e) { var l = e._l; if ((l[0] === n.id || l[1] === n.id) && !hiddenT[l[2]]) { e.classList.add('on'); byId[l[0]]._g.classList.add('on'); byId[l[1]]._g.classList.add('on'); } });
        netFlows.concat(netMoney).forEach(function (x) { if (x._l[0] === n.id || x._l[1] === n.id) x.classList.add('on'); });
      }
      var dragN = null;
      netNodes.forEach(function (g) {
        g.addEventListener('pointerenter', function (e) { if (!dragN && e.pointerType !== 'touch') focusNode(g._n); });
        g.addEventListener('pointerleave', function (e) { if (!dragN && e.pointerType !== 'touch') focusNode(null); });
        g.addEventListener('focus', function () { focusNode(g._n); });
        g.addEventListener('blur', function () { focusNode(null); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusNode(g._n); } });
      });
      function svgPt(e) { var r = net.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * NW, y: (e.clientY - r.top) / r.height * NH }; }
      net.addEventListener('pointerdown', function (e) { var g = e.target.closest('.node'); if (!g) { focusNode(null); return; } dragN = g._n; net.setPointerCapture(e.pointerId); g.style.cursor = 'grabbing'; focusNode(g._n); });
      net.addEventListener('pointermove', function (e) { if (!dragN) return; var p = svgPt(e); dragN.x = Math.max(20, Math.min(NW - 20, p.x)); dragN.y = Math.max(20, Math.min(NH - 20, p.y)); placeNet(1); });
      function dragEnd() { if (dragN) { dragN._g.style.cursor = ''; dragN = null; } }
      net.addEventListener('pointerup', dragEnd); net.addEventListener('pointercancel', dragEnd);
      P.$$('#netLegend button').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-type'), on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', on ? 'true' : 'false'); hiddenT[t] = !on;
          netEdges.concat(netFlows, netMoney).forEach(function (x) { if (x._l[2] === t) x.style.display = on ? '' : 'none'; });
        });
      });
      var fb = P.$('#netMobile .flowbars');
      function playBars() { if (!fb || P.reduce) return; fb.classList.add('pre'); setTimeout(function () { fb.classList.remove('pre'); }, 60); }
      function playNet() {
        if (window.innerWidth <= 900) { playBars(); return; }
        if (P.reduce) { net.classList.add('flowing'); return; }
        net.classList.remove('flowing');
        netEdges.forEach(function (e) { e.style.opacity = 0; });
        netMoney.forEach(function (t) { t.style.opacity = 0; });
        netNodes.forEach(function (g) { g.style.opacity = 0; });
        P.tween(1600, function (t) { placeNet(t); netNodes.forEach(function (g, i) { g.style.opacity = Math.max(0, Math.min(1, t * 3 - i * 0.04)); }); }, function () {
          placeNet(1); netNodes.forEach(function (g) { g.style.opacity = ''; });
          netEdges.forEach(function (e, i) { setTimeout(function () { e.style.opacity = ''; drawPath(e, 900, 0); setTimeout(function () { e.style.transition = ''; e.style.strokeDasharray = ''; e.style.strokeDashoffset = ''; }, 950); }, i * 30); });
          setTimeout(function () { netMoney.forEach(function (t) { t.style.opacity = ''; }); P.restartClass(net, 'flowing'); }, 1500);
        }, E.out, 'net');
      }
      P.onEnter($('netWrap'), playNet);
      if (fb && !P.reduce) { fb.classList.add('pre'); P.onEnter(fb, playBars); }
      onReplay('mreza', playNet);
    });

    // ---------- G1 source filter (the section codes are links in the HTML, written by tools/build.js) ----------
    var srcItems = P.$$('#srcs li'), srcB = P.$$('.src-tools button');
    srcB.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-k');
        srcB.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        srcItems.forEach(function (li) { li.classList.toggle('is-hidden', k !== 'all' && li.getAttribute('data-k') !== k); });
      });
    });

    // ---------- G2 data download ----------
    $('dlData').addEventListener('click', function () {
      // a fresh copy: the charts attach DOM nodes to the working data
      var data = JSON.parse(document.getElementById('vb-data').textContent); delete data.positions;
      var promises = P.$$('#promises .promise').map(function (c) {
        return { obecanje: c.querySelector('q').textContent, ko_i_kada: c.querySelector('.who').textContent, status: c.querySelector('.stamp').textContent, provjera: c.querySelector('.fact').textContent.replace(/\s*Naša računica\s*$/, '').trim() };
      });
      var out = {
        naslov: 'Velje brdo: obećano 20.000 stanova, izgrađeno 0', url: 'https://www.podaci.me/analize/velje-brdo/', stanje_informacija: D.stanje,
        napomena: 'Projekcija troška, tempo gradnje, subvencija po stanu i rate su računice Podaci.me, ne činjenice iz dokumenata.',
        izvedeno: { trasa_km: +routeKm.toFixed(2), cijena_m2_sa_pdv: +contractPerM2.toFixed(2), cijena_m2_bez_pdv: +netPerM2.toFixed(2), cijena_stana_bez_pdv: Math.round(perFlat), prosjecna_povrsina_m2: +avgArea.toFixed(2), projekcija_20000_stanova_eur: Math.round(projection), broj_faza: +phases.toFixed(1), godina_tempom_prve_faze: +years.toFixed(1), dana_od_obecanog_useljenja: late },
        profil_ostvarenja: AXES.map(function (a) { return { osa: a.k, ostvareno: a.f, udio: +a.v.toFixed(4), objasnjenje: a.d }; }),
        obecanja: promises,
        podaci: data
      };
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      a.download = 'velje-brdo-podaci-' + D.stanje + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    });

    // a page opened on an anchor: build everything above the target now, so the jump stays put
    if (P.jumpTarget) buildUpTo(P.jumpTarget);
  }

  if (P.ready) boot(); else document.addEventListener('p:ready', boot);
})();
