// Regression queries against the real library (data/bookmarks.json).
// Each query must put one of the named links in the top 3. These were written
// by Claude after sorting; the owner's own blind queries (tests/blind-queries.json,
// scored by tools/eval.mjs) are the measure that matters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSearch } from '../assets/js/core/search.js';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const { entries } = read('../data/bookmarks.json');
const engine = createSearch({ entries, shelves: read('../data/shelves.json'), synonyms: read('../data/synonyms.json') });
const title = id => entries.find(e => e.id === id).title;

const CASES = [
  ['grainy gradient background', ['Grainient']],
  ['free icons for figma', ['Hugeicons', 'Kitbitz']],
  ['that site with pricing page examples', ['Saaspo', 'CallToInspiration', 'Unsection']],
  ['tool to pick colours', ['Super Color Palette']],
  ['compress images', ['Squoosh']],
  ['thinking animation for ai chat', ['Thinking Orbs', 'AICSS']],
  ['font used in a logo', ['Font In Logo']],
  ['navbar inspiration', ['Navbar Gallery']],
  ['webgl effects on buttons', ['Liquid Metal']],
  ['show my design in a video', ['animos', 'PerspectiveMock']],
  ['dark patterns', ['Dark Patterns Hall of Shame']],
  ['3d models', ['NVIDIA SimReady Assets', 'IMGto3D']],
  ['handwriting font', ['Hand of You']],
  ['fun music experiment', ['Visual Instruments', 'Synesthesia Engine', 'Midlife Engineering']],
  ['design systems for claude', ['Refero Styles', 'UI Skills']],
  ['footer', ['Footer']],
  ['list of design tools', ['designtools.fyi', 'Toolfolio', 'Design Minis']],
  ['weather globe', ['earth']],
  ['typgraphy pairing', ['Typewolf']],
  ['minimal websites', ['Minimal Gallery', 'Dead Simple Sites']],
  ['rebrand reveal', ['Rebrand Gallery']],
  ['psychology of product design book', ['Product Design Psychology']],
  ['html to mp4', ['HyperFrames']],
  ['mobile app animations', ['60fps', 'App Motion']],
  ['jakub', ['Border Beam', 'Liquid Metal', 'Transitions.dev', 'Thinking Orbs']],
];

for (const [q, want] of CASES) {
  test(`"${q}" finds ${want.join(' or ')} in the top 3`, () => {
    const got = engine.search(q).slice(0, 3).map(r => title(r.id));
    assert.ok(want.some(t => got.includes(t)), `got: ${got.join(' / ')}`);
  });
}
