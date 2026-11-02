// Linkmery. The shelves are already in the HTML; this adds the glass
// doors, the search drawer, shelf rooms (#id) with three views, the detail
// sheet, sharing, lights, sound and a few things to find.
import { createSearch, matchedHint } from './core/search.js';
import { EMPTY_SHELF, CONSOLE } from './core/ascii.js';
import { h, $, $$, store, copy, toast, domain, human, TYPE_LABEL } from './ui/util.js';
import { createFlip } from './ui/flip.js';
import { pickColour, bookVars } from './core/colour.js';
import { initEggs } from './ui/eggs.js';
import { sfx } from './ui/sfx.js';

const data = JSON.parse(document.getElementById('lm-data').textContent);
const { entries, synonyms, config } = data;
const shelves = [...data.shelves].sort((a, b) => a.order - b.order);
const real = shelves.filter(s => !s.kind);
const byId = new Map(entries.map(e => [e.id, e]));
const shelfById = new Map(shelves.map(s => [s.id, s]));
const shelfName = id => shelfById.get(id)?.name || id;
const engine = createSearch({ entries, shelves, synonyms });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;
const siteBase = () => config.siteUrl || location.href.split('#')[0];

/** Share with the system sheet where there is one, otherwise copy the link. */
async function share(title, url, text) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, text, url }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  copy(url, 'Link copied. Send it to someone.');
}

