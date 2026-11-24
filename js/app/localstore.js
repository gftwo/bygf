import { App } from './core.js';

/* ==========================================================================
   Penyimpanan lokal besar (IndexedDB) — pelengkap localStorage (batas ±5 MB).
   - Cermin data akun, snapshot, dan salinan data rusak disimpan di sini bila perlu.
   - API sinkron lewat cache memori (diisi saat aplikasi dibuka); tulis ke IndexedDB ditunda 600 ms agar tidak berat.
   - Bila IndexedDB tidak tersedia (mode privat, dll.), semua fungsi tetap aman: aplikasi memakai localStorage seperti biasa.
   ========================================================================== */
const DB_NAME = 'bygf-local', STORE = 'kv', WRITE_DELAY = 600;
const mem = new Map(), timers = new Map();
let dbp = null, ready = false;

function open() {
    if (dbp) return dbp;
    dbp = new Promise(resolve => {
        try {
            if (!window.indexedDB) return resolve(null);
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
            req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
        } catch (e) { resolve(null); }
    });
    return dbp;
}
const tx = (db, mode, fn) => new Promise(resolve => {
    try { const t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : true); t.onerror = t.onabort = () => resolve(false); } catch (e) { resolve(false); }
});

App.LocalStore = {
    get available() { return ready; },
    async init() {   // muat semua isi ke memori (dipanggil saat aplikasi dibuka)
        const db = await open(); if (!db) return false;
        await new Promise(resolve => {
            try {
                const t = db.transaction(STORE, 'readonly'), c = t.objectStore(STORE).openCursor();
                c.onsuccess = () => { const cur = c.result; if (cur) { if (!mem.has(cur.key)) mem.set(cur.key, cur.value); cur.continue(); } };
                t.oncomplete = () => resolve(); t.onerror = t.onabort = () => resolve();
            } catch (e) { resolve(); }
        });
        ready = true; return true;
    },
    get(key) { return mem.has(key) ? mem.get(key) : null; },
    put(key, value) {   // memori langsung, IndexedDB menyusul
        mem.set(key, value); clearTimeout(timers.get(key));
        timers.set(key, setTimeout(async () => { timers.delete(key); const db = await open(); if (db) await tx(db, 'readwrite', s => s.put(value, key)); }, WRITE_DELAY));
    },
    async remove(key) { mem.delete(key); clearTimeout(timers.get(key)); const db = await open(); if (db) await tx(db, 'readwrite', s => s.delete(key)); },
    async estimate() { try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; return e ? { used: e.usage || 0, quota: e.quota || 0 } : null; } catch (e) { return null; } },
    flush() { return Promise.all([...timers.keys()].map(async k => { clearTimeout(timers.get(k)); timers.delete(k); const db = await open(); if (db && mem.has(k)) await tx(db, 'readwrite', s => s.put(mem.get(k), k)); })); }
};
// pastikan tulisan tertunda tidak hilang saat tab disembunyikan/ditutup
document.addEventListener('visibilitychange', () => { if (document.hidden) App.LocalStore.flush(); });
window.addEventListener('pagehide', () => { App.LocalStore.flush(); });
