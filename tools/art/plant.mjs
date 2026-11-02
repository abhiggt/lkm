// The money plant (pothos) on the cabinet: glossy heart-shaped leaves with
// cream marbling, a trailing vine and a glazed white pot. Baked to AVIF in
// six versions: as it is, and with one to five new leaves (one for every
// ten waterings).

const TONES = [['#6fae58', '#3f7a33'], ['#5c9c48', '#33692a'], ['#7cbc63', '#467f37']];
let uid = 0;
function leaf(x, y, r = 0, s = 1, tone = 0) {
  const [hi, lo] = TONES[tone % 3], id = `lf${uid++}`;
  return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
    <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
    <path d="M0 7.4C-6.4 3.2-8.8-3.2-4.5-6.3-2-8.1 0-5.8 0-3.9 0-5.8 2-8.1 4.5-6.3 8.8-3.2 6.4 3.2 0 7.4z" fill="url(#${id})"/>
    <path d="M-3.8-3.4c1.4 1.5 2.6 1.8 3.8 2.4M1.2 1.2c1.6-.4 2.8-1.6 3.2-3" stroke="#f3efcd" stroke-width="1.2" fill="none" opacity=".5" stroke-linecap="round"/>
    <path d="M0 6.6V-3.4" stroke="#2f5e27" stroke-width=".55" opacity=".55"/>
    <path d="M-4.6-4.4c1.4-1.4 3-1.2 3.8.2" stroke="#fff" stroke-width=".9" fill="none" opacity=".45" stroke-linecap="round"/>
  </g>`;
}
const EXTRA = [[4, 14, -50, .78, 2], [52, 9, 45, .78, 0], [20, 3, -20, .72, 1], [38, 1, 20, .72, 2], [29, -6, 0, .72, 0]];

export function plant(extra = 0) {
  uid = 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="720" viewBox="0 -10 70 240">
  <defs>
    <linearGradient id="pot" x1="0" x2="1"><stop offset="0" stop-color="#dcd7cc"/><stop offset=".35" stop-color="#fdfcf8"/><stop offset=".7" stop-color="#ece8df"/><stop offset="1" stop-color="#c9c3b6"/></linearGradient>
    <linearGradient id="rim" x1="0" x2="1"><stop offset="0" stop-color="#e6e2d8"/><stop offset=".4" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d1c5"/></linearGradient>
    <radialGradient id="soil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b2a1e"/><stop offset="1" stop-color="#5a4130"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".25"/></filter>
  </defs>
  <path d="M24 49c-2-10-8-16-14-20M30 49c2-12 8-20 16-24M28 49c0-12-2-22 0-32" stroke="#4d7a3c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  ${leaf(10, 26, -30, 1, 0)}${leaf(46, 22, 30, 1, 1)}${leaf(28, 13, 0, 1.15, 2)}${leaf(18, 37, -15, .95, 1)}${leaf(39, 35, 20, .95, 0)}
  ${EXTRA.slice(0, extra).map(a => leaf(...a)).join('')}
  <path d="M44 51c10 4 16 16 14 34-2 20-10 30-6 50 4 18 12 28 8 46-2 12-6 20-4 32" stroke="#4d7a3c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  ${leaf(58, 70, 80, 1, 2)}${leaf(53, 98, -70, .9, 0)}${leaf(56, 128, 70, 1, 1)}${leaf(61, 158, -80, .9, 2)}${leaf(58, 186, 75, .85, 0)}${leaf(57, 214, -60, .8, 1)}
  <path d="M11 52h34l-2.5 13q-1.5 6-14.5 6t-14.5-6z" fill="url(#pot)"/>
  <path d="M13 56q15 3 30 0" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/>
  <path d="M16 62q12 3 24 0" stroke="#bdb6a8" stroke-width=".6" fill="none"/>
  <rect x="9" y="47.6" width="38" height="5.8" rx="2.2" fill="url(#rim)"/>
  <ellipse cx="28" cy="49.2" rx="16.6" ry="1.7" fill="url(#soil)" filter="url(#soft)"/>
</svg>`;
}
