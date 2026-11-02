#!/usr/bin/env node
// One-time migration helper. Pulls every URL out of exports and notes, keeps
// the text around it as a draft description, dedupes by normalised URL and
// writes a review file the owner edits before merging.
//
// Usage: node tools/import.mjs <file...> [--out data/import/review.json]
// Reads: browser bookmarks .html, Notion .md/.csv, WhatsApp .txt, Slack .json,
// and loose notes (.md/.txt) where links may lack https://.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname } from 'node:path';
import { normalizeUrl, cleanUrl } from './lib/url.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx > -1 ? args.splice(outIdx, 2)[1] : 'data/import/review.json';
if (!args.length) { console.error('usage: node tools/import.mjs <file...> [--out path]'); process.exit(1); }

const existing = (() => { try { return JSON.parse(readFileSync('data/bookmarks.json', 'utf8')).entries; } catch { return []; } })();
const known = new Map(existing.map(e => [normalizeUrl(e.url), e.id]));

// Bare domains like "canvasui.dev" or "music.jessyin.world/x" count as links.
const TLDS = 'com|net|org|io|dev|app|design|xyz|ai|co|in|me|so|art|space|supply|world|website|directory|tools|fyi|institute|engineering|gallery|love|studio|site|page|eu|uk|de|fr';
const URL_RE = new RegExp(String.raw`\bhttps?:\/\/[^\s<>()"'\]]+|\b(?:[a-z0-9-]+\.)+(?:${TLDS})(?:\/[^\s<>()"'\]]*)?`, 'gi');
const tidy = s => s.replace(/[.,;:!?)\]]+$/, '');

function fromText(text, source) {
  const found = [];
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const urls = line.match(URL_RE) || [];
    if (!urls.length) {
      // Short lines without links act as section headings ("Tools", "UNSORTED").
      const head = line.replace(/^[-*#\s]+/, '').trim();
      if (head.length < 60 && !/^@|^\d+$|^·$/.test(head)) section = head;
      continue;
    }
    for (const u of urls) {
      const url = cleanUrl(/^https?:/i.test(u) ? tidy(u) : 'https://' + tidy(u));
      const note = line.replace(URL_RE, ' ').replace(/^[-*\d.\s]+/, '').replace(/^[\s:—–-]+|[\s:—–-]+$/g, '').replace(/\s+/g, ' ').trim();
      found.push({ url, note, section, source });
    }
  }
  return found;
}

function fromBookmarksHtml(html, source) {
  const found = [];
  const folders = [];
  for (const m of html.matchAll(/<H3[^>]*>([^<]*)<\/H3>|<\/DL>|<A [^>]*HREF="([^"]+)"[^>]*?(?:ADD_DATE="(\d+)")?[^>]*>([^<]*)<\/A>/gi)) {
    if (m[1] !== undefined) folders.push(m[1]);
    else if (m[0].toUpperCase() === '</DL>') folders.pop();
    else if (/^https?:/i.test(m[2])) found.push({ url: cleanUrl(m[2]), title: m[4], note: '', section: folders.at(-1) || '', source, added: m[3] ? new Date(+m[3] * 1000).toISOString().slice(0, 10) : undefined });
  }
  return found;
}

function fromSlackJson(json, source) {
  const msgs = Array.isArray(json) ? json : [];
  return msgs.flatMap(m => fromText(String(m.text || '').replace(/<(https?:[^|>]+)(?:\|[^>]*)?>/g, ' $1 '), source)
    .map(x => ({ ...x, added: m.ts ? new Date(+m.ts * 1000).toISOString().slice(0, 10) : undefined })));
}

let all = [];
for (const file of args) {
  const text = readFileSync(file, 'utf8');
  const ext = extname(file).toLowerCase();
  const source = basename(file);
  if (ext === '.html' && /NETSCAPE-Bookmark/i.test(text)) all.push(...fromBookmarksHtml(text, source));
  else if (ext === '.json') all.push(...fromSlackJson(JSON.parse(text), source));
  else all.push(...fromText(ext === '.html' ? text.replace(/<a [^>]*href="([^"]+)"/gi, ' $1 ').replace(/<[^>]+>/g, ' ') : text, source));
}

// Dedupe: keep the first sighting, merge notes from later ones.
const byKey = new Map();
const dupes = [];
for (const x of all) {
  const key = normalizeUrl(x.url);
  if (known.has(key)) { dupes.push({ url: x.url, reason: `already saved as ${known.get(key)}` }); continue; }
  if (byKey.has(key)) {
    const first = byKey.get(key);
    if (x.note && !first.notes.includes(x.note)) first.notes.push(x.note);
    if (x.section && !first.sections.includes(x.section)) first.sections.push(x.section);
    dupes.push({ url: x.url, reason: 'duplicate in import' });
    continue;
  }
  byKey.set(key, { url: x.url, title: x.title || '', notes: x.note ? [x.note] : [], sections: x.section ? [x.section] : [], source: x.source, added: x.added, keep: true });
}

const review = [...byKey.values()];
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ imported: new Date().toISOString().slice(0, 10), count: review.length, duplicatesDropped: dupes, links: review }, null, 2) + '\n');
console.log(`import: ${all.length} links found, ${dupes.length} duplicates dropped, ${review.length} unique written to ${out}`);
