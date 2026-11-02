// URL normalisation used for duplicate detection everywhere (validator,
// importer, merge, extension).
// Removed from saved URLs. `si` (YouTube) and `s` (X) are share-tracking ids.
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref_src$|igshid$|si$)/;

export function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    u.hash = '';
    u.hostname = u.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
    if (u.hostname === 'twitter.com') u.hostname = 'x.com';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k) || (u.hostname === 'x.com' && k === 's')) u.searchParams.delete(k);
    const s = `${u.hostname}${u.pathname.replace(/\/+$/, '')}${u.search}`;
    return s.toLowerCase();
  } catch { return String(raw).trim().toLowerCase(); }
}

/** Removes tracking parameters but keeps the URL usable. */
export function cleanUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return String(raw).trim(); }
}

export const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
