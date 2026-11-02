// A book's colour comes from its favicon: the main colourful hue, averaged
// from the pixels that carry it. Icons that are only black, white or grey
// have no colour, and their books stay white. Shared by the build (Node)
// and the browser (for favicons fetched while someone browses).

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/** The cover colour as #rrggbb from RGBA pixels, or null for a colourless icon. */
export function pickColour(data) {
  const bins = new Map();
  let opaque = 0, colourful = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 140) continue;
    opaque++;
    const [h, s, l] = hsl(r, g, b);
    if (s < 0.22 || l > 0.9 || l < 0.1) continue;          // greys, white, black
    colourful++;
    const k = Math.round(h / 15) % 24;
    const bin = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(k, bin);
  }
  if (!opaque || colourful / opaque < 0.08) return null;
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  return hex(top.r / top.n, top.g / top.n, top.b / top.n);
}

// The cover fades from paper at the top to the site's colour at the foot.
export const FOOT_MIX = 0.78;
const PAPER = '#fbfaf6';

/** Dark or white text for the foot of a cover in this colour. */
export function footInk(colour) {
  const [r, g, b] = rgb(colour).map((v, i) => v * FOOT_MIX + rgb(PAPER)[i] * (1 - FOOT_MIX));
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // contrast against near-black vs white; pick the larger
  return (L + 0.05) / (0.012 + 0.05) >= 1.05 / (L + 0.05) ? '#1a1a1a' : '#ffffff';
}

/** CSS custom properties for a book: its colour and the ink at its foot. */
export const bookVars = colour => colour ? { '--bk': colour, '--bk-ink': footInk(colour) } : null;
