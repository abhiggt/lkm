// Linkmery search: a small, swappable, client-side engine.
// One public shape: createSearch(data).search(query) -> [{ id, score, matched }].
// The site, the extension and the tests all import this module.
import { terms, tokenize, stem, editDistance } from './normalize.js';
import { domainOf } from './url.js';

export const DEFAULT_WEIGHTS = { description: 3, title: 4, why: 2, tags: 2, maker: 1, shelf: 1, domain: 1, type: 1.5 };
const TLD = new Set(['www', 'com', 'org', 'net', 'io', 'co', 'app', 'dev', 'in', 'so', 'ai', 'me', 'design', 'github']);

export function createSearch({ entries, shelves = [], synonyms = [], weights = DEFAULT_WEIGHTS }) {
  const shelfName = Object.fromEntries(shelves.map(s => [s.id, s.name]));
  const vocab = new Map();          // stem -> { df, display }
  const docs = [];

  for (const e of entries) {
    const fields = {
      title: e.title, description: e.description, why: e.why, maker: e.maker,
      tags: (e.tags || []).join(' '), shelf: shelfName[e.shelf] || e.shelf, type: e.type,
      domain: domainOf(e.url).split('.').filter(p => !TLD.has(p)).join(' '),
    };
    const doc = { id: e.id, fields: {} };
    const seen = new Set();
    for (const [f, text] of Object.entries(fields)) {
      const words = tokenize(text);
      const set = new Set();
      for (const w of words) {
        const s = stem(w);
        set.add(s);
        if (!vocab.has(s)) vocab.set(s, { df: 0, display: w });
        if (!seen.has(s)) { seen.add(s); vocab.get(s).df++; }
      }
      doc.fields[f] = set;
    }
    docs.push(doc);
  }

  // stem -> Set of equivalent stems (multi-word phrases contribute each word).
  const syn = new Map();
  for (const group of synonyms) {
    const stems = new Set(group.flatMap(p => tokenize(p).map(stem)));
    for (const s of stems) {
      if (!syn.has(s)) syn.set(s, new Set());
      for (const o of stems) if (o !== s) syn.get(s).add(o);
    }
  }

  const N = docs.length || 1;
  const idf = s => Math.log(1 + N / (vocab.get(s)?.df || N));
  const vocabList = [...vocab.keys()];

  /** For one query term, which vocabulary stems count as a match, and how strongly. */
  function expand(qt, partial) {
    const c = new Map();
    const put = (v, w, how) => { if (vocab.has(v) && (c.get(v)?.w ?? 0) < w) c.set(v, { w, how }); };
    put(qt, 1, 'word');
    for (const s of syn.get(qt) || []) put(s, 0.8, 'synonym');
    const prefixW = partial ? 0.8 : qt.length >= 4 ? 0.55 : 0;
    const maxEdit = qt.length >= 7 ? 2 : qt.length >= 4 ? 1 : 0;
    for (const v of vocabList) {
      if (v === qt) continue;
      if (prefixW && qt.length >= 2 && v.startsWith(qt)) put(v, prefixW, 'prefix');
      else if (maxEdit) {
        const d = editDistance(qt, v, maxEdit);
        if (d <= maxEdit) {
          put(v, d === 1 ? 0.6 : 0.4, 'typo');
          for (const s of syn.get(v) || []) put(s, 0.45, 'synonym');
        }
      }
    }
    return c;
  }

  function search(query, { prefix = true } = {}) {
    const q = String(query ?? '').trim();
    if (!q) return [];
    const qTerms = [...new Set(terms(q))];
    const partialLast = prefix && !/\s$/.test(String(query));
    const cands = qTerms.map((t, i) => expand(t, partialLast && i === qTerms.length - 1));

    const results = [];
    for (const d of docs) {
      let total = 0, hit = 0;
      const matched = [];
      const used = new Set();   // a word in the link can answer only one query word
      cands.forEach((cand, i) => {
        let best = 0, why = null, bestV = null;
        for (const [f, set] of Object.entries(d.fields)) {
          const fw = weights[f] ?? 1;
          for (const [v, { w, how }] of cand) {
            if (!set.has(v) || used.has(v)) continue;
            const s = fw * w * idf(v);
            if (s > best) { best = s; bestV = v; why = { field: f, word: vocab.get(v).display, query: qTerms[i], how }; }
          }
        }
        if (best > 0) { total += best; hit++; matched.push(why); used.add(bestV); }
      });
      if (!hit) continue;
      const coverage = hit / qTerms.length;
      if (qTerms.length >= 3 && coverage < 0.34) continue;
      results.push({ id: d.id, score: +(total * coverage * coverage).toFixed(4), matched });
    }
    results.sort((a, b) => b.score - a.score);
    // A match only on the type word ("tool", "article") says little on its own,
    // and very weak matches far below the best one are noise.
    const top = results[0]?.score || 0;
    return results.filter(r =>
      !(qTerms.length > 1 && r.matched.every(m => m.field === 'type')) && r.score >= top * 0.15);
  }

  /** "Did you mean": replace unmatched words with the closest known word. */
  function didYouMean(query) {
    const words = tokenize(query);
    let changed = false;
    const out = words.map(w => {
      const s = stem(w);
      if (vocab.has(s) || w.length < 3) return w;
      let best = null, bd = 4;
      for (const v of vocabList) {
        const d = editDistance(s, v, 3);
        if (d < bd || (d === bd && best && vocab.get(v).df > vocab.get(best).df)) { bd = d; best = v; }
      }
      if (best && bd <= 3) { changed = true; return vocab.get(best).display; }
      return w;
    });
    return changed ? out.join(' ') : null;
  }

  /** Tags close to what was typed, or the most used tags as a fallback. */
  function nearbyTags(query, limit = 8) {
    const counts = new Map();
    for (const e of entries) for (const t of e.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    const qs = tokenize(query).map(stem);
    const scored = [...counts.keys()].map(t => {
      const ts = stem(tokenize(t).join(''));
      const d = Math.min(...qs.map(q => (ts.startsWith(q.slice(0, 3)) ? 1 : editDistance(q, ts, 3))), 9);
      return { t, d, n: counts.get(t) };
    }).sort((a, b) => a.d - b.d || b.n - a.n);
    const close = scored.filter(x => x.d <= 3).map(x => x.t);
    return (close.length ? close : scored.sort((a, b) => b.n - a.n).map(x => x.t)).slice(0, limit);
  }

  return { search, didYouMean, nearbyTags, size: docs.length };
}

const FIELD_LABEL = { description: 'note', title: 'title', why: 'use', tags: 'tag', maker: 'maker', shelf: 'shelf', domain: 'site', type: 'type' };

/** Short human hint, for example "title: font, use: logo". */
export function matchedHint(result) {
  const byField = new Map();
  for (const m of result.matched || []) {
    const k = FIELD_LABEL[m.field] || m.field;
    if (!byField.has(k)) byField.set(k, new Set());
    byField.get(k).add(m.word);
  }
  return [...byField].map(([f, ws]) => `${f}: ${[...ws].join(', ')}`).join('; ');
}
