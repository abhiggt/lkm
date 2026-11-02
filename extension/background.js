// Linkmery extension background: data cache, saving, GitHub commits,
// the right-click menu, the omnibox and the keyboard shortcut.
import { createSearch } from './core/search.js';
import { normalizeUrl, cleanUrl } from './core/url.js';

const api = globalThis.browser ?? globalThis.chrome;
const HOUR = 36e5;

const get = keys => api.storage.local.get(keys);
const set = obj => api.storage.local.set(obj);

async function settings() {
  const { settings: s = {} } = await get('settings');
  return { siteUrl: 'https://abhiggt.github.io/lkm/', repo: 'abhiggt/lkm', branch: 'main', token: '', ...s };
}

// ---------- published data + local pending entries ----------
async function loadData(force = false) {
  const { cache } = await get('cache');
  const s = await settings();
  if (!force && cache && Date.now() - cache.fetchedAt < HOUR) return cache;
  if (!s.siteUrl) return cache || { entries: [], shelves: [], synonyms: [], fetchedAt: 0 };
  const base = s.siteUrl.replace(/\/?$/, '/');
  try {
    const [bm, shelves, synonyms] = await Promise.all(
      ['data/bookmarks.json', 'data/shelves.json', 'data/synonyms.json'].map(p => fetch(base + p, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
    const fresh = { entries: bm.entries, shelves, synonyms, fetchedAt: Date.now() };
    await set({ cache: fresh });
    return fresh;
  } catch {
    return cache || { entries: [], shelves: [], synonyms: [], fetchedAt: 0, error: 'Couldn’t reach your library. Check its address in settings.' };
  }
}

async function allData() {
  const data = await loadData();
  const { pending = [] } = await get('pending');
  const seen = new Set(data.entries.map(e => normalizeUrl(e.url)));
  return { ...data, pending, entries: [...data.entries, ...pending.filter(p => !seen.has(normalizeUrl(p.url)))] };
}

// ---------- saving ----------
const b36 = n => n.toString(36);
const newId = () => b36(Date.now()).slice(-4) + b36(Math.floor(Math.random() * 1296)).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);

function toEntry(f) {
  const e = {
    id: newId(), url: cleanUrl(f.url), title: f.title.trim(), description: f.description.trim(),
    why: f.why?.trim(), type: f.type, maker: f.maker?.trim(),
    tags: [...new Set(String(f.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean))],
    shelf: f.shelf, added: today(), pinned: !!f.pinned, readLater: !!f.readLater,
    archiveUrl: `https://web.archive.org/web/${cleanUrl(f.url)}`,
  };
  for (const k of Object.keys(e)) if (e[k] === '' || e[k] == null) delete e[k];
  return e;
}

const enc = s => { const b = new TextEncoder().encode(s); let bin = ''; for (const x of b) bin += String.fromCharCode(x); return btoa(bin); };
const dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));

/** Appends entries to data/bookmarks.json in the repo with one commit. */
async function commit(entries) {
  const s = await settings();
  if (!s.repo || !s.token) return { ok: false, reason: 'no-token' };
  const url = `https://api.github.com/repos/${s.repo}/contents/data/bookmarks.json`;
  const headers = { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await fetch(`${url}?ref=${encodeURIComponent(s.branch)}`, { headers, cache: 'no-store' });
    if (!cur.ok) return { ok: false, reason: `GitHub said ${cur.status} when reading the file` };
    const file = await cur.json();
    const db = JSON.parse(dec(file.content));
    const have = new Set(db.entries.map(e => normalizeUrl(e.url)));
    const ids = new Set(db.entries.map(e => e.id));
    const add = entries.filter(e => !have.has(normalizeUrl(e.url))).map(e => ((ids.has(e.id) ? { ...e, id: newId() } : e)));
    if (!add.length) return { ok: true, committed: 0 };
    db.entries.push(...add);
    const res = await fetch(url, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Add ${add.length === 1 ? `"${add[0].title}"` : `${add.length} links`} from the extension`, content: enc(JSON.stringify(db, null, 2) + '\n'), sha: file.sha, branch: s.branch }),
    });
    if (res.ok) return { ok: true, committed: add.length };
    if (res.status !== 409) return { ok: false, reason: `GitHub said ${res.status} when saving` };
  }
  return { ok: false, reason: 'the library changed while adding. Try again.' };
}

/** Renames shelves in data/shelves.json with one commit. names: { id: 'New name' } */
async function renameShelves(names) {
  const s = await settings();
  if (!s.repo || !s.token) return { ok: false, reason: 'no-token' };
  const url = `https://api.github.com/repos/${s.repo}/contents/data/shelves.json`;
  const headers = { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await fetch(`${url}?ref=${encodeURIComponent(s.branch)}`, { headers, cache: 'no-store' });
    if (!cur.ok) return { ok: false, reason: `GitHub said ${cur.status} when reading the shelves` };
    const file = await cur.json();
    const shelves = JSON.parse(dec(file.content));
    const changed = [];
    for (const sh of shelves) {
      const next = String(names[sh.id] ?? '').trim().slice(0, 40);
      if (next && next !== sh.name) { changed.push(`${sh.name} → ${next}`); sh.name = next; }
    }
    if (!changed.length) return { ok: true, renamed: 0 };
    const res = await fetch(url, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: changed.length === 1 ? `Rename shelf: ${changed[0]}` : `Rename ${changed.length} shelves`, content: enc(JSON.stringify(shelves, null, 2) + '\n'), sha: file.sha, branch: s.branch }),
    });
    if (res.ok) {
      const { cache } = await get('cache');
      if (cache) { cache.shelves = shelves; await set({ cache }); }
      return { ok: true, renamed: changed.length };
    }
    if (res.status !== 409) return { ok: false, reason: `GitHub said ${res.status} when saving` };
  }
  return { ok: false, reason: 'the shelves changed while renaming. Try again.' };
}

