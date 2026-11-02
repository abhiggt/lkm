#!/usr/bin/env node
// Fetches a favicon for every link into assets/fav/<id>.png, so the site
// never asks another server for an icon while someone is browsing it.
// Runs in the Deploy workflow before the build; links without an icon keep
// their letter monogram.
//
// Usage: node tools/favicons.mjs [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const force = process.argv.includes('--force');
const { entries } = JSON.parse(readFileSync('data/bookmarks.json', 'utf8'));
mkdirSync('assets/fav', { recursive: true });
const host = url => new URL(url).hostname;

import { iconSize } from './lib/color.mjs';

// Tried in order. Google's service gives a sharp PNG for most sites, but for
// a site it doesn't know it returns a tiny grey globe, so anything 16 px or
// smaller is passed over for the site's own apple-touch-icon or DuckDuckGo.
const sources = url => [
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(url))}&sz=128`,
  `https://${host(url)}/apple-touch-icon.png`,
  `https://icons.duckduckgo.com/ip3/${host(url)}.ico`,
];

async function get(src) {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (Linkmery favicons)' } });
    if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 120 ? buf : null;
  } catch { return null; }
}

async function fetchIcon(url) {
  let small = null;
  for (const src of sources(url)) {
    const buf = await get(src);
    if (!buf) continue;
    const size = iconSize(buf);
    if (size && size.w > 16) return buf;
    if (!src.includes('google.com')) small ||= buf;   // a small real icon beats Google's globe
  }
  return small;
}

let got = 0, kept = 0, missed = [];
const queue = entries.filter(e => force || !existsSync(`assets/fav/${e.id}.png`));
kept = entries.length - queue.length;
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let e; (e = queue.shift());) {
    const buf = await fetchIcon(e.url);
    if (buf) { writeFileSync(`assets/fav/${e.id}.png`, buf); got++; } else missed.push(e.title);
  }
}));
console.log(`favicons: ${got} fetched, ${kept} already here, ${missed.length} missing${missed.length ? ` (${missed.slice(0, 5).join(', ')}${missed.length > 5 ? ', ...' : ''})` : ''}`);
