// The Save and Find panel, used by both the in-page overlay and the popup.
// Add asks for as little as possible: the page is prefilled, your note is
// one line, the shelf is suggested. Everything else waits under "More".
import { createSearch } from './core/search.js';
import { normalizeUrl } from './core/url.js';

const api = globalThis.browser ?? globalThis.chrome;
const send = msg => api.runtime.sendMessage(msg);
const TYPES = ['tool', 'article', 'video', 'inspiration', 'reference'];
const cap = s => s[0].toUpperCase() + s.slice(1);

/** The Linkmery mark, drawn in the current text colour so it works day and night. */
function logo() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true'); svg.classList.add('logo');
  const g = document.createElementNS(ns, 'g');
  for (const [k, v] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) g.setAttribute(k, v);
  const add = (tag, attrs) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); g.append(el); };
  add('rect', { x: 4, y: 5, width: 5, height: 21, rx: 1.6 });
  add('rect', { x: 12, y: 8.5, width: 5, height: 17.5, rx: 1.6 });
  add('rect', { x: 19.4, y: 7, width: 5, height: 19, rx: 1.6, transform: 'rotate(16 24.4 26)' });
  add('path', { d: 'M2 29h28' });
  svg.append(g);
  return svg;
}

function h(tag, props = {}, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name);
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** Guess a type from the URL. */
function guessType(url) {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(u)) return 'video';
  if (/medium\.com|substack\.com|\/blog\/|\/posts?\/|\/article/.test(u)) return 'article';
  if (/dribbble|behance|pinterest|savee|gallery|inspiration/.test(u)) return 'inspiration';
  return 'tool';
}

