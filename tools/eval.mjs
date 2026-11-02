#!/usr/bin/env node
// Scores search against the owner's blind queries: recall@3 and the misses.
// tests/blind-queries.json: [{ "query": "...", "expect": "<url or id>" }]
// Write the queries before looking at the data, then fill in "expect".
import { readFileSync, existsSync } from 'node:fs';
import { createSearch } from '../assets/js/core/search.js';
import { normalizeUrl } from '../assets/js/core/url.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const path = 'tests/blind-queries.json';
const blind = existsSync(path) ? read(path).filter(q => q.expect) : [];
if (!blind.length) { console.log('No blind queries with an "expect" yet. Add some to tests/blind-queries.json.'); process.exit(0); }

const { entries } = read('data/bookmarks.json');
const engine = createSearch({ entries, shelves: read('data/shelves.json'), synonyms: read('data/synonyms.json') });
const idOf = x => entries.find(e => e.id === x || normalizeUrl(e.url) === normalizeUrl(x))?.id;

let hits = 0;
const misses = [];
for (const { query, expect } of blind) {
  const want = idOf(expect);
  const top = engine.search(query).slice(0, 3).map(r => r.id);
  if (want && top.includes(want)) hits++;
  else misses.push(`  "${query}" wanted ${expect}, got ${top.map(id => entries.find(e => e.id === id).title).join(' / ') || 'nothing'}`);
}
const pct = Math.round((hits / blind.length) * 100);
console.log(`recall@3: ${hits}/${blind.length} (${pct}%), target 80%`);
if (misses.length) console.log('misses:\n' + misses.join('\n'));
process.exit(pct >= 80 ? 0 : 1);
