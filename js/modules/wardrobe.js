/* ==========================================================================
   MODUL LEMARI — isi lemari, pakaian hari ini, tingkat kotor / cuci, riwayat pemakaian
   Data: AppModules 'wardrobe' = { v, cats, items, log }
   - cats : { id, name, emoji, washable, limit }   limit = batas tetap N kali pakai (null = ikut jumlah matkul)
   - items: { id, name, cat, photo, washedOn, created }
   - log  : { 'YYYY-MM-DD': { items: [id], matkul, saved } }   catatan pakaian per hari
   - outfits: { id, name, o:{top,inner,bottom,shoes,neck,open}, created }   outfit tersimpan (sub-tab Padu Padan)
   - seedDone: true setelah 27 pakaian bawaan (foto di icons/lemari/) diimpor
   - items[].pp (opsional) = { kind, open, w, h }: foto potongan (latar transparan) yang bisa dipakai di Padu Padan
   Aturan cuci (skala 30): tiap pemakaian menambah beban lalu "waktunya dicuci" di 30.
   - Kategori ber-limit (mis. Bawahan, Kaos = 5×): beban = 30 / limit, jumlah matkul diabaikan.
   - Kategori tanpa limit: 0–1 matkul → batas 3× (beban 10), 2+ matkul → batas 2× (beban 15).
   Jumlah matkul per hari diambil dari jadwal Kuliah (KuliahPro.classCount), bisa diubah manual.
   Foto dikompres kecil (480px) karena seluruh data akun disimpan sebagai satu blob di Firebase.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'wardrobe';
    const THRESH = 30;          // batas "waktunya dicuci"
    const DAYS_UNUSED = 14;     // barang dianggap lama tidak dipakai
    const PHOTO_W = 480, PHOTO_Q = 0.6;
    const PP_KINDS = ['kemeja', 'jaket', 'polo', 'kaos', 'celana', 'sepatu', 'kalung'];
    const KIND_LABEL = { kemeja: 'Kemeja', jaket: 'Jaket', polo: 'Polo', kaos: 'Kaos', celana: 'Celana', sepatu: 'Sepatu', kalung: 'Kalung' };
    const KIND_CAT = { kemeja: 'atasan', jaket: 'atasan', polo: 'atasan', kaos: 'kaos', celana: 'bawahan', sepatu: 'sepatu', kalung: 'aksesori' };
    const MAX_OUTFITS = 40;
    // Pakaian bawaan dari foto pemilik: [no, nama (bisa diubah lewat Ubah), jenis, buka, lebar, tinggi]
    const SEED = [[1, "Batik cokelat lengan panjang", "kemeja", "kancing", 560, 455], [2, "Kemeja garis cokelat tua", "kemeja", "kancing", 560, 420], [3, "Kemeja putih polos lengan panjang", "kemeja", "kancing", 545, 560], [4, "Kemeja krem kerah hitam (zip)", "kemeja", "zip", 509, 487], [5, "Kemeja krem garis lengan pendek", "kemeja", "kancing", 560, 498], [6, "Kaos abu-krem polos", "kaos", "", 560, 461], [7, "Kemeja denim hitam lengan panjang", "kemeja", "kancing", 560, 448], [8, "Kemeja khaki lengan panjang", "kemeja", "kancing", 453, 472], [9, "Kemeja navy lengan pendek (zip)", "kemeja", "zip", 554, 474], [10, "Polo zip hitam", "polo", "", 493, 468], [11, "Kemeja abu tua lengan pendek", "kemeja", "kancing", 481, 471], [12, "Kemeja PDL krem", "kemeja", "kancing", 520, 496], [13, "Batik biru-krem lengan panjang", "kemeja", "kancing", 418, 560], [14, "Jaket korduroi cokelat (zip)", "jaket", "zip", 560, 385], [15, "Hoodie zip hitam", "jaket", "zip", 560, 333], [16, "Kaos hitam polos", "kaos", "", 560, 441], [17, "Kaos hitam sablon Cultural", "kaos", "", 560, 419], [18, "Kaos navy PBAK 2026", "kaos", "", 519, 483], [19, "Kaos putih polos", "kaos", "", 488, 490], [21, "Celana training abu muda", "celana", "", 257, 503], [22, "Celana training hitam list putih", "celana", "", 272, 501], [23, "Jogger hitam tali putih", "celana", "", 214, 478], [24, "Jeans biru muda", "celana", "", 218, 501], [25, "Celana cargo khaki", "celana", "", 247, 560], [26, "Celana bahan hitam", "celana", "", 197, 489], [27, "Celana training abu-oranye", "celana", "", 233, 464], [28, "Jeans hitam washed", "celana", "", 235, 504]];
    const DATA_VERSION = 2;
    const { esc, uid, today, addDays, parse, byId } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
    const fmtShort = s => Mx.fmtDate(s, { day: 'numeric', month: 'short' });
    const fmtDay = s => Mx.fmtDate(s, { weekday: 'short', day: 'numeric', month: 'short' });

    const DEFAULT_CATS = () => [
        { id: 'atasan', name: 'Atasan', emoji: '👕', washable: true, limit: null },
        { id: 'bawahan', name: 'Bawahan', emoji: '👖', washable: true, limit: 5 },
        { id: 'kaos', name: 'Kaos', emoji: '🎽', washable: true, limit: 5 },
        { id: 'sepatu', name: 'Sepatu', emoji: '👟', washable: false, limit: null },
        { id: 'aksesori', name: 'Aksesori', emoji: '📿', washable: false, limit: null }
    ];
    const cleanLimit = v => { const n = parseInt(v, 10); return n >= 1 ? Math.min(30, n) : null; };

    function cleanPP(p) {
        if (!p || typeof p !== 'object' || !PP_KINDS.includes(p.kind)) return null;
        const w = Number(p.w), h = Number(p.h); if (!(w > 0 && h > 0)) return null;
        return { kind: p.kind, open: p.open === 'kancing' || p.open === 'zip' ? p.open : '', w: Math.round(w), h: Math.round(h) };
    }

    // ---------- normalisasi & validasi (data lama tetap terbaca) ----------
    function normalize(raw) {
        raw = raw && typeof raw === 'object' ? raw : {};
        let cats = arr(raw.cats).filter(c => c && c.id && c.name).map(c => ({ id: String(c.id), name: String(c.name).slice(0, 24), emoji: String(c.emoji || '🏷️').slice(0, 4), washable: !!c.washable, limit: cleanLimit(c.limit) }));
        if (!cats.length) cats = DEFAULT_CATS();
        else if ((Number(raw.v) || 1) < DATA_VERSION) { // v2: Bawahan & Kaos batas tetap 5× (sekali saja; data lama tidak hilang)
            const bw = cats.find(c => c.id === 'bawahan'); if (bw && bw.limit == null) bw.limit = 5;
            if (!cats.some(c => c.id === 'kaos')) cats.splice(Math.max(0, cats.findIndex(c => c.id === 'bawahan')), 0, { id: 'kaos', name: 'Kaos', emoji: '🎽', washable: true, limit: 5 });
        }
        const seen = new Set();
        const items = arr(raw.items).filter(i => i && i.id && i.name && !seen.has(String(i.id)) && seen.add(String(i.id)))
            .map(i => { const o = { id: String(i.id), name: String(i.name).slice(0, 60), cat: String(i.cat || cats[0].id), photo: Mx.safeImg(i.photo), washedOn: isoOk(i.washedOn) ? i.washedOn : '', created: isoOk(i.created) ? i.created : today() }; const pp = cleanPP(i.pp); if (pp && o.photo) o.pp = pp; return o; });
        const ids = new Set(items.map(i => i.id)), SLOT_IDS = ['top', 'inner', 'bottom', 'shoes', 'neck'];
        const outfits = arr(raw.outfits).filter(f => f && f.id && f.o && typeof f.o === 'object').slice(0, MAX_OUTFITS).map(f => {
            const o = { open: !!f.o.open }; SLOT_IDS.forEach(k => { o[k] = f.o[k] && ids.has(String(f.o[k])) ? String(f.o[k]) : null; });
            return { id: String(f.id), name: String(f.name || 'Outfit').slice(0, 40), o, created: String(f.created || '') };
        }).filter(f => SLOT_IDS.some(k => f.o[k]));
        const log = {};
        if (raw.log && typeof raw.log === 'object' && !Array.isArray(raw.log)) {
            Object.keys(raw.log).forEach(d => {
                const e = raw.log[d]; if (!isoOk(d) || !e) return;
                const ids = arr(e.items).map(String).filter((x, k, a) => x && a.indexOf(x) === k);
                if (ids.length) log[d] = { items: ids, matkul: Math.max(0, Math.min(8, Math.round(Number(e.matkul) || 0))), saved: String(e.saved || '') };
            });
        }
        return { v: DATA_VERSION, cats, items, log, outfits, seedDone: !!raw.seedDone };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; ['cats', 'items', 'log'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        arr(raw.items).forEach((i, n) => { if (!i || typeof i !== 'object' || !i.name) e.push(`barang #${n + 1} tidak punya nama`); });
        return e.slice(0, 5);
    }

    // ---------- logika cuci (murni, mudah diuji) ----------
    const catOf = id => D().cats.find(c => c.id === id) || { id, name: 'Lainnya', emoji: '🏷️', washable: false, limit: null };
    const effMatkul = n => (n >= 2 ? 2 : 1);
    const matkulLoad = n => (effMatkul(n) === 1 ? 10 : 15);
    const wearLoad = (it, matkul) => { const l = catOf(it.cat).limit; return l ? THRESH / l : matkulLoad(matkul); };
    const almostAt = it => { const l = catOf(it.cat).limit; return THRESH - (l ? THRESH / l : 10); };
    function itemLoad(it) {
        const S = D(), since = it.washedOn || ''; let s = 0;
        Object.keys(S.log).forEach(d => { const e = S.log[d]; if (d > since && e.items.includes(it.id)) s += wearLoad(it, e.matkul); });
        return s;
    }
    const needsWash = it => catOf(it.cat).washable && itemLoad(it) >= THRESH;
    const isAlmost = it => { const l = itemLoad(it); return catOf(it.cat).washable && l >= almostAt(it) && l < THRESH; };
    const wornDates = id => Object.keys(D().log).filter(d => D().log[d].items.includes(id)).sort().reverse();
    const lastWorn = id => wornDates(id)[0] || '';
    const wearCount = (id, since) => wornDates(id).filter(d => !since || d >= since).length;
    function pairedWith(id, limit = 3) {
        const S = D(), c = {};
        Object.keys(S.log).forEach(d => { const e = S.log[d]; if (!e.items.includes(id)) return; e.items.forEach(o => { if (o !== id && byId(S.items, o)) c[o] = (c[o] || 0) + 1; }); });
        return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([pid, n]) => ({ id: pid, n }));
    }
    function toggleWorn(date, id, matkul) { // true bila kini tercatat dipakai
        const S = D(), e = S.log[date];
        if (e && e.items.includes(id)) { e.items = e.items.filter(x => x !== id); if (!e.items.length) delete S.log[date]; return false; }
        if (e) e.items.push(id); else S.log[date] = { items: [id], matkul, saved: new Date().toISOString() };
        return true;
    }
    function unusedItems() {
        const t = today();
        return D().items.map(it => { const lw = lastWorn(it.id); return { it, lw, days: lw ? daysBetween(lw, t) : null }; })
            .filter(x => !x.lw || x.days >= DAYS_UNUSED).sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
    }
    function outfitSuggestions() {
        const S = D(), map = {};
        Object.keys(S.log).forEach(d => {
            const ids = S.log[d].items.filter(id => byId(S.items, id)).sort(); if (ids.length < 2) return;
            const k = ids.join('|'); (map[k] = map[k] || { ids, dates: [] }).dates.push(d);
        });
        return Object.values(map).filter(o => o.dates.length >= 2).map(o => ({ ids: o.ids, n: o.dates.length, last: o.dates.slice().sort().pop() }))
            .sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));
    }
    const autoMatkul = date => (window.KuliahPro && KuliahPro.classCount) ? KuliahPro.classCount(date) : 0;

    // ---------- state tampilan ----------
    const VIEWS = { 'lm-lemari': renderLemari, 'lm-padu': renderPadu, 'lm-hari': renderHari, 'lm-cuci': renderCuci, 'lm-riwayat': renderRiwayat };
    const ui = { q: '', cat: '', sort: '', date: today(), sel: new Set(), manual: 'auto', dayLoaded: '' };
    let current = 'lm-lemari', detail = null;
    const rerender = () => { const f = VIEWS[current]; if (f && root(current)) f(); updateBadge(); };

    function updateBadge() {
        const n = D().items.filter(needsWash).length, b = document.getElementById('lmNavBadge');
        if (b) { b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('show', n > 0); }
    }
    const thumb = it => it.photo ? `<img loading="lazy" decoding="async" alt="" src="${esc(it.photo)}">` : catOf(it.cat).emoji;
    const itemById = id => byId(D().items, id);
    const washBanner = () => { const n = D().items.filter(needsWash).length; return n && current !== 'lm-cuci' ? `<div class="lm-banner" role="status">🧺 ${n} pakaian waktunya dicuci<button type="button" class="mx-btn mx-btn-sm" data-act="goto-cuci">Lihat</button></div>` : ''; };

    function itemCard(it, mode) { // mode: 'view' | 'pick'
        const c = catOf(it.cat), wash = c.washable, ld = itemLoad(it);
        const tag = wash && ld >= THRESH ? '<span class="lm-tag">Cuci</span>' : wash && ld >= almostAt(it) ? '<span class="lm-tag w">Hampir</span>' : '';
        const picked = mode === 'pick' && ui.sel.has(it.id), worn = !!(D().log[today()] || { items: [] }).items.includes(it.id);
        const act = mode === 'pick' ? 'toggle' : 'detail';
        return `<div class="lm-it${picked ? ' sel' : ''}" role="button" tabindex="0" ${mode === 'pick' ? `aria-pressed="${picked}"` : ''} data-act="${act}" data-id="${esc(it.id)}">
            <div class="lm-ph">${thumb(it)}</div>${tag}${picked ? '<span class="lm-tick">✓</span>' : ''}
            <div class="lm-nm">${esc(it.name)}</div><div class="lm-mt">${esc(c.name)}</div>
            ${mode === 'view' ? `<button type="button" class="lm-qk${worn ? ' on' : ''}" data-act="usetoday" data-id="${esc(it.id)}" title="${worn ? 'Batal dipakai hari ini' : 'Pakai hari ini'}" aria-label="${worn ? 'Batal dipakai hari ini' : 'Pakai hari ini'}">${worn ? '✓' : '👚'}</button>` : ''}</div>`;
    }

    // ---------- Cek Lemari ----------
    function renderLemari() {
        const r = root('lm-lemari'), S = D();
        const chips = `<button type="button" class="mx-chip${ui.cat ? '' : ' on'}" data-act="cat" data-c="">Semua (${S.items.length})</button>` + S.cats.map(c => `<button type="button" class="mx-chip${ui.cat === c.id ? ' on' : ''}" data-act="cat" data-c="${esc(c.id)}">${c.emoji} ${esc(c.name)} (${S.items.filter(i => i.cat === c.id).length})</button>`).join('');
        const sorts = [['', 'Urutan input'], ['nama', 'Nama A–Z'], ['sering', 'Paling sering dipakai'], ['kotor', 'Paling kotor'], ['lama', 'Paling lama tak dipakai']];
        r.innerHTML = `<div class="mx-head"><div><h2>Lemari</h2></div><div class="mx-row"><button type="button" class="mx-btn mx-btn-sm" data-act="cats">🏷️ Kategori</button><button type="button" class="mx-btn mx-btn-primary" data-act="add">＋ Tambah barang</button></div></div>
        ${seedBanner()}<div id="lmBanner">${washBanner()}</div>
        <div class="mx-card"><input id="lmQ" type="search" class="mx-input" placeholder="🔍 Cari nama barang…" aria-label="Cari barang" value="${esc(ui.q)}">
        <div class="mx-chips lm-chips">${chips}</div>
        <div class="lm-sort"><label for="lmSort" class="mx-muted mx-xs">Urutkan</label><select id="lmSort" class="mx-input">${sorts.map(([v, l]) => `<option value="${v}"${ui.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div id="lmGrid"></div>`;
        renderGrid();
    }
    function renderGrid() {
        const box = document.getElementById('lmGrid'); if (!box) return;
        const S = D(), q = ui.q.trim().toLowerCase();
        const list = S.items.filter(i => (!ui.cat || i.cat === ui.cat) && (!q || i.name.toLowerCase().includes(q)));
        const cmp = { nama: (a, b) => a.name.localeCompare(b.name, 'id'), sering: (a, b) => wearCount(b.id) - wearCount(a.id), kotor: (a, b) => itemLoad(b) - itemLoad(a), lama: (a, b) => lastWorn(a.id).localeCompare(lastWorn(b.id)) }[ui.sort];
        if (cmp) list.sort(cmp);
        box.innerHTML = list.length ? `<div class="lm-grid">${list.map(i => itemCard(i, 'view')).join('')}</div><p class="mx-muted mx-xs lm-hint">Ketuk barang untuk detail · tombol 👚 di pojok = pakai hari ini</p>`
            : Mx.empty('👗', S.items.length ? 'Tidak ada yang cocok' : 'Lemari masih kosong', S.items.length ? '' : 'Tekan "Tambah barang" untuk mulai mengisi lemari.');
    }


    // ---------- Padu Padan (cek outfit di boneka) ----------
    const PD = { R: 1.72, TOP_Y: 11, TOP_H: 35, BOT_Y: 36, BOT_H: 52, SHOE_Y: 90, SHOE_H: 9, MAXW: 97 };   // persen dari kotak boneka; R = tinggi/lebar kotak
    const PD_SLOTS = [
        { id: 'top', label: 'Atasan', kinds: ['kemeja', 'jaket', 'polo', 'kaos'] },
        { id: 'inner', label: 'Dalaman', kinds: ['kaos'] },
        { id: 'bottom', label: 'Bawahan', kinds: ['celana'] },
        { id: 'shoes', label: 'Sepatu', kinds: ['sepatu'] },
        { id: 'neck', label: 'Kalung', kinds: ['kalung'] }
    ];
    const SLOT_KEYS = PD_SLOTS.map(s => s.id);
    const pd = { o: { top: null, inner: null, bottom: null, shoes: null, neck: null, open: false }, slot: 'top', kind: 'all', naming: false };
    const ppItems = () => D().items.filter(i => i.pp && i.photo);
    const ppById = id => { const it = id && itemById(id); return it && it.pp && it.photo ? it : null; };
    const canOpen = it => !!(it && it.pp.open);
    function pdFit(it, hPct) {
        const ar = it.pp.w / it.pp.h; let h = hPct, w = h * ar * PD.R;
        if (w > PD.MAXW) { w = PD.MAXW; h = w / PD.R / ar; }
        return { w, h };
    }
    const pdLayer = (cls, it, y, w, h) => `<div class="pd-layer ${cls}" style="top:${y}%;width:${w}%;height:${h}%"><img alt="" src="${esc(it.photo)}"></div>`;
    const PD_MANQ = `<svg class="pd-manq" viewBox="0 0 100 172" aria-hidden="true"><ellipse cx="50" cy="6.4" rx="5.4" ry="6.4"/><rect x="47" y="11" width="6" height="8" rx="3"/><path d="M31 21 Q50 15 69 21 L67 64 Q50 68 33 64 Z" stroke-width="2" stroke-linejoin="round"/><path d="M42 66 L41 150" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M58 66 L59 150" stroke-width="11" stroke-linecap="round" fill="none"/><ellipse cx="41" cy="162" rx="6.5" ry="4"/><ellipse cx="59" cy="162" rx="6.5" ry="4"/></svg>`;
    function stageHTML(o) {
        const top = ppById(o.top), inner = ppById(o.inner), bot = ppById(o.bottom), shoes = ppById(o.shoes), neck = ppById(o.neck);
        let h = PD_MANQ;
        if (shoes) { const f = pdFit(shoes, PD.SHOE_H); h += pdLayer('pd-z-shoes', shoes, PD.SHOE_Y, f.w, f.h); }
        if (bot) { const f = pdFit(bot, PD.BOT_H); h += pdLayer('pd-z-bottom', bot, PD.BOT_Y, f.w, f.h); }
        if (top) {
            const f = pdFit(top, PD.TOP_H), opened = !!o.open && canOpen(top);
            if (opened && inner) {   // dalaman: hanya jalur tengah yang tampak di celah atasan
                const ih = Math.min(f.h * 0.97, pdFit(inner, f.h * 0.97).h), iw = ih * (inner.pp.w / inner.pp.h) * PD.R;
                const cut = (100 - Math.min(100, f.w * 0.22 * 1.25 / iw * 100)) / 2, src = esc(inner.photo);
                h += `<div class="pd-layer pd-z-inner" style="top:${PD.TOP_Y + f.h * 0.02}%;width:${iw}%;height:${ih}%"><div class="pd-innerwrap" style="clip-path:inset(0 ${cut}% 0 ${cut}%)"><img alt="" src="${src}"><div class="pd-shade" style="-webkit-mask-image:url('${src}');mask-image:url('${src}')"></div></div></div>`;
            }
            const src = esc(top.photo);
            h += `<div class="pd-layer pd-z-top${opened ? ' open' : ''}" style="top:${PD.TOP_Y}%;width:${f.w}%;height:${f.h}%"><div class="pd-half l"><img alt="" src="${src}"></div><div class="pd-half r"><img alt="" src="${src}"></div></div>`;
        }
        if (neck) { const f = pdFit(neck, 10); h += pdLayer('pd-z-neck', neck, 16, f.w, f.h); }
        return h;
    }
    const outfitNames = o => [o.top, o.inner && o.open && canOpen(ppById(o.top)) ? o.inner : null, o.bottom, o.shoes, o.neck].map(id => id && itemById(id)).filter(Boolean).map(i => i.name);
    const outfitIds = o => SLOT_KEYS.filter(k => k !== 'inner' || (o.open && canOpen(ppById(o.top)))).map(k => o[k]).filter(id => id && itemById(id));

    function seedBanner() {
        const S = D(); if (S.seedDone) return '';
        return `<div class="lm-banner lm-seed" role="status"><span>👕 ${SEED.length} pakaian dari fotomu siap diimpor ke Lemari</span><button type="button" class="mx-btn mx-btn-primary mx-btn-sm" data-act="seed">Impor</button></div>`;
    }
    function ensureCat(id, name, emoji, washable, limit) {
        const S = D(); if (!byId(S.cats, id)) S.cats.push({ id, name, emoji, washable, limit }); return id;
    }
    function importSeed() {
        const S = D(); if (S.seedDone) return 0;
        ensureCat('atasan', 'Atasan', '👕', true, null); ensureCat('bawahan', 'Bawahan', '👖', true, 5); ensureCat('kaos', 'Kaos', '🎽', true, 5);
        let n = 0;
        SEED.forEach(([no, name, kind, open, w, h]) => {
            const id = 'pp' + String(no).padStart(2, '0'); if (byId(S.items, id)) return;
            const cat = KIND_CAT[kind], c = byId(S.cats, cat) ? cat : S.cats[0].id;
            S.items.push({ id, name, cat: c, photo: 'icons/lemari/c' + String(no).padStart(2, '0') + '.webp', washedOn: '', created: today(), pp: { kind, open, w, h } }); n++;
        });
        S.seedDone = true; save(); return n;
    }

    function renderPadu() {
        const r = root('lm-padu'), S = D(), o = pd.o;
        SLOT_KEYS.forEach(k => { if (o[k] && !ppById(o[k])) o[k] = null; });   // barang yang dihapus/diganti fotonya
        const top = ppById(o.top), openable = canOpen(top);
        if (!openable) o.open = false;
        const all = ppItems(), slot = PD_SLOTS.find(s => s.id === pd.slot) || PD_SLOTS[0];
        const slotItems = s => all.filter(i => s.kinds.includes(i.pp.kind));
        const kinds = slot.kinds.filter(k => all.some(i => i.pp.kind === k));
        if (pd.kind !== 'all' && !kinds.includes(pd.kind)) pd.kind = 'all';
        const list = slotItems(slot).filter(i => pd.kind === 'all' || i.pp.kind === pd.kind);
        let hint = '';
        if (!top) hint = 'Pilih atasan dan bawahan untuk mulai.';
        else if (openable && o.open && !o.inner) hint = 'Terbuka. Pilih kaos di tab Dalaman untuk dipakai di dalam.';
        else if (openable && !o.open && o.inner) hint = 'Dalaman baru terlihat kalau atasan dibuka.';
        else if (!openable) hint = 'Atasan ini tidak bisa dibuka.';
        const tabs = PD_SLOTS.map(s => { const n = slotItems(s).length; return `<button type="button" role="tab" class="mx-chip${s.id === slot.id ? ' on' : ''}" aria-selected="${s.id === slot.id}" data-act="pslot" data-s="${s.id}"${n ? '' : ' disabled'}>${s.label}${o[s.id] ? ' ✓' : ''}${n ? '' : ' (kosong)'}</button>`; }).join('');
        const kindChips = kinds.length > 1 ? `<div class="mx-chips pd-kinds">${['all', ...kinds].map(k => `<button type="button" class="mx-chip${pd.kind === k ? ' on' : ''}" data-act="pkind" data-k="${k}">${k === 'all' ? 'Semua' : KIND_LABEL[k]}</button>`).join('')}</div>` : '';
        const thumbs = list.length
            ? `<button type="button" class="pd-th pd-none" aria-pressed="${!o[slot.id]}" data-act="ppick" data-s="${slot.id}" data-id="">Tanpa</button>` + list.map(i => `<button type="button" class="pd-th" aria-pressed="${o[slot.id] === i.id}" aria-label="${esc(i.name)}" title="${esc(i.name)}" data-act="ppick" data-s="${slot.id}" data-id="${esc(i.id)}"><img alt="" loading="lazy" decoding="async" src="${esc(i.photo)}"><span class="pd-nm">${esc(i.name)}</span></button>`).join('')
            : `<div class="mx-muted pd-empty">${all.length ? `Belum ada ${slot.label.toLowerCase()} di Lemari.` : 'Belum ada pakaian berfoto potongan. Impor pakaian bawaan dari banner di atas.'}</div>`;
        const saved = S.outfits.map(f => `<div class="pd-sv"><div class="pd-mini"><div class="pd-box" data-o="${esc(f.id)}">${stageHTML(f.o)}</div></div><b title="${esc(f.name)}">${esc(f.name)}</b><div class="mx-row"><button type="button" class="mx-btn mx-btn-sm" data-act="puse" data-id="${esc(f.id)}">Pakai</button><button type="button" class="mx-btn mx-btn-sm mx-btn-danger" data-act="pdel" data-id="${esc(f.id)}" aria-label="Hapus ${esc(f.name)}">Hapus</button></div></div>`).join('');
        r.innerHTML = `<div class="mx-head"><div><h2>Padu Padan</h2></div></div>${seedBanner()}
        <div class="pd-wrap"><div class="pd-left"><div class="pd-stage"><div class="pd-box" id="pdStage" role="img" aria-label="Pratinjau outfit: ${esc(outfitNames(o).join(', ') || 'kosong')}">${stageHTML(o)}</div></div></div>
        <div class="pd-right"><div class="mx-card">
            ${openable ? `<div class="mx-row pd-openrow"><b>${top.pp.open === 'zip' ? 'Resleting' : 'Kancing'}</b><div class="pd-seg" role="group" aria-label="Buka atau tutup atasan"><button type="button" aria-pressed="${!o.open}" data-act="popen" data-v="0">Tertutup</button><button type="button" aria-pressed="${o.open}" data-act="popen" data-v="1">Terbuka</button></div></div>` : ''}
            <p class="mx-muted mx-xs pd-hint">${hint}</p>
            <div class="mx-chips pd-tabs" role="tablist" aria-label="Bagian outfit">${tabs}</div>${kindChips}
            <div class="pd-thumbs">${thumbs}</div>
            <div class="mx-row pd-actions"><button type="button" class="mx-btn mx-btn-primary" data-act="psave">Simpan outfit</button><button type="button" class="mx-btn" data-act="pwear">Pakai hari ini</button><button type="button" class="mx-btn" data-act="pclear">Kosongkan</button></div>
        </div>
        <h3 class="pd-h">Outfit tersimpan</h3>${saved ? `<div class="pd-saved">${saved}</div>` : '<p class="mx-muted">Belum ada. Susun outfit lalu ketuk Simpan outfit.</p>'}</div></div>`;
    }
    function openSaveOutfit() {
        const o = pd.o; if (!o.top && !o.bottom) return Mx.toast('Pilih pakaian dulu', 'error');
        Mx.modal({
            title: 'Simpan outfit', size: 380,
            body: `<form novalidate><div class="mx-field"><label for="pdOutfitName">Nama outfit</label><input id="pdOutfitName" name="name" class="mx-input" maxlength="40" value="Outfit ${D().outfits.length + 1}"></div><div class="mx-foot"><button type="button" class="mx-btn" data-mx-cancel>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount: api => {
                const f = api.body.querySelector('form'); f.querySelector('[data-mx-cancel]').addEventListener('click', api.close);
                f.addEventListener('submit', e => {
                    e.preventDefault(); const S = D(), name = f.elements.name.value.trim() || 'Outfit ' + (S.outfits.length + 1);
                    S.outfits.unshift({ id: uid(), name, o: { ...pd.o }, created: today() }); S.outfits = S.outfits.slice(0, MAX_OUTFITS);
                    save(); api.close(); renderPadu(); Mx.toast('Outfit tersimpan: ' + name);
                });
                setTimeout(() => { f.elements.name.focus(); f.elements.name.select(); }, 30);
            }
        });
    }
    function wearOutfit() {
        const ids = outfitIds(pd.o); if (!ids.length) return Mx.toast('Pilih pakaian dulu', 'error');
        const S = D(), t = today(), e = S.log[t];
        if (e) ids.forEach(id => { if (!e.items.includes(id)) e.items.push(id); });
        else S.log[t] = { items: ids, matkul: autoMatkul(t), saved: new Date().toISOString() };
        if (ui.dayLoaded === t) ui.dayLoaded = '';
        save(); updateBadge(); Mx.toast('Dicatat ke Pakaian Hari Ini: ' + outfitNames(pd.o).join(' + '));
    }

    // ---------- Hari Ini ----------
    function openDay(d) {
        const e = D().log[d]; ui.date = d; ui.sel = new Set(e ? e.items.filter(id => itemById(id)) : []);
        const auto = autoMatkul(d); ui.manual = e && e.matkul !== auto ? String(Math.min(4, e.matkul)) : 'auto'; ui.dayLoaded = d;
    }
    function renderHari() {
        const r = root('lm-hari'), S = D(), t = today(); if (ui.dayLoaded !== ui.date) openDay(ui.date);
        const auto = autoMatkul(ui.date), n = ui.manual === 'auto' ? auto : Number(ui.manual), e = S.log[ui.date];
        const groups = S.cats.map(c => ({ c, items: S.items.filter(i => i.cat === c.id) })).filter(g => g.items.length);
        const preview = [...ui.sel].map(itemById).filter(it => it && catOf(it.cat).washable).map(it => {
            const after = itemLoad(it) + (e && e.items.includes(it.id) ? 0 : wearLoad(it, n)); // sudah tercatat hari ini tidak dihitung dobel
            return `<div class="lm-row"><div class="lm-th">${thumb(it)}</div><div class="lm-grow"><b>${esc(it.name)}</b><span class="mx-muted mx-xs">setelah ini: ${Math.min(100, Math.round(after / THRESH * 100))}% kotor</span></div>${after >= THRESH ? '<span class="lm-tag lm-tag-s">Cuci</span>' : ''}</div>`;
        }).join('');
        r.innerHTML = `<div class="mx-head"><div><h2>Pakaian hari ini</h2></div></div>
        <div class="mx-card"><div class="mx-row"><button type="button" class="mx-btn mx-btn-sm" data-act="prevd" aria-label="Hari sebelumnya">‹</button><input type="date" id="lmDate" class="mx-input lm-date" value="${ui.date}" max="${t}"><button type="button" class="mx-btn mx-btn-sm" data-act="nextd" aria-label="Hari berikutnya"${ui.date >= t ? ' disabled' : ''}>›</button>${e ? '<b class="lm-saved">Sudah tercatat</b>' : ''}</div>
        <div class="mx-field lm-matkul"><label for="lmMatkul">Matkul hari ini (dari jadwal Kuliah: ${auto})</label><select id="lmMatkul" class="mx-input"><option value="auto"${ui.manual === 'auto' ? ' selected' : ''}>Otomatis (${auto} matkul)</option>${[0, 1, 2, 3, 4].map(k => `<option value="${k}"${String(ui.manual) === String(k) ? ' selected' : ''}>${k === 4 ? '4+' : k} matkul</option>`).join('')}</select></div></div>
        <div class="mx-card"><div class="mx-row"><h3>Pilih yang dipakai</h3><span class="mx-muted mx-xs lm-push">${ui.sel.size} dipilih</span></div>
        ${groups.length ? groups.map(g => `<div class="lm-gh"><b>${g.c.emoji} ${esc(g.c.name)}</b>${g.c.washable ? '' : '<span class="mx-muted mx-xs">· tidak dihitung cuci</span>'}</div><div class="lm-grid">${g.items.map(i => itemCard(i, 'pick')).join('')}</div>`).join('') : Mx.empty('👗', 'Lemari masih kosong', 'Tambah barang dulu di Cek Lemari.')}</div>
        ${preview ? `<div class="mx-card"><h3>Pengaruh ke tingkat kotor</h3>${preview}</div>` : ''}
        <div class="mx-row"><button type="button" class="mx-btn mx-btn-primary" data-act="saveday"${ui.sel.size ? '' : ' disabled'}>Simpan catatan</button>${e ? '<button type="button" class="mx-btn mx-btn-danger" data-act="delday">Hapus catatan hari ini</button>' : ''}</div>`;
    }

    // ---------- Cuci ----------
    function renderCuci() {
        const r = root('lm-cuci'), S = D();
        const wash = S.items.filter(needsWash), alm = S.items.filter(isAlmost);
        const ok = S.items.filter(i => catOf(i.cat).washable && !needsWash(i) && !isAlmost(i));
        const row = (it, cls) => { const p = Math.min(100, Math.round(itemLoad(it) / THRESH * 100)), lw = lastWorn(it.id); return `<div class="lm-row"><div class="lm-th">${thumb(it)}</div><div class="lm-grow"><b>${esc(it.name)}</b><div class="lm-bar ${cls}"><i style="width:${p}%"></i></div><span class="mx-muted mx-xs">${p}% kotor · terakhir dipakai ${lw ? fmtShort(lw) : '—'}</span></div><button type="button" class="mx-btn mx-btn-sm" data-act="wash" data-id="${esc(it.id)}">Sudah dicuci</button></div>`; };
        r.innerHTML = `<div class="mx-head"><div><h2>🧺 Cuci</h2></div></div>
        <div class="mx-card"><div class="mx-row"><h3>Waktunya dicuci</h3>${wash.length ? '<button type="button" class="mx-btn mx-btn-primary mx-btn-sm lm-push" data-act="washall">Cuci semua</button>' : ''}</div>${wash.length ? wash.map(i => row(i, 'd')).join('') : Mx.empty('✨', 'Semua masih bersih', 'Belum ada yang waktunya dicuci.')}</div>
        ${alm.length ? `<div class="mx-card"><h3>Hampir waktunya dicuci</h3>${alm.map(i => row(i, 'w')).join('')}</div>` : ''}
        <div class="mx-card"><h3>Masih aman (${ok.length})</h3>${ok.length ? ok.map(i => row(i, '')).join('') : '<p class="mx-muted">—</p>'}</div>`;
    }

    // ---------- Riwayat ----------
    function renderRiwayat() {
        const r = root('lm-riwayat'), S = D(), t = today(), dates = Object.keys(S.log).sort().reverse();
        const un = unusedItems(), out = outfitSuggestions(), since30 = addDays(t, -29);
        const freq = S.items.map(i => ({ i, n: wearCount(i.id, since30) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
        const nameOf = id => { const it = itemById(id); return it ? esc(it.name) : '(dihapus)'; };
        const outfitHtml = out.length ? out.slice(0, 5).map((o, k) => `<div class="lm-row"><div class="lm-grow"><div class="lm-outfit">${o.ids.map(id => `<span class="lm-th" title="${esc(itemById(id).name)}">${thumb(itemById(id))}</span>`).join('')}</div><span class="mx-muted mx-xs">${o.ids.map(id => esc(itemById(id).name)).join(' + ')} · dipakai ${o.n}×</span></div><button type="button" class="mx-btn mx-btn-sm" data-act="useoutfit" data-k="${k}">Pakai hari ini</button></div>`).join('')
            : Mx.empty('🧩', 'Belum ada kombinasi favorit', 'Kombinasi yang sama dipakai minimal 2 kali akan muncul di sini.');
        r.innerHTML = `<div class="mx-head"><div><h2>Riwayat</h2></div></div>
        <div class="mx-stats"><div class="mx-stat"><span>Hari tercatat</span><b>${dates.length}</b></div><div class="mx-stat"><span>Waktunya cuci</span><b>${S.items.filter(needsWash).length}</b></div><div class="mx-stat"><span>Lama tak dipakai</span><b>${un.length}</b></div></div>
        <div class="mx-card"><h3>🧩 Padu padan favorit</h3>${outfitHtml}</div>
        <div class="mx-card"><h3>🔁 Paling sering dipakai (30 hari)</h3>${freq.length ? freq.map(x => `<div class="lm-row"><div class="lm-th">${thumb(x.i)}</div><div class="lm-grow"><b>${esc(x.i.name)}</b></div><b>${x.n}×</b></div>`).join('') : '<p class="mx-muted">Belum ada data.</p>'}</div>
        ${un.length ? `<div class="mx-card"><h3>💤 Lama tidak dipakai (≥ ${DAYS_UNUSED} hari / belum pernah)</h3>${un.map(x => `<div class="lm-row"><div class="lm-th">${thumb(x.it)}</div><div class="lm-grow"><b>${esc(x.it.name)}</b><span class="mx-muted mx-xs">${x.lw ? x.days + ' hari lalu' : 'belum pernah dicatat dipakai'}</span></div></div>`).join('')}</div>` : ''}
        <div class="mx-card"><h3>📅 Riwayat harian</h3>${dates.length ? dates.slice(0, 30).map(d => { const e = S.log[d]; return `<div class="lm-row"><div class="lm-grow"><b>${fmtDay(d)}</b><span class="mx-muted mx-xs">${e.matkul} matkul · ${e.items.map(nameOf).join(', ')}</span></div><button type="button" class="mx-btn mx-btn-sm" data-act="openday" data-d="${d}">Ubah</button></div>`; }).join('') : Mx.empty('📅', 'Belum ada riwayat')}</div>`;
    }

    // ---------- modal: detail barang ----------
    function detailBody(it) {
        const c = catOf(it.cat), t = today(), ld = itemLoad(it), p = Math.min(100, Math.round(ld / THRESH * 100));
        const dates = wornDates(it.id), lw = dates[0], worn = !!(D().log[t] || { items: [] }).items.includes(it.id);
        const cls = ld >= THRESH ? 'd' : ld >= almostAt(it) ? 'w' : '', pairs = pairedWith(it.id);
        const lwTxt = !lw ? 'Belum pernah' : lw === t ? 'Hari ini' : daysBetween(lw, t) + ' hari lalu';
        return `<span class="mx-muted mx-xs">${c.emoji} ${esc(c.name)}</span><div class="lm-big">${thumb(it)}</div>
        <div class="lm-dk"><div><span>Dipakai</span><b>${dates.length}×</b></div><div><span>Terakhir</span><b>${lwTxt}</b></div><div><span>Dicuci</span><b>${it.washedOn ? fmtShort(it.washedOn) : '—'}</b></div></div>
        ${c.washable ? `<div class="lm-dh">Tingkat kotor ${p}%${ld >= THRESH ? ' · waktunya dicuci' : ld >= almostAt(it) ? ' · hampir' : ''}</div><div class="lm-bar ${cls}"><i style="width:${p}%"></i></div>` : '<p class="mx-muted mx-xs">Kategori ini tidak dihitung cuci.</p>'}
        ${pairs.length ? `<div class="lm-dh">Sering dipadukan dengan</div><div class="lm-chipsm">${pairs.map(x => `<span>${esc(itemById(x.id).name)} · ${x.n}×</span>`).join('')}</div>` : ''}
        ${dates.length ? `<div class="lm-dh">Terakhir dipakai</div><div class="lm-chipsm">${dates.slice(0, 5).map(d => `<span>${fmtDay(d)}</span>`).join('')}</div>` : ''}
        <div class="mx-foot"><button type="button" class="mx-btn" data-act="edit" data-id="${esc(it.id)}">✎ Ubah</button>${c.washable ? `<button type="button" class="mx-btn" data-act="wash" data-id="${esc(it.id)}">🧺 Sudah dicuci</button>` : ''}<button type="button" class="mx-btn ${worn ? '' : 'mx-btn-primary'}" data-act="usetoday" data-id="${esc(it.id)}">${worn ? '✓ Dipakai hari ini (batalkan)' : '👚 Pakai hari ini'}</button></div>`;
    }
    function openDetail(id) {
        const it = itemById(id); if (!it) return;
        closeDetail();
        detail = Mx.modal({ title: it.name, size: 440, body: detailBody(it), onMount: api => Mx.delegate(api.body, acts) });
        detail.id = id;
    }
    function closeDetail() { if (detail) { detail.close(); detail = null; } }
    function refreshDetail() {
        if (!detail || !detail.el.isConnected) { detail = null; return; }
        const it = itemById(detail.id); if (!it) { closeDetail(); return; }
        detail.body.innerHTML = detailBody(it);
    }
    const afterChange = () => { rerender(); refreshDetail(); };

    // ---------- modal: tambah / ubah barang ----------
    function openItemForm(it) {
        closeDetail();
        let photo = it ? it.photo : '';
        const S = D();
        Mx.modal({
            title: it ? 'Ubah barang' : 'Tambah barang', size: 440,
            body: `<form class="lm-form" novalidate>
                <div class="mx-field"><label for="lmName">Nama *</label><input id="lmName" name="name" class="mx-input" maxlength="60" placeholder="Contoh: Kemeja putih" value="${esc(it ? it.name : '')}"></div>
                <div class="mx-field"><label for="lmCat">Kategori</label><select id="lmCat" name="cat" class="mx-input">${S.cats.map(c => `<option value="${esc(c.id)}"${(it ? it.cat : ui.cat || S.cats[0].id) === c.id ? ' selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
                <div class="mx-field"><label>Foto (kamera / galeri)</label><div class="lm-pv" data-pv></div><div class="mx-row"><label class="mx-btn mx-btn-sm">📷 Pilih foto<input type="file" accept="image/*" data-file hidden></label><button type="button" class="mx-btn mx-btn-sm" data-clear>Hapus foto</button><span class="mx-muted mx-xs" data-msg></span></div></div>
                <small class="mx-err" data-err hidden></small>
                <div class="mx-foot">${it ? '<button type="button" class="mx-btn mx-btn-danger" data-del>🗑 Hapus</button>' : ''}<button type="button" class="mx-btn" data-mx-cancel>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount: api => {
                const f = api.body.querySelector('form'), pv = f.querySelector('[data-pv]'), msg = f.querySelector('[data-msg]'), err = f.querySelector('[data-err]');
                const showPv = () => { pv.innerHTML = photo ? `<img alt="Pratinjau" src="${esc(photo)}">` : '📷'; };
                showPv();
                f.querySelector('[data-file]').addEventListener('change', async e => {
                    const file = e.target.files[0]; if (!file) return; msg.textContent = 'Memproses…';
                    try { photo = await Mx.compressImage(file, PHOTO_W, PHOTO_Q); msg.textContent = 'Foto siap (dikompres)'; showPv(); } catch (x) { msg.textContent = x.message; }
                    e.target.value = '';
                });
                f.querySelector('[data-clear]').addEventListener('click', () => { photo = ''; msg.textContent = ''; showPv(); });
                f.querySelector('[data-mx-cancel]').addEventListener('click', api.close);
                const del = f.querySelector('[data-del]');
                if (del) del.addEventListener('click', async () => {
                    if (!(await Mx.confirm(`Hapus "${it.name}"? Riwayat pemakaiannya tetap ada, tapi namanya jadi "(dihapus)".`))) return;
                    const S2 = D(); S2.items = S2.items.filter(i => i.id !== it.id); ui.sel.delete(it.id); save(); api.close(); rerender(); Mx.toast('Barang dihapus');
                });
                f.addEventListener('submit', e => {
                    e.preventDefault(); const name = f.elements.name.value.trim(), S2 = D();
                    const fail = m => { err.textContent = m; err.hidden = false; };
                    if (!name) return fail('Nama wajib diisi.');
                    if (S2.items.some(i => (!it || i.id !== it.id) && i.name.toLowerCase() === name.toLowerCase())) return fail('Nama barang sudah ada.');
                    if (it) { const cur = itemById(it.id); Object.assign(cur, { name, cat: f.elements.cat.value, photo }); if (cur.pp && photo !== it.photo) delete cur.pp; } // foto diganti => bukan potongan transparan lagi, tidak dipakai di Padu Padan
                    else S2.items.push({ id: uid(), name, cat: f.elements.cat.value, photo, washedOn: '', created: today() });
                    save(); api.close(); rerender(); Mx.toast('Barang disimpan');
                });
                setTimeout(() => f.elements.name.focus(), 30);
            }
        });
    }

    // ---------- modal: kategori ----------
    function openCats() {
        closeDetail();
        const html = () => { const S = D(); return `<p class="mx-muted mx-xs">"Cuci" menentukan apakah barang di kategori itu ikut hitungan cuci. Batas tetap (mis. 5×) mengabaikan jumlah matkul; kosongkan untuk ikut jumlah matkul.</p>
            ${S.cats.map(c => `<div class="lm-row"><span class="lm-catico">${c.emoji}</span><div class="lm-grow"><b>${esc(c.name)}</b><span class="mx-muted mx-xs">${S.items.filter(i => i.cat === c.id).length} barang</span></div>
              <label class="lm-sw"><input type="checkbox" data-wcat="${esc(c.id)}"${c.washable ? ' checked' : ''}> cuci</label>
              ${c.washable ? `<label class="lm-sw mx-xs"><input type="number" min="1" max="30" class="mx-input lm-lim" data-lcat="${esc(c.id)}" value="${c.limit || ''}" placeholder="auto" aria-label="Batas pakai ${esc(c.name)}">× pakai</label>` : ''}
              <button type="button" class="mx-btn mx-btn-sm mx-btn-danger" data-act="delcat" data-id="${esc(c.id)}" aria-label="Hapus kategori ${esc(c.name)}">🗑</button></div>`).join('')}
            <form class="lm-newcat" novalidate><div class="mx-field"><label>Kategori baru</label><div class="mx-row"><input name="emoji" class="mx-input lm-emo" maxlength="4" value="🏷️" aria-label="Emoji"><input name="name" class="mx-input lm-grow" maxlength="24" placeholder="Nama, mis. Jaket"></div></div>
            <label class="lm-sw"><input type="checkbox" name="washable"> Ikut hitungan cuci</label>
            <label class="lm-sw mx-xs">Batas tetap <input type="number" name="limit" min="1" max="30" class="mx-input lm-lim" placeholder="auto"> × pakai</label>
            <small class="mx-err" data-err hidden></small><div class="mx-foot"><button type="submit" class="mx-btn mx-btn-primary">Tambah</button></div></form>`; };
        Mx.modal({
            title: 'Kategori', size: 480, body: html(),
            onMount: api => {
                const paint = () => { api.body.innerHTML = html(); rerender(); };
                api.body.addEventListener('change', e => {
                    const t = e.target, S = D();
                    if (t.dataset.wcat) { const c = byId(S.cats, t.dataset.wcat); if (c) { c.washable = t.checked; save(); paint(); } }
                    if (t.dataset.lcat) { const c = byId(S.cats, t.dataset.lcat); if (c) { c.limit = cleanLimit(t.value); save(); paint(); } }
                });
                api.body.addEventListener('click', async e => {
                    const b = e.target.closest('[data-act="delcat"]'); if (!b) return;
                    const S = D(), c = byId(S.cats, b.dataset.id), n = S.items.filter(i => i.cat === c.id).length;
                    if (n) return Mx.toast(`Pindahkan ${n} barang ke kategori lain dulu`, 'error');
                    if (S.cats.length <= 1) return Mx.toast('Minimal satu kategori', 'error');
                    if (!(await Mx.confirm(`Hapus kategori "${c.name}"?`))) return;
                    S.cats = S.cats.filter(x => x.id !== c.id); if (ui.cat === c.id) ui.cat = ''; save(); paint();
                });
                api.body.addEventListener('submit', e => {
                    e.preventDefault(); const f = e.target, S = D(), name = f.elements.name.value.trim(), err = f.querySelector('[data-err]');
                    const fail = m => { err.textContent = m; err.hidden = false; };
                    if (!name) return fail('Isi nama kategori.');
                    if (S.cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return fail('Nama kategori sudah ada.');
                    S.cats.push({ id: 'c' + uid(), name, emoji: f.elements.emoji.value.trim() || '🏷️', washable: f.elements.washable.checked, limit: f.elements.washable.checked ? cleanLimit(f.elements.limit.value) : null });
                    save(); paint();
                });
            }
        });
    }

    // ---------- aksi ----------
    const acts = {
        seed: () => { const n = importSeed(); rerender(); Mx.toast(n ? `${n} pakaian diimpor ke Lemari` : 'Sudah diimpor'); },
        pslot: el => { pd.slot = el.dataset.s; pd.kind = 'all'; renderPadu(); },
        pkind: el => { pd.kind = el.dataset.k; renderPadu(); },
        ppick: el => { const k = el.dataset.s, id = el.dataset.id || null; pd.o[k] = id && pd.o[k] !== id ? id : null; renderPadu(); },
        popen: el => {
            pd.o.open = el.dataset.v === '1';
            if (pd.o.open && !pd.o.inner && ppItems().some(i => i.pp.kind === 'kaos')) { pd.slot = 'inner'; pd.kind = 'all'; }
            renderPadu();
        },
        pclear: () => { pd.o = { top: null, inner: null, bottom: null, shoes: null, neck: null, open: false }; pd.slot = 'top'; pd.kind = 'all'; renderPadu(); },
        psave: openSaveOutfit,
        pwear: wearOutfit,
        puse: el => { const f = byId(D().outfits, el.dataset.id); if (!f) return; pd.o = { ...f.o }; renderPadu(); const st = document.getElementById('pdStage'); if (st) st.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
        pdel: async el => {
            const S = D(), f = byId(S.outfits, el.dataset.id); if (!f) return;
            if (!(await Mx.confirm(`Hapus outfit "${f.name}"?`))) return;
            S.outfits = S.outfits.filter(x => x.id !== f.id); save(); renderPadu();
        },
        cat: el => { ui.cat = el.dataset.c; renderLemari(); },
        add: () => openItemForm(null),
        cats: openCats,
        detail: el => openDetail(el.dataset.id),
        edit: el => { const it = itemById(el.dataset.id); if (it) openItemForm(it); },
        'goto-cuci': () => App.UI.switchTab('lm-cuci', document.getElementById('subtab-lm-cuci')),
        usetoday: el => {
            const it = itemById(el.dataset.id); if (!it) return;
            const t = today(), on = toggleWorn(t, it.id, autoMatkul(t));
            if (ui.dayLoaded === t) ui.dayLoaded = ''; // muat ulang pilihan hari ini
            save(); afterChange(); Mx.toast(on ? `${it.name} dicatat dipakai hari ini` : `${it.name} dibatalkan dari hari ini`);
        },
        toggle: el => { const id = el.dataset.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); renderHari(); },
        prevd: () => { ui.date = addDays(ui.date, -1); ui.manual = 'auto'; ui.dayLoaded = ''; renderHari(); },
        nextd: () => { if (ui.date < today()) { ui.date = addDays(ui.date, 1); ui.manual = 'auto'; ui.dayLoaded = ''; renderHari(); } },
        saveday: () => {
            if (!ui.sel.size) return;
            const n = ui.manual === 'auto' ? autoMatkul(ui.date) : Number(ui.manual);
            D().log[ui.date] = { items: [...ui.sel], matkul: Math.max(0, Math.min(8, n)), saved: new Date().toISOString() };
            save(); renderHari(); updateBadge(); Mx.toast('Catatan hari ini tersimpan');
        },
        delday: async () => {
            if (!(await Mx.confirm('Hapus catatan pakaian untuk hari ini?'))) return;
            delete D().log[ui.date]; ui.sel = new Set(); save(); renderHari(); updateBadge();
        },
        wash: el => { const it = itemById(el.dataset.id); if (!it) return; it.washedOn = today(); save(); afterChange(); Mx.toast(`${it.name} sudah dicuci`); },
        washall: async () => {
            const l = D().items.filter(needsWash); if (!l.length) return;
            if (!(await Mx.confirm(`Tandai ${l.length} pakaian sudah dicuci?`))) return;
            l.forEach(i => { i.washedOn = today(); }); save(); rerender(); Mx.toast('Semua ditandai sudah dicuci');
        },
        openday: el => { openDay(el.dataset.d); App.UI.switchTab('lm-hari', document.getElementById('subtab-lm-hari')); },
        useoutfit: el => {
            const o = outfitSuggestions()[Number(el.dataset.k)]; if (!o) return;
            ui.date = today(); ui.manual = 'auto'; ui.sel = new Set(o.ids); ui.dayLoaded = ui.date;
            App.UI.switchTab('lm-hari', document.getElementById('subtab-lm-hari')); Mx.toast('Kombinasi dimuat — tekan Simpan catatan');
        }
    };

    AppModules.register(KEY, {
        label: 'Lemari', views: Object.keys(VIEWS), normalize, validate,
        onChange() { updateBadge(); },
        summary() {   // dipakai widget homescreen: pakaian hari ini + yang waktunya dicuci
            const S = D(), e = S.log[today()], name = id => { const it = itemById(id); return it ? it.name : ''; };
            return { today: e ? e.items.map(name).filter(Boolean) : [], dirty: S.items.filter(needsWash).map(i => i.name) };
        },
        init() {
            Object.keys(VIEWS).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id === 'lmQ') { ui.q = e.target.value; renderGrid(); } },
                    change: e => {
                        const id = e.target.id;
                        if (id === 'lmSort') { ui.sort = e.target.value; renderGrid(); }
                        if (id === 'lmMatkul') { ui.manual = e.target.value; renderHari(); }
                        if (id === 'lmDate') { const v2 = e.target.value; if (isoOk(v2)) { ui.date = v2 > today() ? today() : v2; ui.manual = 'auto'; ui.dayLoaded = ''; renderHari(); } }
                    }
                });
                r.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('lm-it')) { e.preventDefault(); acts[e.target.dataset.act](e.target); } });
            });
            updateBadge();
        },
        show(v) { current = v; rerender(); },
        refresh() {
            updateBadge(); const r = root(current);
            if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { rerender(); refreshDetail(); }
        },
        isBusy() { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('.mx-modal')); },
        // dipakai uji & modul lain
        washCount: () => D().items.filter(needsWash).length
    });
})();
