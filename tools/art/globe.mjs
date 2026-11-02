// The globe on the cabinet, drawn as two layers so the earth can turn:
// a map strip that tiles sideways (seas, land, ice, a little cloud) and the
// stand: a brass meridian ring and a turned base. Baked to AVIF by bake.mjs.

// A rough world, drawn freehand on a 1024 x 512 strip (equirectangular).
const LAND = [
  // North America
  'M140 92c40-22 96-30 150-18 26 6 40 22 34 40-8 22-40 26-52 46-10 18 2 40-18 52-18 10-36 4-46 22-8 14-2 30-16 36-16 6-26-12-34-26-14-24-42-36-50-62-8-28 6-58 32-90z',
  'M300 40c26-10 60-8 74 6 10 12-6 26-30 28-26 2-56-2-60-14-2-10 6-16 16-20z',
  // South America
  'M262 262c22-10 52-6 66 14 16 22 4 48-6 70-12 26-14 58-32 80-10 12-26 8-28-8-4-26 6-52-4-78-8-22-24-40-14-62 4-8 10-12 18-16z',
  // Europe
  'M492 96c18-14 46-16 64-6 14 8 8 22-6 28-12 6-12 18-26 22-16 4-34-2-40-14-4-10 0-22 8-30z',
  // Africa
  'M500 176c30-14 74-12 98 8 20 16 22 42 14 64-10 26-28 46-34 74-6 28-22 52-44 50-20-2-24-26-30-46-8-26-28-44-30-72-2-28 4-62 26-78z',
  // Asia
  'M580 80c50-30 132-34 196-20 44 10 84 30 92 62 6 26-20 44-48 52-28 8-38 30-66 38-30 8-54-8-80 2-24 10-28 36-50 40-20 4-30-16-36-34-8-22-30-34-30-58 0-30 26-56 22-82z',
  // India and South East Asia
  'M686 196c14-4 26 6 28 20 2 18-8 36-20 40-10 2-14-14-16-28-2-14-4-28 8-32z',
  'M770 214c16-6 36 0 40 12 4 14-12 22-26 22-14 0-24-8-24-18 0-8 4-14 10-16z',
  // Australia
  'M830 318c26-14 64-12 82 6 14 14 8 34-10 42-22 10-48 6-66-2-16-8-22-26-14-38 2-4 4-6 8-8z',
  // Greenland, Japan, Madagascar, New Zealand
  'M380 34c22-6 44 0 46 12 2 14-20 22-38 20-16-2-26-10-24-20 2-6 8-10 16-12z',
  'M846 140c6-4 14 0 14 8 0 10-6 22-12 24-6 2-8-8-8-16 0-8 2-14 6-16z',
  'M628 330c6-4 12 0 12 10s-4 22-10 22-6-10-6-18c0-8 2-12 4-14z',
  'M948 384c6-2 10 4 8 12-2 10-8 16-12 14-4-2-2-10 0-16 2-6 2-8 4-10z',
];

export const earthMap = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d5f86"/><stop offset=".5" stop-color="#3f86ad"/><stop offset="1" stop-color="#2d5f86"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="4" seed="7" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .2  0 0 0 0 .35  0 0 0 0 .15  0 0 0 .9 -.25"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="landtex" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="3" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .62  0 0 0 0 .56  0 0 0 0 .32  0 0 0 1.4 -.55" result="dry"/>
      <feComposite in="dry" in2="SourceGraphic" operator="in" result="d"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/></feMerge>
    </filter>
    <filter id="cloud" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".008 .03" numOctaves="4" seed="11" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.2 -1.25"/>
    </filter>
    <linearGradient id="iceN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8fa"/><stop offset=".6" stop-color="#e6eef2"/><stop offset="1" stop-color="#e6eef2" stop-opacity="0"/></linearGradient>
    <linearGradient id="iceS" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f4f8fa"/><stop offset=".6" stop-color="#e6eef2"/><stop offset="1" stop-color="#e6eef2" stop-opacity="0"/></linearGradient>
    <!-- coastlines: roughen the freehand shapes so they read as real land -->
    <filter id="coast" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="5" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="22" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <linearGradient id="biome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="512">
      <stop offset=".05" stop-color="#8a9e86"/><stop offset=".18" stop-color="#5e8a4c"/><stop offset=".32" stop-color="#6b9150"/><stop offset=".4" stop-color="#c4ab70"/><stop offset=".47" stop-color="#b89d62"/><stop offset=".53" stop-color="#3f7d3a"/><stop offset=".62" stop-color="#b8a066"/><stop offset=".75" stop-color="#6c9652"/><stop offset=".95" stop-color="#8a9e86"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="512" fill="url(#sea)"/>
  <rect width="1024" height="512" fill="#1d4d70" filter="url(#grain)" opacity=".5"/>
  <g filter="url(#coast)">
    <g fill="#9fc3d6" opacity=".55">${LAND.map(d => `<path d="${d}" transform="translate(-3 -3) scale(1.01)"/>`).join('')}</g>
    <g fill="url(#biome)" filter="url(#landtex)">${LAND.map(d => `<path d="${d}"/>`).join('')}</g>
  </g>
  <rect y="0" width="1024" height="40" fill="url(#iceN)"/><rect y="472" width="1024" height="40" fill="url(#iceS)"/>
  <rect width="1024" height="512" filter="url(#cloud)" opacity=".55"/>
