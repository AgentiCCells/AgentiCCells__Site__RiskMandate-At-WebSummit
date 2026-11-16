// Read-only sgit vault reader for the browser. No dependencies: WebCrypto, fetch and
// (for video) Media Source Extensions. It mirrors the read path of sgit (sgit-ai 0.27):
//   index  bare/indexes/idx-pid-muw-{HMAC(read_key, "sg-vault-v1:file-id:branch-index:{id}")[:12]}
//   ref    bare/refs/{head_ref_id}           -> {"commit_id"}
//   commit bare/data/{commit_id}             -> {"tree_id"}
//   tree   bare/data/{tree_id}               -> entries with name_enc, blob_id | tree_id
//   blob   bare/data/{blob_id}               -> iv(12) + AES-256-GCM(content), or "\0sgz1" + iv + AES-GCM(deflate)
// Every object is encrypted with the read key; the server only ever sees ciphertext.
// Written by site-riskmandate-at-websummit@AgentiCCells.dinis, 2026-11-16. Apache-2.0.

const API = 'https://send.sgraph.ai/api/vault';
const MAGIC = [0, 0x73, 0x67, 0x7a, 0x31]; // "\0sgz1"
const te = new TextEncoder(), td = new TextDecoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function parseReadKey(key) {
  const s = String(key || '').trim().replace(/^sgit_(public_read|private_read|rk1)_/, '');
  const m = s.match(/^([0-9a-f]{64}):([a-z0-9]{4,24})$/);
  if (!m) throw new Error('not a read key ({64 hex}:{vault id})');
  return { readKeyHex: m[1], vaultId: m[2] };
}

export class VaultReader {
  constructor(readKeyHex, vaultId, { api = API, concurrency = 6 } = {}) {
    this.vaultId = vaultId; this.api = api; this.raw = unhex(readKeyHex);
    this.slots = concurrency; this.queue = []; this.trees = new Map();
  }