// ---------- covers made in the browser (drawer, search, the flip) ----------
const letterOf = e => (e.title.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
function coverEl(e, hint, { full = true } = {}) {
  const c = e.colour;
  return h('article', { class: `cover${c ? '' : ' paper'}${e.pinned ? ' pinned' : ''}${e.deadSince ? ' dead' : ''}`, 'data-id': e.id, 'data-age': String(e.age ?? 0), title: hint ? `Matched on ${hint}` : null,
    style: c ? { '--bk': c.bg, '--bk-ink': c.ink } : null },
    h('h3.cv-t', {}, h('a', { href: e.url, rel: 'noopener' }, e.title)),
    e.fav ? h('span.cv-art', {}, h('img', { src: e.fav, alt: '', width: 32, height: 32, loading: 'lazy' }))
      : h('span.cv-art.mono', { 'aria-hidden': 'true', 'data-host': domain(e.url) }, letterOf(e)),
    h('p.cv-site', {}, domain(e.url)),
    !full ? null : [
    h('p.cv-d', {}, e.description),
    e.why ? h('p.cv-why', {}, `For ${e.why}`) : null,
    h('p.cv-m', {},
      h('span.cv-dom', {}, domain(e.url)), h('span.cv-type', {}, TYPE_LABEL[e.type]),
      h('time', { datetime: e.added }, human(e.added)),
      e.deadSince ? h('span.cv-dead', {}, 'Moved out') : null)]);
}
// Every time a book is opened it is "borrowed": the card stamps when it was
// last taken out. Kept in this browser only.
const ago = ts => {
  const d = Math.floor((Date.now() - ts) / 864e5);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`;
};
function borrow(e) {
  const log = store.get('borrowed', {}), prev = log[e.id];
  log[e.id] = [(prev?.[0] || 0) + 1, Date.now()];
  store.set('borrowed', log);
  return !prev ? 'First time borrowed' : `Borrowed before, last ${ago(prev[1])}`;
}
const flip = createFlip({ shelfName, share, copy, sfx, siteBase, entry: id => byId.get(id), onShow: borrow, front: e => coverEl(e, null, { full: false }) });

// ---------- favicons that weren't fetched at build time ----------
// The deploy saves every favicon it can find next to the site. For any it
// missed, the browser asks Google's favicon service once the book is in
// view, and colours the book from it when the image allows that.
const iconCache = new Map();
function iconFor(host) {
  if (!iconCache.has(host)) iconCache.set(host, new Promise(resolve => {
    const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    const tryLoad = cors => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.naturalWidth <= 16) return resolve(null);          // the service's blank globe
        let colour = null;
        try {
          const cv = document.createElement('canvas'); cv.width = cv.height = 32;
          const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, 32, 32);
          colour = pickColour(cx.getImageData(0, 0, 32, 32).data);
        } catch { /* no CORS: show the icon, keep the book white */ }
        resolve({ src, colour });
      };
      img.onerror = () => cors ? tryLoad(false) : resolve(null);
      img.src = src;
    };
    tryLoad(true);
  }));
  return iconCache.get(host);
}
async function dressBook(cover) {
  const art = cover.querySelector('.cv-art.mono[data-host]');
  if (!art || art.dataset.tried) return;
  art.dataset.tried = '1';
  const got = await iconFor(art.dataset.host);
  if (!got) return;
  const e = byId.get(cover.dataset.id);
  if (e) { e.fav = got.src; if (got.colour) e.colour = { bg: got.colour, ink: bookVars(got.colour)['--bk-ink'] }; }
  for (const el of $$(`.cover[data-id="${cover.dataset.id}"]`)) {
    const a = el.querySelector('.cv-art.mono');
    if (a) a.replaceWith(h('span.cv-art', {}, h('img', { src: got.src, alt: '', width: 32, height: 32 })));
    if (got.colour) { el.classList.remove('paper'); for (const [k, v] of Object.entries(bookVars(got.colour))) el.style.setProperty(k, v); }
  }
}
// A book on the shelf opens its card, never the site. The titles stay real
// links in the HTML for search engines and no-JS readers; here they become
// the book's button.
function bookify(root) {
  for (const a of $$('.cover .cv-t a[href]', root)) {
    if (a.closest('.flip')) continue;
    a.dataset.href = a.getAttribute('href');
    a.removeAttribute('href'); a.removeAttribute('rel');
    a.setAttribute('role', 'button'); a.tabIndex = 0;
  }
}
bookify(document);
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && bookify(n)))).observe(document.body, { childList: true, subtree: true });
// On a shelf, the arrow keys walk along the books.
document.addEventListener('keydown', ev => {
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  const cover = ev.target.closest?.('.cover');
  if (!cover || cover.closest('.flip-stage')) return;
  const row = [...cover.parentElement.querySelectorAll(':scope > .cover')].filter(c => c.offsetParent);
  const next = row[row.indexOf(cover) + (ev.key === 'ArrowRight' ? 1 : -1)];
  if (next) { ev.preventDefault(); next.querySelector('.cv-t a')?.focus(); next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }); }
});
document.addEventListener('keydown', ev => {
  const a = ev.target.closest?.('.cover .cv-t a[role="button"]');
  if (!a || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault();
  const cover = a.closest('.cover');
  flip.open(byId.get(cover.dataset.id), cover);
});
const seen = new IntersectionObserver(items => items.forEach(it => { if (it.isIntersecting) { seen.unobserve(it.target); dressBook(it.target); } }), { rootMargin: '300px' });
const watchBooks = root => $$('.cover', root).forEach(c => { if (c.querySelector('.cv-art.mono[data-host]')) seen.observe(c); });
watchBooks(document);

// ---------- the glass doors ----------
// Home always opens behind closed glass doors, the logo as the doorknob.
// A tap, Enter or "/" opens them. A shared shelf link (#id) walks straight in.
const doorsEl = $('#doors');
let doors = 'open';
function openDoors({ sound = true, then } = {}) {
  if (doors !== 'closed') { then?.(); return; }
  doors = 'opening';
  if (sound) sfx.open();
  const done = () => {
    doorsEl.hidden = true; doorsEl.classList.remove('opening');
    body.classList.remove('closed'); doors = 'open';
    lightsOn();
    then?.();
  };
  if (reduced()) return done();
  doorsEl.classList.add('opening');
  setTimeout(done, 900);
}
// The doors open on a dark cabinet. A light inside flickers on, the shelves
// come up one after another and the books settle. The first visit gets the
// whole of it; later visits a shorter version.
function lightsOn() {
  if (reduced()) return;
  const first = !store.get('visited', false);
  store.set('visited', true);
  body.classList.toggle('first-visit', first);
  const shelvesInView = $$('.shelves .shelf:not(.virtual)').filter(s => s.getBoundingClientRect().top < innerHeight).slice(0, 3);
  shelvesInView.forEach((s, i) => {
    s.style.setProperty('--row', i);
    $$('.rows > .cover', s).slice(0, 7).forEach((c, j) => c.style.setProperty('--i', j));
  });
  setTimeout(() => sfx.light(), first ? 120 : 40);
  setTimeout(() => sfx.settleRow(), first ? 700 : 300);
  body.classList.add('lights-on');
  setTimeout(() => body.classList.remove('lights-on', 'first-visit'), first ? 2600 : 1400);
}
function closeDoors() {
  if (doors !== 'open' || body.classList.contains('in-room')) return;
  closeDrawer(false);
  scrollTo({ top: 0, behavior: 'instant' });
  sfx.close();
  body.classList.add('closed'); doorsEl.hidden = false; doorsEl.classList.add('opening');
  doorsEl.getBoundingClientRect();
  doorsEl.classList.remove('opening'); doors = 'closed';
}
{
  const hr = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  $('#cue-hello').textContent = hr < 5 ? 'Still up? Come in.' : hr < 12 ? 'Good morning. Come in.' : hr < 17 ? 'Good afternoon. Come in.' : 'Good evening. Come in.';
}
if (!location.hash) {
  body.classList.add('closed'); doorsEl.hidden = false; doors = 'closed';
}
// Enter or Space opens the doors from anywhere while they are closed.
document.addEventListener('keydown', ev => {
  if (doors !== 'closed' || flip.isOpen) return;
  if ((ev.key === 'Enter' || ev.key === ' ') && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName)) { ev.preventDefault(); openDoors(); }
});
doorsEl.addEventListener('click', () => openDoors());

// ---------- rooms that fill themselves ----------
// New arrivals (the stack on the cabinet), Borrowed lately (what you opened
// on this device) and Meri (pinned books, then the ones you borrow most).
const borrowedLog = () => store.get('borrowed', {});
const fileOrder = new Map(entries.map((e, i) => [e.id, i]));
const byLatest = (a, b) => b.added.localeCompare(a.added) || fileOrder.get(b.id) - fileOrder.get(a.id);
const VIRTUAL = {
  recent: { name: shelfById.get('recent')?.name || 'New arrivals', note: shelfById.get('recent')?.note || '', empty: '',
    pick: () => [...entries].sort(byLatest).slice(0, 12) },
  borrowed: { name: 'Borrowed lately', note: 'The books you opened most recently, kept on this device only.', empty: 'Nothing borrowed yet. Open a few books and they gather here.',
    pick: () => Object.entries(borrowedLog()).sort((a, b) => b[1][1] - a[1][1]).map(([id]) => byId.get(id)).filter(Boolean).slice(0, 12) },
  meri: { name: 'Meri', note: 'Meri means mine: the pinned books, then the ones borrowed most.', empty: '',
    pick: () => {
      const log = borrowedLog();
      const pinned = entries.filter(e => e.pinned);
      const most = Object.entries(log).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]).map(([id]) => byId.get(id)).filter(e => e && !e.pinned);
      const list = [...pinned, ...most].slice(0, 12);
      return list.length ? list : [...entries].sort(byLatest).slice(0, 6);
    } },
};
// Hidden in plain sight: a shelf for every type of book, reached only from a card.
const TYPE_ROOM = { tool: 'Every tool', article: 'Every article', video: 'Every video', inspiration: 'Every inspiration', reference: 'Every reference' };
for (const [t, name] of Object.entries(TYPE_ROOM)) VIRTUAL[`type-${t}`] = { name, note: `Every ${TYPE_LABEL[t].toLowerCase()} in the library, whichever shelf it lives on.`, empty: '', pick: () => entries.filter(e => e.type === t) };
for (const [id, v] of Object.entries(VIRTUAL)) {
  shelfById.set(id, { ...(shelfById.get(id) || {}), id, name: v.name });
  $('#shelves').append(h('section.shelf.virtual', { id, 'data-view': 'shelf', 'aria-labelledby': `h-${id}` },
    h('header.shelf-head', {}, h('h2.shelf-label', { id: `h-${id}` }, h('a', { href: `#${id}` }, v.name)), v.note ? h('p.shelf-note', {}, v.note) : null),
    h('div.rows')));
}
function fillVirtual(id) {
  const v = VIRTUAL[id]; if (!v) return;
  const rows = $(`#${id} .rows`), list = v.pick();
  rows.replaceChildren(...list.map(e => coverEl(e)));
  rows.classList.toggle('none', !list.length);
  if (!list.length) rows.append(h('p.empty-note', {}, v.empty));
  watchBooks(rows);
}