</svg>`;

// The stand: a brass half-meridian ring on a turned wooden base. The sphere
// itself is drawn by the page (it turns); this sits in front of and under it.
export const globeStand = () => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280" viewBox="0 0 240 280">
  <defs>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1d898"/><stop offset=".35" stop-color="#c9a24e"/><stop offset=".6" stop-color="#e6c983"/><stop offset="1" stop-color="#8c6721"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a2c1a"/><stop offset=".3" stop-color="#7a4b2c"/><stop offset=".55" stop-color="#a06a42"/><stop offset=".8" stop-color="#6d4126"/><stop offset="1" stop-color="#3e2415"/>
    </linearGradient>
    <linearGradient id="woodtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b07a4f"/><stop offset="1" stop-color="#6d4126"/></linearGradient>
    <radialGradient id="cast" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="120" cy="268" rx="78" ry="9" fill="url(#cast)"/>
  <!-- base -->
  <path d="M58 252c0-10 28-16 62-16s62 6 62 16v8c0 8-28 12-62 12s-62-4-62-12z" fill="url(#wood)"/>
  <ellipse cx="120" cy="252" rx="62" ry="13" fill="url(#woodtop)"/>
  <ellipse cx="120" cy="250" rx="40" ry="7" fill="#5a3520" opacity=".35"/>
  <!-- stem -->
  <path d="M112 196h16l4 54h-24z" fill="url(#wood)"/>
  <ellipse cx="120" cy="198" rx="12" ry="4" fill="url(#woodtop)"/>
  <rect x="113" y="186" width="14" height="10" rx="3" fill="url(#brass)"/>
  <!-- the meridian ring, tilted with the axis -->
  <g transform="rotate(-23.5 120 104)">
    <path d="M120 10a94 94 0 0 1 0 188" fill="none" stroke="#6b4e15" stroke-width="10" opacity=".35" transform="translate(2 2)"/>
    <path d="M120 10a94 94 0 0 1 0 188" fill="none" stroke="url(#brass)" stroke-width="8"/>
    <path d="M120 10a94 94 0 0 1 0 188" fill="none" stroke="#fff3c9" stroke-width="1.2" opacity=".6" transform="translate(-2 0)"/>
    ${Array.from({ length: 17 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 16; const x1 = 120 + Math.cos(a) * 91, y1 = 104 + Math.sin(a) * 91, x2 = 120 + Math.cos(a) * 96, y2 = 104 + Math.sin(a) * 96; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#6b4e15" stroke-width="1"/>`; }).join('')}
    <circle cx="120" cy="10" r="5" fill="url(#brass)"/><circle cx="120" cy="198" r="5" fill="url(#brass)"/>
  </g>
  <!-- the arm that holds the ring on the stem -->
  <path d="M156 190c-6 8-22 10-34 0" fill="none" stroke="#6b4e15" stroke-width="7" opacity=".3" transform="translate(1 2)"/>
  <path d="M156 190c-6 8-22 10-34 0" fill="none" stroke="url(#brass)" stroke-width="6" stroke-linecap="round"/>
</svg>`;
