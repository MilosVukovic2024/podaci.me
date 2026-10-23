/* Pokreće scenu kad je zajednički runtime spreman, i kad je signal stigao prije ove skripte. */
function onReady(fn) { if (window.P && window.P.ready) fn(); else document.addEventListener('p:ready', fn); }

/* Crna Gora i Singapur — sticky scena „Četiri omjera“: traka i broj se mijenjaju po koraku. */
onReady(function () {
  'use strict';
  var P = window.P, $ = function (id) { return document.getElementById(id); };
  var el = $('gapScrolly'); if (!el) return;
  var S = [
    { k: 'Teritorija', v: 19, dec: 0, l: 'više prostora ima Crna Gora', cg: 13883, sg: 735, fc: '13.883 km²', fs: '≈735 km²', src: 'Izvor: Monstat, godišnjak 2024; Singapur, zaokruženo.' },
    { k: 'Stanovništvo', v: 10, dec: 0, l: 'više stanovnika ima Singapur', cg: 623633, sg: 6210000, fc: '623.633', fs: '6,21 mil.', src: 'Izvor: Monstat, popis 2023; NPTD, jun 2026.' },
    { k: 'BDP po stanovniku', v: 6.7, dec: 1, l: 'veći BDP po stanovniku u Singapuru', cg: 14817, sg: 98878, fc: '14.817 USD', fs: '98.878 USD', src: 'Izvor: Svjetska banka; CEIC/SingStat, 2025.' },
    { k: 'Ukupni BDP', v: 65, dec: 0, l: 'veća ekonomija Singapura', cg: 9.2, sg: 600, fc: '9,2 mlrd USD', fs: '≈600 mlrd USD', src: 'Izvor: Svjetska banka; SingStat. BDP Singapura u USD: naša računica.' }
  ];
  var V = $('gapV'), fc = $('gapFillCg'), fs = $('gapFillSg'), dots = P.$$('.gap__dots i', el);
  P.scrolly(el, function (i, prev) {
    var s = S[i], m = Math.max(s.cg, s.sg);
    $('gapN').textContent = '0' + (i + 1); $('gapK').textContent = s.k; $('gapL').textContent = s.l;
    $('gapCg').textContent = s.fc; $('gapSg').textContent = s.fs; $('gapSrc').textContent = s.src;
    // minimum vidljive širine, da najmanja vrijednost ne nestane
    fc.style.setProperty('--s', Math.max(0.012, s.cg / m).toFixed(4));
    fs.style.setProperty('--s', Math.max(0.012, s.sg / m).toFixed(4));
    dots.forEach(function (d, j) { d.classList.toggle('on', j <= i); });
    V.setAttribute('data-dec', s.dec);
    if (prev < 0 || P.reduce) { V._v = s.v; V.textContent = P.nf(s.v, s.dec) + '×'; }
    else P.countTo(V, s.v, 1000, S[prev].v);
  });
});

/* Penzije — sticky scena „Stopa doprinosa“: složena traka zaposleni + poslodavac, skala do 37%. */
onReady(function () {
  'use strict';
  var P = window.P, $ = function (id) { return document.getElementById(id); };
  var el = $('pioScrolly'); if (!el) return;
  var MAX = 37;
  var S = [
    { k: 'Crna Gora do oktobra 2024.', emp: 15, er: 5.5, l: 'bruto zarade odlazilo je u Fond PIO', src: 'Izvor: Zakon o PIO prije izmjena iz 2024.', sg: false },
    { k: 'Crna Gora od 1. 10. 2024.', emp: 10, er: 0, l: 'poslije programa „Evropa sad 2“; poslodavac ne plaća', src: 'Izvor: Dan; Zakon o PIO, izmjene 2024.', sg: false },
    { k: 'Crna Gora od 2027, predlog', emp: 0, er: 0, l: 'doprinosa po Euro modelu; penzije iz budžeta', src: 'Izvor: predlozi zakona utvrđeni 17. 9. 2026; Skupština ih nije usvojila.', sg: false },
    { k: 'Singapur, do 55 godina', emp: 20, er: 17, l: 'zarade na lični račun u CPF-u', src: 'Izvor: CPF Board, stope od 1. 1. 2026.', sg: true }
  ];
  var V = $('pioV'), emp = $('pioEmp'), er = $('pioEr'), track = emp.parentNode, dots = P.$$('.gap__dots i', el);
  function pct(v) { return P.nf(v, v % 1 ? 1 : 0) + '%'; }
  P.scrolly(el, function (i, prev) {
    var s = S[i], tot = s.emp + s.er;
    $('pioN').textContent = '0' + (i + 1); $('pioK').textContent = s.k; $('pioL').textContent = s.l; $('pioSrc').textContent = s.src;
    $('pioTot').textContent = pct(tot); $('pioEmpV').textContent = pct(s.emp); $('pioErV').textContent = pct(s.er);
    emp.style.width = (s.emp / MAX * 100).toFixed(2) + '%';
    er.style.left = (s.emp / MAX * 100).toFixed(2) + '%';
    er.style.width = (s.er / MAX * 100).toFixed(2) + '%';
    track.classList.toggle('is-sg', s.sg);
    track.classList.toggle('is-zero', tot === 0);
    dots.forEach(function (d, j) { d.classList.toggle('on', j <= i); });
    var dec = tot % 1 ? 1 : 0; V.setAttribute('data-dec', dec);
    if (prev < 0 || P.reduce) { V._v = tot; V.textContent = pct(tot); }
    else P.countTo(V, tot, 1000, S[prev].emp + S[prev].er);
  });
});
