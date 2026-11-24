import { App } from './core.js';

/* ==========================================================================
   Jembatan fitur Android (hanya aktif di APK; di web semua fungsi aman diabaikan):
   · App.Native.badge   — angka di ikon aplikasi (tugas hari ini + pakaian waktunya dicuci)
   · App.Native.widget  — kirim ringkasan data ke widget homescreen (dibaca native)
   · App.AutoBackup     — cadangan otomatis ke folder HP (Documents/BYgf), simpan 7 berkas terakhir
   · App.Updater        — cek versi APK terbaru di GitHub Releases
   · App.Native.link    — buka tab dari widget (bygf://tugas, bygf://catatan, ...)
   Semua plugin dimuat lewat native/plugins.js (Capacitor.Plugins.*).
   ========================================================================== */
const P = name => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[name]) || null;
const isNative = () => !!(window.Capacitor && (Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : (Capacitor.getPlatform && Capacitor.getPlatform() !== 'web')));
const mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null;
const api = k => (window.AppModules && AppModules.api) ? AppModules.api(k) : null;
const iso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } };
const ymd = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : '';

/* ---------- ringkasan untuk badge & widget ---------- */
function openTasks() {   // tugas harian + tugas kuliah yang belum selesai, diurutkan tanggal
    const today = iso(), out = [];
    const d = mod('daily'); ((d && d.tasks) || []).forEach(t => { if (!t.done && t.title) out.push({ t: t.title, due: t.date || '', time: t.time || '' }); });
    try { ((window.KuliahPro && KuliahPro.getTasks) ? KuliahPro.getTasks() : []).forEach(t => { if (!t.done && t.judul) out.push({ t: t.judul + (t.matkul ? ' · ' + t.matkul : ''), due: ymd(t.deadline), time: '' }); }); } catch (e) { /* abaikan */ }
    out.sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : (a.time || '').localeCompare(b.time || ''));
    return { all: out, due: out.filter(x => x.due && x.due <= today) };
}
function badgeCount() {
    if (App.State.isAdmin) return 0;
    const t = openTasks().due.length, w = api('wardrobe') && api('wardrobe').summary ? api('wardrobe').summary().dirty.length : 0;
    return t + w;
}
function widgetData() {
    const S = App.State; if (!S.user || S.isAdmin) return { v: 1, at: Date.now(), none: true };
    const tk = openTasks(), b = App.UI.getBalances ? App.UI.getBalances() : { cash: 0, saldo: 0 };
    let classes = []; try { classes = (window.KuliahPro && KuliahPro.upcomingClasses) ? KuliahPro.upcomingClasses(4).map(c => ({ d: c.dateISO, s: c.jamMulai, e: c.jamSelesai || '', n: c.nama, r: c.lokasi || '' })) : []; } catch (e) { /* abaikan */ }
    const w = api('wardrobe') && api('wardrobe').summary ? api('wardrobe').summary() : { today: [], dirty: [] };
    return {
        v: 1, at: Date.now(), today: iso(),
        tasks: tk.all.slice(0, 8).map(x => ({ t: x.t, d: x.due, h: x.time })), tasksDue: tk.due.length, tasksTotal: tk.all.length,
        balance: { total: Math.round(b.cash + b.saldo), cash: Math.round(b.cash), saldo: Math.round(b.saldo) },
        classes: classes.slice(0, 24), wear: { today: w.today.slice(0, 6), dirty: w.dirty.slice(0, 6), dirtyN: w.dirty.length }
    };
}

