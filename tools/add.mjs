#!/usr/bin/env node
// Add one link from the terminal. Fetches the page's title, description and
// share image as defaults, saves the image and favicon locally, asks the
// Wayback Machine for a snapshot, and refuses duplicates.
//
// Usage:
//   node tools/add.mjs <url> [--title ..] [--description ..] [--why ..] [--type tool]
//                          [--maker ..] [--tags a,b] [--shelf id] [--pinned] [--read-later] [--yes]
// Without --yes it asks for anything not given.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { normalizeUrl, cleanUrl } from './lib/url.mjs';

const argv = process.argv.slice(2);
const url = argv.find(a => /^https?:\/\//.test(a));
if (!url) { console.error('usage: node tools/add.mjs <url> [--title ..] [--shelf ..] ...'); process.exit(1); }
const flag = n => { const i = argv.indexOf(`--${n}`); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined; };
const has = n => argv.includes(`--${n}`);

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const db = read('data/bookmarks.json');
const shelves = read('data/shelves.json').filter(s => !s.kind);
const dupe = db.entries.find(e => normalizeUrl(e.url) === normalizeUrl(url));
if (dupe) { console.error(`Already saved as "${dupe.title}" (${dupe.id}) on ${dupe.shelf}.`); process.exit(1); }

// ---------- page metadata ----------
let meta = {};
try {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Linkmery' }, signal: AbortSignal.timeout(15000) });
  const html = await res.text();
  const tag = n => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${n}["']`, 'i'))?.[1];
  const decode = s => s?.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
  meta = {
    title: decode(tag('og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
    description: decode(tag('og:description') || tag('description')),
    image: tag('og:image') && new URL(tag('og:image'), res.url).href,
    icon: new URL(html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] || '/favicon.ico', res.url).href,
  };
} catch (err) { console.warn(`Could not read the page (${err.message}). Fill the fields by hand.`); }

// ---------- fields ----------
const rl = has('yes') ? null : createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def) => {
  if (!rl) return def ?? '';
  const a = (await rl.question(`${q}${def ? ` [${def.length > 60 ? def.slice(0, 57) + '...' : def}]` : ''}: `)).trim();
  return a || def || '';
};
const title = flag('title') ?? await ask('Title', meta.title);
const description = flag('description') ?? await ask('Description (your words: what it is, when to reach for it)', meta.description);
const why = flag('why') ?? await ask('Use it for (optional)');
const type = flag('type') ?? await ask('Type: tool, article, video, inspiration, reference', 'tool');
const maker = flag('maker') ?? await ask('Maker (optional)');
const tags = (flag('tags') ?? await ask('Tags, comma separated')).split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
console.log(rl ? shelves.map(s => `  ${s.id}: ${s.name}`).join('\n') : '');
const shelf = flag('shelf') ?? await ask('Shelf id', shelves[0].id);
rl?.close();
if (!shelves.some(s => s.id === shelf)) { console.error(`Unknown shelf "${shelf}".`); process.exit(1); }
if (!title || !description) { console.error('A title and a description are required.'); process.exit(1); }

// ---------- local thumbnail and favicon ----------
const ids = new Set(db.entries.map(e => e.id));
let id; do { id = Math.random().toString(36).slice(2, 8); } while (ids.has(id));
async function download(src, base) {
  if (!src) return undefined;
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return undefined;
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/gif': 'gif' })[r.headers.get('content-type')?.split(';')[0]];
    if (!ext) return undefined;
    mkdirSync('assets/img', { recursive: true });
    const path = `assets/img/${base}.${ext}`;
    writeFileSync(path, Buffer.from(await r.arrayBuffer()));
    return path;
  } catch { return undefined; }
}
const image = await download(meta.image, id);
const favicon = await download(meta.icon, `${id}-icon`);

// ---------- archive snapshot ----------
let archiveUrl;
try {
  const r = await fetch(`https://web.archive.org/save/${url}`, { signal: AbortSignal.timeout(60000) });
  archiveUrl = r.headers.get('content-location') ? `https://web.archive.org${r.headers.get('content-location')}` : `https://web.archive.org/web/${url}`;
} catch { archiveUrl = `https://web.archive.org/web/${url}`; }

const entry = Object.fromEntries(Object.entries({
  id, url: cleanUrl(url), title, description, why, type, maker, tags, shelf,
  added: new Date().toISOString().slice(0, 10), pinned: has('pinned'), readLater: has('read-later'), image, favicon, archiveUrl,
}).filter(([, v]) => v !== undefined && v !== ''));
db.entries.push(entry);
writeFileSync('data/bookmarks.json', JSON.stringify(db, null, 2) + '\n');
console.log(`Added "${title}" to ${shelf} as ${id}. Run node tools/validate.mjs, then commit.`);
