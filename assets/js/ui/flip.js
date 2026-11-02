// A book, taken off the shelf. Tap a cover and it lifts out, turns over in
// the air and opens into its catalogue card in the middle of the screen:
// the librarian's note, the details, what it pairs well with, "Go to the site".
// The arrows (or a swipe, or the arrow keys) leaf through the rest of the
// shelf without putting the book back. Closing turns it back into its gap.
import { h, human, domain, TYPE_LABEL } from './util.js';

const BASE_W = 126, BASE_H = 186;           // a book's size on a desktop shelf
const DUR = 900;        // out of the shelf, then over
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = d => { const t = document.createElement('template'); t.innerHTML = `<svg class="i" viewBox="0 0 20 20" aria-hidden="true">${d}</svg>`; return t.content.firstChild; };

// Which side faces us: read from the live transform while the book turns,
// so the right face shows even where a browser flattens the 3D book.
function trackSide(book, anim) {
  const tick = () => {
    if (!book.isConnected) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(book).transform);
    book.dataset.side = m.m11 * m.m33 >= 0 && m.m11 >= 0 ? 'front' : 'back';
    if (anim.playState === 'running' || anim.playState === 'pending') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function createFlip({ shelfName, share, copy, front, sfx, entry: getEntry = () => null, onShow = () => {}, siteBase = () => location.href.split('#')[0] }) {
  let stage = null, book = null, from = null, entry = null, returnFocus = null, busy = false, opening = null, list = [];

  // Where the book should sit: centred, as large as the screen allows,
  // keeping the shape of the book it came from.
  function target(ratio) {
    let w = Math.min(420, innerWidth * 0.92), hgt = w / ratio;
    const maxH = innerHeight * 0.9;
    if (hgt > maxH) { hgt = maxH; w = hgt * ratio; }
    return { w, h: hgt, x: (innerWidth - w) / 2, y: (innerHeight - hgt) / 2 };
  }
  // The transform that puts the open book back over a rectangle on the shelf.
  function onShelf(r, t, turn, f = 1, z = 0, grow = 0) {
    const dx = r.left + r.width / 2 - (t.x + t.w / 2), dy = r.top + r.height / 2 - (t.y + t.h / 2);
    const s = r.height / t.h;
    return `translate3d(${dx * f}px, ${dy * f - (f < 1 ? 24 : 0)}px, ${z}px) scale(${s + (1 - s) * grow}) rotateY(${turn}deg)`;
  }
  const visibleRect = el => {
    if (!el?.isConnected) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height && r.bottom > 0 && r.top < innerHeight ? r : null;
  };

  function card(e) {
    const rows = [
      // The type leads to a shelf that isn't on the bookcase: every book of that kind.
      ['Type', h('a.type-link', { href: `#type-${e.type}`, onclick: () => close() }, TYPE_LABEL[e.type])],
      ['Site', h('span.site-row', {}, h('span.mono', {}, domain(e.url)),
        h('button.copy', { type: 'button', 'aria-label': 'Copy the link', title: 'Copy the link', onclick: ev => { copy?.(e.url, 'Link copied'); ev.currentTarget.classList.add('done'); } },
          icon('<rect x="7" y="7" width="9" height="10" rx="2"/><path d="M13 4.5H6a2 2 0 0 0-2 2V14"/>'), icon('<path class="tick" d="M5 10.5l3 3 7-7"/>')))],
      e.deadSince && ['Moved out', h('time', { datetime: e.deadSince }, human(e.deadSince))],
    ].filter(Boolean);
    const art = e.fav ? h('span.cv-art', {}, h('img', { src: e.fav, alt: '', width: 32, height: 32 }))
      : h('span.cv-art.mono', { 'aria-hidden': 'true' }, (e.title.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase());
    return h('div.card-wrap', {}, h('div.card-in', {},
      h('div.card-top', {},
        art,
        h('div.card-where', {},
          h('span.card-shelf', {}, shelfName(e.shelf))),
        list.length > 1 ? h('div.card-nav', {},
          h('button.btn.icon.prev', { type: 'button', 'aria-label': 'Previous book on this shelf', onclick: () => leaf(-1) }, icon('<path d="M12 4l-6 6 6 6"/>')),
          h('button.btn.icon.next', { type: 'button', 'aria-label': 'Next book on this shelf', onclick: () => leaf(1) }, icon('<path d="M8 4l6 6-6 6"/>'))) : null,
        h('button.btn.icon.card-close', { type: 'button', 'aria-label': 'Put it back', onclick: () => close() },
          icon('<path d="M5 5l10 10M15 5L5 15"/>'))),
      h('h2.card-title', { id: 'flip-title' }, e.title),
      e.deadSince && h('p.card-dead', {}, 'This page has moved out.', e.archiveUrl ? [' ', h('a', { href: e.archiveUrl, target: '_blank', rel: 'noopener' }, 'The archived copy'), ' still opens.'] : null),
      h('p.card-desc', {}, e.description),
      e.why && h('div.card-why', {}, h('span', {}, "Librarian's note"), h('p', {}, `For ${e.why}`)),
      h('dl.card', {}, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),

      h('div.card-acts', {},
        h('a.btn.primary.go', { href: e.url, target: '_blank', rel: 'noopener' }, 'Go to the site',
          icon('<path d="M7 13L14 6M8 6h6v6"/>')),
        share && h('button.btn', { type: 'button', onclick: () => share(e.title, e.url, e.description) }, 'Send to someone'))));
  }

  function open(e, cover, { quiet = false } = {}) {
    if (busy) return;
    if (stage) teardown();
    entry = e; from = cover || null; returnFocus = cover || document.activeElement;
    list = cover?.closest('.rows') ? [...cover.closest('.rows').querySelectorAll(':scope > .cover')] : [];
    const r = visibleRect(from);
    const view = from?.closest('.shelf')?.dataset.view || 'shelf';
    // A book on the shelf keeps its own shape; from a spine or a list row, the card is book-shaped.
    const ratio = r && view === 'shelf' && !from.closest('.found, .top-shelf') ? r.width / r.height : BASE_W / BASE_H;
    const t = target(ratio);
    const bw = ratio * BASE_H, k = t.h / BASE_H;

    const face = front(e);
    face.classList.add('flip-cover');
    face.style.width = `${bw}px`; face.style.height = `${BASE_H}px`; face.style.transform = `scale(${k})`;

    book = h('div.flip', { 'data-side': 'front', style: { left: `${t.x}px`, top: `${t.y}px`, width: `${t.w}px`, height: `${t.h}px` } },
      h('div.face.face-front', { 'aria-hidden': 'true' }, face),
      h('div.face.face-back', {}, card(e)));
    onShow(e);
    if (e.colour) { book.style.setProperty('--bk', e.colour.bg); book.style.setProperty('--bk-ink', e.colour.ink); }
    stage = h('div.flip-stage', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'flip-title',
      onclick: ev => { if (ev.target === stage) close(); } }, book);
    document.body.append(stage);
    // A sideways swipe on the card leafs through the shelf.
    let sx = null;
    book.addEventListener('pointerdown', ev => { sx = ev.clientX; });
    book.addEventListener('pointerup', ev => { if (sx != null && Math.abs(ev.clientX - sx) > 60) leaf(ev.clientX < sx ? 1 : -1); sx = null; });
    document.body.classList.add('flipping');
    from?.classList.add('out');
    if (!quiet) sfx?.flip();

    const mine = stage;
    const done = () => { if (stage !== mine || mine.dataset.closing) return; busy = false; book.classList.add('settled'); stage.querySelector('.go')?.focus({ preventScroll: true }); };
    if (reduced() || !r) {
      book.style.transform = 'rotateY(180deg)'; book.dataset.side = 'back';
      done(); return;
    }
    busy = true;
    // First it slides up off the shelf towards you, barely turning; then it
    // turns over as it settles in the middle of the screen.
    const end = 'translate3d(0px, 0px, 0px) scale(1) rotateY(180deg)';
    book.style.transform = end;
    const anim = opening = book.animate([
      { transform: onShelf(r, t, 0), easing: 'cubic-bezier(.3,.6,.35,1)' },
      { transform: onShelf(r, t, -12, 0.45, 140, 0.45), offset: 0.38, easing: 'cubic-bezier(.45,0,.25,1)' },
      { transform: end },
    ], { duration: DUR });
    trackSide(book, anim);
    anim.finished.then(() => { book.dataset.side = 'back'; done(); }, done);
  }

  // Leaf to the next or previous book on the same shelf, card still open.
  function leaf(d) {
    if (!stage || busy || list.length < 2) return;
    const i = list.indexOf(from), next = list[(i + d + list.length) % list.length];
    const e = getEntry(next?.dataset.id);
    if (e) show(e, next, d);
  }
  // Swap the open card to another book (a neighbour, or one it pairs with).
  function show(e, next, d = 1) {
    if (!stage || busy || !e) return;
    from?.classList.remove('out');
    entry = e;
    if (next) {
      from = returnFocus = next;
      if (!list.includes(next)) list = next.closest('.rows') ? [...next.closest('.rows').querySelectorAll(':scope > .cover')] : [next];
      if (next.offsetParent) next.classList.add('out');
    }
    onShow(e);
    if (e.colour) { book.style.setProperty('--bk', e.colour.bg); book.style.setProperty('--bk-ink', e.colour.ink); }
    else { book.style.removeProperty('--bk'); book.style.removeProperty('--bk-ink'); }
    const oldFace = book.querySelector('.flip-cover'), face = front(e);
    face.classList.add('flip-cover'); face.style.cssText = oldFace.style.cssText; oldFace.replaceWith(face);
    const back = book.querySelector('.face-back'), old = back.firstChild, fresh = card(e);
    sfx?.pull();
    const swap = () => { back.replaceChildren(fresh); fresh.querySelector(".card-in").scrollTop = 0; fresh.querySelector(d > 0 ? '.next' : '.prev')?.focus({ preventScroll: true }); };
    if (reduced()) return swap();
    old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-18 * d}px)` }], { duration: 140, easing: 'ease-in' }).finished.then(() => {
      swap();
      fresh.animate([{ opacity: 0, transform: `translateX(${18 * d}px)` }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
  }

  function teardown() {
    stage?.remove(); stage = book = null; busy = false;
    document.body.classList.remove('flipping');
    from?.classList.remove('out');
  }

  function close() {
    if (!stage) return;
    // Closing while it is still coming out: land it first, then put it back.
    if (busy && opening?.playState === 'running') { opening.finish(); busy = false; book.dataset.side = 'back'; }
    if (busy) return;
    stage.dataset.closing = '1';
    const el = from, bk = book, st = stage;
    const r = visibleRect(el);
    sfx?.unflip();
    const finish = () => {
      teardown();
      const back = returnFocus?.querySelector?.('.cv-t a') || returnFocus;
      back?.focus?.({ preventScroll: true });
    };
    if (reduced() || !r) {
      st.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished.then(finish, finish);
      return;
    }
    busy = true;
    bk.classList.remove('settled');
    const t = { x: parseFloat(bk.style.left), y: parseFloat(bk.style.top), w: parseFloat(bk.style.width), h: parseFloat(bk.style.height) };
    const anim = bk.animate([
      { transform: 'translate3d(0px, 0px, 0px) scale(1) rotateY(180deg)', easing: 'cubic-bezier(.5,0,.6,1)' },
      { transform: onShelf(r, t, -12, 0.45, 140, 0.45), offset: 0.55, easing: 'cubic-bezier(.3,.6,.3,1)' },
      { transform: onShelf(r, t, 0) },
    ], { duration: DUR * 0.85, fill: 'forwards' });
    trackSide(bk, anim);
    anim.finished.then(finish, finish);
  }

  // Escape puts the book back; Tab stays inside the card.
  document.addEventListener('keydown', ev => {
    if (!stage) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); leaf(ev.key === 'ArrowRight' ? 1 : -1); return; }
    if (ev.key !== 'Tab') return;
    const f = [...stage.querySelectorAll('a[href], button:not([disabled])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }, true);
  addEventListener('resize', () => { if (stage && !busy) { const t = target(parseFloat(book.style.width) / parseFloat(book.style.height)); Object.assign(book.style, { left: `${t.x}px`, top: `${t.y}px`, width: `${t.w}px`, height: `${t.h}px` }); const fc = book.querySelector('.flip-cover'); fc.style.transform = `scale(${t.h / BASE_H})`; } });

  return { open, close, get isOpen() { return !!stage; }, get entry() { return entry; } };
}