// ---------- shelf rooms: #id opens one shelf, with views and sharing ----------
const views = store.get('views', {});
const VIEWS = [['shelf', 'Shelf'], ['spines', 'Stack'], ['list', 'List']];
for (const sec of $$('.shelves .shelf')) {
  const id = sec.id;
  const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'View' }, VIEWS.map(([v, label]) =>
    h('button', { type: 'button', role: 'radio', 'data-v': v, 'aria-checked': String(v === 'shelf'), onclick: () => setShelfView(sec, v, true) }, label)));
  $('.shelf-head', sec).append(h('div.room-bar', {}, seg));
}
// Inside a shelf, "Share this shelf" sits in the top row, level with the search bar.
$('#share-room').addEventListener('click', () => {
  const id = location.hash.slice(1);
  share(`${shelfById.get(id)?.name || VIRTUAL[id]?.name || 'A shelf'} on Linkmery`, `${siteBase()}#${id}`);
});
// Ornaments (a plant, a Rubik's cube) stand in a shelf's last row only if it has room.
function fitOrnaments() {
  for (const orn of $$('.shelves .ornament')) {
    const rows = orn.parentElement;
    const cols = getComputedStyle(rows).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const books = [...rows.children].filter(c => c !== orn && c.offsetParent !== null).length;
    orn.classList.toggle('fits', rows.closest('.shelf').dataset.view !== 'list' && books % cols !== 0);
  }
}
let fo; addEventListener('resize', () => { clearTimeout(fo); fo = setTimeout(fitOrnaments, 120); });
requestAnimationFrame(fitOrnaments);

