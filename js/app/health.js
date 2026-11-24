import { App } from './core.js';

/* ==========================================================================
   Kesehatan Data
   - problems(data)  : cek struktur data akun (dipakai pemulihan otomatis saat data cloud rusak).
   - recover(uid)    : cari salinan sehat (cermin lokal → riwayat → snapshot) bila data cloud rusak.
   - check()         : laporan di Setelan: transaksi ganda, id kembar, angka tidak wajar, saldo minus,
                       data yatim (kategori/barang yang sudah tidak ada), ukuran data.
   - Perbaikan yang tersedia selalu membuat snapshot dulu; transaksi ganda dipindah ke Sampah (bisa dipulihkan).
   ========================================================================== */
const ARRAYS = ['transactions', 'recurring', 'customCategories', 'budgets', 'paylaters', 'transfers', 'debts', 'quickTemplates', 'trashedTransactions'];
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
const num = v => v === undefined || v === null || v === '' || (typeof v === 'number' && isFinite(v));
const fmtN = App.Utils ? n => App.Utils.formatCurrency(n) : n => 'Rp ' + n;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uidNow = () => App.State.user && App.State.user.uid;
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

function problems(data) {   // daftar masalah struktur; kosong = sehat
    const out = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return ['data bukan objek'];
    ARRAYS.forEach(k => { if (data[k] !== undefined && data[k] !== null && !Array.isArray(data[k])) out.push(k + ' bukan daftar'); });
    if (Array.isArray(data.transactions) && data.transactions.some(t => !t || typeof t !== 'object')) out.push('ada transaksi yang bukan objek');
    if (data.modules !== undefined && data.modules !== null && (typeof data.modules !== 'object' || Array.isArray(data.modules))) out.push('modul bukan objek');
    else if (data.modules && window.AppModules) { const v = AppModules.validate(data.modules); if (!v.ok) out.push('modul: ' + v.errors[0]); }
    if (data.settings !== undefined && data.settings !== null && (typeof data.settings !== 'object' || Array.isArray(data.settings))) out.push('setelan rusak');
    return out;
}

