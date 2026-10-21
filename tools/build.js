// Writes the static parts of the Velje brdo page from its own data block (#vb-data), between <!--gen:x--> markers:
// radar table, chronology chips and list, the list of network links, and the phone version of the network.
// Static HTML means correct heights before any script runs (anchors land where they should), and text for readers
// and crawlers without JavaScript. story.js only adds behaviour to these parts. Run after editing #vb-data:
//   node tools/build.js
const fs = require('fs');
const path = require('path');
// works both in the working folder (site/ next to tools/) and in the repository (tools/ at the site root)
const siteRoot = fs.existsSync(path.join(__dirname, '..', 'site', 'analize')) ? path.join(__dirname, '..', 'site') : path.join(__dirname, '..');
const file = path.join(siteRoot, 'analize', 'velje-brdo', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const D = JSON.parse(html.match(/<script type="application\/json" id="vb-data">([\s\S]*?)<\/script>/)[1]);

const NF = {};
const nf = (v, dec = 0) => (NF[dec] || (NF[dec] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }))).format(Number(v));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MNAME = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
const labelMonth = (m) => MNAME[+m.slice(5) - 1] + ' ' + m.slice(0, 4) + '.';
const pct = (v) => nf(v * 100, v > 0 && v < 0.05 ? 1 : 0) + '%';
const TYPE = { nadleznost: 'nadležnost', ugovor: 'ugovor ili nagrada', kontrola: 'kontrola i uslovi', kritika: 'kritika i mediji' };
const GROUP = { projekat: 'Projekat', vlast: 'Vlast', izvodjaci: 'Izvođači', kontrola: 'Institucije', kritika: 'Kritičari i mediji' };
const DOT = { projekat: 'd-izv', vlast: 'd-vlast', izvodjaci: 'd-izv', kontrola: 'd-kon', kritika: 'd-kri' };

// route length, same method as story.js
let rl = 0;
for (let i = 1; i < D.route.length; i++) rl += Math.hypot(D.route[i][0] - D.route[i - 1][0], D.route[i][1] - D.route[i - 1][1]);
const routeKm = rl * D.routeMetersPerUnit / 1000;

function put(name, body) {
  const re = new RegExp('(<!--gen:' + name + '-->)[\\s\\S]*?(<!--/gen:' + name + '-->)');
  if (!re.test(html)) throw new Error('marker missing: ' + name);
  html = html.replace(re, (m, a, b) => a + body + b);
}

// B3 radar table
put('rtab', D.profile.map((a, i) => {
  const v = a.from === 'route' ? Math.min(1, routeKm / a.of) : a.have / a.of;
  const f = a.from === 'route' ? nf(routeKm, 1) + ' / ' + nf(a.of, 1) + ' km' : a.f;
  return `<tr><td><span class="rtab__n">${i + 1}</span>${esc(a.k)}<span class="d">${esc(f)} · ${esc(a.d)}</span><span class="mb"><i style="transform:scaleX(${+v.toFixed(5)})"></i></span></td><td class="p${v < 0.05 ? ' zero' : ''}">${pct(v)}</td></tr>`;
}).join(''));

// E3 chronology
put('chips', [`<button type="button" class="chip-btn" aria-pressed="true" data-k="-1">Sve <span class="n">${D.events.length}</span></button>`]
  .concat(D.themes.map((th, k) => `<button type="button" class="chip-btn" aria-pressed="false" data-k="${k}">${esc(th)} <span class="n">${D.events.filter((e) => e[1] === k).length}</span></button>`)).join(''));
put('chron', D.events.map((e) => `<li data-k="${e[1]}"><time datetime="${e[0]}">${labelMonth(e[0])}</time><span class="tx">${esc(e[2])}</span><span class="th k${e[1]}">${esc(D.themes[e[1]])}</span></li>`).join(''));

// F1 network: full list of links, with their type
const byId = {}; D.nodes.forEach((n) => { byId[n.id] = n; });
const linkText = (l) => byId[l[0]].l + ' → ' + byId[l[1]].l + ': ' + l[3] + (l[4] ? ' (' + nf(l[4]) + ' €)' : '');
put('netlist', D.links.map((l) => `<li><span class="lt">${TYPE[l[2]]}</span> ${esc(linkText(l))}</li>`).join(''));