function setShelfView(sec, v, remember) {
  sec.dataset.view = v;
  requestAnimationFrame(fitOrnaments);
  $$('.room-bar [data-v]', sec).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)));
  if (remember) { views[sec.id] = v; store.set('views', views); sfx.tap(); }
}
function enterRoom(id, smooth) {
  closeDrawer(false);
  fillVirtual(id);
  for (const s of $$('.shelves .shelf')) {
    const here = s.id === id;
    s.classList.toggle('here', here);
    setShelfView(s, here ? views[id] || 'shelf' : 'shelf', false);
  }
  body.classList.add('in-room');
  document.title = `${shelfName(id)} on Linkmery`;
  if (doors === 'closed') { doorsEl.hidden = true; body.classList.remove('closed'); doors = 'open'; }
  scrollTo({ top: 0, behavior: smooth && !reduced() ? 'smooth' : 'instant' });
}
function leaveRoom() {
  body.classList.remove('in-room');
  $$('.shelves .shelf.here').forEach(s => { s.classList.remove('here'); setShelfView(s, 'shelf', false); });
  document.title = document.querySelector('meta[property="og:title"]').content;
}
function goHome() {
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
  leaveRoom(); closeDrawer(false);
  scrollTo({ top: 0, behavior: reduced() ? 'instant' : 'smooth' });
}
$('#back').addEventListener('click', () => { sfx.tap(); if (body.classList.contains('seeking') && !body.classList.contains('in-room')) closeDrawer(true); else goHome(); });

// ---------- the search drawer ----------
const q = $('#q');
const drawer = $('#drawer');
const found = $('#found');
// While searching, the drawer holds only the shelves, nothing else.
function renderDrawer() {
  drawer.replaceChildren(
    h('nav.chips', { 'aria-label': 'Shelves' }, real.map(s => h('a.chip', { href: `#${s.id}` }, s.name))),
    h('button.btn.small.drawer-close', { type: 'button', onclick: () => closeDrawer(true) }, 'Close'));
}
function openDrawer() {
  if (body.classList.contains('seeking') && (!drawer.hidden || q.value)) return;
  body.classList.add('seeking');
  if (!q.value.trim()) { renderDrawer(); drawer.hidden = false; }
}
function closeDrawer(blur) {
  if (q.value) { q.value = ''; found.hidden = true; found.replaceChildren(); results = []; }
  drawer.hidden = true;
  body.classList.remove('seeking');
  if (blur) q.blur();
}

let results = [];

