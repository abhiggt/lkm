#!/usr/bin/env node
// Merges new entries into data/bookmarks.json, deduping by normalised URL.
// Input: a JSON array of entries, or { entries: [...] } (the extension's
// Export JSON, or a reviewed import). Missing ids and dates are filled in.
//
// Usage: node tools/merge.mjs <file.json> [--dry-run]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeUrl, cleanUrl } from './lib/url.mjs';

const file = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!file) { console.error('usage: node tools/merge.mjs <file.json> [--dry-run]'); process.exit(1); }

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const db = existsSync('data/bookmarks.json') ? read('data/bookmarks.json') : { schemaVersion: 1, entries: [] };
const shelves = new Set(read('data/shelves.json').filter(s => !s.kind).map(s => s.id));
const incoming = (x => Array.isArray(x) ? x : x.entries || x.links || [])(read(file));

const ids = new Set(db.entries.map(e => e.id));
const urls = new Map(db.entries.map(e => [normalizeUrl(e.url), e]));
const today = new Date().toISOString().slice(0, 10);

/** Short stable id from the URL, never reused. */
function makeId(url) {
  for (let salt = 0; ; salt++) {
    const id = BigInt('0x' + createHash('sha1').update(normalizeUrl(url) + (salt || '')).digest('hex').slice(0, 10)).toString(36).slice(0, 6);
    if (!ids.has(id)) { ids.add(id); return id; }
  }
}

const FIELDS = ['id', 'url', 'title', 'description', 'why', 'type', 'maker', 'tags', 'shelf', 'added', 'pinned', 'readLater', 'image', 'favicon', 'archiveUrl', 'deadSince'];
let added = 0, skipped = [], problems = [];
for (const raw of incoming) {
  if (raw.keep === false) continue;
  const key = normalizeUrl(raw.url);
  if (urls.has(key)) { skipped.push(`${raw.url} (already saved as ${urls.get(key).id})`); continue; }
  const e = {
    ...raw,
    id: raw.id && !ids.has(raw.id) ? raw.id : makeId(raw.url),
    url: cleanUrl(raw.url),
    tags: [...new Set((raw.tags || []).map(t => t.toLowerCase().trim()).filter(Boolean))],
    added: raw.added || today,
    pinned: !!raw.pinned,
    readLater: !!raw.readLater,
  };
  ids.add(e.id);
  if (!shelves.has(e.shelf)) problems.push(`${e.url}: unknown shelf "${e.shelf}"`);
  for (const k of Object.keys(e)) if (!FIELDS.includes(k) || e[k] === '' || e[k] == null) delete e[k];
  db.entries.push(Object.fromEntries(FIELDS.filter(k => k in e).map(k => [k, e[k]])));
  urls.set(key, e);
  added++;
}

if (problems.length) { problems.forEach(p => console.error('error ' + p)); process.exit(1); }
skipped.forEach(s => console.log('skip  ' + s));
if (!dry) writeFileSync('data/bookmarks.json', JSON.stringify(db, null, 2) + '\n');
console.log(`merge: ${added} added, ${skipped.length} duplicates skipped${dry ? ' (dry run, nothing written)' : ''}. Run node tools/validate.mjs next.`);
