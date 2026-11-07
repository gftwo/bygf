import { App } from './core.js';

/* ==========================================================================
   Pengaman data & pengingat harian
   - Snapshot otomatis mingguan ke penyimpanan perangkat ini (3 terakhir) — tidak menggantikan backup file.
   - Pengingat backup file bila sudah > 7 hari, dan pengingat jurnal (setelah jam 18) lewat popup dalam aplikasi.
   ========================================================================== */
const SNAP_DAYS = 7, KEEP = 3, MAX_BYTES = 1500000, STALE_DAYS = 7;
const K = { snaps: uid => 'bygf.snaps.' + uid, last: 'bygf.lastBackupAt', nudge: 'bygf.nudgeDay' };
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysSince = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
const uid = () => App.State.user && App.State.user.uid;
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

App.Guard = {
    snapshots() { const u = uid(); return u ? (read(K.snaps(u)) || []) : []; },
    lastBackupAt() { return localStorage.getItem(K.last) || ''; },
    markBackup() { try { localStorage.setItem(K.last, new Date().toISOString()); } catch (e) { /* abaikan */ } this.renderCard(); },
    hasData() { const s = App.State; return (s.transactions || []).length > 0 || (window.AppModules && AppModules.keys().some(k => k !== 'home' && JSON.stringify(AppModules.get(k)).length > 40)); },
    snapshotNow(manual) {
        const u = uid(); if (!u) return false;
        const data = App.DB.getLocalMirror(u); if (!data) { if (manual) App.UI.showToast('Belum ada data untuk disimpan', 'error'); return false; }
        const json = JSON.stringify(data);
        if (json.length > MAX_BYTES) { if (manual) App.UI.showToast('Data terlalu besar untuk snapshot lokal — gunakan Export JSON', 'error'); return false; }
        const list = this.snapshots(); list.unshift({ at: new Date().toISOString(), size: json.length, tx: (data.transactions || []).length, json });
        while (list.length > KEEP) list.pop();
        try { localStorage.setItem(K.snaps(u), JSON.stringify(list)); } catch (e) { // penyimpanan penuh: coba simpan 1 saja
            try { localStorage.setItem(K.snaps(u), JSON.stringify(list.slice(0, 1))); } catch (e2) { if (manual) App.UI.showToast('Penyimpanan browser penuh', 'error'); return false; }
        }
        if (manual) App.UI.showToast('Snapshot tersimpan'); this.renderCard(); return true;
    },
    autoSnapshot() { const l = this.snapshots(); if (this.hasData() && (!l.length || daysSince(l[0].at) >= SNAP_DAYS)) this.snapshotNow(false); },
    download(i) { const s = this.snapshots()[i]; if (!s) return; const b = new Blob([s.json], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Snapshot_${s.at.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
    restore(i) { // memakai jalur impor yang sama (validasi + konfirmasi menimpa)
        const s = this.snapshots()[i]; if (!s) return;
        const file = new File([s.json], 'snapshot.json', { type: 'application/json' });
        App.Handlers.importFile({ target: { files: [file], value: '' } });
    },
    removeSnap(i) { const u = uid(), l = this.snapshots(); l.splice(i, 1); try { localStorage.setItem(K.snaps(u), JSON.stringify(l)); } catch (e) { /* abaikan */ } this.renderCard(); },
    renderCard() {
        const el = document.getElementById('guardCard'); if (!el) return;
        const last = this.lastBackupAt(), n = daysSince(last), snaps = this.snapshots();
        const fmt = iso => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        el.innerHTML = `<h3 class="font-bold" style="margin-bottom:.5rem;">🛡️ Pengaman Data</h3>
        <p class="text-xs text-muted" style="margin-bottom:.75rem;">Backup file terakhir: <b>${last ? fmt(last) + ` (${n} hari lalu)` : 'belum pernah'}</b>${last && n > STALE_DAYS ? ' ⚠️' : ''}. Snapshot otomatis dibuat tiap ${SNAP_DAYS} hari dan disimpan di perangkat ini (${KEEP} terakhir).</p>
        <div style="display:flex; flex-direction:column; gap:.5rem; margin-bottom:.75rem;">${snaps.length ? snaps.map((s, i) => `<div style="display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; padding:.55rem .7rem; background:var(--bg-body); border-radius:var(--radius-md);"><div style="flex:1; min-width:150px;"><div class="text-sm font-semibold">${fmt(s.at)}</div><div class="text-xs text-muted">${s.tx} transaksi · ${(s.size / 1024).toFixed(0)} KB</div></div><button type="button" class="btn btn-sm btn-outline" onclick="App.Guard.download(${i})">⬇ Unduh</button><button type="button" class="btn btn-sm btn-outline" onclick="App.Guard.restore(${i})">↩ Pulihkan</button><button type="button" class="btn btn-sm btn-outline" aria-label="Hapus snapshot" onclick="App.Guard.removeSnap(${i})">🗑</button></div>`).join('') : '<p class="text-xs text-muted">Belum ada snapshot.</p>'}</div>
        <button type="button" class="btn btn-outline" onclick="App.Guard.snapshotNow(true)">📸 Buat snapshot sekarang</button>`;
    },
    // ----- pengingat harian (popup dalam aplikasi) -----
    nudgeItems() {
        const items = [], hour = new Date().getHours();
        const j = window.AppModules && AppModules.has('journal') ? AppModules.get('journal') : null;
        if (j && hour >= 18 && !(j.entries || []).some(e => e.date === day() && (e.rating || e.good || e.problem || e.lesson || e.tomorrow || e.note))) items.push({ icon: '📔', text: 'Jurnal hari ini belum diisi.', btn: 'Isi jurnal', fn: () => { App.UI._lastSubTab.notes = 'jr-today'; App.UI.switchMainGroup('notes'); } });
        if (this.hasData()) { const n = daysSince(this.lastBackupAt()); if (n === null || n > STALE_DAYS) items.push({ icon: '🛡️', text: n === null ? 'Kamu belum pernah membuat backup file.' : `Backup file terakhir ${n} hari lalu.`, btn: 'Backup sekarang', fn: () => { App.UI.switchMainGroup('settings'); App.Handlers.exportData('json'); } }); }
        return items;
    },
    showNudge() {
        if (localStorage.getItem(K.nudge) === day()) return false;
        const items = this.nudgeItems(); if (!items.length) return false;
        let m = document.getElementById('guardNudge'); if (m) m.remove();
        m = document.createElement('div'); m.id = 'guardNudge'; m.className = 'modal-overlay show'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Pengingat'); m.style.zIndex = 10500;
        m.innerHTML = `<div class="modal-content" style="max-width:380px;"><div class="modal-header"><h2>🔔 Pengingat</h2><button type="button" class="modal-close" data-nudge-close aria-label="Tutup">&times;</button></div>${items.map((it, i) => `<div style="display:flex; align-items:center; gap:.75rem; padding:.7rem 0; border-bottom:1px dashed var(--border-light);"><span style="font-size:1.6rem;">${it.icon}</span><div style="flex:1;" class="text-sm">${it.text}</div><button type="button" class="btn btn-sm btn-primary" data-nudge="${i}">${it.btn}</button></div>`).join('')}<button type="button" class="btn btn-outline" style="width:100%; margin-top:1rem;" data-nudge-close>Nanti saja</button></div>`;
        const close = () => { try { localStorage.setItem(K.nudge, day()); } catch (e) { /* abaikan */ } m.remove(); if (window.AppNotifyQueue) AppNotifyQueue.closed('guard-nudge'); };
        m.addEventListener('click', e => { const b = e.target.closest('[data-nudge]'); if (b) { const it = items[+b.dataset.nudge]; close(); it.fn(); return; } if (e.target.closest('[data-nudge-close]') || e.target === m) close(); });
        document.body.appendChild(m); return true;
    },
    onLoaded() { // dipanggil setelah data akun termuat
        this.autoSnapshot(); this.renderCard();
        setTimeout(() => { if (window.AppNotifyQueue) AppNotifyQueue.register('guard-nudge', () => this.showNudge()); else this.showNudge(); }, 1500);
    }
};

// render kartu saat membuka Setelan
const hook = () => { if (!App.UI || !App.UI.switchTab || App.UI.__guardHooked) return; const o = App.UI.switchTab; App.UI.__guardHooked = true; App.UI.switchTab = function (id) { const r = o.apply(this, arguments); if (id === 'settings') App.Guard.renderCard(); return r; }; };
document.addEventListener('DOMContentLoaded', () => setTimeout(hook, 0)); if (document.readyState !== 'loading') setTimeout(hook, 0);
