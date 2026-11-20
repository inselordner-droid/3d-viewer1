// Digitales Museum · Galerie – Service Worker (offline). Version 20261120231630
const CACHE = 'fair-galerie-20261120231630';
const SHELL = ['./', './index.html', './data/gallery.js', './app/museum.bundle.js', './assets/museum.css', './manifest.webmanifest', './offline-manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fair-galerie-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
let running = null;
self.addEventListener('message', e => {
  const t = e.data && e.data.type;
  if (t === 'precache') { if (!running) running = precache().finally(() => { running = null; }); }
  if (t === 'status') status().then(s => broadcast({ type: 'status', ...s }));
});
async function broadcast(msg) { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg); }
async function list() { const c = await caches.open(CACHE); const r = (await c.match('./offline-manifest.json')) || await fetch('./offline-manifest.json', { cache: 'no-store' }); return (await r.clone().json()).files; }
async function status() {
  const files = await list(), c = await caches.open(CACHE);
  let have = 0, haveBytes = 0, total = 0;
  for (const f of files) { total += f.size; if (await c.match(f.path)) { have++; haveBytes += f.size; } }
  return { have, count: files.length, haveBytes, total, complete: have === files.length };
}
async function precache() {
  const files = await list(), c = await caches.open(CACHE);
  const total = files.reduce((s, f) => s + f.size, 0);
  let bytes = 0, n = 0;
  for (const f of files) {
    n++;
    if (!(await c.match(f.path))) {
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try { const r = await fetch(f.path, { cache: 'reload' }); if (!r.ok) throw new Error(r.status); await c.put(f.path, r); ok = true; }
        catch (err) { if (attempt === 2) { broadcast({ type: 'error', file: f.path, message: String(err && err.message || err) }); return; } }
      }
    }
    bytes += f.size;
    broadcast({ type: 'progress', n, count: files.length, bytes, total, file: f.path });
  }
  broadcast({ type: 'done', total });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    let hit = await c.match(req, { ignoreSearch: true, ignoreVary: true });
    if (!hit && (url.pathname.endsWith('/') || req.mode === 'navigate')) hit = await c.match('./index.html');
    const range = req.headers.get('range');
    if (hit && range) return rangeResponse(hit, range);
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) { return new Response('Offline: Diese Datei wurde noch nicht gespeichert.', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});
// Videos brauchen Teilantworten (HTTP 206), sonst spielt Safari sie aus dem Speicher nicht ab
async function rangeResponse(resp, range) {
  const blob = await resp.blob(), size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(blob.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': resp.headers.get('Content-Type') || 'video/mp4', 'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