// ---------- cheat codes (made in the admin panel) ----------
const cheats = (data.config.cheats || []).filter(c => c.code && c.open);
let cheatTimer = 0;
function cheatTarget(c) {
  if (c.open.startsWith('#')) { const id = c.open.slice(1); return { label: shelfById.get(id)?.name || VIRTUAL[id]?.name || id, kind: 'room', id }; }
  if (c.open.startsWith('book:')) { const e = byId.get(c.open.slice(5)); return e ? { label: e.title, kind: 'book', e } : null; }
  return { label: domain(c.open), kind: 'url', url: c.open };
}
function showCheat(c) {
  const t = cheatTarget(c);
  results = [];
  found.hidden = false;
  if (!t) { found.replaceChildren(h('p.cheat', {}, 'That cheat code leads nowhere now.')); return; }
  const go = h('a.cheat-go', { href: t.kind === 'url' ? t.url : t.kind === 'room' ? `#${t.id}` : `#${t.e.shelf}`, ...(t.kind === 'url' && { target: '_blank', rel: 'noopener' }),
    onclick: ev => { ev.preventDefault(); openCheat(c); } }, t.label);
  found.replaceChildren(h('div.cheat', { role: 'status' }, h('span.cheat-mark', { 'aria-hidden': 'true' }, '✦'),
    h('p', {}, 'Cheat code ', h('strong', {}, c.code.trim()), '. Opening ', go, '…')));
  clearTimeout(cheatTimer);
  cheatTimer = setTimeout(() => { if (q.value.trim().toLowerCase() === c.code.trim().toLowerCase()) openCheat(c); }, 800);
}
function openCheat(c) {
  clearTimeout(cheatTimer);
  const t = cheatTarget(c); if (!t) return;
  sfx.light();
  if (t.kind === 'url') { window.open(t.url, '_blank', 'noopener'); toast(`Opened ${t.label} in a new tab.`); closeDrawer(true); return; }
  closeDrawer(true);
  if (t.kind === 'room') { location.hash = t.id; return; }
  openBook(t.e);
}
/** Takes one book out, wherever it is: from its shelf at home, or from its room if it isn't showing. */
function openBook(e) {
  if (body.classList.contains('in-room') && !$(`.shelf.here #l-${e.id}`)) goHome();
  const cover = document.getElementById(`l-${e.id}`);
  if (cover && cover.offsetParent === null) { location.hash = e.shelf; setTimeout(() => surprise.pick(e), 500); return; }
  setTimeout(() => surprise.pick(e), 120);
}
function remember(s) {
  s = s.trim();
  if (s.length < 3 || !results.length) return;
  store.set('recent', [s, ...store.get('recent', []).filter(x => x !== s)].slice(0, 6));
}
function renderFound() {
  const text = q.value.trim();
  if (!text) {
    found.hidden = true; found.replaceChildren(); results = [];
    if (body.classList.contains('seeking')) { renderDrawer(); drawer.hidden = false; }
    return;
  }
  drawer.hidden = true;
  body.classList.add('seeking');
  // A cheat code, typed exactly, opens what it was made for.
  const cheat = cheats.find(c => c.code.trim().toLowerCase() === text.toLowerCase());
  if (cheat) return showCheat(cheat);
  // "all" lays every shelf out, whole.
  const everything = /^all$/i.test(text);
  results = everything
    ? real.flatMap(sh => entries.filter(e => e.shelf === sh.id).map(e => ({ e, r: null })))
    : engine.search(q.value).map(r => ({ e: byId.get(r.id), r }));
  found.hidden = false;
  if (!results.length) {
    const dym = engine.didYouMean(text);
    found.replaceChildren(h('header.shelf-head', {}, h('h2', {}, `Nothing on these shelves for "${text}"`)),
      h('div.empty', {},
        h('pre', { 'aria-hidden': 'true' }, EMPTY_SHELF),
        dym ? h('p', {}, 'Did you mean ', h('button.btn.small', { type: 'button', onclick: () => setQuery(dym, true) }, dym), '?') : null,
        h('div.chips', {}, engine.nearbyTags(text, 8).map(tg => h('button.chip', { type: 'button', onclick: () => setQuery(tg, true) }, tg)))));
    return;
  }
  // Results are grouped by the shelf they live on, best shelf first, the way
  // a librarian would walk you to them.
  const groups = new Map();
  for (const x of results) { if (!groups.has(x.e.shelf)) groups.set(x.e.shelf, []); groups.get(x.e.shelf).push(x); }
  found.replaceChildren(
    h('header.shelf-head', {}, h('h2', {}, everything ? 'Every shelf' : `On the shelves for "${text}"`)),
    ...[...groups].map(([sid, xs]) => h('section.found-group', {},
      h('h3.found-shelf', {}, h('span', {}, shelfName(sid)), h('a.btn.small', { href: `#${sid}` }, 'Go to this shelf')),
      h('div.rows', {}, xs.map(({ e, r }) => coverEl(e, r ? matchedHint(r) : null))))));
  watchBooks(found);
}
function setQuery(v, commit) {
  q.value = v;
  renderFound();
  if (commit) remember(v);
  q.focus();
}
let t;
q.addEventListener('focus', () => {
  if (body.classList.contains('in-room')) { history.pushState(null, '', location.pathname + location.search); leaveRoom(); }
  openDrawer();
});
q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderFound, 60); });
q.addEventListener('blur', () => remember(q.value));
q.closest('form').addEventListener('submit', ev => {
  ev.preventDefault();
  renderFound(); remember(q.value);
  const first = found.querySelector('.cover');
  if (first) flip.open(byId.get(first.dataset.id), first);
});
// Clicking outside the search area with nothing typed puts the drawer away.
document.addEventListener('pointerdown', ev => {
  if (!body.classList.contains('seeking') || q.value.trim()) return;
  if (ev.target.closest('.almari-head, .back, dialog, .flip-stage, .toast, .foot, .minibar')) return;
  closeDrawer(false);
});

