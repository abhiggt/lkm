// A small GitHub client for the admin panel (and anything else that needs to
// publish): read a JSON file, and write several files in one commit.

const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));

export function createRepo({ token, repo, branch = 'main' }) {
  const base = `https://api.github.com/repos/${repo}`;
  async function api(path, opts = {}) {
    const res = await fetch(base + path, {
      ...opts, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body && { 'Content-Type': 'application/json' }) },
    });
    if (!res.ok) {
      const why = res.status === 401 ? 'the token was refused' : res.status === 404 ? 'the repository or file was not found, or the token cannot see it' : res.status === 403 ? 'the token is missing a permission (it needs Contents: read and write)' : `GitHub answered ${res.status}`;
      throw new Error(why);
    }
    return res.status === 204 ? null : res.json();
  }
  return {
    /** Confirms the token can see the repository. */
    check: () => api(''),
    async readJson(path) {
      const f = await api(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
      return JSON.parse(fromB64(f.content));
    },
    /** Writes { path: text } as one commit on the branch. */
    async commit(files, message) {
      const ref = await api(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const parent = ref.object.sha;
      const head = await api(`/git/commits/${parent}`);
      const tree = await api('/git/trees', { method: 'POST', body: JSON.stringify({
        base_tree: head.tree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
      }) });
      const commit = await api('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }) });
      await api(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      return commit.sha;
    },
  };
}
