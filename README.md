# Podaci.me

Biznis analitika iz Crne Gore i svijeta (Fidelity Consulting d.o.o., Podgorica).

Statički HTML, hostovan na Vercelu, vizuelno usklađen sa Tendering.me
(Archivo; #f3f2f2 / #201e1d / crvena #d40511; okviri 2 px; mreža 1280 px).
Vercel ne pokreće build — commituje se gotov HTML.

## Struktura

```
index.html                                 početna
analize/velje-brdo/index.html              Velje brdo: obećano 20.000 stanova (prva analiza; snimci u img/)
arhiva/skupstina-vmidmiko5c/index.html     Skupštinski monitor 2023–2026, sakriven: bez linkova, noindex, van sitemapa;
                                           stara adresa /analize/skupstina-2023-2026/ vodi na početnu (vercel.json)
og-image.png, og-velje-brdo.png, og-skupstina.png, favicon.svg
vercel.json, robots.txt, sitemap.xml
```

## Nova analiza

1. `analize/<slug>/index.html` — ista traka (`.sitebar`) i podnožje (`.sitefoot`) kao Skupštinski monitor.
2. Kartica na početnoj u `#analize`, oblast u `#oblasti` sa „U pripremi" na „Objavljeno".
3. URL u `sitemap.xml`.
4. `git add -A && git commit -m "..." && git push` — Vercel objavljuje sam.

## Kontakt

office@fidelityconsulting.me · 067 525 774