// ---------- spines view: pick a book up and move it along the shelf ----------
// The new order lasts until the page reloads; the shelf itself doesn't change.
let drag = null, justDragged = false;
document.addEventListener('pointerdown', ev => {
  const cover = ev.target.closest?.('.shelf[data-view="spines"] .rows > .cover');
  if (!cover || ev.button > 0 || flip.isOpen) return;
  drag = { cover, sx: ev.clientX, sy: ev.clientY, on: false, pid: ev.pointerId };
});
// Near the edge of the screen (or of a shelf that scrolls sideways), the
// shelf moves under the book you're carrying, so a long shelf can be walked.
function edgeScroll() {
  if (!drag?.on) return;
  const { px, py } = drag, edge = 70, row = drag.cover.parentElement;
  const vy = py < edge ? -(edge - py) / 4 : py > innerHeight - edge ? (py - innerHeight + edge) / 4 : 0;
  const rr = row.getBoundingClientRect();
  const vx = row.scrollWidth > row.clientWidth ? (px < rr.left + edge ? -(rr.left + edge - px) / 4 : px > rr.right - edge ? (px - rr.right + edge) / 4 : 0) : 0;
  if (vy) scrollBy(0, vy);
  if (vx) row.scrollLeft += vx;
  if (vx || vy) moveTo(px, py);
  drag.raf = requestAnimationFrame(edgeScroll);
}
function moveTo(x, y) {
  placeAt(x, y);
  const c = drag.cover; c.style.transform = 'none';
  const r = c.getBoundingClientRect();
  c.style.transform = `translate(${x - drag.gx - r.left}px, ${y - drag.gy - r.top}px) rotate(-3deg)`;
}
function dragStart(ev) {
  const r = drag.cover.getBoundingClientRect();
  drag.on = true; drag.gx = drag.sx - r.left; drag.gy = drag.sy - r.top; drag.px = ev.clientX; drag.py = ev.clientY;
  drag.cover.classList.add('dragging'); drag.cover.parentElement.classList.add('rearranging');
  try { drag.cover.setPointerCapture(drag.pid); } catch { /* fine */ }
  sfx.pull();
  drag.raf = requestAnimationFrame(edgeScroll);
}
function placeAt(x, y) {
  const c = drag.cover, row = c.parentElement;
  const others = [...row.querySelectorAll(':scope > .cover')].filter(o => o !== c);
  // The book under the pointer, by position, ignoring the one in hand.
  const over = others.find(o => { const r = o.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20; });
  if (!over) return;
  const r = over.getBoundingClientRect();
  const before = x < r.left + r.width / 2;
  if ((before && over.previousElementSibling === c) || (!before && over.nextElementSibling === c)) return;
  const all = [...row.querySelectorAll(':scope > .cover')];
  const first = new Map(all.map(o => [o, o.getBoundingClientRect()]));
  before ? over.before(c) : over.after(c);
  for (const o of all) {
    if (o === c) continue;
    const a = first.get(o), b = o.getBoundingClientRect();
    if (a.left !== b.left || a.top !== b.top) o.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: reduced() ? 0 : 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
}
document.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.pid) return;
  const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
  if (!drag.on) {
    if (Math.hypot(dx, dy) < 8) return;
    if (ev.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // a vertical swipe scrolls the page
    dragStart(ev);
  }
  ev.preventDefault();
  drag.px = ev.clientX; drag.py = ev.clientY;
  moveTo(ev.clientX, ev.clientY);   // keeps the book under the finger wherever it now sits
}, { passive: false });
function drop() {
  if (!drag) return;
  cancelAnimationFrame(drag.raf);
  if (drag.on) {
    const c = drag.cover;
    const from = c.style.transform; c.style.transform = '';
    c.classList.remove('dragging'); c.parentElement.classList.remove('rearranging');
    if (!reduced()) c.animate([{ transform: from }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.25,1)' });
    sfx.settleRow();
    justDragged = true; setTimeout(() => { justDragged = false; }, 0);
    if (!store.get('moved', false)) { store.set('moved', true); toast('Moved. The shelf goes back to its order when you reload.'); }
  }
  drag = null;
}
document.addEventListener('pointerup', drop);
document.addEventListener('pointercancel', drop);

// ---------- opening covers ----------
document.addEventListener('click', ev => {
  const cover = ev.target.closest('.cover');
  if (!cover || cover.closest('.flip-stage') || ev.target.closest('.cv-dead a')) return;
  ev.preventDefault(); ev.stopPropagation();
  if (justDragged) return;
  flip.open(byId.get(cover.dataset.id), cover);
});

// ---------- routing ----------
function route(smooth = true) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) { leaveRoom(); return; }
  if (id === 'now') { enterRoom('meri', smooth); return; }
  if (id === 'gems') { leaveRoom(); q.focus({ preventScroll: true }); openDrawer(); return; }
  if (real.some(s => s.id === id) || VIRTUAL[id]) enterRoom(id, smooth);
}
addEventListener('hashchange', () => route(true));
addEventListener('popstate', () => { if (!location.hash) { leaveRoom(); closeDrawer(false); } });
if (location.hash) route(false);


