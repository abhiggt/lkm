#!/usr/bin/env node
// Generates the logo files, favicon, app icons and the brand board.
// Usage: node tools/brand.mjs [--mark a|b|c]
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { MARKS, DEFAULT_MARK, markSvg } from './lib/marks.mjs';
import { outline } from './lib/type.mjs';

const arg = process.argv.indexOf('--mark');
const pick = arg > -1 ? process.argv[arg + 1] : DEFAULT_MARK;
const INK = '#1a1a1a', NIGHT_INK = '#ededea', BRASS = '#8a6417';

mkdirSync('assets/brand', { recursive: true });
mkdirSync('icons', { recursive: true });

// Wordmark: lowercase, Instrument Sans 600, tightened.
const WM = outline('linkmery', { size: 40, x: 0, y: 32, weight: 500, tracking: -0.02 });
const wmW = Math.ceil(WM.width);
const wordmark = (c = 'currentColor') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wmW} 42" width="${wmW}" height="42" role="img" aria-label="linkmery"><path fill="${c}" d="${WM.d}"/></svg>`;

// Lockup: mark sized to the x-height band + wordmark.
const lockup = (key, c = 'currentColor') => {
  const w = 44 + 10 + wmW;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 44" width="${w}" height="44" role="img" aria-label="Linkmery">
  <svg x="0" y="0" width="44" height="44" viewBox="0 0 32 32">${MARKS[key].inner(c, 1.75)}</svg>
  <g transform="translate(54 3)"><path fill="${c}" d="${WM.d}"/></g>
</svg>`;
};

for (const k of Object.keys(MARKS)) writeFileSync(`assets/brand/mark-${k}.svg`, markSvg(k));
writeFileSync('assets/brand/mark.svg', markSvg(pick));
writeFileSync('assets/brand/wordmark.svg', wordmark());
writeFileSync('assets/brand/lockup.svg', lockup(pick));
writeFileSync('assets/brand/lockup-mono-black.svg', lockup(pick, '#000'));
writeFileSync('assets/brand/lockup-mono-white.svg', lockup(pick, '#fff'));

// Favicon follows the OS colour scheme (the page itself follows IST).
writeFileSync('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>.s{stroke:${INK}}@media (prefers-color-scheme:dark){.s{stroke:${NIGHT_INK}}}</style>
  ${MARKS[pick].inner('currentColor', 2.2).replaceAll('stroke="currentColor"', 'class="s"')}
</svg>`);

