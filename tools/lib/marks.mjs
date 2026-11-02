// Linkmery logo mark, drawn on a 32 x 32 grid with one thin monoline stroke
// (the floor plan uses the same weight). `inner(color, sw)` returns SVG children.
//
// Final mark: books on a shelf. Two upright books and one leaning, standing on
// a single shelf line, the library half of the name.

export const MARKS = {
  a: {
    name: 'Books on a shelf',
    inner: (c, sw = 1.75) => `
  <g fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="5" width="5" height="21" rx="1.6"/>
    <rect x="12" y="8.5" width="5" height="17.5" rx="1.6"/>
    <rect x="19.4" y="7" width="5" height="19" rx="1.6" transform="rotate(16 24.4 26)"/>
    <path d="M2 29h28"/>
  </g>`,
  },
};

export const DEFAULT_MARK = 'a';

export function markSvg(key = DEFAULT_MARK, { color = 'currentColor', size = 32, sw = 1.75, title = 'Linkmery' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${title}">${MARKS[key].inner(color, sw)}
</svg>`;
}
