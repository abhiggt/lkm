// Injected into the page by the shortcut or the right-click menu. Builds the
// panel inside a closed Shadow DOM so the page's styles cannot leak in.
(async () => {
  const api = globalThis.browser ?? globalThis.chrome;
  const opts = globalThis.__linkmeryOpen || {};
  delete globalThis.__linkmeryOpen;

  const existing = document.getElementById('linkmery-overlay');
  if (existing) { existing.remove(); return; }   // the shortcut toggles

  const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content || '';
  const page = {
    url: opts.url || location.href,
    title: opts.url ? '' : (meta('og:title') || document.title || ''),
    description: opts.url ? '' : (meta('og:description') || meta('description')),
    image: meta('og:image'),
    selection: (opts.selection || String(getSelection() || '')).trim().slice(0, 600),
  };

  // The page's own favicon, and its colour for the book (same rule as the site).
  const iconHref = opts.url ? '' : (document.querySelector('link[rel="apple-touch-icon"][href], link[rel~="icon"][href]')?.href || new URL('/favicon.ico', location.href).href);
  async function iconPixels(src) {
    if (!src) return null;
    try {
      const img = new Image();
      if (new URL(src).origin !== location.origin) img.crossOrigin = 'anonymous';
      img.src = src; await img.decode();
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 32, 32);
      return cx.getImageData(0, 0, 32, 32).data;
    } catch { return null; }
  }
  // Fonts are registered on the document under Linkmery's own names, so the
  // panel inside the shadow root can use them without touching the page's type.
  const faces = [['Linkmery Sans', 'instrument-sans-latin-400-normal', '400'], ['Linkmery Sans', 'instrument-sans-latin-500-normal', '500'],
    ['Linkmery Serif', 'fraunces-latin-400-normal', '400'], ['Linkmery Serif', 'fraunces-latin-500-normal', '500'], ['Linkmery Mono', 'ibm-plex-mono-latin-400-normal', '400']];
  for (const [family, file, weight] of faces) {
    try { const f = new FontFace(family, `url(${api.runtime.getURL(`fonts/${file}.woff2`)})`, { weight }); document.fonts.add(f); f.load().catch(() => {}); } catch { /* fonts are optional */ }
  }
  try { const f = new FontFace('Linkmery Serif', `url(${api.runtime.getURL('fonts/fraunces-latin-400-italic.woff2')})`, { style: 'italic' }); document.fonts.add(f); f.load().catch(() => {}); } catch { /* optional */ }

  const host = document.createElement('div');
  host.id = 'linkmery-overlay';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 16px; right: 16px;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = api.runtime.getURL('ui.css');
  const root = document.createElement('div');
  root.className = 'overlay';
  // Same theme rule as the site: IST day 06:00 to 18:00.
  const hr = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  root.dataset.theme = hr >= 6 && hr < 18 ? 'day' : 'night';
  shadow.append(css, root);
  document.documentElement.append(host);

  const close = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);

  const [{ renderApp }, { pickColour }] = await Promise.all([import(api.runtime.getURL('ui.js')), import(api.runtime.getURL('core/colour.js'))]);
  const px = await iconPixels(iconHref);
  page.icon = px ? iconHref : '';
  page.colour = px ? pickColour(px) : null;
  renderApp(root, { page, initialTab: opts.tab || 'save', close });
})();