// ---------- lights: India time, day, night ----------
function setLights(mode) {
  try { localStorage.setItem('lm.theme', mode); } catch { /* storage blocked */ }
  if (window.__lmTheme) window.__lmTheme();
  if (mode !== 'ist' && document.documentElement.dataset.mode !== mode) document.documentElement.dataset.theme = mode;
  $$('.lights [data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  clock(); sfx.tap();
}
$$('.lights [data-mode]').forEach(b => b.addEventListener('click', () => setLights(b.dataset.mode)));
const savedMode = (() => { try { return localStorage.getItem('lm.theme') || 'ist'; } catch { return 'ist'; } })();
$$('.lights [data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === savedMode)));

function clock() {
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date()).toLowerCase();
  const night = document.documentElement.dataset.theme === 'night';
  const mode = document.documentElement.dataset.mode || 'ist';
  $('#clock').textContent = mode === 'ist'
    ? `It's ${time} in India, so the lights are ${night ? 'low' : 'up'}.`
    : `It's ${time} in India. Lights kept ${night ? 'low' : 'up'}.`;
  document.querySelector('meta[name="theme-color"]').content = night ? '#000000' : '#ffffff';
}
clock(); setInterval(clock, 30000);

// The money plant keeps count of how often it was watered today.
// (Three quick taps show what you borrowed lately: see eggs.js.)
const plant = $('#plant');
const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
plant.addEventListener('click', () => {
  const day = todayIST(), log = store.get('watered', {});
  const n = (log.day === day ? log.n : 0) + 1;
  store.set('watered', { day, n });
  plant.classList.remove('watering', 'sway'); void plant.offsetWidth; plant.classList.add('watering');
  setTimeout(() => { plant.classList.add('sway'); sfx.drop(); }, reduced() ? 0 : 420);
  toast(n === 1 ? 'Watered once, today.' : `Watered ${n} times, today.`);
});

// ---------- the plaque ----------
// Inside a shelf it is a brooch: one tap goes home. On the main hall it counts
// taps: two turn it over ("Nothing to see here :)"), three insist, four open
// the admin panel.
const plaque = $('#plaque');
let plTaps = 0, plTimer = 0, plBack = 0;
function turnPlaque(line, aside = '') {
  $('#pl-time').textContent = line; $('#pl-secret').textContent = aside;
  plaque.classList.add('flipped'); sfx.click();
  plaque.setAttribute('aria-label', `${line} ${aside}`.trim());
  clearTimeout(plBack);
  plBack = setTimeout(() => { plaque.classList.remove('flipped'); plaque.setAttribute('aria-label', plaque.querySelector('.pl-front').textContent); }, 4200);
}
plaque.addEventListener('click', () => {
  if (body.classList.contains('in-room')) { sfx.tap(); goHome(); return; }
  plTaps++; clearTimeout(plTimer);
  if (plTaps >= 4) { plTaps = 0; plaque.classList.remove('flipped'); openAdmin(); return; }
  plTimer = setTimeout(() => {
    const n = plTaps; plTaps = 0;
    if (n === 2) {
      if (plaque.classList.contains('flipped')) { clearTimeout(plBack); plaque.classList.remove('flipped'); sfx.click(); }
      else turnPlaque('Nothing to see here :)');
    } else if (n === 3) turnPlaque('I told you na.', 'nothing to see here');
  }, 420);
});
plaque.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  ev.preventDefault();
  if (body.classList.contains('in-room')) return goHome();
  if (plaque.classList.contains('flipped')) plaque.classList.remove('flipped'); else turnPlaque('Nothing to see here :)');
});