App.Native = {
    isNative, badgeCount, widgetData,
    _t: null,
    refresh(delay) {   // dipanggil tiap data tersimpan/berubah (ditunda agar ringan)
        if (!isNative()) return; clearTimeout(this._t);
        this._t = setTimeout(() => { this.pushBadge(); this.pushWidget(); }, delay === undefined ? 1200 : delay);
    },
    async pushBadge() {
        const B = P('Badge'); if (!B) return;
        try { const n = badgeCount(); if (n > 0) { const perm = await B.checkPermissions(); if (perm.display !== 'granted') await B.requestPermissions(); await B.set({ count: n }); } else await B.clear(); } catch (e) { console.warn('Badge gagal:', e); }
    },
    async pushWidget() {
        const W = P('BygfNative'); if (!W || !W.setWidgetData) return;
        try { await W.setWidgetData({ json: JSON.stringify(widgetData()) }); } catch (e) { console.warn('Widget gagal:', e); }
    },
    // simpan teks sebagai berkas (APK: Documents/BYgf lalu cadangan folder aplikasi); mengembalikan lokasi
    async saveFile(name, text) {
        const F = P('Filesystem'); if (!isNative() || !F) throw new Error('hanya di aplikasi Android');
        let lastErr = '';
        for (const directory of ['DOCUMENTS', 'EXTERNAL']) {
            try { await F.writeFile({ path: `${AB.dir}/${name}`, data: text, directory, encoding: 'utf8', recursive: true }); return directory === 'DOCUMENTS' ? 'Documents/' + AB.dir : 'Android/data/com.gftwo.bygf/files/' + AB.dir; }
            catch (e) { lastErr = String(e && e.message || e); }
        }
        throw new Error(lastErr || 'gagal menulis berkas');
    },
    // tautan dari widget: bygf://tugas | kuliah | saldo | lemari | catatan
    open(url) {
        const m = /^bygf:\/\/([a-z]+)/i.exec(String(url || '')); if (!m || !App.State.user || App.State.isAdmin) return;
        const map = { tugas: ['daily'], kuliah: ['kuliah'], saldo: ['keuangan'], lemari: ['lemari'], catatan: ['notes'] }, t = map[m[1].toLowerCase()]; if (t) App.UI.switchMainGroup(t[0]);
    },
    bind() {
        if (!isNative() || this._bound) return; this._bound = true;
        const A = P('App');
        if (A) {
            A.addListener('appUrlOpen', ev => this.open(ev && ev.url));
            A.addListener('appStateChange', st => { if (st && st.isActive) { this.refresh(300); if (App.Notify) App.Notify.reschedule(600); } });
            A.getLaunchUrl && A.getLaunchUrl().then(r => { if (r && r.url) setTimeout(() => this.open(r.url), 800); }).catch(() => {});
        }
        this.refresh(2000);
    }
};

