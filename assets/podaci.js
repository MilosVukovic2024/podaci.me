/* Podaci.me — shared runtime: menu, reveal, counters, tooltip, scrollytelling, chart mounting, chapter nav, anchor jumps.
   Every helper leaves the page in a truthful final state even if an animation never runs. */
(function (w, d) {
  'use strict';
  var root = d.documentElement;
  // the runtime is here, so the page is in JS mode even if the head's slow-load fallback already fired
  if (w.__noJsT) clearTimeout(w.__noJsT);
  root.classList.remove('no-js'); root.classList.add('js');
  var mq = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var P = w.P = { reduce: !!(mq && mq.matches) };
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { P.reduce = e.matches; });
  var NS = 'http://www.w3.org/2000/svg';
  var hasIO = 'IntersectionObserver' in w;

  P.$ = function (s, c) { return (c || d).querySelector(s); };
  P.$$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  var NFC = {};
  P.nf = function (v, dec) { dec = dec || 0; return (NFC[dec] || (NFC[dec] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }))).format(Number(v)); };

  P.svg = function (tag, attrs, parent, text) {
    var n = d.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
  P.h = function (tag, attrs, parent, html) {
    var n = d.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  };

  P.ease = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    io: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lin: function (t) { return t; }
  };

  // rAF tween with a timer backstop: a hidden tab or panel still lands on the final frame
  var runs = {};
  P.tween = function (ms, step, done, ease, key) {
    ease = ease || P.ease.out;
    var token = key ? (runs[key] = (runs[key] || 0) + 1) : 0;
    var finished = false;
    function finish() { if (finished || (key && runs[key] !== token)) return; finished = true; step(1); if (done) done(); }
    if (P.reduce || ms <= 0) { finish(); return; }
    var t0 = null;
    function f(now) {
      if (finished || (key && runs[key] !== token)) return;
      if (t0 === null) t0 = now;
      var t = Math.min(1, (now - t0) / ms);
      if (t < 1) { step(ease(t)); w.requestAnimationFrame(f); } else finish();
    }
    w.requestAnimationFrame(f);
    setTimeout(finish, ms + 250);
  };
  P.cancel = function (key) { runs[key] = (runs[key] || 0) + 1; };
  P.later = function (fn, ms) { if (P.reduce) fn(); else setTimeout(fn, ms); };
  // restart a CSS animation on the next frames instead of forcing a synchronous layout
  P.restartClass = function (node, cls) {
    node.classList.remove(cls);
    var done = false, add = function () { if (!done) { done = true; node.classList.add(cls); } };
    w.requestAnimationFrame(function () { w.requestAnimationFrame(add); });
    setTimeout(add, 80);
  };

  // ---------- animated numbers ----------
  function fmt(node, v) {
    var dec = +(node.getAttribute('data-dec') || 0);
    return (node.getAttribute('data-pre') || '') + P.nf(v, dec) + (node.getAttribute('data-suf') || '');
  }
  P.countTo = function (node, to, ms, from) {
    var dec = +(node.getAttribute('data-dec') || 0);
    if (from == null) from = node._v != null ? node._v : 0;
    node._v = to;
    if (to === 0 && from === 0) { node.textContent = fmt(node, 0); P.restartClass(node, 'zero-in'); return; }
    var key = node._key || (node._key = 'c' + Math.random().toString(36).slice(2));
    P.tween(ms || 1400, function (t) {
      var v = from + (to - from) * t;
      node.textContent = fmt(node, dec ? v : Math.round(v));
    }, function () { node.textContent = fmt(node, to); if (to === 0) P.restartClass(node, 'zero-in'); }, P.ease.out, key);
  };

  // ---------- one-shot entry observer ----------
  P.onEnter = function (el, fn, margin) {
    if (!el) return;
    if (!hasIO) { fn(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(el); } });
    }, { rootMargin: margin || '0px 0px -22% 0px' });
    io.observe(el);
  };

  function initReveal() {
    var items = P.$$('[data-reveal]');
    if (!hasIO) { items.forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    items.forEach(function (n) { io.observe(n); });
    P.$$('[data-count]').forEach(function (n) {
      var to = +n.getAttribute('data-count');
      n._v = to;
      if (P.reduce) return;
      P.onEnter(n, function () { P.countTo(n, to, +(n.getAttribute('data-ms') || 1500), 0); }, '0px 0px -12% 0px');
    });
  }

  // ---------- tooltip: hover, focus, tap; Escape closes; a mouse may move onto it ----------
  // hidden from assistive technology: everything it shows is also in the data tables and lists
  var tip;
  function initTip() {
    tip = P.h('div', { 'class': 'tip', 'aria-hidden': 'true' }, d.body);
    var cur = null, hideT = 0, lastPt = 'mouse';
    d.addEventListener('pointerdown', function (e) { lastPt = e.pointerType; }, true);
    function text(t) {
      var k = t.getAttribute('data-tip-k'), v = t.getAttribute('data-tip');
      tip.textContent = '';
      if (k) P.h('b', null, tip).textContent = k;
      tip.appendChild(d.createTextNode(v));
    }
    function at(x, y) {
      var tw = tip.offsetWidth, th = tip.offsetHeight, px = x + 14, py = y + 18;
      if (px + tw > w.innerWidth - 8) px = Math.max(8, x - tw - 14);
      if (py + th > w.innerHeight - 8) py = Math.max(8, y - th - 14);
      tip.style.left = px + 'px'; tip.style.top = py + 'px';
    }
    // only a mouse or pen can enter the tooltip; on touch it must never cover the next tap target
    function show(t, x, y, hover) { clearTimeout(hideT); cur = t; text(t); tip.classList.add('on'); tip.classList.toggle('hov', !!hover); at(x, y); }
    function hide() { clearTimeout(hideT); cur = null; tip.classList.remove('on', 'hov'); }
    function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 300); }
    d.addEventListener('pointerover', function (e) { if (e.pointerType === 'touch') return; var t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t, e.clientX, e.clientY, true); });
    // it follows the pointer only while the pointer is on the mark, so the pointer can travel onto it
    d.addEventListener('pointermove', function (e) { if (cur && e.pointerType !== 'touch' && cur.contains(e.target)) at(e.clientX, e.clientY); });
    d.addEventListener('pointerout', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (t && e.pointerType !== 'touch' && !(e.relatedTarget && tip.contains(e.relatedTarget))) hideSoon();
    });
    tip.addEventListener('pointerenter', function () { clearTimeout(hideT); });
    tip.addEventListener('pointerleave', hideSoon);
    d.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (t && !t.closest('a,button')) { var r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top + r.height / 2, lastPt !== 'touch'); }
      else if (!t && !tip.contains(e.target)) hide();
    });
    d.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) { var r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.bottom, false); } });
    d.addEventListener('focusout', hide);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) hide(); });
    w.addEventListener('scroll', hide, { passive: true });
  }

  // ---------- responsive chart mounting ----------
  // draw(width) rebuilds the chart at its real pixel width, so labels stay legible and nothing overflows the page
  P.mount = function (el, draw) {
    var last = -1, api = { width: 0, redraw: function () { last = -1; run(); } };
    function run() {
      var wd = Math.round(el.clientWidth);
      if (!wd || Math.abs(wd - last) < 2) return;
      last = wd; api.width = wd; draw(wd);
    }
    if ('ResizeObserver' in w) new ResizeObserver(run).observe(el); else w.addEventListener('resize', run);
    run();
    return api;
  };

  // ---------- scrollytelling ----------
  // the active step is always the last one whose top has passed the middle of the screen, decided from geometry,
  // so stopping on a boundary, scrolling back or jumping in from an anchor never leaves the stage on a stale step
  P.scrolly = function (el, onStep) {
    var steps = P.$$('.step', el), cur = -1, raf = 0;
    function go(i, force) {
      if (i === cur && !force) return;
      var prev = cur; cur = i;
      steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      onStep(i, prev);
    }
    function pick() {
      raf = 0;
      var line = w.innerHeight / 2, i = 0;
      for (var j = 0; j < steps.length; j++) if (steps[j].getBoundingClientRect().top <= line) i = j;
      go(i);
    }
    function req() { if (!raf) raf = w.requestAnimationFrame(pick); }
    go(0, true);
    if (hasIO) {
      var io = new IntersectionObserver(req, { rootMargin: '-48% 0px -48% 0px' });
      steps.forEach(function (s) { io.observe(s); });
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) req(); }).observe(el);
    } else {
      w.addEventListener('scroll', req, { passive: true });
    }
    pick();
    return {
      go: go,
      get current() { return cur; },
      scrollTo: function (i) {
        var s = steps[i]; if (!s) return;
        var r = s.getBoundingClientRect();
        w.scrollTo({ top: w.scrollY + r.top + r.height / 2 - w.innerHeight / 2, behavior: P.reduce ? 'auto' : 'smooth' });
      }
    };
  };

  // ---------- anchor jumps: keep the target aligned while lazy content above it settles ----------
  // pages listen to 'p:jump' (detail = target element) to build anything above the target before the browser scrolls
  function initJumps() {
    var target = null, until = 0, timer = 0;
    function stop() {
      target = null; clearInterval(timer); timer = 0;
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (t) { w.removeEventListener(t, stop, true); });
    }
    function align() {
      if (!target) { stop(); return; }
      if (P.jumpBusy && P.jumpBusy()) until = Math.max(until, Date.now() + 600);
      if (Date.now() > until) { stop(); return; }
      // the same offset the browser uses for a fragment: root scroll-padding plus the target's own scroll-margin
      var pad = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      var top = target.getBoundingClientRect().top;
      if (Math.abs(top - pad) > 2) w.scrollTo(0, w.scrollY + top - pad);
    }
    function start(el) {
      stop(); target = el; until = Date.now() + 2500;
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (t) { w.addEventListener(t, stop, { capture: true, passive: true }); });
      timer = setInterval(align, 100); setTimeout(align, 0);
    }
    function byHash(h) { try { return h && h.length > 1 ? d.getElementById(decodeURIComponent(h.slice(1))) : null; } catch (e) { return null; } }
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var el = byHash(a.getAttribute('href')); if (!el) return;
      d.dispatchEvent(new CustomEvent('p:jump', { detail: el }));
      setTimeout(function () { start(el); }, 0);
    }, true);
    w.addEventListener('hashchange', function () { var el = byHash(location.hash); if (el && el !== target) start(el); });
    // a reload or Back/Forward restores the reader's own scroll position: do not pull it to the hash
    var nt = w.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    var restoring = nt && (nt.type === 'reload' || nt.type === 'back_forward');
    P.jumpTarget = byHash(location.hash);
    if (P.jumpTarget && !restoring) start(P.jumpTarget);
    if (restoring) P.jumpTarget = null;
  }

  // ---------- global menu: disclosure; Escape and leaving it close it ----------
  function initMenu() {
    var b = P.$('.menu-btn'), nav = P.$('#gh-nav');
    if (!b || !nav) return;
    var isOpen = function () { return b.getAttribute('aria-expanded') === 'true'; };
    function set(open) {
      nav.classList.toggle('is-open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('menu-open', open && !P.$('.gh').classList.contains('gh--flow'));
    }
    b.addEventListener('click', function () { set(!isOpen()); });
    P.$$('a', nav).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { set(false); b.focus(); } });
    nav.addEventListener('focusout', function (e) { var t = e.relatedTarget; if (isOpen() && t && !nav.contains(t) && t !== b) set(false); });
    w.addEventListener('resize', function () { if (w.innerWidth > 880 && isOpen()) set(false); });
  }

  // ---------- chapter nav: per-chapter progress, current chapter, tone ----------
  function initLnav() {
    var nav = P.$('.lnav'); if (!nav) return;
    root.classList.add('has-lnav');
    var acts = P.$$('[data-act]'), segs = P.$$('.lnav__segs a', nav), now = P.$('.lnav__now', nav), list = P.$('.lnav__segs', nav);
    var tocBtn = P.$('.lnav__toc', nav), toc = P.$('#toc');
    var ticking = false, lastOn = -1;
    function update() {
      ticking = false;
      var vh = w.innerHeight, mid = vh * 0.45, lh = nav.offsetHeight, on = -1, toneDark = false;
      acts.forEach(function (a, i) {
        var r = a.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height)));
        if (segs[i]) segs[i].style.setProperty('--p', p.toFixed(4));
        if (r.top <= mid && r.bottom > mid) on = i;
        if (r.top <= lh && r.bottom > lh) toneDark = a.getAttribute('data-tone') === 'night';
      });
      nav.classList.toggle('is-dark', toneDark);
      if (on !== lastOn) {
        lastOn = on;
        segs.forEach(function (s, i) { s.classList.toggle('is-on', i === on); if (i === on) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current'); });
        if (now) now.innerHTML = on >= 0 ? '<b>' + acts[on].getAttribute('data-act') + '</b>' + acts[on].getAttribute('data-title') : (now.getAttribute('data-default') || '');
      }
    }
    function req() { if (!ticking) { ticking = true; w.requestAnimationFrame(update); } }
    w.addEventListener('scroll', req, { passive: true });
    w.addEventListener('resize', req);
    w.addEventListener('load', req);
    req();
    // on phones the chapter links shrink to progress bars: keep them out of the tab order there, the TOC button is the route
    if (list && w.matchMedia) {
      var narrow = w.matchMedia('(max-width:760px)');
      var sync = function () { list.inert = narrow.matches; if (narrow.matches) list.setAttribute('aria-hidden', 'true'); else list.removeAttribute('aria-hidden'); };
      sync(); if (narrow.addEventListener) narrow.addEventListener('change', sync);
    }
    if (tocBtn && toc) {
      var isOpen = function () { return tocBtn.getAttribute('aria-expanded') === 'true'; };
      var set = function (open) { toc.classList.toggle('is-open', open); tocBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) { var f = P.$('a', toc); if (f) f.focus({ preventScroll: true }); } };
      tocBtn.addEventListener('click', function () { set(!isOpen()); });
      P.$$('a', toc).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { set(false); tocBtn.focus(); } });
      d.addEventListener('click', function (e) { if (isOpen() && !nav.contains(e.target)) set(false); });
      nav.addEventListener('focusout', function (e) { var t = e.relatedTarget; if (isOpen() && t && !nav.contains(t)) set(false); });
    }
  }

  // ---------- replay buttons ----------
  function initReplay() {
    P.$$('[data-replay]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = d.getElementById(b.getAttribute('data-replay'));
        if (t) t.dispatchEvent(new CustomEvent('replay'));
      });
    });
  }

  function boot() { initMenu(); initReveal(); initTip(); initLnav(); initReplay(); initJumps(); P.ready = true; d.dispatchEvent(new CustomEvent('p:ready')); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
