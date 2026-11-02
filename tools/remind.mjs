#!/usr/bin/env node
// Weekly digest of read-later links saved more than 3 days ago, sent through
// the Resend email API. Needs RESEND_API_KEY, REMIND_TO and REMIND_FROM.
// Run with --dry-run to print the email instead of sending it.
import { readFileSync } from 'node:fs';

const dry = process.argv.includes('--dry-run');
const { entries } = JSON.parse(readFileSync('data/bookmarks.json', 'utf8'));
const cfg = JSON.parse(readFileSync('linkmery.config.json', 'utf8'));
const cutoff = Date.now() - 3 * 864e5;
const due = entries.filter(e => e.readLater && Date.parse(e.added) < cutoff).sort((a, b) => a.added.localeCompare(b.added));

if (!due.length) { console.log('Nothing on the read-later pile. No email sent.'); process.exit(0); }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const subject = `${due.length} ${due.length === 1 ? 'link' : 'links'} waiting on your read-later shelf`;
const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1a1a1a;line-height:1.5">
<p style="font-size:18px;margin:0 0 16px">From your almari: ${subject}.</p>
${due.map(e => `<p style="margin:0 0 14px"><a href="${esc(e.url)}" style="color:#1a1a1a;font-weight:600">${esc(e.title)}</a><br>
<span style="color:#64645f">${esc(e.description)}</span><br><span style="color:#8a6417;font-size:13px">Saved ${e.added}</span></p>`).join('')}
<p style="color:#64645f;font-size:13px;margin-top:24px">Untick "read later" in the extension when you're done. <a href="${esc(cfg.siteUrl)}" style="color:#64645f">Open Linkmery</a></p></div>`;
const text = due.map(e => `${e.title}\n${e.url}\n${e.description}\n`).join('\n');

if (dry) { console.log(subject + '\n\n' + text); process.exit(0); }
const { RESEND_API_KEY, REMIND_TO, REMIND_FROM } = process.env;
if (!RESEND_API_KEY || !REMIND_TO || !REMIND_FROM) {
  console.error('Set RESEND_API_KEY, REMIND_TO and REMIND_FROM as repository secrets.');
  process.exit(1);
}
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: REMIND_FROM, to: REMIND_TO.split(',').map(s => s.trim()), subject, html, text }),
});
if (!res.ok) { console.error(`Email failed: ${res.status} ${await res.text()}`); process.exit(1); }
console.log(`Sent: ${subject}`);
