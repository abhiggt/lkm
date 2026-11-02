// The admin panel: three taps on the logo, then a passcode. No accounts.
// The passcode opens data/admin.json (the sealed GitHub token), and changes
// are published as one commit; the site redeploys a minute or two later.
import { h, $, $$ } from './util.js';
import { seal, unseal, strength } from '../core/vault.js';
import { createRepo } from '../core/github.js';

const TYPES = ['tool', 'article', 'video', 'inspiration', 'reference'];
const cap = s => s[0].toUpperCase() + s.slice(1);
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'shelf';
const clone = x => JSON.parse(JSON.stringify(x));
const domain = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const normUrl = u => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search).toLowerCase(); } catch { return u; } };
const cleanTag = t => t.trim().toLowerCase().replace(/[^a-z0-9 .+#-]/g, '').replace(/^[^a-z0-9]+/, '').replace(/\s+/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const FIELDS = ['id', 'url', 'title', 'description', 'why', 'type', 'maker', 'tags', 'shelf', 'added', 'pinned', 'readLater', 'image', 'favicon', 'archiveUrl', 'deadSince'];
const tidy = e => Object.fromEntries(FIELDS.filter(k => k in e && e[k] !== '' && e[k] != null).map(k => [k, e[k]]));

let dlg = null;

// What is being edited, and the last published copy to compare against.
let shelves = [], links = [], config = {}, saved = { shelves: '[]', links: '[]', config: '{}' };
const snapshot = () => ({ shelves: JSON.stringify(shelves), links: JSON.stringify(links), config: JSON.stringify(config) });
function dirty() { const now = snapshot(); return now.shelves !== saved.shelves || now.links !== saved.links || now.config !== saved.config; }
function changes() {
  const a = JSON.parse(saved.shelves), b = JSON.parse(saved.links), c = JSON.parse(saved.config);
  let n = 0;
  for (const k of new Set([...Object.keys(c), ...Object.keys(config)])) if (JSON.stringify(c[k]) !== JSON.stringify(config[k])) n++;
  const ids = new Set([...a.map(s => s.id), ...shelves.map(s => s.id)]);
  for (const id of ids) if (JSON.stringify(a.find(s => s.id === id)) !== JSON.stringify(shelves.find(s => s.id === id))) n++;
  const lids = new Set([...b.map(e => e.id), ...links.map(e => e.id)]);
  for (const id of lids) if (JSON.stringify(b.find(e => e.id === id)) !== JSON.stringify(links.find(e => e.id === id))) n++;
  return n;
}
function confirmClose() {
  if (dlg.querySelector('.ad-leave')) return;
  dlg.querySelector('.ad-head')?.append(h('div.ad-leave', {}, 'Leave without publishing? ',
    h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => dlg.close() }, 'Leave'),
    h('button.ad-ghost', { type: 'button', onclick: ev => ev.target.closest('.ad-leave').remove() }, 'Stay')));
}