// F1 network on phones: money ranking + actors with their links
const money = D.links.filter((l) => l[2] === 'ugovor' && l[4]).sort((a, b) => b[4] - a[4]);
const max = money[0][4];
let mob = '<div class="flowbars"><div><h4>Ugovori i nagrade, po vrijednosti</h4><p class="sub">Eura, ista skala. Gotovo sav novac ide od Ministarstva javnih radova.</p></div>';
mob += money.map((l) => `<div class="fb"><div class="fb__row"><b>${esc(byId[l[1]].l)}</b><span>${nf(l[4])} €</span></div><div class="fb__bar"><i style="width:${Math.max(0.4, l[4] / max * 100).toFixed(2)}%"></i></div><p class="meta">${esc(byId[l[0]].l)} → ${esc(l[3])}</p></div>`).join('');
mob += '</div><div class="actors"><h4>Akteri i veze</h4>';
for (const gk of ['projekat', 'vlast', 'izvodjaci', 'kontrola', 'kritika']) {
  mob += `<div class="actor-g"><p><i class="dot ${DOT[gk]}"></i>${GROUP[gk]}</p>`;
  for (const n of D.nodes.filter((x) => x.g === gk)) {
    const rel = D.links.filter((l) => l[0] === n.id || l[1] === n.id);
    mob += `<details class="actor"><summary>${esc(n.l)}<span>${rel.length}</span></summary><div class="in"><p>${esc(n.i)}</p><ul>` +
      rel.map((l) => { const out = l[0] === n.id, o = byId[out ? l[1] : l[0]]; return `<li><span class="lt">${TYPE[l[2]]}</span> ${out ? '→' : '←'} ${esc(o.l)}: ${esc(l[3])}${l[4] ? ' (' + nf(l[4]) + ' €)' : ''}</li>`; }).join('') +
      '</ul></div></details>';
  }
  mob += '</div>';
}
mob += '</div>';
put('netmobile', mob);

// G1: section codes next to each source become links to the sections (also without JavaScript)
const CODE = { A1: 'izjave', A2: 'obecanja', B1: 'teren', B2: 'uporedi', B3: 'profil', B4: 'prepreke', C1: 'razmjera', C2: 'tempo', C3: 'projekat', D1: 'cijena', D2: 'novac', D3: 'subvencija', E1: 'rokovi', E2: 'kalendar', E3: 'hronologija', F1: 'mreza', F2: 'glasovi' };
html = html.replace(/<span class="srcs__u">([\s\S]*?)<\/span>/g, (m, inner) => {
  const codes = inner.replace(/<[^>]+>/g, '').split('·').map((c) => c.trim()).filter(Boolean);
  return '<span class="srcs__u">' + codes.map((c) => (CODE[c] ? `<a href="#${CODE[c]}">${c}</a>` : esc(c))).join(' · ') + '</span>';
});

// numbers stay with their units and dates stay on one line, in every text node of the page (not in scripts, styles or attributes)
const cutAt = html.indexOf('<script type="application/json"');
const nbsp = (t) => t
  .replace(/(\d{1,2})\. (\d{1,2})\. (\d{4})/g, '$1. $2. $3')
  .replace(/(\d) (€|m²|ha|km|mil\.|mlrd\.|dana|godine)(?=[\s.,;:)\/<“"]|$)/g, '$1 $2')
  .replace(/(mil\.|mlrd\.) €/g, '$1 €');
html = html.slice(0, cutAt).split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/).map((part) =>
  /^<(script|style)/.test(part) ? part : part.replace(/>([^<]+)/g, (m, t) => '>' + nbsp(t))
).join('') + html.slice(cutAt);

fs.writeFileSync(file, html, 'utf8');
console.log('built: rtab', D.profile.length, '· chron', D.events.length, '· links', D.links.length, '· actors', D.nodes.length, '· route', routeKm.toFixed(3), 'km');
