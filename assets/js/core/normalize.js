// Text normalisation shared by search, the importer and the extension.

export const STOPWORDS = new Set((
  'a an and are as at be been but by can could do does for from had has have he her his how i if in into is it its ' +
  'just me my no not of on or our she so some such than that the their them then there these they this those to ' +
  'too up us was we were what when where which who why will with would you your ' +
  // filler people use when describing a half-remembered link
  'something thing things stuff about around kind sort maybe really good nice great cool best find found looking ' +
  'look want need needed like one ones saw seen saved remember remembered also any lot lots very work works'
).split(' '));

/** Lowercase, strip accents and punctuation, split into words. */
export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter(Boolean);
}

/** Light English stemmer: plurals, -ing, -ed, -ly, trailing e. Consistent, not clever. */
export function stem(w) {
  if (w.length <= 3 || /^\d+$/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('es') && /(ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) { w = w.slice(0, -3); if (/(.)\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1); }
  else if (w.endsWith('ed') && w.length > 4) { w = w.slice(0, -2); if (/(.)\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1); }
  else if (w.endsWith('ly') && w.length > 5) w = w.slice(0, -2);
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith('our') && w.length > 4) w = w.slice(0, -3) + 'or'; // colour -> color
  return w;
}

/** Words with stopwords removed, stemmed. Falls back to all words if every word was a stopword. */
export function terms(text, { keepStop = false } = {}) {
  const words = tokenize(text);
  const kept = keepStop ? words : words.filter(w => !STOPWORDS.has(w));
  return (kept.length ? kept : words).map(stem);
}

/** Damerau-free Levenshtein with an early exit once `max` is exceeded. */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
