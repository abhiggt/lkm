// Things that live on and around the cabinet, drawn in real colour: a
// library card box for new arrivals, a money plant (pothos) in a white
// ceramic pot with a vine that trails down the side, and a small succulent.

/** Money plant (pothos): heart leaves, green with cream marbling, in a white pot. */
const leaf = (x, y, r = 0, s = 1, tone = 0) => {
  const fill = ['#5f9a4c', '#4e8a3f', '#6fae58'][tone % 3];
  return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
    <path d="M0 7C-6 3-8.5-3-4.4-6-2-7.8 0-5.6 0-3.8 0-5.6 2-7.8 4.4-6 8.5-3 6 3 0 7z" fill="${fill}"/>
    <path d="M0 6.2V-3.6M0 1.5l-2.6-2M0-.8l2.4-2" stroke="#e9efc9" stroke-width=".7" fill="none" opacity=".75" stroke-linecap="round"/>
    <path d="M-3.5-3.2c1.2 1.4 2.4 1.6 3.5 2.2" stroke="#f0eccb" stroke-width="1.1" fill="none" opacity=".45" stroke-linecap="round"/>
  </g>`;
};
export const moneyPlant = () => `<svg class="orn money" viewBox="0 0 70 230" aria-hidden="true">
  <defs><linearGradient id="mp-pot" x1="0" x2="1"><stop offset="0" stop-color="#e9e6df"/><stop offset=".5" stop-color="#fbfaf6"/><stop offset="1" stop-color="#d9d5cc"/></linearGradient></defs>
  <g class="mp-top">
  <path d="M24 49c-2-10-8-16-14-20M30 49c2-12 8-20 16-24M28 49c0-12-2-22 0-32" stroke="#4d7a3c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  ${leaf(10, 26, -30, 1, 0)}${leaf(46, 22, 30, 1, 1)}${leaf(28, 13, 0, 1.15, 2)}${leaf(18, 37, -15, .95, 1)}${leaf(39, 35, 20, .95, 0)}
  <!-- new leaves, one for every ten waterings -->
  <g class="g g1">${leaf(4, 14, -50, .75, 2)}</g><g class="g g2">${leaf(52, 9, 45, .75, 0)}</g><g class="g g3">${leaf(20, 3, -20, .7, 1)}</g><g class="g g4">${leaf(38, 1, 20, .7, 2)}</g><g class="g g5">${leaf(29, -6, 0, .7, 0)}</g>
  </g>
  <g class="mp-vine">
  <path d="M44 51c10 4 16 16 14 34-2 20-10 30-6 50 4 18 12 28 8 46-2 12-6 20-4 32" stroke="#4d7a3c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  ${leaf(58, 70, 80, 1, 2)}${leaf(53, 98, -70, .9, 0)}${leaf(56, 128, 70, 1, 1)}${leaf(61, 158, -80, .9, 2)}${leaf(58, 186, 75, .85, 0)}${leaf(57, 214, -60, .8, 1)}
  </g>
  <path d="M11 52h34l-2.5 13q-1.5 6-14.5 6t-14.5-6z" fill="url(#mp-pot)"/>
  <rect x="9" y="48" width="38" height="5.5" rx="2" fill="#f4f2ec"/>
  <ellipse cx="28" cy="49" rx="17" ry="1.5" fill="#4a3426"/>
  <path d="M16 58q12 3 24 0" stroke="#c9c3b6" stroke-width=".8" fill="none"/>
</svg>`;

/** A blue-green echeveria rosette in a small terracotta pot. */
export const succulent = () => `<svg class="orn succulent" viewBox="0 0 60 64" aria-hidden="true">
  <defs><linearGradient id="sc-l" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5f8f86"/><stop offset="1" stop-color="#a9cbbf"/></linearGradient></defs>
  <path d="M30 41c-9 2-18 0-24-6 9-3 17-1 24 6z" fill="url(#sc-l)"/>
  <path d="M30 41c9 2 18 0 24-6-9-3-17-1-24 6z" fill="url(#sc-l)"/>
  <path d="M30 41c-10-2-16-10-16-19 9 2 14 9 16 19z" fill="url(#sc-l)"/>
  <path d="M30 41c10-2 16-10 16-19-9 2-14 9-16 19z" fill="url(#sc-l)"/>
  <path d="M30 41c-5-8-5-18 0-27 5 9 5 19 0 27z" fill="#b9d6ca"/>
  <path d="M16 41h28l-2.6 20q-.3 1.5-1.8 1.5H20.4q-1.5 0-1.8-1.5z" fill="#c46a43"/>
  <rect x="14" y="39" width="32" height="5" rx="1.5" fill="#b85d38"/>
</svg>`;

/* ------------------------------------------------------------------ */
/* On top of the cabinet: a steel library card box. The newest cards  */
/* stick up out of it, the latest with a red tab. It holds New arrivals. */
export const cardBox = () => `<svg class="orn cardbox" viewBox="0 0 120 70" aria-hidden="true">
  <defs>
    <linearGradient id="cb-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa596"/><stop offset="1" stop-color="#6b8172"/></linearGradient>
    <linearGradient id="cb-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d7163"/><stop offset="1" stop-color="#4f6155"/></linearGradient>
    <linearGradient id="cb-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd396"/><stop offset="1" stop-color="#b38a37"/></linearGradient>
  </defs>
  <!-- cards standing in the drawer -->
  <g class="cards">
    <rect x="22" y="10" width="62" height="34" rx="2" fill="#f6f0df" transform="rotate(-4 53 27)"/>
    <rect x="26" y="7" width="62" height="34" rx="2" fill="#fbf7ea"/>
    <path d="M32 16h40M32 21h46M32 26h34" stroke="#c9bfa6" stroke-width="1"/>
    <rect x="70" y="2" width="14" height="9" rx="1.5" fill="#d8513b"/>
    <rect x="30" y="12" width="60" height="32" rx="2" fill="#efe7d2" transform="rotate(3 60 28)"/>
  </g>
  <!-- the box -->
  <path d="M96 30l14-6v40l-14 4z" fill="url(#cb-side)"/>
  <rect x="10" y="30" width="86" height="38" rx="3" fill="url(#cb-steel)"/>
  <path d="M10 30h86l14-6H26z" fill="#a7bbae"/>
  <rect x="10" y="30" width="86" height="2" fill="#fff" opacity=".25"/>
  <!-- brass label holder and pull -->
  <rect x="36" y="38" width="34" height="14" rx="1.5" fill="url(#cb-brass)"/>
  <rect x="39" y="40.5" width="28" height="9" fill="#fbf6e6"/>
  <text x="53" y="47.6" text-anchor="middle" font-family="Georgia, serif" font-size="6.2" font-style="italic" fill="#4a4231">new</text>
  <path d="M44 58c0 4 18 4 18 0" stroke="url(#cb-brass)" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

/* ------------------------------------------------------------------ */
/* One thing on each shelf that belongs to what the shelf holds.       */

const shine = id => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;

/** Web inspiration: a little desktop monitor showing a landing page. */
export const monitor = () => `<svg class="orn obj monitor" viewBox="0 0 90 84" aria-hidden="true">
  <defs><linearGradient id="mo-img" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb4f5"/><stop offset="1" stop-color="#c3a8f3"/></linearGradient>${shine('mo-sh')}</defs>
  <path d="M37 58h16l4 20H33z" fill="#d3cdc0"/><path d="M37 58h16l1 5H36z" fill="#000" opacity=".1"/>
  <rect x="24" y="76" width="42" height="5" rx="2.5" fill="#cfc8ba"/>
  <rect x="6" y="8" width="78" height="52" rx="5" fill="#ece8df"/>
  <rect x="10" y="12" width="70" height="42" rx="2" fill="#fbf9f4"/>
  <rect x="10" y="12" width="70" height="6" rx="2" fill="#e6e0d4"/>
  <circle cx="14" cy="15" r="1.3" fill="#e4572e"/><circle cx="18" cy="15" r="1.3" fill="#f6ae2d"/><circle cx="22" cy="15" r="1.3" fill="#3fae6a"/>
  <rect x="15" y="24" width="30" height="4" rx="1" fill="#1f1f1f"/><rect x="15" y="30" width="24" height="2.4" rx="1" fill="#aaa497"/><rect x="15" y="34" width="20" height="2.4" rx="1" fill="#aaa497"/>
  <rect x="15" y="40" width="13" height="6" rx="3" fill="#e4572e"/>
  <rect x="50" y="23" width="25" height="25" rx="2" fill="url(#mo-img)"/>
  <rect x="6" y="8" width="78" height="52" rx="5" fill="url(#mo-sh)" opacity=".5"/>
</svg>`;

/** Components and effects: toy bricks, snapped together. */
const brick = (x, y, w, h, c, dark, studs) => `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${c}"/>
  <rect x="${x}" y="${y + h - 4}" width="${w}" height="4" rx="1.5" fill="${dark}" opacity=".6"/>
  ${Array.from({ length: studs }, (_, i) => { const sx = x + 4 + i * ((w - 8) / studs) + (w - 8) / studs / 2 - 4; return `<rect x="${sx}" y="${y - 4}" width="8" height="5" rx="1" fill="${c}"/><ellipse cx="${sx + 4}" cy="${y - 4}" rx="4" ry="1.4" fill="#fff" opacity=".35"/>`; }).join('')}
</g>`;
export const bricks = () => `<svg class="orn obj bricks" viewBox="0 0 90 84" aria-hidden="true">
  ${brick(8, 60, 64, 22, '#d8402f', '#8f2318', 4)}
  ${brick(22, 40, 34, 20, '#2f6fd6', '#18418a', 2)}
  ${brick(38, 22, 18, 18, '#f2b632', '#a8770f', 1)}
  ${brick(60, 46, 18, 14, '#3fae6a', '#1f6e3f', 1)}
</svg>`;

/** Tools: a pencil cup with pencils, a ruler and a pair of scissors. */
export const pencilCup = () => `<svg class="orn obj pencils" viewBox="0 0 90 84" aria-hidden="true">
  <defs>${shine('pc-sh')}</defs>
  <g transform="rotate(-14 40 50)"><rect x="34" y="6" width="7" height="50" fill="#f2c23a"/><path d="M34 6l3.5-6 3.5 6z" fill="#e8c9a0"/><path d="M36.3 2l1.2-2 1.2 2z" fill="#333"/><rect x="34" y="6" width="2.3" height="50" fill="#fff" opacity=".25"/></g>
  <g transform="rotate(9 50 50)"><rect x="46" y="10" width="7" height="46" fill="#3a6fd1"/><path d="M46 10l3.5-6 3.5 6z" fill="#e8c9a0"/><path d="M48.3 6l1.2-2 1.2 2z" fill="#333"/><rect x="46" y="4" width="0" height="0"/></g>
  <g transform="rotate(-4 56 40)"><rect x="54" y="4" width="8" height="54" rx="1" fill="#c9ced3"/><path d="M56 10h3M56 16h5M56 22h3M56 28h5M56 34h3M56 40h5" stroke="#6b7177" stroke-width=".8"/></g>
  <g transform="rotate(18 30 40)"><circle cx="26" cy="20" r="5" fill="none" stroke="#d8402f" stroke-width="3"/><circle cx="34" cy="21" r="5" fill="none" stroke="#d8402f" stroke-width="3"/><path d="M28 25l4 30M32 25l-1 30" stroke="#aab0b6" stroke-width="2"/></g>
  <path d="M22 44h46l-4 36H26z" fill="#7d9a8a"/>
  <path d="M22 44h46l-4 36H26z" fill="url(#pc-sh)"/>
  <ellipse cx="45" cy="44" rx="23" ry="3.2" fill="#5f7a6b"/>
  <path d="M28 52h34" stroke="#fff" stroke-width="1" opacity=".25"/>
</svg>`;

/** Motion and interaction: a Newton's cradle. Hover and it swings. */
const ball = (cx, id) => `<circle cx="${cx}" cy="64" r="6" fill="url(#${id})"/>`;
export const cradle = () => `<svg class="orn obj cradle" viewBox="0 0 90 84" aria-hidden="true">
  <defs><radialGradient id="nc-b" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#cfd5dc"/><stop offset="1" stop-color="#6f7780"/></radialGradient></defs>
  <rect x="6" y="78" width="78" height="5" rx="2" fill="#2b2b2b"/>
  <path d="M12 78V14h66v64" stroke="#5b5b5b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <g class="nc-l" style="transform-origin: 33px 14px">
    <path d="M33 14l-0 44" stroke="#9aa0a6" stroke-width=".8"/>${ball(33, 'nc-b')}
  </g>
  ${[45, 57].map(x => `<path d="M${x} 14v44" stroke="#9aa0a6" stroke-width=".8"/>${ball(x, 'nc-b')}`).join('')}
  <g class="nc-r" style="transform-origin: 69px 14px">
    <path d="M69 14v44" stroke="#9aa0a6" stroke-width=".8"/>${ball(69, 'nc-b')}
  </g>
</svg>`;

/** Brand and visual: a colour swatch fan, opened a little. */
export const swatches = () => {
  const cols = ['#2f6fd6', '#3fae6a', '#f2b632', '#ee7a2b', '#d8402f'];
  return `<svg class="orn obj swatches" viewBox="0 0 90 84" aria-hidden="true">
  ${cols.map((c, i) => { const r = -28 + i * 14; return `<g class="sw" style="transform-origin: 40px 76px; --r: ${r}deg; transform: rotate(${r}deg)">
    <rect x="33" y="14" width="15" height="66" rx="2.5" fill="${c}"/><rect x="33" y="56" width="15" height="16" fill="#fbf8ef"/>
    <path d="M36 61h8M36 65h5" stroke="#b9b2a1" stroke-width="1"/><rect x="33" y="14" width="4" height="66" fill="#fff" opacity=".18"/></g>`; }).join('')}
  <circle cx="40" cy="76" r="2.6" fill="#c9a24e" stroke="#8a6417" stroke-width=".8"/>
</svg>`;
};

/** Type, icons and assets: two wooden letterpress blocks. */
const block = (x, y, w, h, ch, size) => `<g>
  <path d="M${x} ${y}l6-5h${w}l-6 5z" fill="#e7cfa3"/><path d="M${x + w} ${y}l6-5v${h}l-6 5z" fill="#b48a52"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d6b380"/>
  <path d="M${x} ${y + h * 0.3}h${w}M${x} ${y + h * 0.62}h${w}" stroke="#c19b63" stroke-width=".7" opacity=".7"/>
  <text x="${x + w / 2}" y="${y + h * 0.74}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="#2a211a">${ch}</text>
</g>`;
export const typeBlocks = () => `<svg class="orn obj typeblocks" viewBox="0 0 90 84" aria-hidden="true">
  ${block(8, 40, 34, 40, 'A', 30)}${block(44, 50, 26, 30, 'g', 26)}
</svg>`;

/** Playful web: a rubber duck. Hover and it bobs. */
export const duck = () => `<svg class="orn obj duck" viewBox="0 0 90 84" aria-hidden="true">
  <defs><radialGradient id="dk-b" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffe56b"/><stop offset="1" stop-color="#f2b51e"/></radialGradient></defs>
  <g class="dk">
    <path d="M14 58c0-12 12-18 26-16 6-10 4-22 14-26 12-4 22 6 20 16-1 6-6 9-10 10 10 2 16 10 14 20-2 10-14 16-32 16-20 0-32-8-32-20z" fill="url(#dk-b)"/>
    <path d="M24 60c8 6 22 6 30-2" stroke="#e6a412" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M72 30c6-2 12 0 12 3s-6 5-12 3z" fill="#f07a24"/>
    <circle cx="62" cy="26" r="2.6" fill="#1d1d1d"/><circle cx="63" cy="25.2" r=".8" fill="#fff"/>
  </g>
</svg>`;

/** Directories: a globe on a brass stand. */
export const globe = () => `<svg class="orn obj globe" viewBox="0 0 90 84" aria-hidden="true">
  <defs>
    <radialGradient id="gl-sea" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#9cd0e6"/><stop offset="1" stop-color="#3e7fa3"/></radialGradient>
    <clipPath id="gl-clip"><circle cx="45" cy="36" r="24"/></clipPath>
  </defs>
  <path d="M30 80h30" stroke="#8a6417" stroke-width="4" stroke-linecap="round"/>
  <path d="M45 62v18" stroke="#b38a37" stroke-width="3"/>
  <circle cx="45" cy="36" r="24" fill="url(#gl-sea)"/>
  <g clip-path="url(#gl-clip)"><g class="land">
    ${[0, 64].map(o => `<g transform="translate(${o} 0)"><path d="M26 22c6-4 14-2 16 4 2 6-4 8-2 14s-4 10-8 6-2-10-6-12-6-8 0-12z" fill="#7cb46b"/><path d="M50 18c6 0 10 4 8 8s-8 2-10-2 0-6 2-6z" fill="#7cb46b"/><path d="M52 40c6-2 10 4 8 10s-10 6-12 0 0-8 4-10z" fill="#8cc077"/></g>`).join('')}
  </g></g>
  <path d="M21 36a24 24 0 0 0 48 0M45 12a10 24 0 0 0 0 48" stroke="#fff" stroke-width=".6" fill="none" opacity=".45"/>
  <path d="M19 30a27 27 0 0 1 52 0" stroke="#b38a37" stroke-width="2.4" fill="none" transform="rotate(-20 45 36)"/>
  <circle cx="45" cy="36" r="24" fill="#fff" opacity=".08"/>
</svg>`;

/** AI and code: a tin toy robot. */
export const robot = () => `<svg class="orn obj robot" viewBox="0 0 90 84" aria-hidden="true">
  <defs><linearGradient id="rb-tin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa6ad"/><stop offset=".45" stop-color="#e3e8ea"/><stop offset="1" stop-color="#8b979e"/></linearGradient></defs>
  <path d="M45 6v8" stroke="#6f7a80" stroke-width="2"/><circle cx="45" cy="5" r="3" fill="#d8402f"/>
  <rect x="30" y="13" width="30" height="22" rx="4" fill="url(#rb-tin)"/>
  <circle cx="38" cy="23" r="4" fill="#1c2b33"/><circle cx="52" cy="23" r="4" fill="#1c2b33"/>
  <circle cx="38" cy="23" r="2" fill="#5fe3d4" class="eye"/><circle cx="52" cy="23" r="2" fill="#5fe3d4" class="eye"/>
  <rect x="38" y="29" width="14" height="2.5" rx="1" fill="#6f7a80"/>
  <rect x="26" y="37" width="38" height="28" rx="4" fill="#2f8f8a"/>
  <rect x="32" y="42" width="16" height="12" rx="2" fill="#1c2b33"/><path d="M35 46h4M35 50h9" stroke="#5fe3d4" stroke-width="1.4"/>
  <circle cx="56" cy="47" r="3.4" fill="#f2b632"/><circle cx="56" cy="57" r="2" fill="#d8402f"/>
  <rect x="17" y="40" width="8" height="18" rx="3" fill="url(#rb-tin)"/><rect x="65" y="40" width="8" height="18" rx="3" fill="url(#rb-tin)"/>
  <rect x="31" y="65" width="10" height="15" rx="2" fill="url(#rb-tin)"/><rect x="49" y="65" width="10" height="15" rx="2" fill="url(#rb-tin)"/>
  <rect x="29" y="78" width="14" height="4" rx="1.5" fill="#6f7a80"/><rect x="47" y="78" width="14" height="4" rx="1.5" fill="#6f7a80"/>
</svg>`;

/** Reading and references: reading glasses resting on two books. */
export const glasses = () => `<svg class="orn obj glasses" viewBox="0 0 90 84" aria-hidden="true">
  <defs><linearGradient id="gs-pages" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ecd8"/><stop offset="1" stop-color="#ddd1b4"/></linearGradient></defs>
  <rect x="6" y="66" width="78" height="14" rx="2" fill="#2f4a3a"/><rect x="11" y="68" width="70" height="10" fill="url(#gs-pages)"/><rect x="6" y="66" width="7" height="14" rx="2" fill="#253b2e"/>
  <rect x="12" y="54" width="66" height="12" rx="2" fill="#8a3a2e"/><rect x="17" y="56" width="58" height="8" fill="url(#gs-pages)"/><rect x="12" y="54" width="7" height="12" rx="2" fill="#6f2c23"/>
  <path d="M18 44l-6 8M72 44l6 8" stroke="#2a211a" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="42" r="11" fill="#cfe3ee" fill-opacity=".35" stroke="#2a211a" stroke-width="2.6"/>
  <circle cx="58" cy="42" r="11" fill="#cfe3ee" fill-opacity=".35" stroke="#2a211a" stroke-width="2.6"/>
  <path d="M43 40c1-3 3-3 4 0" stroke="#2a211a" stroke-width="2.4" fill="none"/>
  <path d="M26 36c2-2 5-3 8-2M52 36c2-2 5-3 8-2" stroke="#fff" stroke-width="1.4" opacity=".7" stroke-linecap="round"/>
</svg>`;
