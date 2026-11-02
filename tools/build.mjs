#!/usr/bin/env node
// Pre-renders index.html (every link as crawlable HTML), sitemap.xml,
// robots.txt, the web manifest, the service worker version and og.png.
// The output is plain files; GitHub Pages serves the repo root as-is.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
// Favicons are fetched by tools/favicons.mjs (in CI) into assets/fav/<id>.png.
const favOf = id => existsSync(`assets/fav/${id}.png`) ? `assets/fav/${id}.png` : null;
import { createHash } from 'node:crypto';
import { Resvg } from '@resvg/resvg-js';
import { MARKS, DEFAULT_MARK } from './lib/marks.mjs';
import { outline, wrap } from './lib/type.mjs';

import { coverColour } from './lib/color.mjs';
import { domainOf } from '../assets/js/core/url.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const cfg = read('linkmery.config.json');
const { entries } = read('data/bookmarks.json');
const shelves = read('data/shelves.json').sort((a, b) => a.order - b.order);
const synonyms = read('data/synonyms.json');
const realShelves = shelves.filter(s => !s.kind);
// On GitHub Actions the address is known: https://owner.github.io/repo/.
// A siteUrl in the config wins once it's set to something real.
const ghPages = (() => {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
  if (!owner) return null;
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${repo.toLowerCase()}/` : `https://${owner.toLowerCase()}.github.io/${repo}/`;
})();
const configured = cfg.siteUrl && !/example\.github\.io/.test(cfg.siteUrl) ? cfg.siteUrl : null;
const siteRaw = configured || ghPages || cfg.siteUrl;
const site = siteRaw.endsWith('/') ? siteRaw : siteRaw + '/';
const ON_HOME = 7;   // books shown per shelf on the home page

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const human = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const TYPE_LABEL = { tool: 'Tool', article: 'Article', video: 'Video', inspiration: 'Inspiration', reference: 'Reference' };

const order = new Map(entries.map((e, i) => [e.id, i]));   // later in the file = added later
const byNewest = (a, b) => b.added.localeCompare(a.added) || order.get(b.id) - order.get(a.id);
const lastUpdated = entries.map(e => e.added).sort().pop() || new Date().toISOString().slice(0, 10);
const shelfOf = id => shelves.find(s => s.id === id);

// ---------- pieces ----------
// The lockup's three books get classes so the logo easter egg can move them.
const lockup = () => {
  const wm = outline('linkmery', { size: 40, x: 0, y: 32, weight: 500, tracking: -0.02 });
  const w = 44 + 10 + Math.ceil(wm.width);
  let n = 0;
  const mark = MARKS[DEFAULT_MARK].inner('currentColor', 1.75).replace(/<rect /g, () => `<rect class="bk bk${++n}" `);
  return `<svg class="lockup" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 44" width="${w}" height="44" aria-hidden="true" focusable="false">
  <svg x="0" y="0" width="44" height="44" viewBox="0 0 32 32" overflow="visible">${mark}</svg>
  <g transform="translate(54 3)"><path fill="currentColor" d="${wm.d}"/></g></svg>`;
};