async function save(form) {
  const entry = toEntry(form);
  const { pending = [] } = await get('pending');
  pending.push(entry);
  await set({ pending });
  fetch(`https://web.archive.org/save/${entry.url}`, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  const result = await commit(pending).catch(err => ({ ok: false, reason: String(err.message || err) }));
  if (result.ok) {
    await set({ pending: [] });
    const { cache } = await get('cache');
    if (cache) { cache.entries.push(...pending); await set({ cache }); }
  }
  return { entry, ...result, pendingCount: result.ok ? 0 : pending.length };
}

async function exportPending() {
  const { pending = [] } = await get('pending');
  return { schemaVersion: 1, entries: pending };
}

// ---------- messages from the overlay, popup and options page ----------
api.runtime.onMessage.addListener((msg, _sender, reply) => {
  const run = {
    data: () => allData(),
    refresh: () => loadData(true).then(() => allData()),
    save: () => save(msg.form),
    renameShelves: () => renameShelves(msg.names || {}),
    export: () => exportPending(),
    clearPending: () => set({ pending: [] }).then(() => ({ ok: true })),
    retry: async () => { const { pending = [] } = await get('pending'); const r = await commit(pending); if (r.ok) await set({ pending: [] }); return r; },
  }[msg.type];
  if (!run) return false;
  run().then(reply, err => reply({ ok: false, reason: String(err?.message || err) }));
  return true;   // async reply
});

// ---------- overlay: shortcut and right-click ----------
async function openOverlay(tab, extra = {}) {
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id }, func: x => { globalThis.__linkmeryOpen = x; }, args: [extra] });
    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
  } catch {
    // Pages like the new tab page or the web store do not allow scripts.
    api.action.openPopup?.();
  }
}

api.commands.onCommand.addListener(async cmd => {
  if (cmd !== 'open-overlay') return;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab) openOverlay(tab);
});

api.runtime.onInstalled.addListener(details => {
  api.contextMenus.create({ id: 'save', title: 'Add to Linkmery', contexts: ['page', 'link', 'selection', 'image'] });
  if (details.reason === 'install') api.runtime.openOptionsPage();
});
api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save') openOverlay(tab, { tab: 'save', url: info.linkUrl, selection: info.selectionText });
});

// ---------- omnibox: type "lm" then a space ----------
const escXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
let engine = null, engineAt = 0, byId = new Map();
async function getEngine() {
  const d = await allData();
  if (!engine || d.fetchedAt !== engineAt || d.pending.length) {
    engine = createSearch(d); engineAt = d.fetchedAt; byId = new Map(d.entries.map(e => [e.id, e]));
  }
  return engine;
}
api.omnibox.setDefaultSuggestion({ description: 'Search your Linkmery library' });
api.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const eng = await getEngine();
  suggest(eng.search(text).slice(0, 6).map(r => {
    const e = byId.get(r.id);
    return { content: e.url, description: `${escXml(e.title)} - ${escXml(e.description.slice(0, 80))}` };
  }));
});
api.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let url = text;
  if (!/^https?:\/\//.test(text)) {
    const top = (await getEngine()).search(text)[0];
    const s = await settings();
    url = top ? byId.get(top.id).url : (s.siteUrl || 'https://github.com');
  }
  if (disposition === 'currentTab') api.tabs.update({ url });
  else api.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
