// Things to find. Each wakes up on three quick taps (or clicks).
import { $, $$ } from './util.js';

/** Calls fn when el is tapped three times within a short window. */
export function onTriple(el, fn, gap = 450) {
  let n = 0, last = 0;
  el.addEventListener('click', ev => {
    const now = performance.now();
    n = now - last < gap ? n + 1 : 1;
    last = now;
    if (n === 3) { n = 0; fn(ev); }
  });
}

/** Restart a CSS animation class on an element. */
function play(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Six things to find. Each is a small delight that also does something
// useful, and the footer keeps count of how many you've found.
export function initEggs({ toast, reduced, sfx, found, skeletonKey, fiveMinuteRead, borrowedLately, meri, shareSite }) {
  // 1. The keyhole: three taps and a skeleton key turns. It opens a random book.
  const doors = $('#doors'), keyhole = $('#doors .keyhole');
  keyhole.addEventListener('click', ev => ev.stopPropagation());   // a single tap on it does not open
  onTriple(keyhole, () => {
    play(doors, 'rattle', 500); sfx.knock(); found('keyhole');
    toast('A skeleton key. It opens any book.');
    setTimeout(skeletonKey, reduced() ? 0 : 650);
  });

  // 2. The clock in the footer: a chai break, and a five-minute read to go with it.
  const clock = $('.clock');
  onTriple(clock, () => {
    play(clock, 'chai', 2400); sfx.tap(); found('chai');
    toast('Chai break. Here is a five-minute read.');
    setTimeout(fiveMinuteRead, 700);
  });

  // 3. The money plant: three quick taps show the books you borrowed lately.
  // (Every single tap waters it; the plant counts today's waterings.)
  onTriple($('#plant'), () => { found('plant'); toast('The plant remembers what you borrowed.'); setTimeout(borrowedLately, 500); });

  // 4. Where the name comes from: the books on the logo knock, and Linkmery's address is copied to pass on.
  const crest = $('#crest');
  onTriple($('.why .name'), () => {
    for (const el of [crest, $('.minibar')]) play(el, 'tumble', 1400);
    sfx.knock(); found('name');
    shareSite();
  });

  // 5. Type "meri" anywhere (outside a text box): the books that are most yours.
  let typed = '';
  document.addEventListener('keydown', ev => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key.length !== 1) return;
    typed = (typed + ev.key.toLowerCase()).slice(-4);
    if (typed === 'meri') { typed = ''; found('meri'); toast('Meri: mine.'); meri(); }
  });
}
