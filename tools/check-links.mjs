#!/usr/bin/env node
// Checks every saved link. Broken ones get deadSince (and an archive link if
// one exists); links that work again lose it. Sites that block bots (403, 429)
// are not treated as dead.
//
// Usage: node tools/check-links.mjs [--write] [--report file.md]
import { readFileSync, writeFileSync } from 'node:fs';

const write = process.argv.includes('--write');
const ri = process.argv.indexOf('--report');
const reportPath = ri > -1 ? process.argv[ri + 1] : null;
const db = JSON.parse(readFileSync('data/bookmarks.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (compatible; LinkmeryLinkCheck/1.0; +https://github.com)';

async function status(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return { ok: true, code: res.status };
      if ([401, 403, 405, 429, 999].includes(res.status) && method === 'HEAD') continue;
      if ([401, 403, 429, 999].includes(res.status)) return { ok: true, code: res.status, blocked: true };
      return { ok: false, code: res.status };
    } catch (err) {
      if (method === 'GET') return { ok: false, code: err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || 'network error') };
    }
  }
  return { ok: false, code: 'unknown' };
}

async function archived(url) {
  try {
    const r = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
    return (await r.json())?.archived_snapshots?.closest?.url || null;
  } catch { return null; }
}

const broken = [], revived = [];
const queue = [...db.entries];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let e; (e = queue.shift());) {
    const s = await status(e.url);
    if (!s.ok) {
      if (!e.deadSince) e.deadSince = today;
      if (!e.archiveUrl) e.archiveUrl = await archived(e.url) || undefined;
      broken.push({ e, code: s.code });
    } else if (e.deadSince) {
      delete e.deadSince;
      revived.push(e);
    }
  }
}));

for (const { e, code } of broken) console.log(`dead  ${code}  ${e.url}  (${e.title})`);
for (const e of revived) console.log(`back  ${e.url}`);
console.log(`\n${db.entries.length} checked, ${broken.length} broken, ${revived.length} working again`);

if (write) writeFileSync('data/bookmarks.json', JSON.stringify(db, null, 2) + '\n');
if (reportPath && broken.length) {
  writeFileSync(reportPath, `These links failed this week's check. They now show a dead-link badge on the site, with the archived copy where one exists.\n\n`
    + broken.map(({ e, code }) => `- [ ] **${e.title}** (${e.shelf}): ${e.url} returned ${code}${e.archiveUrl ? `. [Archived copy](${e.archiveUrl})` : ''}`).join('\n')
    + `\n\nFix the URL, delete the entry, or leave it: the badge clears itself if the link comes back.\n`);
}
