// Small DOM and browser helpers.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** h('button.chip', { onclick }, 'text', child) */
export function h(tag, props = {}, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) {
      if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val;
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(k, fallback) { try { const v = localStorage.getItem('lm.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem('lm.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

export async function copy(text, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast(done); } catch { toast('Copy failed. Select the text instead.'); }
    ta.remove();
  }
}

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
export const human = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const domain = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stable small hash for picking spine colours and heights. */
export const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };

/** Markdown list for pasting into chat. */
export const asMarkdown = (entries, heading) =>
  (heading ? `**${heading}**\n\n` : '') + entries.map(e => `- [${e.title}](${e.url}): ${e.description}`).join('\n');

export const TYPE_LABEL = { tool: 'Tool', article: 'Article', video: 'Video', inspiration: 'Inspiration', reference: 'Reference' };