// PNG icons: transparent small sizes; app icons on a solid tile.
const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
for (const s of [16, 32, 48, 128]) {
  const sw = s <= 16 ? 2.3 : s <= 32 ? 2 : 1.75;
  writeFileSync(`icons/icon-${s}.png`, png(markSvg(pick, { color: INK, size: s, sw }), s));
}
const tile = (pad, bg, fg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <svg x="${pad}" y="${pad}" width="${512 - 2 * pad}" height="${512 - 2 * pad}" viewBox="0 0 32 32">${MARKS[pick].inner(fg, 1.5)}</svg>
</svg>`;
writeFileSync('icons/icon-192.png', png(tile(72, '#ffffff', INK), 192));
writeFileSync('icons/icon-512.png', png(tile(72, '#ffffff', INK), 512));
writeFileSync('icons/icon-maskable-512.png', png(tile(128, '#000000', '#d2a95a'), 512));
writeFileSync('icons/apple-touch-icon.png', png(tile(64, '#ffffff', INK), 180));

// ---------- brand board ----------
const sizes = [16, 32, 48, 128, 512];
const conceptBlock = (k, i) => `
<section class="concept" aria-labelledby="c-${k}">
  <h2 id="c-${k}">${i + 1}. ${MARKS[k].name}${k === pick ? ' <span class="pick">current pick</span>' : ''}</h2>
  ${['day', 'night'].map(t => `
  <div class="strip ${t}">
    <div class="sizes">${sizes.map(s => `<figure><div class="m" style="width:${Math.min(s, 160)}px;height:${Math.min(s, 160)}px">${markSvg(k, { size: Math.min(s, 160), sw: s <= 16 ? 2.3 : s <= 32 ? 2 : 1.75 })}</div><figcaption>${s}${s > 160 ? ' (shown 160)' : ''}</figcaption></figure>`).join('')}</div>
    <div class="lock">${lockup(k)}</div>
    <div class="tab"><span class="fav">${markSvg(k, { size: 16, sw: 2.3 })}</span><span>Linkmery</span><span class="x">×</span></div>
  </div>`).join('')}
</section>`;

const board = `<!doctype html>
<html lang="en" data-theme="day">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Linkmery brand board</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="../assets/css/tokens.css">
<style>
  body { margin: 0; font-family: var(--font-sans); background: #f6f6f4; color: #1a1a1a; }
  main { max-width: 1100px; margin: 0 auto; padding: 48px 16px 96px; }
  h1 { font-size: 2.5rem; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; font-weight: 600; margin: 56px 0 12px; }
  p { max-width: 68ch; line-height: 1.5; }
  .pick { font-size: .8rem; font-weight: 500; color: #8a6417; border: 1.5px solid #8a6417; border-radius: 3px; padding: 1px 6px; margin-left: 8px; vertical-align: middle; }
  .strip { border-radius: 6px; padding: 24px; margin: 8px 0; display: grid; grid-template-columns: 1fr; gap: 20px; }
  .strip.day { background: #fff; color: #1a1a1a; border: 1.5px solid #e2e2de; }
  .strip.night { background: #000; color: #ededea; }
  .sizes { display: flex; align-items: flex-end; gap: 28px; flex-wrap: wrap; }
  figure { margin: 0; display: grid; justify-items: center; gap: 6px; }
  figcaption { font-family: var(--font-mono); font-size: 12px; opacity: .6; }
  .m svg { display: block; width: 100%; height: 100%; }
  .lock > svg { display: block; height: 44px; width: auto; overflow: visible; }
  .tab { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px 12px; border-radius: 8px 8px 0 0; width: 220px; }
  .day .tab { background: #ededea; } .night .tab { background: #1c1c1c; }
  .fav svg { display: block; } .tab .x { margin-left: auto; opacity: .5; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  .card { background: #fff; border: 1.5px solid #e2e2de; border-radius: 6px; padding: 20px; }
  .card.night { background: #000; color: #ededea; border-color: #000; }
  .sw { display: flex; gap: 8px; align-items: center; margin: 6px 0; font-family: var(--font-mono); font-size: 13px; }
  .sw i { width: 36px; height: 36px; border-radius: 3px; display: inline-block; }
  .t1 { font-family: "Instrument Sans"; } .t2 { font-family: "Instrument Serif", serif; }
  .mono { font-family: var(--font-mono); font-size: 13px; color: #64645f; }
  .night .mono { color: #9a9a94; }
  .copy { font-size: 1.05rem; }
  ol.q li { margin: 8px 0; line-height: 1.5; }
</style>
<style>@font-face { font-family: "Instrument Serif"; src: url("../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2") format("woff2"); }</style>
</head>
<body><main>
<h1>Linkmery brand board</h1>
<p>Linkmery blends almari (अलमारी, cupboard), library and "link meri" (my links). The idea: a glass-front almari. Visitors look in and take a copy of anything; only the owner rearranges the shelves. Reply with picks by number, for example "logo 1, type A, accent 1, voice ok".</p>

<h2>Logo concepts</h2>
<p>Each mark is drawn on a 32 px grid with one monoline stroke, the same line the floor plan uses. Shown at five sizes on the day and night themes, with a lockup and a browser tab.</p>
${Object.keys(MARKS).map(conceptBlock).join('')}

<h2>Type pairings</h2>
<div class="row">
  <div class="card"><p class="mono">A (in use)</p><p class="t1" style="font-size:2rem;font-weight:600;letter-spacing:-.02em;margin:0">Tool to pick colours</p><p class="t1">Instrument Sans for titles and UI. Open licence, self-hosted, about 60 KB for three weights.</p><p class="mono">oklch.com 12 Mar 2025</p><p class="mono">IBM Plex Mono for domains and dates</p></div>
  <div class="card"><p class="mono">B</p><p class="t2" style="font-size:2.3rem;margin:0">Tool to pick colours</p><p class="t1">Instrument Serif for titles, Instrument Sans for UI. Softer, more bookish, closer to the library half of the name.</p><p class="mono">IBM Plex Mono for metadata</p></div>
</div>
<p>Devanagari: should "अलमारी" appear in the About text only (works with either pairing, falls back to the system font) or in the logo lockup (needs a Devanagari face added)? Default: About text only.</p>

<h2>Accent</h2>
<div class="row">
  <div class="card"><p class="mono">1 (in use): almari brass, from the key and lock</p>
    <div class="sw"><i style="background:#8a6417"></i>#8a6417 on white, 5.4:1</div>
    <div class="sw"><i style="background:#d2a95a"></i>#d2a95a on black, 9.6:1</div></div>
  <div class="card"><p class="mono">2: steel almari green, from the painted cupboard</p>
    <div class="sw"><i style="background:#2f6b5f"></i>#2f6b5f on white, 6.2:1</div>
    <div class="sw"><i style="background:#86c2b2"></i>#86c2b2 on black, 10.4:1</div></div>
</div>

<h2>Voice</h2>
<div class="row">
  <div class="card copy"><p class="mono">Empty search</p><p>Nothing on these shelves for "kerning bot". Try "kerning" or browse Type.</p></div>
  <div class="card copy"><p class="mono">Random link button</p><p>Pull one out</p></div>
  <div class="card copy night"><p class="mono">Dead link badge</p><p>This page has moved out. The archived copy still opens.</p></div>
</div>
</main></body></html>`;
mkdirSync('brand', { recursive: true });
writeFileSync('brand/board.html', board);
console.log(`brand: mark ${pick}, wordmark ${wmW}px, icons and board written`);