// ---------- the little light on the cabinet ----------
// At night it switches on and warms the room. In daylight it has nothing to
// add, and says so.
const light = $('#light');
const isNight = () => document.documentElement.dataset.theme === 'night';
function setLight(on) {
  body.classList.toggle('light-on', on);
  light.setAttribute('aria-pressed', String(on));
  light.setAttribute('aria-label', on ? 'Switch the little light off' : 'Switch the little light on');
}
light.addEventListener('click', () => {
  sfx.click();
  if (!isNight()) { setLight(false); return daylightNote(); }
  setLight(!body.classList.contains('light-on'));
});
new MutationObserver(() => { if (!isNight()) setLight(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
function daylightNote() {
  $('.daylight')?.remove();
  const note = h('div.daylight', { role: 'status', onclick: () => note.remove() },
    h('p', {}, 'Brightness is within', h('span', {}, '(and also all over your screen :)')));
  body.append(note);
  requestAnimationFrame(() => note.classList.add('on'));
  setTimeout(() => { note.classList.remove('on'); setTimeout(() => note.remove(), 600); }, 2800);
}

// ---------- why Linkmery exists (folded away in the footer) ----------
const whyBtn = $('#why-btn'), why = $('#why');
whyBtn.addEventListener('click', () => {
  const open = why.hidden;
  why.hidden = !open;
  whyBtn.setAttribute('aria-expanded', String(open));
  $('span', whyBtn).textContent = open ? 'Fold it away' : 'Why I made this';
  if (open) { why.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }); } else sfx.tap();
});

// ---------- sound ----------
const soundBtn = $('#sound');
const showSound = () => { const on = sfx.isOn(); $('span', soundBtn).textContent = on ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', String(on)); };
soundBtn.addEventListener('click', () => { sfx.set(!sfx.isOn()); showSound(); });
showSound();

// ---------- pull one out ----------
function surprise() {
  if (doors === 'closed') return openDoors({ then: surprise });
  // Wander: a random shelf first, then a random book on it.
  const shelf = real[Math.floor(Math.random() * real.length)];
  const onShelf = entries.filter(x => x.shelf === shelf.id);
  const e = onShelf[Math.floor(Math.random() * onShelf.length)] || entries[Math.floor(Math.random() * entries.length)];
  if (body.classList.contains('seeking')) closeDrawer(false);
  if (body.classList.contains('in-room') && !$(`.shelf.here #l-${e.id}`)) goHome();
  const cover = document.getElementById(`l-${e.id}`);
  // A book past the first five on its shelf isn't showing at home: open its shelf.
  if (cover && cover.offsetParent === null) { location.hash = e.shelf; setTimeout(() => surprise.pick(e), 500); return; }
  pickOut(e, cover);
}
function pickOut(e, cover) {
  if (!cover || reduced()) return flip.open(e, cover || undefined);
  cover.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => { cover.classList.add('pulled'); sfx.pull(); }, 450);
  setTimeout(() => { cover.classList.remove('pulled'); flip.open(e, cover); }, 1000);
}
surprise.pick = e => pickOut(e, $(`.shelf.here #l-${e.id}`) || document.getElementById(`l-${e.id}`));
$('#random').addEventListener('click', surprise);
$('#random-mini').addEventListener('click', surprise);

// ---------- the bar that follows you down the page ----------
const minibar = $('#minibar');
const watch = new IntersectionObserver(([e]) => {
  const on = !e.isIntersecting && !body.classList.contains('closed');
  minibar.classList.toggle('on', on);
  minibar.setAttribute('aria-hidden', String(!on));
  for (const b of $$('button', minibar)) b.tabIndex = on ? 0 : -1;
}, { rootMargin: '-40px 0px 0px 0px' });
watch.observe($('.search-row'));
// The aisle index in the bar: jump to a shelf; the one in view is lit.
const aisles = $('.aisles', minibar);
aisles.replaceChildren(...real.map(s => h('button', { type: 'button', 'data-to': s.id, tabIndex: -1, onclick: () => {
  sfx.tap();
  const go = () => document.getElementById(s.id).scrollIntoView({ behavior: reduced() ? 'instant' : 'smooth', block: 'start' });
  if (body.classList.contains('in-room') || body.classList.contains('seeking')) { goHome(); setTimeout(go, 60); } else go();
} }, s.name)));
const lit = new IntersectionObserver(items => items.forEach(it => {
  if (!it.isIntersecting) return;
  for (const b of $$('button', aisles)) {
    const on = b.dataset.to === it.target.id;
    b.classList.toggle('on', on);
    if (on) aisles.scrollTo({ left: b.offsetLeft - aisles.clientWidth / 2 + b.offsetWidth / 2, behavior: reduced() ? 'instant' : 'smooth' });
  }
}), { rootMargin: '-45% 0px -50% 0px' });
$$('.shelves .shelf:not(.virtual)').forEach(s => lit.observe(s));
const toTop = (focus) => { scrollTo({ top: 0, behavior: reduced() ? 'instant' : 'smooth' }); if (focus) setTimeout(() => q.focus({ preventScroll: true }), reduced() ? 0 : 380); };
$('.mini-search', minibar).addEventListener('click', () => toTop(true));
$('.mini-mark', minibar).addEventListener('click', () => toTop(false));

// ---------- keyboard ----------
document.addEventListener('keydown', ev => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (ev.key === '/' && !typing && !flip.isOpen) { ev.preventDefault(); openDoors({ then: () => { q.focus(); q.select(); } }); return; }
  if (ev.key !== 'Escape' || flip.isOpen) return;
  if (document.activeElement === q && q.value) { setQuery('', false); return; }
  if (body.classList.contains('seeking')) { closeDrawer(true); return; }
  if (body.classList.contains('in-room')) goHome();
});

// ---------- things to find ----------
// Remembered quietly, in case a later version wants to say something about it.
function markFound(id) {
  const list = store.get('found', []);
  if (!list.includes(id)) store.set('found', [...list, id]);
}
const randomOf = list => list[Math.floor(Math.random() * list.length)];
initEggs({ toast, reduced, sfx, found: markFound,
  skeletonKey: () => openDoors({ then: () => surprise() }),
  fiveMinuteRead: () => {
    const e = randomOf(entries.filter(x => x.type === 'article' || x.shelf === 'reading'));
    if (!e) return;
    openDoors({ then: () => { if (body.classList.contains('in-room') || body.classList.contains('seeking')) goHome(); setTimeout(() => surprise.pick(e), 200); } });
  },
  borrowedLately: () => { location.hash = 'borrowed'; },
  meri: () => openDoors({ then: () => { location.hash = 'meri'; } }),
  shareSite: () => copy(siteBase(), "Linkmery's address copied. Pass it on."),
});

// ---------- admin: three taps on the logo, then a passcode ----------
async function openAdmin() {
  sfx.tap();
  try {
    const { openAdmin: open } = await import('./ui/admin.js');
    await open({ data, toast, sfx });
  } catch (err) {
    document.querySelector('dialog.admin')?.close?.();
    toast('The admin panel could not open. Reload the page and try again.');
    console.error(err);
  }
}

// A hello for anyone who opens the developer console.
console.log(`%c${CONSOLE}`, 'font-family: monospace; line-height: 1.2');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