// Each link is a book. Its cover fades from paper at the top to the colour
// of the site's favicon at the foot; a favicon with no real colour (black,
// white, grey), or none, makes a white book. Older books gather a patina.
const colours = new Map(entries.map(e => [e.id, favOf(e.id) ? coverColour(favOf(e.id)) : null]));
const bookStyle = id => { const c = colours.get(id); return c ? ` style="--bk:${c.bg};--bk-ink:${c.ink}"` : ''; };
const ageOf = added => Math.min(3, Math.floor((Date.now() - Date.parse(added)) / (365.25 * 864e5)));
const letterOf = e => esc((e.title.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase());
// Without a fetched favicon the cover shows a letter, and the browser tries
// the favicon itself (data-host) once the book comes into view.
const artHtml = e => {
  const f = favOf(e.id);
  return f ? `<span class="cv-art"><img src="${f}" alt="" width="32" height="32" loading="lazy" decoding="async"></span>`
    : `<span class="cv-art mono" data-host="${esc(domainOf(e.url))}" aria-hidden="true">${letterOf(e)}</span>`;
};
const coverHtml = e => {
  const dom = domainOf(e.url);
  return `
        <article class="cover${colours.get(e.id) ? '' : ' paper'}${e.pinned ? ' pinned' : ''}${e.deadSince ? ' dead' : ''}" id="l-${e.id}" data-id="${e.id}" data-age="${ageOf(e.added)}"${bookStyle(e.id)}>
          <h3 class="cv-t"><a href="${esc(e.url)}" rel="noopener">${esc(e.title).replace(/([a-z])([A-Z])/g, '$1<wbr>$2')}</a></h3>
          ${artHtml(e)}
          <p class="cv-site">${esc(dom)}</p>
          <p class="cv-d">${esc(e.description)}</p>${e.why ? `
          <p class="cv-why">For ${esc(e.why)}</p>` : ''}
          <p class="cv-m"><span class="cv-dom">${esc(dom)}</span><span class="cv-type">${TYPE_LABEL[e.type]}</span><time datetime="${e.added}">${human(e.added)}</time>${e.deadSince ? `<span class="cv-dead">Moved out${e.archiveUrl ? `, <a href="${esc(e.archiveUrl)}" rel="noopener">archived copy</a>` : ''}</span>` : ''}</p>
        </article>`;
};

// Things that live on certain shelves.
// Shelves hold books only.
const ORNAMENT = {};

const shelvesHtml = realShelves.map(s => {
  const items = entries.filter(e => e.shelf === s.id).sort(byNewest);
  return `
    <section class="shelf" id="${s.id}" data-view="shelf" aria-labelledby="h-${s.id}">
      <header class="shelf-head">
        <h2 id="h-${s.id}" class="shelf-label"><a href="#${s.id}" tabindex="-1">${esc(s.name)}</a></h2>
        ${s.note ? `<p class="shelf-note">${esc(s.note)}</p>` : ''}
      </header>
      <div class="rows">${items.map(coverHtml).join('')}${items.length > ON_HOME ? `
        <a class="see-all" href="#${s.id}"><span>See all</span><svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4"/></svg></a>` : ''}${ORNAMENT[s.id] ? `
        <div class="ornament" aria-hidden="true">${ORNAMENT[s.id]()}</div>` : ''}
      </div>
      <a class="shelf-plate" href="#${s.id}" aria-label="Open the ${esc(s.name)} shelf"><span>${esc(s.name)}</span></a>
    </section>`;
}).join('');


const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: cfg.shortName,
  headline: cfg.title,
  description: cfg.description,
  url: site,
  inLanguage: cfg.lang,
  dateModified: lastUpdated,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: entries.length,
    itemListElement: [...entries].sort(byNewest).map((e, i) => ({
      '@type': 'ListItem', position: i + 1, url: e.url, name: e.title, description: e.description,
    })),
  },
};

// Data for the JS layer, embedded so the page needs no runtime fetch.
const payload = JSON.stringify({ entries: entries.map(e => ({ ...e, ...(favOf(e.id) && { fav: favOf(e.id) }), ...(colours.get(e.id) && { colour: colours.get(e.id) }), age: ageOf(e.added) })), shelves, synonyms, config: { cheats: (cfg.cheats || []).filter(c => c.code && c.open), gemsOlderThanDays: cfg.gemsOlderThanDays, exampleSearches: cfg.exampleSearches, siteUrl: site, ownerName: cfg.ownerName || '' } })
  .replace(/</g, '\\u003c');
// Version stamp for cache busting: covers the data and every script and stylesheet.
const assetFiles = ['assets/css/tokens.css', 'assets/css/site.css', ...readdirSync('assets/js', { recursive: true }).filter(f => f.endsWith('.js')).sort().map(f => `assets/js/${f}`)];
const assetHash = createHash('sha1').update(payload + assetFiles.map(f => readFileSync(f, 'utf8')).join('')).digest('hex').slice(0, 8);

