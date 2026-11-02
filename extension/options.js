const api = globalThis.browser ?? globalThis.chrome;
const $ = id => document.getElementById(id);
const status = msg => { $('status').textContent = msg; };
const hr = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
document.documentElement.dataset.theme = document.body.dataset.theme = hr >= 6 && hr < 18 ? 'day' : 'night';

const FIELDS = ['siteUrl', 'repo', 'branch', 'token'];
const { settings = {} } = await api.storage.local.get('settings');
for (const f of FIELDS) $(f).value = settings[f] || (f === 'branch' ? 'main' : '');

async function showPending() {
  const { pending = [] } = await api.storage.local.get('pending');
  $('pending').textContent = pending.length
    ? `${pending.length} ready to go live: ${pending.map(p => p.title).join(', ')}`
    : 'Nothing waiting. Everything is live.';
}
showPending();

$('save').addEventListener('click', async () => {
  const next = Object.fromEntries(FIELDS.map(f => [f, $(f).value.trim()]));
  if (next.siteUrl && !next.siteUrl.endsWith('/')) next.siteUrl += '/';
  if (next.repo && !/^[\w.-]+\/[\w.-]+$/.test(next.repo)) return status('Repository should look like owner/name.');
  // A custom domain needs permission to read it.
  if (next.siteUrl && !/\.github\.io\//.test(next.siteUrl)) {
    const origin = new URL(next.siteUrl).origin + '/*';
    const granted = await api.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) return status('Linkmery needs permission to read your site so it can search it.');
  }
  await api.storage.local.set({ settings: next });
  await api.storage.local.remove('cache');
  status('Settings saved.');
});

$('test').addEventListener('click', async () => {
  status('Checking...');
  const d = await api.runtime.sendMessage({ type: 'refresh' });
  status(d.error || `Found ${d.entries.length} links on ${d.shelves.filter(s => !s.kind).length} shelves.`);
});

$('retry').addEventListener('click', async () => {
  const r = await api.runtime.sendMessage({ type: 'retry' });
  status(r.ok ? `${r.committed} links are on their way to your site.` : r.reason === 'no-token' ? 'Add the repository and a token first.' : r.reason);
  showPending();
});

$('export').addEventListener('click', async () => {
  const data = await api.runtime.sendMessage({ type: 'export' });
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `linkmery-export-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
});

$('clear').addEventListener('click', async () => {
  if (!confirm('Remove the waiting links from this browser? Export them first if you want to keep them.')) return;
  await api.runtime.sendMessage({ type: 'clearPending' });
  showPending();
});

// ---------- shelf names ----------
async function showShelves() {
  const d = await api.runtime.sendMessage({ type: 'data' });
  const box = $('shelf-names');
  const real = (d.shelves || []).filter(s => !s.kind).sort((a, b) => a.order - b.order);
  if (!real.length) { box.innerHTML = '<p>Add your library address above, then come back here.</p>'; return; }
  box.replaceChildren(...real.map(s => {
    const label = document.createElement('label'); label.className = 'field';
    const span = document.createElement('span'); span.textContent = `#${s.id}`;
    const input = document.createElement('input'); input.value = s.name; input.dataset.id = s.id; input.dataset.was = s.name; input.maxLength = 40;
    label.append(span, input); return label;
  }));
}
showShelves();
$('save-names').addEventListener('click', async () => {
  const names = {};
  for (const i of document.querySelectorAll('#shelf-names input')) if (i.value.trim() && i.value.trim() !== i.dataset.was) names[i.dataset.id] = i.value.trim();
  const say = m => { $('names-status').textContent = m; };
  if (!Object.keys(names).length) return say('Nothing changed.');
  say('Renaming…');
  const r = await api.runtime.sendMessage({ type: 'renameShelves', names });
  if (r.ok) { say(r.renamed === 1 ? 'Renamed. Your site updates in a minute or two.' : `${r.renamed} shelves renamed. Your site updates in a minute or two.`); showShelves(); }
  else say(r.reason === 'no-token' ? 'Add the repository and a token above first.' : `Couldn’t rename: ${r.reason}`);
});
