// Reads a favicon file (PNG, or an ICO with a PNG inside) and returns the
// book's colour, using the same rules as the browser (assets/js/core/colour.js).
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { pickColour, footInk } from '../../assets/js/core/colour.js';

const PNG_SIG = '89504e470d0a1a0a';
function pngBytes(buf) {
  if (buf.subarray(0, 8).toString('hex') === PNG_SIG) return buf;
  if (buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {           // ICO
    let best = null;
    for (let i = 0, n = buf.readUInt16LE(4); i < n; i++) {
      const o = 6 + i * 16, size = buf.readUInt32LE(o + 8), off = buf.readUInt32LE(o + 12);
      const part = buf.subarray(off, off + size);
      if (part.subarray(0, 8).toString('hex') === PNG_SIG && (!best || size > best.length)) best = part;
    }
    return best;
  }
  return null;
}

/** Width and height of a favicon file, or null when it can't be read. */
export function iconSize(buf) {
  try { const b = pngBytes(buf); if (!b) return null; const p = PNG.sync.read(b); return { w: p.width, h: p.height }; } catch { return null; }
}

/** { bg, ink } for a favicon file, or null when it has no real colour. */
export function coverColour(file) {
  try {
    const bytes = pngBytes(readFileSync(file)); if (!bytes) return null;
    const bg = pickColour(PNG.sync.read(bytes).data);
    return bg ? { bg, ink: footInk(bg) } : null;
  } catch { return null; }
}
