// Regression queries written against the sample data. The real measure is
// tests/blind-queries.json (the owner's own queries), scored by tools/eval.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSearch } from '../assets/js/core/search.js';
import { stem, terms } from '../assets/js/core/normalize.js';
import { normalizeUrl } from '../assets/js/core/url.js';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const { entries } = read('./fixtures/sample-bookmarks.json');
const engine = createSearch({ entries, shelves: read('./fixtures/sample-shelves.json'), synonyms: read('../data/synonyms.json') });
const top = (q, n = 3) => engine.search(q).slice(0, n).map(r => r.id);

const CASES = [
  ['that font article for logo work', ['t5fu', 't1fs']],
  ['tool to pick colors', ['c3ok', 'c1co', 'c2rc']],
  ['something about pricing pages', ['n2ln']],
  ['free fonts', ['t1fs', 't2gf']],
  ['typeface with devanagari', ['t2gf']],
  ['heading sizes ratio', ['t4ts']],
  ['contrast checker accessibility', ['c4cr']],
  ['make svg smaller', ['b3sv']],
  ['logo redesign reviews', ['b1bn']],
  ['why buttons should be bigger psychology', ['i1lu']],
  ['real app onboarding screens', ['i4mb']],
  ['how to price freelance work video', ['r3fu']],
  ['interactive explainer essays', ['r1ci']],
  ['responsive web essay old', ['r2dw']],
  ['palette on a real website', ['c2rc']],
  ['typgraphy book', ['t3pt']],              // typo
  ['oklch', ['c3ok']],
  ['jakob nielsen', ['i3nn']],
  ['moodboard references', ['n3sv']],
  ['design system names', ['i5ds']],
  ['refact', ['i2rf']],                      // prefix while typing
];

for (const [q, want] of CASES) {
  test(`"${q}" puts ${want.join(' or ')} in the top 3`, () => {
    const got = top(q);
    assert.ok(want.some(id => got.includes(id)), `got ${got.join(', ')}`);
  });
}

test('every result carries a matched-on reason', () => {
  for (const r of engine.search('free fonts')) assert.ok(r.matched.length > 0);
});

test('zero results offer a correction and nearby tags', () => {
  assert.equal(engine.search('kerning robot').length, 0);
  assert.ok(engine.didYouMean('typogrphy zzz'));
  assert.ok(engine.nearbyTags('kerning').length > 0);
});

test('normaliser basics', () => {
  assert.equal(stem('colours'), stem('color'));
  assert.equal(stem('pricing'), stem('price'));
  assert.deepEqual(terms('Something about the pricing pages'), ['pric', 'pag']);
});

test('url normalisation catches common duplicates', () => {
  assert.equal(normalizeUrl('https://www.Coolors.co/?utm_source=x#top'), normalizeUrl('http://coolors.co'));
  assert.equal(normalizeUrl('https://twitter.com/a/status/1?s=20'), normalizeUrl('https://x.com/a/status/1'));
});
