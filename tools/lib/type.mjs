// Turns text into SVG outlines using the self-hosted brand fonts, so logos and
// the share image render identically everywhere without loading a font.
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsrc = (pkg, file) => join(root, 'node_modules', '@fontsource', pkg, 'files', file);
const cache = new Map();

function load(weight = 600, family = 'sans') {
  const key = family + weight;
  if (!cache.has(key)) {
    const file = family === 'mono'
      ? fsrc('ibm-plex-mono', `ibm-plex-mono-latin-${weight}-normal.woff`)
      : fsrc('instrument-sans', `instrument-sans-latin-${weight}-normal.woff`);
    const buf = readFileSync(file);
    cache.set(key, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return cache.get(key);
}

const n = v => (Math.round(v * 100) / 100).toString();
function serialize(cmds) {
  return cmds.map(c => {
    switch (c.type) {
      case 'M': case 'L': return `${c.type}${n(c.x)} ${n(c.y)}`;
      case 'Q': return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      case 'Z': return 'Z';
      default: return '';
    }
  }).join('');
}

/** Outline `text`. tracking is in em units (negative tightens). */
export function outline(text, { size = 32, x = 0, y = 0, weight = 600, family = 'sans', tracking = 0 } = {}) {
  const font = load(weight, family);
  const scale = size / font.unitsPerEm;
  let cx = x;
  const parts = [];
  const glyphs = [...text].map(ch => font.charToGlyph(ch));
  glyphs.forEach((g, i) => {
    parts.push(serialize(g.getPath(cx, y, size).commands));
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) adv += (font.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
    cx += adv + tracking * size;
  });
  return { d: parts.join(''), width: cx - x - (glyphs.length ? tracking * size : 0) };
}

/** Width of text without outlining. */
export const measure = (text, opts) => outline(text, opts).width;

/** Wrap text into lines no wider than maxWidth. */
export function wrap(text, maxWidth, opts) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (line && measure(test, opts) > maxWidth) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
