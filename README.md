# Podaci.me

Biznis analitika iz Crne Gore i svijeta (Fidelity Consulting d.o.o., Podgorica).

Statički HTML, hostovan na Vercelu, vizuelno usklađen sa Tendering.me
(Archivo; #f3f2f2 / #201e1d / crvena #d40511; okviri 2 px; mreža 1280 px).
Vercel ne pokreće build — commituje se gotov HTML.

## Struktura

```
index.html                                 početna
analize/skupstina-2023-2026/index.html     Skupštinski monitor 2023–2026 (podaci ugrađeni u stranicu)
og-image.png, og-skupstina.png, favicon.svg
vercel.json, robots.txt, sitemap.xml
```

## Nova analiza

1. `analize/<slug>/index.html` — ista traka (`.sitebar`) i podnožje (`.sitefoot`) kao Skupštinski monitor.
2. Kartica na početnoj u `#analize`, oblast u `#oblasti` sa „U pripremi" na „Objavljeno".
3. URL u `sitemap.xml`.
4. `git add -A && git commit -m "..." && git push` — Vercel objavljuje sam.

## Kontakt

office@fidelityconsulting.me · 067 525 774
