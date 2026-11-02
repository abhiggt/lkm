#!/usr/bin/env node
// Validates data/*.json against the schemas and checks what a schema cannot:
// duplicate ids and URLs, unknown shelves, thin descriptions, synonym shape.
// Exit code 1 on errors; warnings never fail the build.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { normalizeUrl } from './lib/url.mjs';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const errors = [], warnings = [];
const check = (schemaPath, data, label) => {
  const v = ajv.compile(read(schemaPath));
  if (!v(data)) for (const e of v.errors) errors.push(`${label}${e.instancePath} ${e.message}`);
};

const bm = read('data/bookmarks.json');
const shelves = read('data/shelves.json');
const synonyms = read('data/synonyms.json');
check('schema/bookmarks.schema.json', bm, 'bookmarks');
check('schema/shelves.schema.json', shelves, 'shelves');
check('schema/synonyms.schema.json', synonyms, 'synonyms');

const realShelves = new Set(shelves.filter(s => !s.kind).map(s => s.id));
const shelfIds = new Set();
for (const s of shelves) { if (shelfIds.has(s.id)) errors.push(`shelves: duplicate id "${s.id}"`); shelfIds.add(s.id); }
if (!shelves.some(s => s.kind === 'pinned')) warnings.push('shelves: no "Now" shelf (kind "pinned")');

const ids = new Map(), urls = new Map();
for (const e of bm.entries || []) {
  const where = `"${e.title}" (${e.id})`;
  if (ids.has(e.id)) errors.push(`duplicate id ${e.id}: ${where} and "${ids.get(e.id)}"`);
  ids.set(e.id, e.title);
  const n = normalizeUrl(e.url);
  if (urls.has(n)) errors.push(`duplicate URL ${e.url}: ${where} and "${urls.get(n)}"`);
  urls.set(n, e.title);
  if (!realShelves.has(e.shelf)) errors.push(`${where}: unknown shelf "${e.shelf}"`);
  const sentences = (e.description || '').split(/[.!?]+\s/).filter(s => s.trim().split(/\s+/).length >= 4);
  if ((e.description || '').trim().split(/\s+/).length < 8 || !sentences.length)
    warnings.push(`${where}: description is shorter than a sentence; Google and search get little to work with`);
  if (e.deadSince && !e.archiveUrl) warnings.push(`${where}: marked dead but has no archiveUrl`);
  if (!e.tags?.length) warnings.push(`${where}: no tags`);
}
for (const s of realShelves) if (![...(bm.entries || [])].some(e => e.shelf === s)) warnings.push(`shelf "${s}" is empty`);

for (const w of warnings) console.warn('warn  ' + w);
for (const e of errors) console.error('error ' + e);
console.log(`\n${bm.entries?.length ?? 0} links, ${realShelves.size} shelves, ${synonyms.length} synonym groups: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