App.Health = {
    problems,
    candidates(uid) {   // salinan lokal, paling baru dulu
        const list = [], mirror = App.DB.getLocalMirror(uid); if (mirror) list.push({ from: 'cadangan lokal', data: mirror });
        const hist = readJSON('cloud_cache_history_' + uid) || []; hist.forEach(h => { if (h && h.data) list.push({ from: 'riwayat cadangan', data: h.data }); });
        const snaps = App.Guard ? App.Guard.snapshots() : []; snaps.forEach(s => { try { list.push({ from: 'snapshot', data: JSON.parse(s.json) }); } catch (e) { /* abaikan */ } });
        return list;
    },
    recover(uid, badData) {   // kembalikan salinan sehat pertama, dan amankan data rusak untuk diperiksa nanti
        try { if (App.LocalStore) App.LocalStore.put('corrupt:' + uid, { at: new Date().toISOString(), data: badData }); } catch (e) { /* abaikan */ }
        return this.candidates(uid).find(c => problems(c.data).length === 0) || null;
    },
    // ---------- laporan ----------
    check() {
        const S = App.State, issues = [], tx = S.transactions || [];
        const cats = new Set([...(App.Config.DefaultCategories || []), ...(S.customCategories || [])].map(c => c.id));
        // 1) angka & tanggal tidak wajar
        const badTx = tx.filter(t => !t || !isDate(t.tanggal) || !num(t.pemasukan) || !num(t.pengeluaran) || (t.pemasukan || 0) < 0 || (t.pengeluaran || 0) < 0 || ((t.pemasukan || 0) > 0 && (t.pengeluaran || 0) > 0));
        if (badTx.length) issues.push({ id: 'badtx', level: 'warn', title: `${badTx.length} transaksi bertanggal/berangka tidak wajar`, detail: 'Tanggal rusak, angka bukan angka/minus, atau pemasukan dan pengeluaran terisi sekaligus. Periksa di Riwayat.', items: badTx.slice(0, 5).map(t => `${t && t.tanggal || '?'} · ${t && t.keterangan || '-'}`) });
        // 2) id kembar
        const seen = new Map(); tx.forEach(t => { if (t && t.id !== undefined) seen.set(t.id, (seen.get(t.id) || 0) + 1); });
        const dupIds = [...seen].filter(([, n]) => n > 1);
        if (dupIds.length) issues.push({ id: 'dupid', level: 'warn', title: `${dupIds.length} id transaksi kembar`, detail: 'Dua transaksi memakai id yang sama; mengedit/menghapus satu bisa mengenai yang lain.', fix: 'fixDupIds', fixLabel: 'Beri id baru' });
        // 3) transaksi mungkin ganda
        const groups = new Map(); tx.forEach((t, i) => { if (!t) return; const k = [t.tanggal, t.jenisAkun, t.subWallet || '', t.pemasukan || 0, t.pengeluaran || 0, t.kategori || '', (t.keterangan || '').trim().toLowerCase()].join('|'); (groups.get(k) || groups.set(k, []).get(k)).push(i); });
        const dups = [...groups.values()].filter(g => g.length > 1);
        const extra = dups.reduce((a, g) => a + g.length - 1, 0);
        if (extra) issues.push({ id: 'dups', level: 'warn', title: `${extra} transaksi mungkin ganda`, detail: 'Tanggal, akun, jumlah, kategori, dan keterangan sama persis. Bisa jadi memang beli dua kali; kalau ganda, pindahkan kelebihannya ke Sampah (masih bisa dipulihkan).', items: dups.slice(0, 5).map(g => { const t = tx[g[0]]; return `${g.length}× ${t.tanggal} · ${t.keterangan || '-'} · ${fmtN(t.pemasukan || t.pengeluaran || 0)}`; }), fix: 'fixDups', fixLabel: 'Pindahkan kelebihan ke Sampah' });
        // 4) saldo
        try {
            const b = App.UI.getBalances(), neg = [];
            if (b.cash < 0) neg.push('Cash ' + fmtN(b.cash)); Object.entries(b.sub).forEach(([k, v]) => { if (v < 0) neg.push(k + ' ' + fmtN(v)); });
            const diff = Math.abs(Object.values(b.sub).reduce((a, v) => a + v, 0) - b.saldo);
            if (neg.length) issues.push({ id: 'neg', level: 'warn', title: 'Saldo minus di ' + neg.length + ' dompet', detail: 'Biasanya karena ada pemasukan/transfer yang belum dicatat atau salah dompet.', items: neg });
            if (diff > 0.5) issues.push({ id: 'diff', level: 'warn', title: 'Total Saldo tidak sama dengan jumlah dompet', detail: 'Selisih ' + fmtN(diff) + '. Periksa transaksi dan transfer antar dompet.' });
        } catch (e) { /* abaikan */ }
        // 5) data yatim
        const orphanTx = tx.filter(t => t && t.kategori && !cats.has(t.kategori));
        if (orphanTx.length) issues.push({ id: 'orcat', level: 'info', title: `${orphanTx.length} transaksi dengan kategori yang sudah tidak ada`, detail: 'Kategori kustomnya terhapus. Transaksi tetap aman; ubah kategorinya di Riwayat bila perlu.', items: [...new Set(orphanTx.map(t => t.kategori))].slice(0, 5) });
        const orBud = (S.budgets || []).filter(x => x && x.category && !cats.has(x.category));
        if (orBud.length) issues.push({ id: 'orbud', level: 'info', title: `${orBud.length} budget untuk kategori yang sudah tidak ada`, detail: 'Budget ini tidak akan terpakai.' });
        const orRec = (S.recurring || []).filter(r => !r || !r.template);
        if (orRec.length) issues.push({ id: 'orrec', level: 'warn', title: `${orRec.length} transaksi otomatis tanpa templat`, detail: 'Tidak akan menghasilkan transaksi. Hapus di Setelan › Transaksi Otomatis.' });
        const w = window.AppModules && AppModules.has('wardrobe') ? AppModules.get('wardrobe') : null;
        if (w) {
            const ids = new Set((w.items || []).map(i => i.id)), badLog = Object.values(w.log || {}).reduce((a, d) => a + (d.items || []).filter(id => !ids.has(id)).length, 0);
            if (badLog) issues.push({ id: 'orlog', level: 'info', title: `${badLog} catatan pakaian untuk barang yang sudah dihapus`, detail: 'Tidak berbahaya, tapi bisa dibersihkan.', fix: 'fixWardrobeLog', fixLabel: 'Bersihkan' });
        }
        // 6) ukuran
        let bytes = 0; try { bytes = JSON.stringify(App.DB.getLocalMirror(uidNow() || '') || {}).length; } catch (e) { /* abaikan */ }
        const mb = bytes / 1048576;
        if (mb > 8) issues.push({ id: 'size', level: 'warn', title: `Data akun besar (${mb.toFixed(1)} MB)`, detail: 'Batas Firebase 16 MB per simpan. Kurangi foto Lemari/Makan atau hubungi saya untuk memecah penyimpanan.' });
        return { issues, tx: tx.length, mb };
    },
    // ---------- perbaikan (selalu snapshot dulu) ----------
    _safe(fn, msg) { if (App.Guard) App.Guard.snapshotNow(false); fn(); App.DB.save(); App.UI.renderAll(); this.render(); App.UI.showToast(msg, 'success'); },
    fixDups() {
        const S = App.State, seen = new Set(), keep = [], trash = [], now = new Date().toISOString();
        S.transactions.forEach(t => { if (!t) return; const k = [t.tanggal, t.jenisAkun, t.subWallet || '', t.pemasukan || 0, t.pengeluaran || 0, t.kategori || '', (t.keterangan || '').trim().toLowerCase()].join('|'); if (seen.has(k)) trash.push({ ...t, _deletedAt: now }); else { seen.add(k); keep.push(t); } });
        if (!trash.length) return;
        this._safe(() => { S.transactions = keep; S.trashedTransactions = [...(S.trashedTransactions || []), ...trash]; }, `${trash.length} transaksi ganda dipindah ke Sampah`);
    },
    fixDupIds() {
        const S = App.State, used = new Set(); let n = 0, next = Date.now();
        this._safe(() => { S.transactions.forEach(t => { if (!t) return; if (used.has(t.id)) { while (used.has(++next)); t.id = next; n++; } used.add(t.id); }); }, 'Id kembar diperbaiki');
    },
    fixWardrobeLog() {
        const w = AppModules.get('wardrobe'), ids = new Set(w.items.map(i => i.id));
        this._safe(() => { Object.keys(w.log).forEach(d => { w.log[d].items = (w.log[d].items || []).filter(id => ids.has(id)); if (!w.log[d].items.length) delete w.log[d]; }); AppModules.changed('wardrobe'); }, 'Catatan pakaian dibersihkan');
    },
    async storageInfo() { return App.LocalStore ? App.LocalStore.estimate() : null; },
    async render() {
        const el = document.getElementById('healthCard'); if (!el || !App.State.user) return;
        const open = el.querySelector('details') ? el.querySelector('details').open : false;
        const r = this.check(), est = await this.storageInfo(), mb = n => (n / 1048576).toFixed(1) + ' MB';
        el.innerHTML = `<details class="st-fold st-box"${open ? ' open' : ''}><summary><span class="font-bold">🩺 Kesehatan Data</span><small class="text-muted">${r.issues.length ? r.issues.length + ' temuan' : 'sehat'}</small></summary>
        <p class="text-xs text-muted" style="margin:.5rem 0;">${r.tx} transaksi · data akun ${r.mb.toFixed(2)} MB${est ? ` · penyimpanan perangkat ${mb(est.used)} dari ${mb(est.quota)}` : ''}</p>
        ${r.issues.length ? r.issues.map(i => `<div style="padding:.6rem .7rem; margin-bottom:.5rem; background:var(--bg-body); border-radius:var(--radius-md); border-left:3px solid ${i.level === 'warn' ? 'var(--warning, #f59e0b)' : 'var(--border-medium)'};"><div class="text-sm font-semibold">${i.level === 'warn' ? '⚠️' : 'ℹ️'} ${esc(i.title)}</div><div class="text-xs text-muted">${esc(i.detail || '')}</div>${(i.items || []).map(t => `<div class="text-xs">• ${esc(t)}</div>`).join('')}${i.fix ? `<button type="button" class="btn btn-sm btn-outline" style="margin-top:.4rem" data-health-fix="${i.fix}">${esc(i.fixLabel)}</button>` : ''}</div>`).join('') : '<p class="text-sm" style="padding:.4rem 0;">✅ Tidak ada masalah yang ditemukan.</p>'}
        <button type="button" class="btn btn-outline" data-health-act="refresh">🔄 Periksa ulang</button></details>`;
        if (!el._bound) { el._bound = true; el.addEventListener('click', async e => {
            const f = e.target.closest('[data-health-fix]'); if (f) { if (await App.UI.confirm('Snapshot dibuat dulu, lalu perbaikan dijalankan. Lanjutkan?')) this[f.dataset.healthFix](); return; }
            if (e.target.closest('[data-health-act="refresh"]')) this.render();
        }); }
    }
};

const hook = () => { if (!App.UI || !App.UI.switchTab || App.UI.__healthHooked) return; const o = App.UI.switchTab; App.UI.__healthHooked = true; App.UI.switchTab = function (id) { const r = o.apply(this, arguments); if (id === 'settings') setTimeout(() => App.Health.render(), 50); return r; }; };
document.addEventListener('DOMContentLoaded', () => setTimeout(hook, 0)); if (document.readyState !== 'loading') setTimeout(hook, 0);