export async function openAdmin({ toast, sfx }) {
  if (!dlg) {
    dlg = h('dialog.admin', { 'aria-label': 'Linkmery admin' });
    document.body.append(dlg);
    dlg.addEventListener('cancel', ev => { if (dirty()) { ev.preventDefault(); confirmClose(); } });
  }
  let box = null;
  try { const r = await fetch('data/admin.json', { cache: 'no-store' }); if (r.ok) box = await r.json(); } catch { /* not set up */ }
  dlg.replaceChildren(box ? lockScreen(box) : setupScreen());
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('input')?.focus();

  // ---------------- locked ----------------
  function shell(title, ...kids) {
    return h('div.ad-gate', {},
      h('button.ad-x', { type: 'button', 'aria-label': 'Close', onclick: () => dlg.close() }, 'Close'),
      h('div.ad-card', {}, h('h2', {}, title), ...kids));
  }

  function lockScreen(sealed) {
    const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Passcode', 'aria-label': 'Passcode' });
    const msg = h('p.ad-msg', { role: 'status' });
    let fails = 0;
    const form = h('form', { onsubmit: async ev => {
      ev.preventDefault();
      msg.textContent = 'Opening...';
      try {
        const secret = await unseal(sealed, pass.value);
        sfx.open();
        editor(secret, sealed);
      } catch {
        fails++;
        msg.textContent = fails > 3 ? "That passcode doesn't open it. Take a breath and try again in a moment." : "That passcode doesn't open it.";
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        pass.select();
        if (fails > 3) { pass.disabled = true; setTimeout(() => { pass.disabled = false; pass.focus(); }, 4000 * (fails - 3)); }
      }
    } }, pass, h('button.ad-primary', { type: 'submit' }, 'Unlock'), msg);
    return shell('Edit Linkmery', h('p', {}, 'Enter the passcode to edit shelves, books, tags and the words on the site.'), form);
  }

  function setupScreen() {
    const guess = (() => { const m = location.hostname.match(/^([\w-]+)\.github\.io$/); if (!m) return ''; const path = location.pathname.split('/').filter(Boolean)[0]; return `${m[1]}/${path || `${m[1]}.github.io`}`; })();
    const repo = h('input', { placeholder: 'owner/linkmery', value: guess, 'aria-label': 'Repository', autocomplete: 'off' });
    const branch = h('input', { value: 'main', 'aria-label': 'Branch' });
    const token = h('input', { type: 'password', placeholder: 'github_pat_...', autocomplete: 'off', 'aria-label': 'GitHub token' });
    const p1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'A long passcode', 'aria-label': 'Passcode' });
    const p2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Same passcode again', 'aria-label': 'Repeat the passcode' });
    const meter = h('p.ad-hint');
    p1.addEventListener('input', () => { meter.textContent = p1.value ? `Passcode strength: ${strength(p1.value)}` : ''; meter.dataset.s = strength(p1.value); });
    const msg = h('p.ad-msg', { role: 'status' });
    const form = h('form.ad-setup', { onsubmit: async ev => {
      ev.preventDefault();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo.value.trim())) return (msg.textContent = 'The repository looks like owner/name.');
      if (p1.value !== p2.value) return (msg.textContent = "The two passcodes don't match.");
      if (p1.value.length < 8) return (msg.textContent = 'Use at least 8 characters.');
      const secret = { token: token.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() || 'main' };
      msg.textContent = 'Checking the token...';
      try {
        const gh = createRepo(secret);
        await gh.check();
        msg.textContent = 'Sealing and publishing...';
        const sealed = await seal(secret, p1.value);
        await gh.commit({ 'data/admin.json': JSON.stringify(sealed, null, 2) + '\n' }, 'Set up the admin panel');
        sfx.open();
        toast('Admin is set up. Remember the passcode.');
        editor(secret, sealed);
      } catch (err) { msg.textContent = `Couldn't set up: ${err.message}.`; }
    } },
      h('label', {}, h('span', {}, 'GitHub repository'), repo),
      h('label', {}, h('span', {}, 'Branch'), branch),
      h('label', {}, h('span', {}, 'Fine-grained token (this repository only, Contents: read and write)'), token),
      h('label', {}, h('span', {}, 'Passcode'), p1), meter,
      h('label', {}, h('span', {}, 'Passcode again'), p2),
      h('button.ad-primary', { type: 'submit' }, 'Set up editing'), msg);
    return shell('Set up editing',
      h('p', {}, 'One time only. Your token is sealed with the passcode and published as data/admin.json. After this, the passcode alone opens the editor, on any device.'),
      h('p.ad-hint', {}, 'Anyone can download the sealed file and try to guess the passcode, so make it long: a short sentence works well.'),
      form);
  }

  // ---------------- unlocked ----------------

  async function editor(secret, sealed) {
    const gh = createRepo(secret);
    dlg.replaceChildren(shell('Loading the latest shelves...', h('p.ad-msg', {}, 'Reading from GitHub.')));
    try {
      const [bm, sh, cf] = await Promise.all([gh.readJson('data/bookmarks.json'), gh.readJson('data/shelves.json'), gh.readJson('linkmery.config.json').catch(() => ({}))]);
      links = bm.entries; shelves = sh.sort((a, b) => a.order - b.order); config = cf;
      saved = snapshot();
    } catch (err) {
      dlg.replaceChildren(shell("Couldn't load the shelves", h('p.ad-msg', {}, `${cap(err.message)}. Check the token in GitHub, then set up again by deleting data/admin.json.`)));
      return;
    }

    let tab = 'shelves';
    const count = h('span.ad-count');
    const publish = h('button.ad-primary', { type: 'button', onclick: doPublish }, 'Publish');
    const body = h('div.ad-body');
    const tabs = h('div.ad-tabs', { role: 'tablist' }, [['shelves', 'Shelves'], ['links', 'Books'], ['tags', 'Tags'], ['site', 'Site'], ['access', 'Passcode']].map(([id, label]) =>
      h('button', { type: 'button', role: 'tab', 'data-t': id, onclick: () => { tab = id; draw(); } }, label)));
    dlg.replaceChildren(h('div.ad', {},
      h('header.ad-head', {},
        h('div.ad-title', {}, h('strong', {}, 'Linkmery'), h('span', {}, 'admin')),
        tabs,
        h('div.ad-actions', {}, count, publish,
          h('button.ad-ghost', { type: 'button', onclick: () => (dirty() ? confirmClose() : dlg.close()) }, 'Close'))),
      body));

    function refresh() {
      const n = changes();
      count.textContent = n ? `${n} unpublished ${n === 1 ? 'change' : 'changes'}` : 'All published';
      publish.disabled = !n;
    }
    function draw() {
      $$('[data-t]', tabs).forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === tab)));
      body.replaceChildren(({ shelves: shelvesPane, links: linksPane, tags: tagsPane, site: sitePane, access: accessPane })[tab]());
      refresh();
    }

    // ---- shelves ----
    function shelvesPane() {
      const real = () => shelves.filter(s => !s.kind);
      const list = h('ol.ad-shelves');
      const countOf = id => links.filter(e => e.shelf === id).length;
      const move = (i, d) => { const r = real(); const j = i + d; if (j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; reorder(r); draw(); };
      const reorder = r => { const virt = shelves.filter(s => s.kind); shelves = [...virt, ...r]; shelves.forEach((s, i) => { s.order = i; }); };
      real().forEach((s, i, arr) => {
        const name = h('input.ad-name', { value: s.name, 'aria-label': 'Shelf name', oninput: ev => { s.name = ev.target.value; refresh(); } });
        const note = h('input.ad-note', { value: s.note || '', placeholder: 'A line about this shelf', 'aria-label': 'Shelf note', oninput: ev => { s.note = ev.target.value || undefined; if (!s.note) delete s.note; refresh(); } });
        const n = countOf(s.id);
        const del = h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => {
          if (!n) { shelves = shelves.filter(x => x !== s); reorder(real()); draw(); return; }
          const target = h('select', { 'aria-label': 'Move its links to' }, real().filter(x => x !== s).map(x => h('option', { value: x.id }, x.name)));
          row.append(h('div.ad-confirm', {}, `Move its ${n} links to `, target, ' and delete the shelf? ',
            h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => {
              links.forEach(e => { if (e.shelf === s.id) e.shelf = target.value; });
              shelves = shelves.filter(x => x !== s); reorder(real()); draw();
            } }, 'Delete'),
            h('button.ad-ghost', { type: 'button', onclick: () => draw() }, 'Keep it')));
          del.disabled = true;
        } }, 'Delete');
        const row = h('li.ad-shelf', {},
          h('div.ad-move', {},
            h('button.ad-icon', { type: 'button', 'aria-label': `Move ${s.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, 'Up'),
            h('button.ad-icon', { type: 'button', 'aria-label': `Move ${s.name} down`, disabled: i === arr.length - 1, onclick: () => move(i, 1) }, 'Down')),
          h('div.ad-fields', {}, name, note),
          h('span.ad-n', {}, `${n} ${n === 1 ? 'link' : 'links'}`, h('br'), h('code', {}, `#${s.id}`)),
          del);
        list.append(row);
      });
      const newName = h('input', { placeholder: 'New shelf name', 'aria-label': 'New shelf name' });
      const add = h('form.ad-add', { onsubmit: ev => {
        ev.preventDefault();
        const name = newName.value.trim(); if (!name) return;
        let id = slug(name); const taken = new Set(shelves.map(s => s.id));
        for (let k = 2; taken.has(id); k++) id = `${slug(name)}-${k}`;
        shelves.push({ id, name, order: shelves.length });
        draw();
      } }, newName, h('button.ad-ghost', { type: 'submit' }, 'Add shelf'));
      const special = h('ul.ad-special', {}, shelves.filter(s => s.kind).map(s => h('li.ad-shelf', {},
        h('div.ad-fields', {},
          h('input.ad-name', { value: s.name, 'aria-label': `Name for the ${s.kind} shelf`, oninput: ev => { s.name = ev.target.value; refresh(); } }),
          h('input.ad-note', { value: s.note || '', placeholder: 'A line about this shelf', 'aria-label': 'Shelf note', oninput: ev => { if (ev.target.value) s.note = ev.target.value; else delete s.note; refresh(); } })),
        h('span.ad-n', {}, ({ pinned: 'Pinned books', recent: 'Newest books', gems: 'Older, unopened' })[s.kind] || s.kind, h('br'), h('code', {}, `#${s.id}`)))));
      return h('section.ad-pane', {},
        h('p.ad-lede', {}, 'Rename, reorder and describe shelves. Renaming keeps each shelf\'s link (the #name) the same, so shared links keep working.'),
        list, add,
        h('h3.ad-sub', {}, 'Shelves that fill themselves'),
        h('p.ad-hint', {}, 'These gather books on their own. Their names and notes are yours to change.'),
        special);
    }

    // ---- links ----
    let filter = '', shelfFilter = '', openId = null;
    function linksPane() {
      const real = shelves.filter(s => !s.kind);
      const nameOf = id => real.find(s => s.id === id)?.name || id;
      const q = h('input.ad-search', { type: 'search', placeholder: `Find among ${links.length} links`, value: filter, 'aria-label': 'Find a link' });
      const sf = h('select', { 'aria-label': 'Shelf' }, h('option', { value: '' }, 'All shelves'), real.map(s => h('option', { value: s.id, selected: s.id === shelfFilter }, s.name)));
      const list = h('ul.ad-links');
      const render = () => {
        const t = filter.toLowerCase();
        const shown = links.filter(e => (!shelfFilter || e.shelf === shelfFilter) && (!t || `${e.title} ${e.url} ${e.description} ${(e.tags || []).join(' ')}`.toLowerCase().includes(t)));
        list.replaceChildren(...shown.slice(0, 200).map(e => {
          const li = h(e.id === openId ? 'li.ad-link.open' : 'li.ad-link', {},
            h('button.ad-row', { type: 'button', 'aria-expanded': String(e.id === openId), onclick: () => { openId = openId === e.id ? null : e.id; render(); } },
              h('span.ad-lt', {}, e.title), h('span.ad-ls', {}, `${nameOf(e.shelf)}, ${domain(e.url)}`)));
          if (e.id === openId) li.append(linkForm(e, real));
          return li;
        }));
        if (!shown.length) list.append(h('li.ad-empty', {}, 'No links match.'));
      };
      q.addEventListener('input', () => { filter = q.value; render(); });
      sf.addEventListener('change', () => { shelfFilter = sf.value; render(); });
      render();
      return h('section.ad-pane', {}, addBook(real), h('div.ad-filter', {}, q, sf), list);
    }
    let notice = '';
    function addBook(real) {
      const url = h('input', { type: 'url', placeholder: 'https://', 'aria-label': 'New book URL', required: true });
      const title = h('input', { placeholder: 'Title (optional)', 'aria-label': 'New book title' });
      const shelf = h('select', { 'aria-label': 'Shelf for the new book' }, real.map(s => h('option', { value: s.id, selected: s.id === shelfFilter }, s.name)));
      const msg = h('p.ad-msg', { role: 'status' }, notice); notice = '';
      return h('form.ad-newbook', { onsubmit: ev => {
        ev.preventDefault();
        let u = url.value.trim();
        if (!/^https?:\/\//.test(u)) u = 'https://' + u;
        try { new URL(u); } catch { msg.textContent = "That URL doesn't look right."; return; }
        const dupe = links.find(x => normUrl(x.url) === normUrl(u));
        if (dupe) { notice = `Already on the shelves as "${dupe.title}".`; openId = dupe.id; filter = ''; shelfFilter = ''; draw(); return; }
        const ids = new Set(links.map(x => x.id)); let id;
        do { id = Math.random().toString(36).slice(2, 8); } while (ids.has(id) || !/^[a-z0-9]{6}$/.test(id));
        const e = { id, url: u, title: title.value.trim() || domain(u), description: '', type: 'tool', tags: [], shelf: shelf.value, added: today(), pinned: false, readLater: false };
        links.unshift(e); openId = id; filter = ''; shelfFilter = '';
        draw();
        body.querySelector('.ad-link.open textarea')?.focus();
      } },
        h('strong', {}, 'Shelve a new book'), url, title, shelf, h('button.ad-ghost', { type: 'submit' }, 'Add'), msg);
    }
    function linkForm(e, real) {
      const field = (label, input) => h('label', {}, h('span', {}, label), input);
      const text = (k, attrs = {}) => h('input', { value: e[k] || '', ...attrs, oninput: ev => { const v = ev.target.value; if (v) e[k] = v; else delete e[k]; refresh(); } });
      const del = h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => {
        del.replaceWith(h('span.ad-confirm', {}, 'Delete this link? ',
          h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => { links = links.filter(x => x !== e); openId = null; draw(); } }, 'Delete'),
          h('button.ad-ghost', { type: 'button', onclick: () => draw() }, 'Keep it')));
      } }, 'Delete link');
      const dateIn = (k, label, opt) => field(label, h('input', { type: 'date', value: e[k] || '', required: !opt, onchange: ev => { const v = ev.target.value; if (v) e[k] = v; else if (opt) delete e[k]; refresh(); } }));
      return h('div.ad-form', {},
        h('p.ad-catno', {}, `Shelved ${e.added}`, h('code', {}, e.id)),
        field('Title', text('title')),
        field('URL', text('url', { type: 'url' })),
        field('Description', h('textarea', { rows: 3, oninput: ev => { e.description = ev.target.value; refresh(); } }, e.description || '')),
        field('Use it for', text('why')),
        h('div.ad-2', {},
          field('Shelf', h('select', { onchange: ev => { e.shelf = ev.target.value; refresh(); } }, real.map(s => h('option', { value: s.id, selected: s.id === e.shelf }, s.name)))),
          field('Type', h('select', { onchange: ev => { e.type = ev.target.value; refresh(); } }, TYPES.map(t => h('option', { value: t, selected: t === e.type }, cap(t)))))),
        field('Tags', h('input', { value: (e.tags || []).join(', '), oninput: ev => { e.tags = [...new Set(ev.target.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))]; refresh(); } })),
        h('div.ad-2', {}, dateIn('added', 'Shelved on'), dateIn('deadSince', 'Moved out on (leave empty if alive)', true)),
        field('Archived copy URL', text('archiveUrl', { type: 'url', placeholder: 'https://web.archive.org/...' })),
        h('div.ad-checks', {},
          h('label', {}, h('input', { type: 'checkbox', checked: !!e.pinned, onchange: ev => { e.pinned = ev.target.checked; refresh(); } }), ' Pinned'),
          h('label', {}, h('input', { type: 'checkbox', checked: !!e.readLater, onchange: ev => { e.readLater = ev.target.checked; refresh(); } }), ' Read later'),
          del));
    }

    // ---- tags ----
    function tagsPane() {
      const counts = new Map();
      links.forEach(e => (e.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
      const all = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const q = h('input.ad-search', { type: 'search', placeholder: `Find among ${all.length} tags`, 'aria-label': 'Find a tag' });
      const list = h('ul.ad-tags');
      const retag = (from, to) => {
        links.forEach(e => {
          if (!e.tags?.includes(from)) return;
          e.tags = [...new Set(e.tags.map(t => t === from ? to : t).filter(Boolean))];
        });
        draw();
      };
      const render = () => list.replaceChildren(...all.filter(([t]) => t.includes(q.value.trim().toLowerCase())).map(([t, n]) => {
        const input = h('input', { value: t, 'aria-label': `Rename the tag ${t}` });
        const apply = () => { const v = cleanTag(input.value); if (v && v !== t) retag(t, v); };
        input.addEventListener('keydown', ev => { if (ev.key === 'Enter') apply(); });
        return h('li.ad-tag', {}, input, h('span.ad-n', {}, `${n} ${n === 1 ? 'book' : 'books'}`),
          h('button.ad-ghost', { type: 'button', onclick: apply }, counts.has(cleanTag(input.value)) && cleanTag(input.value) !== t ? 'Merge' : 'Rename'),
          h('button.ad-ghost.ad-danger', { type: 'button', onclick: () => retag(t, '') }, 'Remove'));
      }));
      q.addEventListener('input', render);
      render();
      return h('section.ad-pane', {},
        h('p.ad-lede', {}, 'Rename a tag on every book at once. Rename it to a tag that already exists and the two merge. Remove takes it off every book.'),
        q, list);
    }

    // ---- site ----
    function sitePane() {
      const field = (label, input, hint) => h('label', {}, h('span', {}, label), input, hint ? h('small.ad-hint', {}, hint) : null);
      const set = (k, v) => { if (v === '' || (Array.isArray(v) && !v.length)) delete config[k]; else config[k] = v; refresh(); };
      const line = (k, attrs = {}) => h('input', { value: config[k] || '', ...attrs, oninput: ev => set(k, ev.target.value) });
      const area = (k, rows, split, join) => h('textarea', { rows, oninput: ev => set(k, split(ev.target.value)) }, join(config[k] || []));
      return h('section.ad-pane', {},
        h('p.ad-lede', {}, 'The words around the shelves. They are written into the page when the site rebuilds.'),
        h('div.ad-form.ad-site', {},
          field('Kept and made by', line('ownerName'), 'Signs the footer and the brass plaque on the cabinet.'),
          field('The line under the logo', line('dedication', { placeholder: 'Links I keep coming back to, each one kept for a reason.' }), 'One sentence on what this library is.'),
          field('Why Linkmery exists', area('why', 5, v => v.split('\n').map(p => p.trim()).filter(Boolean), a => a.join('\n')), 'One line per line; four or five read best. {count} becomes the number of books. It sits folded away in the footer.'),
          field('Where the name comes from', h('textarea', { rows: 2, oninput: ev => set('nameOrigin', ev.target.value.trim()) }, config.nameOrigin || '')),
          field('Page title (for search engines)', line('title')),
          field('Description (for search engines and link previews)', h('textarea', { rows: 3, oninput: ev => set('description', ev.target.value.trim()) }, config.description || '')),
          h('div.ad-2', {},
            field('Forgotten after (days)', line('gemsOlderThanDays', { type: 'number', min: 7, oninput: ev => set('gemsOlderThanDays', Number(ev.target.value) || undefined) })),
            field('Site address', line('siteUrl', { type: 'url' })))));
    }

    // ---- passcode ----
    function accessPane() {
      const p1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New passcode', 'aria-label': 'New passcode' });
      const p2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Same again', 'aria-label': 'Repeat the new passcode' });
      const msg = h('p.ad-msg', { role: 'status' });
      return h('section.ad-pane', {},
        h('p.ad-lede', {}, 'Change the passcode. The token stays the same; it is sealed again with the new passcode and published.'),
        h('form.ad-setup', { onsubmit: async ev => {
          ev.preventDefault();
          if (p1.value !== p2.value) return (msg.textContent = "The two passcodes don't match.");
          if (p1.value.length < 8) return (msg.textContent = 'Use at least 8 characters.');
          msg.textContent = 'Sealing and publishing...';
          try {
            sealed = await seal(secret, p1.value);
            await gh.commit({ 'data/admin.json': JSON.stringify(sealed, null, 2) + '\n' }, 'Change the admin passcode');
            msg.textContent = 'Changed. Use the new passcode from now on.';
            p1.value = p2.value = '';
          } catch (err) { msg.textContent = `Couldn't change it: ${err.message}.`; }
        } }, h('label', {}, h('span', {}, 'New passcode'), p1), h('label', {}, h('span', {}, 'Again'), p2), h('button.ad-primary', { type: 'submit' }, 'Change passcode'), msg),
        h('p.ad-hint', {}, 'To revoke access entirely, delete the token on GitHub. The sealed file then opens to nothing.'));
    }

    async function doPublish() {
      const problems = [];
      const real = shelves.filter(s => !s.kind);
      if (real.some(s => !s.name.trim())) problems.push('a shelf has no name');
      if (links.some(e => !e.title?.trim() || !e.description?.trim())) problems.push('a link is missing its title or description');
      if (links.some(e => !real.some(s => s.id === e.shelf))) problems.push('a link points at a shelf that no longer exists');
      const bad = links.find(e => { try { new URL(e.url); return !/^https?:/.test(e.url); } catch { return true; } });
      if (bad) problems.push(`"${bad.title}" has a URL that doesn't work`);
      const seen = new Map(); for (const e of links) { const k = normUrl(e.url); if (seen.has(k)) problems.push(`"${e.title}" and "${seen.get(k)}" are the same link`); seen.set(k, e.title); }
      if (links.some(e => !isDate(e.added) || (e.deadSince && !isDate(e.deadSince)))) problems.push('a book has a date that isn\'t a real date');
      if (!String(config.siteUrl || 'https://x').match(/^https?:\/\//)) problems.push('the site address should start with https://');
      if (problems.length) { toast(`Can't publish yet: ${problems[0]}.`); return; }
      publish.disabled = true; publish.textContent = 'Publishing...';
      try {
        const files = {};
        if (JSON.stringify(shelves) !== saved.shelves) files['data/shelves.json'] = JSON.stringify(shelves.map(s => { const c = clone(s); c.name = c.name.trim(); return c; }), null, 2) + '\n';
        if (JSON.stringify(links) !== saved.links) files['data/bookmarks.json'] = JSON.stringify({ schemaVersion: 1, entries: links.map(tidy) }, null, 2) + '\n';
        if (JSON.stringify(config) !== saved.config) files['linkmery.config.json'] = JSON.stringify(config, null, 2) + '\n';
        await gh.commit(files, `Edit ${changes()} ${changes() === 1 ? 'thing' : 'things'} from the admin panel`);
        saved = snapshot();
        sfx.open();
        toast('Published. The site updates in a minute or two.');
      } catch (err) { toast(`Couldn't publish: ${err.message}.`); }
      publish.textContent = 'Publish';
      refresh();
    }
    draw();
  }
}