  async open() {
    this.aes = await crypto.subtle.importKey('raw', this.raw, 'AES-GCM', false, ['decrypt']);
    const mac = await crypto.subtle.importKey('raw', this.raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const id = async (domain) => hex(await crypto.subtle.sign('HMAC', mac, te.encode(domain))).slice(0, 12);
    let refId;
    try {
      const index = await this.json(`bare/indexes/idx-pid-muw-${await id(`sg-vault-v1:file-id:branch-index:${this.vaultId}`)}`);
      const named = index.branches.filter((b) => b.branch_type === 'named');
      refId = (named.find((b) => b.name === 'current') || named[0]).head_ref_id;
    } catch { refId = `ref-pid-muw-${await id(`sg-vault-v1:file-id:ref:${this.vaultId}`)}`; }
    const { commit_id } = await this.json(`bare/refs/${refId}`);
    this.commitId = commit_id;
    const commit = await this.json(`bare/data/${commit_id}`);
    this.rootTree = commit.tree_id;
    return this;
  }

  // Limit parallel requests so a gallery does not open dozens at once.
  async fetchRaw(fileId, signal) {
    if (this.slots <= 0) await new Promise((r) => this.queue.push(r));
    this.slots--;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch(`${this.api}/read/${this.vaultId}/${encodeURIComponent(fileId)}`, { signal });
          if (!r.ok) throw new Error(`vault read ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        } catch (e) {
          if (signal?.aborted || attempt >= 2) throw e;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    } finally { this.slots++; const next = this.queue.shift(); if (next) next(); }
  }

  async decrypt(data) {
    if (data.length > 17 && MAGIC.every((b, i) => data[i] === b)) {
      try {
        const packed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(5, 17) }, this.aes, data.subarray(17));
        return new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      } catch { /* a v1 object whose iv starts with the magic bytes: read as v1 */ }
    }
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12) }, this.aes, data.subarray(12)));
  }

  async json(fileId) { return JSON.parse(td.decode(await this.decrypt(await this.fetchRaw(fileId)))); }

  async tree(treeId) {
    if (!this.trees.has(treeId)) {
      this.trees.set(treeId, (async () => {
        const t = await this.json(`bare/data/${treeId}`);
        const out = new Map();
        await Promise.all(t.entries.map(async (e) => out.set(td.decode(await this.decrypt(b64(e.name_enc))), e)));
        return out;
      })());
    }
    return this.trees.get(treeId);
  }

  async entry(path) {
    let tree = this.rootTree, entry = null;
    for (const part of path.split('/')) {
      if (!tree) throw new Error(`not a folder on the way to ${path}`);
      entry = (await this.tree(tree)).get(part);
      if (!entry) throw new Error(`not in the vault: ${path}`);
      tree = entry.tree_id;
    }
    return entry;
  }

  async bytes(path, signal) {
    const e = await this.entry(path);
    if (!e.blob_id) throw new Error(`${path} is a folder`);
    return this.decrypt(await this.fetchRaw(`bare/data/${e.blob_id}`, signal));
  }

  async objectURL(path, type) { return URL.createObjectURL(new Blob([await this.bytes(path)], { type })); }
  async text(path) { return td.decode(await this.bytes(path)); }
}

// Play a segmented fragmented-MP4 video (an init segment and media segments, each a vault
// file) in a <video>. Media Source Extensions where available, fetching a few segments
// ahead and jumping on seek; otherwise the segments are joined into one Blob.
export async function playSegmented(video, reader, spec, { onProgress } = {}) {
  const MS = window.ManagedMediaSource || window.MediaSource;
  const getAll = async () => {
    const parts = [await reader.bytes(spec.init)];
    for (let i = 0; i < spec.segments.length; i++) { parts.push(await reader.bytes(spec.segments[i])); onProgress?.((i + 1) / spec.segments.length); }
    return URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
  };
  if (!MS || !MS.isTypeSupported(spec.mime)) { video.src = await getAll(); return; }

  const ms = new MS();
  if (window.ManagedMediaSource) video.disableRemotePlayback = true;
  video.src = URL.createObjectURL(ms);
  await new Promise((r) => ms.addEventListener('sourceopen', r, { once: true }));
  ms.duration = spec.duration;
  const sb = ms.addSourceBuffer(spec.mime);
  const append = (buf) => new Promise((res, rej) => {
    sb.addEventListener('updateend', res, { once: true });
    sb.addEventListener('error', rej, { once: true });
    sb.appendBuffer(buf);
  });
  const starts = spec.durations.reduce((a, d, i) => (a.push(i ? a[i - 1] + spec.durations[i - 1] : 0), a), []);
  const segAt = (t) => Math.max(0, starts.findLastIndex((s) => s <= t + 0.05));
  const buffered = (t) => { for (let i = 0; i < sb.buffered.length; i++) if (sb.buffered.start(i) <= t + 0.1 && t < sb.buffered.end(i)) return sb.buffered.end(i); return null; };
  const have = new Set(), cache = new Map();
  let next = 0, wake = null;
  const fetchSeg = (i) => { if (!cache.has(i)) cache.set(i, reader.bytes(spec.segments[i])); return cache.get(i); };
  video.addEventListener('seeking', () => {
    const i = segAt(video.currentTime);
    if (buffered(video.currentTime) === null) { have.delete(i); next = i; } // also re-fetches a segment evicted from the buffer
    wake?.();
  });
  video.addEventListener('timeupdate', () => wake?.());

  await append(await reader.bytes(spec.init));
  for (;;) {
    while (next < spec.segments.length && have.has(next)) next++;
    if (next >= spec.segments.length) {
      if ([...Array(spec.segments.length).keys()].every((i) => have.has(i))) break;
      next = spec.segments.findIndex((_, i) => !have.has(i));
    }
    const ahead = (buffered(video.currentTime) ?? video.currentTime) - video.currentTime;
    if (ahead > 30 && have.has(segAt(video.currentTime))) { await new Promise((r) => (wake = r)); wake = null; continue; }
    const i = next;
    if (i + 1 < spec.segments.length) fetchSeg(i + 1); // prefetch one
    const data = await fetchSeg(i);
    cache.delete(i);
    if (sb.updating) await new Promise((r) => sb.addEventListener('updateend', r, { once: true }));
    try { await append(data); } catch {
      // Buffer full: drop what is well behind the playhead, then retry once.
      if (video.currentTime > 20) { sb.remove(0, video.currentTime - 10); await new Promise((r) => sb.addEventListener('updateend', r, { once: true })); }
      await append(data);
    }
    have.add(i); next = i + 1;
    onProgress?.(have.size / spec.segments.length);
  }
  if (ms.readyState === 'open' && !sb.updating) ms.endOfStream();
}