/** Suggest a shelf from the links it most resembles. */
function suggest(engine, byId, text) {
  const votes = new Map();
  engine.search(text).slice(0, 6).forEach((r, i) => {
    const e = byId.get(r.id);
    votes.set(e.shelf, (votes.get(e.shelf) || 0) + (6 - i) * r.score);
  });
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export async function renderApp(root, { page = {}, initialTab = 'save', close }) {
  let data = await send({ type: 'data' });
  const shelves = (data.shelves || []).filter(s => !s.kind).sort((a, b) => a.order - b.order);
  const byId = new Map(data.entries.map(e => [e.id, e]));
  const engine = createSearch(data);
  const known = new Map(data.entries.map(e => [normalizeUrl(e.url), e]));
  const shelfName = id => shelves.find(s => s.id === id)?.name || id;

  const tabs = h('div.seg', { role: 'tablist' });
  const body = h('div.body');
  const status = h('p.status', { role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(h('div.app', {},
    h('div.head', {}, logo(), tabs, close && h('button.x', { type: 'button', 'aria-label': 'Close', onclick: close }, 'esc')),
    body, status));

  // The page's own favicon, set into a small soft tile.
  const tileFor = ({ title, url, icon }) => {
    const letter = (title?.match(/[A-Za-z0-9]/) || [hostOf(url)[0] || '?'])[0].toUpperCase();
    return h('span.tile', { 'aria-hidden': 'true' },
      icon ? h('img', { src: icon, alt: '', onerror: ev => ev.target.replaceWith(h('span', {}, letter)) }) : h('span', {}, letter));
  };

  const show = which => {
    for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === which));
    which === 'save' ? renderSave() : renderFind();
  };
  for (const [id, label] of [['save', 'Add'], ['find', 'Find']])
    tabs.append(h('button', { type: 'button', role: 'tab', 'data-tab': id, onclick: () => show(id) }, label));
  // Tab switches between Save and Find when focus is on the tabs; Alt+F / Alt+S anywhere.
  root.addEventListener('keydown', ev => {
    if (ev.altKey && (ev.key === 'f' || ev.key === 'F')) { ev.preventDefault(); show('find'); }
    if (ev.altKey && (ev.key === 's' || ev.key === 'S')) { ev.preventDefault(); show('save'); }
  });

  // ---------- Save ----------
  function renderSave() {
    status.textContent = '';
    const url = page.url || '';
    const dupe = known.get(normalizeUrl(url));
    const note = page.selection || page.description || '';
    let shelf = dupe?.shelf || suggest(engine, byId, `${page.title || ''} ${note} ${hostOf(url)}`) || shelves[0]?.id;
    const suggested = shelf;

    const title = h('textarea.title', { name: 'title', rows: 2, required: true, 'aria-label': 'Title', spellcheck: 'false' }, page.title || '');
    const desc = h('textarea.note', { name: 'description', rows: 3, required: true, placeholder: 'What is it good for? A line in your words.', 'aria-label': 'Your note' }, note);
    const goLabel = h('span.go-label');
    const go = h('button.go', { type: 'submit' }, h('span.go-plus', { 'aria-hidden': 'true' }), goLabel, h('kbd.go-key', { 'aria-hidden': 'true' }, '↵'));
    const sug = h('span.sug', {}, 'best fit');
    const select = h('select', { name: 'shelf', 'aria-label': 'Shelf' }, shelves.map(s => h('option', { value: s.id, selected: s.id === shelf }, s.name)));
    const label = () => { goLabel.textContent = `${dupe ? 'Update on' : 'Add to'} ${shelfName(shelf)}`; sug.hidden = !!dupe || shelf !== suggested; };
    select.addEventListener('change', () => { shelf = select.value; label(); });
    label();

    const more = h('details.more', {},
      h('summary', {}, 'Add details'),
      h('label.field', {}, h('span', {}, 'Good for'), h('input', { name: 'why', placeholder: 'logo work, a slow Sunday read', maxlength: 140 })),
      h('label.field', {}, h('span', {}, 'Type'), h('select', { name: 'type' }, TYPES.map(t => h('option', { value: t, selected: t === guessType(url) }, cap(t))))),
      h('label.field', {}, h('span', {}, 'Tags'), h('input', { name: 'tags', placeholder: 'fonts, free, colour', autocomplete: 'off' })),
      h('div.checks', {},
        h('label', {}, h('input', { type: 'checkbox', name: 'pinned' }), ' Pin to the top'),
        h('label', {}, h('input', { type: 'checkbox', name: 'readLater' }), ' Read later')));

    const f = h('form.save', { onsubmit: ev => submit(ev, () => shelf) },
      h('div.page-row', {}, tileFor({ title: page.title, url, icon: page.icon }), h('div.meta-col', {},
        title, h('p.url', {}, hostOf(url)),
        dupe && h('p.dupe', {}, `Already in your library, on ${shelfName(dupe.shelf)}.`))),
      desc,
      h('label.shelf-select', {}, select, sug),
      more,
      h('div.acts', {}, go));
    // Enter saves from anywhere except inside the note, where Ctrl/Cmd+Enter does.
    f.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.isComposing) return;
      if (ev.target === desc && !(ev.ctrlKey || ev.metaKey)) return;
      if (ev.target.tagName === 'SUMMARY' || ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox') return;
      ev.preventDefault(); f.requestSubmit();
    });
    f.dataset.url = url;
    body.replaceChildren(f);
    (desc.value ? go : desc).focus();
  }

  async function submit(ev, getShelf) {
    ev.preventDefault();
    const f = ev.target;
    const fd = new FormData(f);
    const form = Object.fromEntries(fd.entries());
    form.url = f.dataset.url;
    form.shelf = getShelf();
    form.type = form.type || guessType(form.url);
    form.pinned = fd.has('pinned'); form.readLater = fd.has('readLater');
    if (!form.url || !/^https?:/.test(form.url)) { status.textContent = 'This page can’t be added. Open a website and try again.'; return; }
    f.querySelector('.go').disabled = true;
    status.textContent = 'Adding…';
    const r = await send({ type: 'save', form });
    if (r.ok) {
      body.replaceChildren(h('div.done', {}, h('span.seal', { 'aria-hidden': 'true' }, '✓'),
        h('p.big', {}, `Added to ${shelfName(form.shelf)}.`),
        h('p', {}, r.committed ? 'It will be on your site in a minute or two.' : 'Nicely done.')));
      status.textContent = '';
      setTimeout(() => close?.(), 1300);
    } else {
      status.textContent = r.reason === 'no-token'
        ? `Saved in this browser (${r.pendingCount} ready to go live). Add a GitHub token in settings to publish it.`
        : `Saved in this browser. It isn’t live yet: ${r.reason}`;
      f.querySelector('.go').disabled = false;
    }
    data = await send({ type: 'data' });
    known.set(normalizeUrl(form.url), r.entry);
  }

  // ---------- Find ----------
  function renderFind() {
    status.textContent = data.error || '';
    const fresh = createSearch(data);
    const all = new Map(data.entries.map(e => [e.id, e]));
    const q = h('input.q', { type: 'search', placeholder: 'Search your library', 'aria-label': 'Search your library' });
    const list = h('ol.results');
    let sel = 0;
    const items = () => [...list.querySelectorAll('li[data-url]')];
    const mark = () => items().forEach((li, i) => li.classList.toggle('sel', i === sel));
    const draw = () => {
      sel = 0;
      const res = q.value.trim() ? fresh.search(q.value).slice(0, 8) : [];
      list.replaceChildren(...res.map(r => {
        const e = all.get(r.id);
        return h('li', { 'data-url': e.url, onclick: ev => { if (!ev.target.closest('a, button')) ev.currentTarget.querySelector('a').click(); } },
          h('span.chip', { 'aria-hidden': 'true' }, h('img', { src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(e.url))}&sz=32`, alt: '', onerror: ev => ev.target.remove() })),
          h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.title),
          h('p', {}, e.description),
          h('div.meta', {}, h('span', {}, hostOf(e.url), ' · ', h('em', {}, shelfName(e.shelf))),
            h('button', { type: 'button', onclick: () => navigator.clipboard.writeText(e.url).then(() => { status.textContent = 'Link copied'; }) }, 'Copy')));
      }));
      if (q.value.trim() && !res.length) list.replaceChildren(h('li.none', {}, 'Nothing like that yet. Try fewer words.'));
      mark();
    };
    q.addEventListener('input', draw);
    q.addEventListener('keydown', ev => {
      const n = items().length;
      if (ev.key === 'ArrowDown' && n) { ev.preventDefault(); sel = (sel + 1) % n; mark(); }
      if (ev.key === 'ArrowUp' && n) { ev.preventDefault(); sel = (sel - 1 + n) % n; mark(); }
      if (ev.key === 'Enter' && n) { ev.preventDefault(); items()[sel].querySelector('a').click(); close?.(); }
    });
    body.replaceChildren(q, list, h('p.count', {}, `${data.pending?.length ? `${data.pending.length} on the way to your site. ` : ''}↑ ↓ to move, Enter to open.`));
    q.focus();
  }

  show(initialTab);
}