const html = `<!doctype html>
<html lang="${cfg.lang}" data-theme="day">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="canonical" href="${site}">
<meta name="theme-color" content="#ffffff">
<script>
/* Theme: by default follows India Standard Time for every visitor (day 06:00
   to 18:00). The footer switch can pin Day or Night; that choice is remembered. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  function mode() { try { return localStorage.getItem('lm.theme') || 'ist'; } catch (e) { return 'ist'; } }
  function set() {
    var m = mode();
    var h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
    root.dataset.theme = m === 'day' || m === 'night' ? m : (h >= ${cfg.dayStartsIST} && h < ${cfg.nightStartsIST}) ? 'day' : 'night';
    root.dataset.mode = m;
  }
  window.__lmTheme = set;
  set(); setInterval(set, 60000);
})();
</script>
<link rel="preload" href="assets/fonts/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/instrument-sans-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/fraunces-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/tokens.css?v=${assetHash}">
<link rel="stylesheet" href="assets/css/site.css?v=${assetHash}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.shortName)}">
<meta property="og:title" content="${esc(cfg.title)}">
<meta property="og:description" content="${esc(cfg.description)}">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${site}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Linkmery: a shelf of link covers beside the logo, three books on a shelf">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(cfg.title)}">
<meta name="twitter:description" content="${esc(cfg.description)}">
<meta name="twitter:image" content="${site}og.png">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#q">Skip to search</a>

<main class="almari" id="main">
  <div class="plaque" id="plaque" role="button" tabindex="0" aria-label="The Library of Links, kept by ${esc(cfg.ownerName || 'hand')}" data-since="${entries.map(e => e.added).sort()[0] || ''}">
    <span class="pl-turn">
      <span class="pl-face pl-front"><span class="pl-title">The Library of Links</span><em>kept by ${esc(cfg.ownerName || 'hand')}</em></span>
      <span class="pl-face pl-back" aria-live="polite"><span class="pl-time" id="pl-time">Nothing to see here :)</span><em id="pl-secret"></em></span>
    </span>
    <span class="pl-brooch" aria-hidden="true"><svg viewBox="0 0 32 32" width="26" height="26">${MARKS[DEFAULT_MARK].inner('currentColor', 2.2)}</svg></span>
  </div>
  <div class="cabinet-top">
    <button type="button" class="light-btn" id="light" data-js aria-pressed="false" aria-label="The little light"><i class="contact"></i>
      <svg class="bulb" viewBox="0 0 60 120" aria-hidden="true"><defs>
        <radialGradient id="bl-glass" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fffaf0" stop-opacity=".55"/><stop offset=".5" stop-color="#e9dcc0" stop-opacity=".16"/><stop offset="1" stop-color="#b9a47a" stop-opacity=".3"/></radialGradient>
        <radialGradient id="bl-glow" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#ffd98a"/><stop offset=".45" stop-color="#ffb648" stop-opacity=".75"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient>
        <linearGradient id="bl-brass" x1="0" x2="1"><stop offset="0" stop-color="#6e4f1a"/><stop offset=".3" stop-color="#e6c77c"/><stop offset=".55" stop-color="#b98d3c"/><stop offset="1" stop-color="#5e4214"/></linearGradient>
        <linearGradient id="bl-base" x1="0" x2="1"><stop offset="0" stop-color="#2a1d0c"/><stop offset=".35" stop-color="#7a5a26"/><stop offset=".6" stop-color="#4b3513"/><stop offset="1" stop-color="#1e1508"/></linearGradient></defs>
        <circle class="bl-glow" cx="30" cy="38" r="30" fill="url(#bl-glow)"/>
        <path class="bl-glass" d="M30 6C16 6 8 17 8 30c0 10 6 17 10 23 3 4 4 7 4 11h16c0-4 1-7 4-11 4-6 10-13 10-23C52 17 44 6 30 6Z" fill="url(#bl-glass)" stroke="#d8c9a4" stroke-opacity=".55" stroke-width="1"/>
        <path d="M17 22c2-6 7-10 13-11" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" fill="none"/>
        <g class="bl-fil" fill="none" stroke-linecap="round"><path d="M26 63V40M34 63V40" stroke="#7d6a48" stroke-width=".8"/>
          <path class="wire" d="M26 40c0-6 2-12 4-12s4 6 4 12M26 40c1-3 2-3 2 0s1 3 2 0 1-3 2 0 1 3 2 0" stroke="#8a6a3a" stroke-width="1.1"/></g>
        <rect x="21" y="63" width="18" height="17" rx="2" fill="url(#bl-brass)"/>
        <path d="M21 67h18M21 71h18M21 75h18" stroke="#5a3f12" stroke-opacity=".55" stroke-width="1"/>
        <path d="M14 82h32l4 14H10Z" fill="url(#bl-brass)"/>
        <rect x="6" y="96" width="48" height="9" rx="2" fill="url(#bl-base)"/>
        <path d="M6 97.5h48" stroke="#c9a24e" stroke-opacity=".6" stroke-width="1"/>
        <rect class="bl-switch" x="44" y="86" width="3.5" height="7" rx="1.5" fill="#2a1d0c"/></svg>
    </button>
    <button type="button" class="plant-btn" id="plant" data-js aria-label="Water the money plant"><i class="contact"></i>
      <img class="money" src="assets/img/plant.avif" alt="" width="210" height="720" decoding="async"><i class="drop d1" aria-hidden="true"></i><i class="drop d2" aria-hidden="true"></i><i class="drop d3" aria-hidden="true"></i><i class="drop d4" aria-hidden="true"></i>
    </button>
  </div>
  <div class="cabinet-doors" id="doors" data-js hidden>
    <div class="door l" aria-hidden="true">
      <svg class="door-lines" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="6" y="4" width="88" height="92" rx="2"/><path d="M14 10l14 -6M14 24l30 -14"/></svg>
      <span class="hinge t"></span><span class="hinge b"></span>
    </div>
    <div class="door r" aria-hidden="true">
      <svg class="door-lines" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="6" y="4" width="88" height="92" rx="2"/><path d="M60 96l26 -12M78 96l10 -5"/></svg>
      <span class="hinge t"></span><span class="hinge b"></span>
    </div>
    <span class="seam" aria-hidden="true"></span>
    <span class="keyhole" aria-hidden="true"></span>
    <button type="button" class="knob" id="open-doors" aria-label="Open Linkmery"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">${MARKS[DEFAULT_MARK].inner('currentColor', 1.9)}</svg></button>
    <p class="cue" aria-hidden="true"><span id="cue-hello">Come in.</span> Tap to open</p>
  </div>

  <button type="button" class="btn back" id="back" data-js><svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg>All shelves</button>
  <button type="button" class="btn share-room" id="share-room" data-js><svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5"/></svg><span>Share<span class="long"> this shelf</span></span></button>
  <div class="almari-head">
    <h1 class="crest"><span class="crest-btn" id="crest">${lockup()}</span><span class="sr-only">Linkmery: a visual designer's links on type, colour, interface and brand</span></h1>
    <noscript><p class="crest-fallback">Linkmery</p></noscript>
    <p class="dedication">${esc(cfg.dedication || 'Links I keep coming back to, each one kept for a reason.')}</p>
    <div class="search-row">
      <form class="search" role="search" action="#" data-js>
        <label for="q" class="sr-only">Search the shelves</label>
        <input id="q" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Search the shelves" aria-describedby="search-help">
        <kbd class="slash" aria-hidden="true">/</kbd>
        <p id="search-help" class="sr-only">Results appear as you type. Press Escape to clear.</p>
      </form>
      <button type="button" class="btn surprise" id="random" data-js aria-label="Wander: a random book from a random shelf"><svg class="i compass" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2"/><path class="needle" d="M12.6 7.4l-1.5 3.7-3.7 1.5 1.5-3.7z"/></svg>Wander</button>
    </div>
    <div class="drawer" id="drawer" data-js hidden></div>
    <section class="shelf found" id="found" data-js aria-live="polite" hidden></section>
  </div>

  <div class="shelves" id="shelves">${shelvesHtml}
  </div>
</main>

<div class="minibar" id="minibar" data-js aria-hidden="true">
  <button type="button" class="mini-mark" tabindex="-1" aria-label="Back to the top"><svg viewBox="0 0 32 32" width="22" height="22">${MARKS[DEFAULT_MARK].inner('currentColor', 2)}</svg></button>
  <nav class="aisles" aria-label="Jump to a shelf"></nav>
  <button type="button" class="btn icon mini-search" tabindex="-1" aria-label="Search the shelves"><svg class="i" viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/></svg></button>
  <button type="button" class="btn icon" id="random-mini" tabindex="-1" aria-label="Wander to a random book"><svg class="i compass" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2"/><path class="needle" d="M12.6 7.4l-1.5 3.7-3.7 1.5 1.5-3.7z"/></svg></button>
</div>

<footer class="foot">
  <div class="why-wrap" data-js>
    <span class="foot-mark" aria-hidden="true">${lockup()}</span>
    <button type="button" class="why-btn" id="why-btn" aria-expanded="false" aria-controls="why"><span>Why I made this</span></button>
    <section class="why" id="why" aria-label="Why I made this" hidden>
      ${(cfg.why || []).map(t => `<p>${esc(t.replaceAll('{count}', entries.length))}</p>`).join('\n      ')}${cfg.nameOrigin ? `
      <p class="name">${esc(cfg.nameOrigin)}</p>` : ''}
      <p class="sig">Kept and made by ${esc(cfg.ownerName || 'hand')}.</p>
    </section>
  </div>
  <noscript><p class="why-nojs">${esc((cfg.why || [])[0] || '')} Kept and made by ${esc(cfg.ownerName || 'hand')}.</p></noscript>
  <div class="foot-row">
    <p class="clock"><span id="clock">Lit by India Standard Time.</span><span class="steam" aria-hidden="true"><i></i><i></i><i></i></span></p>
    <div class="foot-ctl" data-js>
      <a class="btn small" href="changelog.html">What’s new</a>
      <div class="seg lights" role="radiogroup" aria-label="Lights">
        <button type="button" role="radio" data-mode="ist" aria-checked="true">India time</button>
        <button type="button" role="radio" data-mode="day" aria-checked="false">Day</button>
        <button type="button" role="radio" data-mode="night" aria-checked="false">Night</button>
      </div>
      <button type="button" class="btn small" id="sound" aria-pressed="true"><svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path class="wave" d="M13 7.5a3.5 3.5 0 0 1 0 5M15.2 5.5a6.5 6.5 0 0 1 0 9"/><path class="mute" d="M13.5 8l4 4M17.5 8l-4 4"/></svg><span>Sound on</span></button>
    </div>
  </div>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script type="application/json" id="lm-data">${payload}</script>
<script type="module" src="assets/js/app.js?v=${assetHash}"></script>
</body>
</html>
`;
writeFileSync('index.html', html);