/* ---------- cadangan otomatis ke folder HP ---------- */
const AB = { key: 'bygf.autoBackup', dir: 'BYgf', keep: 7 };
App.AutoBackup = {
    prefs() { return Object.assign({ on: true, last: '', lastName: '', where: '', err: '' }, read(AB.key, {})); },
    _save(p) { write(AB.key, p); },
    setOn(on) { const p = this.prefs(); p.on = !!on; this._save(p); this.renderCard(); if (on) this.run(false); },
    _json() { try { return App.Handlers.buildBackup ? App.Handlers.buildBackup() : null; } catch (e) { return null; } },
    async run(manual) {
        const p = this.prefs(), F = P('Filesystem'); if (App.State.isAdmin || !App.State.user) return false;
        if (!isNative() || !F) { if (manual) App.UI.showToast('Cadangan ke folder hanya ada di aplikasi Android', 'info'); return false; }
        if (!manual && (!p.on || p.last === iso())) return false;   // otomatis: maksimal sekali per hari
        const text = this._json(); if (!text) { if (manual) App.UI.showToast('Belum ada data untuk dicadangkan', 'error'); return false; }
        const name = `BYgf-backup-${iso()}.json`; let where = '', lastErr = '';
        try { const perm = await F.checkPermissions(); if (perm.publicStorage && perm.publicStorage !== 'granted') await F.requestPermissions(); } catch (e) { /* izin tidak wajib di Android 10+ */ }
        for (const directory of ['DOCUMENTS', 'EXTERNAL']) {
            try { await F.writeFile({ path: `${AB.dir}/${name}`, data: text, directory, encoding: 'utf8', recursive: true }); where = directory === 'DOCUMENTS' ? 'Documents/' + AB.dir : 'Android/data/com.gftwo.bygf/files/' + AB.dir; await this._prune(F, directory); break; }
            catch (e) { lastErr = String(e && e.message || e); }
        }
        if (!where) { this._save({ ...p, err: lastErr || 'gagal menulis berkas' }); if (manual) App.UI.showToast('Gagal menulis ke folder HP: ' + (lastErr || 'tidak diketahui'), 'error'); this.renderCard(); return false; }
        this._save({ ...p, last: iso(), lastName: name, where, err: '' }); if (App.Guard) App.Guard.markBackup();
        if (manual) App.UI.showToast('Cadangan tersimpan di ' + where, 'success'); this.renderCard(); return true;
    },
    async _prune(F, directory) {   // simpan 7 berkas terbaru, hapus yang lama
        try {
            const r = await F.readdir({ path: AB.dir, directory });
            const files = (r.files || []).map(f => typeof f === 'string' ? f : f.name).filter(n => /^BYgf-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse();
            for (const n of files.slice(AB.keep)) await F.deleteFile({ path: `${AB.dir}/${n}`, directory });
        } catch (e) { /* pembersihan tidak kritis */ }
    },
    onLoaded() { if (isNative()) setTimeout(() => this.run(false), 6000); this.renderCard(); },
    renderCard() {
        const el = document.getElementById('autoBackupCard'); if (!el) return;
        if (!isNative()) { el.innerHTML = ''; return; }
        const p = this.prefs(), when = p.last ? new Date(p.last + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'belum pernah';
        el.innerHTML = `<h4 class="st-sub">📁 Cadangan otomatis ke folder HP</h4>
        <label class="nt-sw" style="display:flex; gap:.5rem; align-items:center; margin-bottom:.5rem;"><input type="checkbox" id="abOn" ${p.on ? 'checked' : ''}><span>Simpan cadangan tiap hari ke folder ${AB.dir}</span></label>
        <p class="text-xs text-muted" style="margin-bottom:.6rem;">Terakhir: <b>${when}</b>${p.where ? ' · ' + p.where : ''}. ${AB.keep} berkas terbaru disimpan. ${p.err ? '<br>⚠️ ' + String(p.err).replace(/[<>&]/g, '') : ''}</p>
        <button type="button" class="btn btn-outline" id="abNow">📁 Cadangkan ke folder sekarang</button>`;
        const on = el.querySelector('#abOn'), now = el.querySelector('#abNow'); on.onchange = () => this.setOn(on.checked); now.onclick = async () => { now.disabled = true; await this.run(true); now.disabled = false; };
    }
};

/* ---------- cek pembaruan APK ---------- */
const REPO = 'gftwo/bygf', UP = { key: 'bygf.updateCheck' };
const verNum = v => String(v || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
App.Updater = {
    current() { return (App.Config && App.Config.Changelog && App.Config.Changelog[0] && App.Config.Changelog[0].version) || ''; },
    async check(manual) {
        const last = read(UP.key, {});
        if (!manual && last.at && Date.now() - last.at < 21600000) return last.result || null;   // otomatis: maksimal 6 jam sekali
        if (navigator.onLine === false) { if (manual) App.UI.showToast('Kamu sedang offline', 'info'); return null; }
        try {
            const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
            if (r.status === 404) { write(UP.key, { at: Date.now(), result: null }); if (manual) App.UI.showToast('Belum ada rilis APK di GitHub', 'info'); return null; }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json(), tag = j.tag_name || j.name || '', asset = (j.assets || []).find(a => /\.apk$/i.test(a.name || '')), cur = this.current();
            const res = { tag, url: asset ? asset.browser_download_url : (j.html_url || ''), page: j.html_url || '', notes: String(j.body || '').slice(0, 400), has: !!tag && newer(tag, cur) };
            write(UP.key, { at: Date.now(), result: res });
            if (manual) App.UI.showToast(res.has ? 'Versi baru tersedia: ' + tag : 'Kamu sudah di versi terbaru (' + (cur || '-') + ')', res.has ? 'success' : 'info');
            return res;
        } catch (e) { console.warn('Cek pembaruan gagal:', e); if (manual) App.UI.showToast('Gagal mengecek pembaruan', 'error'); return null; }
    },
    async renderCard(manual) {
        const el = document.getElementById('updateCard'); if (!el) return; if (!isNative()) { el.innerHTML = ''; return; }
        const r = manual ? await this.check(true) : read(UP.key, {}).result, cur = this.current();
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        el.innerHTML = `<h4 class="st-sub">⬆️ Pembaruan aplikasi</h4><p class="text-xs text-muted" style="margin-bottom:.6rem;">Versi terpasang: <b>${esc(cur || '-')}</b>${r && r.has ? ` · tersedia: <b>${esc(r.tag)}</b>` : ''}</p>
        ${r && r.has && /^https:\/\/github\.com\//.test(r.url) ? `<a class="btn btn-primary" href="${esc(r.url)}" target="_blank" rel="noopener" style="display:block; text-align:center; margin-bottom:.5rem;">⬇️ Unduh ${esc(r.tag)}</a>` : ''}
        <button type="button" class="btn btn-outline" id="upChk">🔄 Cek pembaruan</button>`;
        el.querySelector('#upChk').onclick = () => this.renderCard(true);
    },
    async onLoaded() {
        this.renderCard(false); if (App.State.isAdmin || !isNative()) return;
        const r = await this.check(false); if (r && r.has && read('bygf.updateNudge', '') !== r.tag) { write('bygf.updateNudge', r.tag); App.UI.showToast('Versi baru tersedia: ' + r.tag + ' — lihat di Setelan', 'info'); }
    }
};

// pasang pada siklus aplikasi: setelah data akun termuat, dan tiap data tersimpan
const hook = () => {
    if (!App.DB || App.DB.__nativeHooked) return false; App.DB.__nativeHooked = true;
    const orig = App.DB.save; App.DB.save = function (...a) { const r = orig.apply(this, a); App.Native.refresh(); return r; };
    const tab = App.UI && App.UI.switchTab; if (tab && !App.UI.__nativeTabHooked) { App.UI.__nativeTabHooked = true; App.UI.switchTab = function (id) { const r = tab.apply(this, arguments); if (id === 'settings') { App.AutoBackup.renderCard(); App.Updater.renderCard(false); } return r; }; }
    return true;
};
App.Native.onLoaded = function () { hook(); this.bind(); App.AutoBackup.onLoaded(); App.Updater.onLoaded(); this.refresh(1500); };
document.addEventListener('DOMContentLoaded', () => setTimeout(hook, 0));
