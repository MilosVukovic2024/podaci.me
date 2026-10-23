/* Crna Gora i Singapur — sticky scena „Četiri omjera“: traka i broj se mijenjaju po koraku. */
document.addEventListener('p:ready', function () {
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
