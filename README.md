# Podaci.me

Biznis analitika iz Crne Gore i svijeta (Fidelity Consulting d.o.o., Podgorica).

Statički HTML, hostovan na Vercelu. Vercel ne pokreće build — commituje se gotov HTML, CSS i JS.

## Dizajn v2 (oktobar 2026)

Bijela strana, crna tipografija, jedna crvena (#d40511) za razliku između obećanog i stvarnog.
Archivo (varijabilni 400–800) za tekst, IBM Plex Mono samo za podatke, datume i izvore.
Tamne sekcije (#0b0b0c) i sive (#f5f5f7) smjenjuju se po poglavljima; mreža 1280 px.
Projekcije i naše računice su šrafirane i označene „Naša računica“ — nikad istim stilom kao dokumentovane vrijednosti.

## Struktura

```
index.html                                 početna
assets/podaci.css                          dizajn sistem: tokeni, header, dugmad, reveal, navigacija poglavlja, scrollytelling, tabele
assets/podaci.js                           zajednički JS: meni, reveal, brojači, tooltip, scrollytelling, crtanje grafikona po širini
analize/velje-brdo/index.html              Velje brdo: 7 poglavlja (A Obećanje … G Dokazi); tekst u HTML-u, podaci u <script id="vb-data">
analize/velje-brdo/story.css               scene analize
analize/velje-brdo/story.js                grafikoni i scene analize (grade se kad se čitalac približi)
analize/velje-brdo/img/                    Sentinel-2 snimci: original .jpg/.png + .webp (1100 i 720 px) + crno-bijela verzija (-bw)
analize/crna-gora-singapur/                Crna Gora i Singapur: 7 poglavlja (A Država … G Dokazi); story.css i story.js (sticky scena „Četiri omjera“)
analize/crna-gora-u-brojkama-monstata/index.html     Monstat u brojkama: samostalna stranica (34 oblasti, 465 grafikona, d3 sa CDN-a); vlastiti CSS, zaglavlje i podnožje kao na sajtu
arhiva/skupstina-vmidmiko5c/index.html     Skupštinski monitor 2023–2026, sakriven: bez linkova, noindex, van sitemapa;
                                           stara adresa /analize/skupstina-2023-2026/ vodi na početnu (vercel.json)
og-image.png, og-velje-brdo.png, og-crna-gora-singapur.png, og-monstat-u-brojkama.png, og-skupstina.png, favicon.svg, fidelity-logo.svg
vercel.json, robots.txt, sitemap.xml
tools/build.js                             upisuje statičke dijelove Velje brda iz #vb-data (vidi dolje); sajt ga ne učitava
```

Tabela paukovog dijagrama, hronologija, spisak veza mreže i mobilna mreža su statički HTML između oznaka
`<!--gen:x-->`, da bi se stranica čitala i bez JavaScript-a i da bi sidra padala na pravo mjesto.
Poslije svake izmjene podataka u `#vb-data` pokrenuti `node tools/build.js` (može više puta, rezultat je isti).

Stara sidra Velje brda (`#teren`, `#obecanja`, `#profil`, `#razmjera`, `#cijena`, `#novac`, `#rokovi`,
`#kalendar`, `#prepreke`, `#mreza`, `#glasovi`, `#projekat`, `#izvori`) i dalje rade.

## Nova analiza

1. `analize/<slug>/index.html` sa istim headerom (`.gh`), navigacijom poglavlja (`.lnav`) i podnožjem (`.gf`); učitati `/assets/podaci.css` i `/assets/podaci.js`.
2. Scene analize u `analize/<slug>/story.css` i `story.js`; svaki grafikon ima izvor ispod i tabelu podataka (`<details class="data">`).
3. Kartica na početnoj u `#analize`, oblast u `#oblasti` sa „U pripremi“ na „Objavljeno“.
4. URL u `sitemap.xml`.
5. `git add -A && git commit -m "..." && git push` — Vercel objavljuje sam.

## Kontakt

office@fidelityconsulting.me · 067 525 774
