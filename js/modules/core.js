/* ==========================================================================
   MODUL TAMBAHAN — inti bersama
   - window.Mx          : helper umum (format, modal, gambar, kalender, dll.)
   - window.AppModules  : registry modul (Daily, Catatan Kuliah, Makan, Notes)
                          yang menyimpan data per-akun, sinkron ke Firebase lewat
                          App.DB.save() dan ikut backup/restore aplikasi utama.
   Data tersimpan di: users/{uid}/appData/modules/{daily|lecture|meal|notes}
   ========================================================================== */
(function () {
    'use strict';

    // ---------- Helper umum ----------
    const Mx = {};
    const pad = n => String(n).padStart(2, '0');
    Mx.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    Mx.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    Mx.iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    Mx.today = () => Mx.iso();
    Mx.nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    Mx.parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
    Mx.addDays = (s, n) => { const d = Mx.parse(s) || new Date(); d.setDate(d.getDate() + n); return Mx.iso(d); };
    Mx.weekStart = s => { const d = Mx.parse(s) || new Date(); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return Mx.iso(d); }; // Senin
    Mx.fmtDate = (s, opt) => { const d = Mx.parse(s); return d ? d.toLocaleDateString('id-ID', opt || { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
    Mx.fmtDateLong = s => Mx.fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    Mx.fmtDateTime = ts => { const d = new Date(ts); return isNaN(d) ? '—' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    Mx.fmtRp = n => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
    Mx.parseRp = v => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
    Mx.debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = (...a) => { clearTimeout(t); fn(...a); }; f.cancel = () => clearTimeout(t); return f; };
    Mx.clone = o => JSON.parse(JSON.stringify(o));
    Mx.byId = (arr, id) => (arr || []).find(x => String(x.id) === String(id));
    Mx.isUrl = s => /^https?:\/\/\S+$/i.test(String(s || '').trim());
    Mx.$ = (sel, root) => (root || document).querySelector(sel);
    Mx.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    Mx.toast = (msg, type = 'success') => {
        if (window.App && App.UI && App.UI.showToast) App.UI.showToast(Mx.esc(msg), type);
    };
    Mx.confirm = msg => (window.App && App.UI && App.UI.confirm) ? App.UI.confirm(msg) : Promise.resolve(window.confirm(msg));

    Mx.copy = async text => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
            else { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
            Mx.toast('Tersalin ke clipboard');
        } catch (e) { Mx.toast('Gagal menyalin', 'error'); }
    };
    Mx.download = (filename, text, mime = 'text/plain') => {
        const blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    Mx.readFileText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(file); });

    // Kompres gambar dari perangkat -> data URL JPEG (hemat database & localStorage)
    Mx.compressImage = (file, maxW = 720, quality = 0.7) => new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error('File bukan gambar'));
        const url = URL.createObjectURL(file); const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxW / img.width); const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
                let q = quality, out = c.toDataURL('image/jpeg', q);
                while (out.length > 140000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
                URL.revokeObjectURL(url); resolve(out);
            } catch (e) { URL.revokeObjectURL(url); reject(e); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
        img.src = url;
    });

    // Gambar hanya boleh http(s) atau data:image (cegah javascript: dsb.)
    Mx.safeImg = s => { s = String(s || '').trim(); return (/^https?:\/\//i.test(s) || /^data:image\/(jpeg|png|webp|gif);base64,/i.test(s)) ? s : ''; };

    // Input gambar: URL atau unggah dari perangkat. Mengembalikan HTML + binder.
    Mx.imageFieldHTML = (id, value) => `
        <div class="mx-imgfield" data-imgfield="${id}">
            <div class="mx-img169 mx-img-preview" ${Mx.safeImg(value) ? '' : 'hidden'}><img alt="Pratinjau" src="${Mx.esc(Mx.safeImg(value))}"></div>
            <input type="text" class="mx-input" data-img-url placeholder="Tempel URL gambar (https://…)" value="${Mx.esc(Mx.isUrl(value) ? value : '')}">
            <div class="mx-row"><label class="mx-btn mx-btn-sm">📷 Unggah foto<input type="file" accept="image/*" data-img-file hidden></label>
            <button type="button" class="mx-btn mx-btn-sm" data-img-clear>Hapus gambar</button><span class="mx-muted mx-xs" data-img-msg></span></div>
            <input type="hidden" data-img-value value="${Mx.esc(Mx.safeImg(value))}">
        </div>`;
    Mx.bindImageField = root => {
        const box = root.querySelector('[data-imgfield]'); if (!box) return () => '';
        const val = box.querySelector('[data-img-value]'), prev = box.querySelector('.mx-img-preview'), msg = box.querySelector('[data-img-msg]');
        const show = () => { const v = Mx.safeImg(val.value); prev.hidden = !v; prev.querySelector('img').src = v; };
        box.querySelector('[data-img-url]').addEventListener('input', e => {
            const v = e.target.value.trim(); msg.textContent = '';
            if (!v) { val.value = ''; } else if (Mx.isUrl(v)) { val.value = v; } else { msg.textContent = 'URL harus diawali http:// atau https://'; }
            show();
        });
        box.querySelector('[data-img-file]').addEventListener('change', async e => {
            const f = e.target.files[0]; if (!f) return; msg.textContent = 'Memproses…';
            try { val.value = await Mx.compressImage(f, 720); box.querySelector('[data-img-url]').value = ''; msg.textContent = 'Foto siap (dikompres)'; show(); }
            catch (err) { msg.textContent = err.message; }
            e.target.value = '';
        });
        box.querySelector('[data-img-clear]').addEventListener('click', () => { val.value = ''; box.querySelector('[data-img-url]').value = ''; msg.textContent = ''; show(); });
        return () => Mx.safeImg(val.value);
    };

    // Modal generik (memakai kelas .modal-overlay milik aplikasi utama)
    Mx.modal = ({ title, body, size = 520, onMount }) => {
        const ov = document.createElement('div'); ov.className = 'modal-overlay show mx-overlay'; ov.style.zIndex = 9000;
        ov.innerHTML = `<div class="modal-content mx-modal" style="max-width:${size}px" role="dialog" aria-modal="true">
            <div class="modal-header"><h3 class="font-bold">${Mx.esc(title)}</h3><button type="button" class="modal-close" data-mx-close aria-label="Tutup">✕</button></div>
            <div class="mx-modal-body">${body}</div></div>`;
        const onKey = e => { if (e.key === 'Escape' && ov === Mx.$$('.mx-overlay').pop()) close(); };
        const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
        ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
        ov.querySelector('[data-mx-close]').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(ov);
        const api = { el: ov, body: ov.querySelector('.mx-modal-body'), close };
        if (onMount) onMount(api);
        return api;
    };

    // Delegasi event: elemen pakai data-act="nama"; handler = acts[nama](el, event)
    Mx.delegate = (root, acts, extra = {}) => {
        root.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && root.contains(el) && acts[el.dataset.act]) acts[el.dataset.act](el, e); });
        ['input', 'change', 'keydown'].forEach(ev => root.addEventListener(ev, e => { const f = extra[ev]; if (f) f(e); }));
    };

    // Kalender bulanan. state={y,m}; marks={iso:jumlah}; sel=iso terpilih
    Mx.calHTML = (st, marks = {}, sel = '', mini = false) => {
        const first = new Date(st.y, st.m, 1), startWd = (first.getDay() + 6) % 7, days = new Date(st.y, st.m + 1, 0).getDate(), today = Mx.today();
        const title = first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        let cells = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<div class="mx-cal-h">${d}</div>`).join('');
        for (let i = 0; i < startWd; i++) cells += '<div></div>';
        for (let d = 1; d <= days; d++) {
            const iso = `${st.y}-${pad(st.m + 1)}-${pad(d)}`, n = marks[iso] || 0;
            cells += `<button type="button" class="mx-cal-d${iso === today ? ' is-today' : ''}${iso === sel ? ' is-sel' : ''}${n ? ' has' : ''}" data-act="cal-day" data-iso="${iso}" aria-label="${Mx.fmtDateLong(iso)}">${d}${n ? `<i>${mini ? '' : n}</i>` : ''}</button>`;
        }
        return `<div class="mx-cal${mini ? ' mini' : ''}"><div class="mx-cal-head"><button type="button" class="mx-btn mx-btn-sm" data-act="cal-prev" aria-label="Bulan sebelumnya">‹</button><b>${title}</b><button type="button" class="mx-btn mx-btn-sm" data-act="cal-next" aria-label="Bulan berikutnya">›</button></div><div class="mx-cal-grid">${cells}</div></div>`;
    };
    Mx.calShift = (st, delta) => { const d = new Date(st.y, st.m + delta, 1); st.y = d.getFullYear(); st.m = d.getMonth(); };

    Mx.empty = (icon, title, text = '') => `<div class="mx-empty"><div class="mx-empty-ico">${icon}</div><b>${Mx.esc(title)}</b>${text ? `<p>${Mx.esc(text)}</p>` : ''}</div>`;
    Mx.stars = (n, max = 5) => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, max - Math.round(n)));

    // Sanitizer HTML sederhana (whitelist) untuk konten Notes — data dari backup/cloud tidak dipercaya.
    const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'H1', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'A', 'HR', 'IMG', 'INPUT', 'SPAN', 'BLOCKQUOTE', 'S', 'CODE', 'PRE']);
    Mx.sanitizeHtml = html => {
        const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
        const walk = node => {
            Array.from(node.childNodes).forEach(ch => {
                if (ch.nodeType === 3) return;
                if (ch.nodeType !== 1) { ch.remove(); return; }
                if (!OK_TAGS.has(ch.tagName)) { if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(ch.tagName)) { ch.remove(); return; } walk(ch); ch.replaceWith(...Array.from(ch.childNodes)); return; }
                Array.from(ch.attributes).forEach(a => {
                    const n = a.name.toLowerCase();
                    const keep = (ch.tagName === 'A' && n === 'href') || (ch.tagName === 'IMG' && (n === 'src' || n === 'alt')) ||
                        (ch.tagName === 'INPUT' && (n === 'type' || n === 'checked')) || (n === 'class' && /^(nt-[\w-]+\s*)+$/.test(a.value));
                    if (!keep) ch.removeAttribute(a.name);
                });
                if (ch.tagName === 'A') { const h = ch.getAttribute('href') || ''; if (!/^(https?:|mailto:)/i.test(h)) ch.removeAttribute('href'); ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
                if (ch.tagName === 'IMG' && !Mx.safeImg(ch.getAttribute('src'))) { ch.remove(); return; }
                if (ch.tagName === 'INPUT') { if (ch.getAttribute('type') !== 'checkbox') { ch.remove(); return; } }
                walk(ch);
            });
        };
        walk(doc.body); return doc.body.innerHTML;
    };

    window.Mx = Mx;

    // ---------- Registry modul ----------
    const mods = {}, data = {}, viewToMod = {};
    let uid = null, lastLocalChange = 0, mounted = false;
    const LKEY = u => 'modules.v1.' + u;
    const toastQuota = Mx.debounce(() => Mx.toast('Penyimpanan browser penuh. Kurangi foto/lampiran atau gunakan URL gambar.', 'error'), 500);

    const persistLocal = () => {
        if (!uid) return;
        try { localStorage.setItem(LKEY(uid), JSON.stringify(data)); } catch (e) { console.warn('Simpan lokal modul gagal:', e); toastQuota(); }
    };
    const dbSave = Mx.debounce(() => { try { if (window.App && App.DB && App.State.user) App.DB.save(); } catch (e) { console.warn('Sync modul gagal (diabaikan):', e); } }, 600);

    const AppModules = {
        register(key, def) {
            mods[key] = def; data[key] = def.normalize(null);
            (def.views || []).forEach(v => { viewToMod[v] = key; });
        },
        get: key => data[key],
        has: key => !!mods[key],
        api: key => mods[key], // definisi modul (fungsi bantu publik, mis. todayItems)
        keys: () => Object.keys(mods),
        // Dipanggil modul setiap data berubah
        changed(key) { lastLocalChange = Date.now(); persistLocal(); dbSave(); if (mods[key] && mods[key].onChange) mods[key].onChange(); },
        setUser(u) {
            uid = u || null;
            let saved = null;
            if (uid) { try { saved = JSON.parse(localStorage.getItem(LKEY(uid)) || 'null'); } catch (e) { saved = null; } }
            Object.keys(mods).forEach(k => { data[k] = mods[k].normalize(saved && saved[k]); });
            this.refresh();
        },
        // Data dari akun (Firebase) / mirror lokal / restore backup
        apply(obj, { force = false } = {}) {
            if (!obj || typeof obj !== 'object') return;
            const skipEcho = !force && (Date.now() - lastLocalChange < 4000), changedKeys = [];
            Object.keys(mods).forEach(k => {
                if (!(k in obj)) return;
                if (!force && (skipEcho || (mods[k].isBusy && mods[k].isBusy()))) return; // jangan timpa ketikan yang sedang berjalan
                const next = mods[k].normalize(obj[k]);
                if (JSON.stringify(next) === JSON.stringify(data[k])) return;
                data[k] = next; changedKeys.push(k);
            });
            if (!changedKeys.length) return;
            persistLocal(); this.refresh(changedKeys);
        },
        collect() { return Mx.clone(data); },
        // Validasi struktur backup sebelum restore
        validate(obj) {
            const errors = [];
            if (obj == null) return { ok: true, errors };
            if (typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['Bagian "modules" tidak valid'] };
            Object.keys(obj).forEach(k => { if (mods[k] && mods[k].validate) mods[k].validate(obj[k]).forEach(e => errors.push(`${mods[k].label}: ${e}`)); });
            return { ok: errors.length === 0, errors };
        },
        // Simpan salinan data modul sebelum ditimpa restore (1 langkah undo)
        snapshotBeforeRestore() { if (uid) try { localStorage.setItem(LKEY(uid) + '.prev', JSON.stringify({ at: new Date().toISOString(), data })); } catch (e) { /* abaikan */ } },
        undoRestore() {
            if (!uid) return false;
            try { const p = JSON.parse(localStorage.getItem(LKEY(uid) + '.prev') || 'null'); if (!p) return false; this.apply(p.data, { force: true }); this.changed(Object.keys(mods)[0]); return true; } catch (e) { return false; }
        },
        // Dipanggil setelah data akun (Firebase) selesai diterapkan; modul boleh memigrasi data lama
        afterCloudLoad(cloud) { Object.keys(mods).forEach(k => { try { if (mods[k].afterLoad) mods[k].afterLoad(cloud); } catch (e) { console.error('Migrasi modul gagal:', k, e); } }); },
        refresh(keys) { (keys || Object.keys(mods)).forEach(k => { try { if (mods[k].refresh) mods[k].refresh(); } catch (e) { console.error('Render modul gagal:', k, e); } }); },
        onShow(viewId) { const k = viewToMod[viewId]; if (k && mods[k].show) { try { mods[k].show(viewId); } catch (e) { console.error('Tampil modul gagal:', k, e); } } },
        // Buat <main class="app-section" id="view-xxx"> untuk setiap view modul
        mount() {
            if (mounted) return; const anchor = document.getElementById('view-kuliah'); if (!anchor) return;
            Object.keys(mods).forEach(k => (mods[k].views || []).forEach(v => {
                if (document.getElementById('view-' + v)) return;
                const m = document.createElement('main'); m.className = 'app-section mx-view'; m.id = 'view-' + v; m.setAttribute('data-module', k);
                anchor.parentNode.appendChild(m);
            }));
            Object.keys(mods).forEach(k => { if (mods[k].init) mods[k].init(); });
            mounted = true;
        }
    };
    window.AppModules = AppModules;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => AppModules.mount(), 0)); else setTimeout(() => AppModules.mount(), 0);
})();
