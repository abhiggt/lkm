// Seals a secret (the GitHub token, repository and branch) with a passcode,
// so it can be published in data/admin.json and opened only with the
// passcode. PBKDF2-SHA256 derives an AES-GCM key; everything runs in the
// browser (or Node) with the built-in Web Crypto API. A long passcode matters:
// anyone can download the sealed file and try guesses offline.

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFrom(passcode, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(secret, passcode, iterations = 600000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passcode, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(secret)));
  return { v: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-GCM', iterations, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Returns the secret, or throws if the passcode is wrong. */
export async function unseal(box, passcode) {
  const key = await keyFrom(passcode, unb64(box.salt), box.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data));
  return JSON.parse(dec.decode(plain));
}

/** A rough strength check for the passcode field. */
export function strength(passcode) {
  const p = passcode || '';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  const words = p.trim().split(/\s+/).filter(Boolean).length;
  if (p.length >= 20 || (words >= 4 && p.length >= 16)) return 'strong';
  if (p.length >= 12 && kinds >= 2) return 'fair';
  return 'weak';
}