// ---------- crawl and install files ----------
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}</loc><lastmod>${lastUpdated}</lastmod></url>
</urlset>
`);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`);
writeFileSync('manifest.webmanifest', JSON.stringify({
  name: 'Linkmery', short_name: 'Linkmery', description: cfg.description,
  start_url: './', scope: './', display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');

const sw = readFileSync('tools/lib/sw.template.js', 'utf8').replace('__VERSION__', assetHash);
writeFileSync('sw.js', sw);

// ---------- share image ----------
const W = 1200, H = 630, INK = '#ededea', MUTED = '#9a9a94', LINE = '#3d3d3a', BRASS = '#d2a95a';
const t = (text, o) => `<path fill="${o.fill || INK}" d="${outline(text, o).d}"/>`;
const head = wrap("A visual designer's links, on shelves", 560, { size: 64, weight: 500 });
const sample = [...entries].sort(byNewest).slice(0, 4);
const plan = sample.map((e, i) => {
  const x = 660 + (i % 2) * 230, y = 150 + Math.floor(i / 2) * 200, w = 200, h = 140;
  const lines = wrap(e.title, w - 36, { size: 22, weight: 500 }).slice(0, 2);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="${INK}" stroke-opacity=".7" stroke-width="2"/>`
    + lines.map((l, j) => t(l, { size: 22, x: x + 18, y: y + 38 + j * 27, weight: 500 })).join('')
    + t(domainOf(e.url).slice(0, 18), { size: 14, x: x + 18, y: y + h - 18, family: 'mono', weight: 400, fill: MUTED });
}).join('') + [0, 1].map(r => `<path d="M640 ${150 + r * 200 + 152}H1130" stroke="${INK}" stroke-opacity=".55" stroke-width="2"/>`).join('');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#000"/>
  <svg x="72" y="72" width="72" height="72" viewBox="0 0 32 32">${MARKS[DEFAULT_MARK].inner(INK, 1.6)}</svg>
  ${t('linkmery', { size: 56, x: 162, y: 128, weight: 500, tracking: -0.02 })}
  ${head.map((l, i) => t(l, { size: 64, x: 72, y: 300 + i * 74, weight: 500, tracking: -0.015 })).join('')}
  ${t(`${entries.length} links on type, colour, interface and brand`, { size: 26, x: 72, y: 300 + head.length * 74 + 30, weight: 400, fill: MUTED })}
  <path d="M72 560H560" stroke="${BRASS}" stroke-width="2"/>
  ${plan}
</svg>`;
writeFileSync('og.png', new Resvg(og, { fitTo: { mode: 'width', value: W } }).render().asPng());

// ---------- extension shares the core modules and tokens ----------
if (existsSync('extension')) {
  mkdirSync('extension/core', { recursive: true });
  for (const f of ['search.js', 'normalize.js', 'url.js', 'colour.js']) cpSync(`assets/js/core/${f}`, `extension/core/${f}`);
  cpSync('assets/css/tokens.css', 'extension/core/tokens.css');
  rmSync('extension/fonts', { recursive: true, force: true });
  cpSync('assets/fonts', 'extension/fonts', { recursive: true });
  mkdirSync('extension/icons', { recursive: true });
  for (const s of [16, 32, 48, 128]) cpSync(`icons/icon-${s}.png`, `extension/icons/icon-${s}.png`);
}

console.log(`build: ${entries.length} links, ${realShelves.length} shelves, version ${assetHash}`);
