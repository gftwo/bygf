/* ==========================================================================
   MODUL MAKAN — jadwal makan + jurnal makanan pribadi
   Data: AppModules 'meal' = { schedules, records, wishlist }
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'meal';
    const SLOTS = { sarapan: ['🌅', 'Sarapan'], siang: ['☀️', 'Makan siang'], malam: ['🌙', 'Makan malam'], camilan: ['🍿', 'Camilan'] };
    const CATS = ['Makanan berat', 'Minuman', 'Camilan', 'Dessert', 'Sarapan', 'Lainnya'];
    const REPEAT = { none: 'Sekali saja', daily: 'Setiap hari', weekly: 'Setiap minggu (hari yang sama)' };
    const { esc, uid, today, byId } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const ui = { jMode: 'today', jDate: today(), weekStart: Mx.weekStart(today()), cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, calSel: today(), hCal: { y: new Date().getFullYear(), m: new Date().getMonth() }, hSel: '',
        f: { q: '', place: '', rating: 0, cat: '', from: '', to: '', fav: false, norice: false, sort: 'new' }, period: 'month', wishType: 'food', pick: null };

    function normalize(raw) {
        raw = raw || {};
        const schedules = arr(raw.schedules).filter(s => s && s.name).map(s => ({ id: String(s.id || uid()), slot: SLOTS[s.slot] ? s.slot : 'siang', name: String(s.name).slice(0, 100), time: /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '', desc: String(s.desc || '').slice(0, 500), image: Mx.safeImg(s.image), date: isoOk(s.date) ? s.date : today(), repeat: REPEAT[s.repeat] ? s.repeat : 'none', doneDates: arr(s.doneDates).filter(isoOk), created: s.created || new Date().toISOString() }));
        const records = arr(raw.records).filter(r => r && r.name).map(r => ({ id: String(r.id || uid()), name: String(r.name).slice(0, 100), place: String(r.place || '').slice(0, 100), location: String(r.location || '').slice(0, 120), price: Math.max(0, Number(r.price) || 0), rating: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))), image: Mx.safeImg(r.image), withoutRice: !!r.withoutRice, desc: String(r.desc || '').slice(0, 1000), notes: String(r.notes || '').slice(0, 1000), category: String(r.category || 'Lainnya'), date: isoOk(r.date) ? r.date : today(), favorite: !!r.favorite, txId: r.txId ? String(r.txId) : '', created: r.created || new Date().toISOString(), updated: r.updated || r.created || new Date().toISOString() }));
        const wishlist = arr(raw.wishlist).filter(w => w && w.name).map(w => ({ id: String(w.id || uid()), type: w.type === 'place' ? 'place' : 'food', name: String(w.name).slice(0, 100), note: String(w.note || '').slice(0, 200), done: !!w.done, created: w.created || new Date().toISOString() }));
        return { schedules, records, wishlist };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; ['schedules', 'records', 'wishlist'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        arr(raw.records).forEach((r, i) => { if (!r || typeof r !== 'object' || !r.name) e.push(`catatan makanan #${i + 1} tidak punya nama`); });
        return e.slice(0, 5);
    }

    // ----- jadwal: kemunculan per tanggal -----
    function occurs(s, iso) {
        if (s.repeat === 'daily') return iso >= s.date;
        if (s.repeat === 'weekly') return iso >= s.date && Mx.parse(iso).getDay() === Mx.parse(s.date).getDay();
        return s.date === iso;
    }
    const itemsOn = iso => D().schedules.filter(s => occurs(s, iso)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.name.localeCompare(b.name));
    const isDone = (s, iso) => s.doneDates.includes(iso);
    const img169 = (src, ico) => `<div class="mx-img169">${src ? `<img loading="lazy" decoding="async" alt="" src="${esc(src)}">` : `<span class="mx-img-ph">${ico || '🍽️'}</span>`}</div>`;
    function schedCard(s, iso) {
        const done = isDone(s, iso);
        return `<article class="mk-sched${done ? ' done' : ''}">${img169(s.image, SLOTS[s.slot][0])}<div class="mk-sbody"><div class="mx-row mx-gap-s"><span class="mx-pill">${SLOTS[s.slot][0]} ${SLOTS[s.slot][1]}</span>${s.time ? `<span class="mx-pill">◷ ${esc(s.time)}</span>` : ''}${s.repeat !== 'none' ? `<span class="mx-pill">↻ ${s.repeat === 'daily' ? 'harian' : 'mingguan'}</span>` : ''}</div>
            <div class="mk-sname">${esc(s.name)}</div>${s.desc ? `<div class="mx-muted mx-xs">${esc(s.desc)}</div>` : ''}
            <div class="mx-row"><label class="mx-check"><input type="checkbox" data-act="sdone" data-id="${esc(s.id)}" data-iso="${iso}" ${done ? 'checked' : ''}> ${done ? 'Sudah makan' : 'Belum makan'}</label><span class="mk-sact"><button type="button" class="mx-icon" data-act="sedit" data-id="${esc(s.id)}" title="Edit" aria-label="Edit jadwal">✎</button><button type="button" class="mx-icon" data-act="sdel" data-id="${esc(s.id)}" title="Hapus" aria-label="Hapus jadwal">🗑</button></span></div></div></article>`;
    }
    const daySections = iso => {
        const items = itemsOn(iso); if (!items.length) return Mx.empty('🍽️', 'Belum ada jadwal makan', 'Tambahkan jadwal untuk tanggal ini.');
        return Object.entries(SLOTS).map(([k, v]) => { const l = items.filter(s => s.slot === k); return l.length ? `<div class="mx-label">${v[0]} ${v[1]}</div><div class="mk-grid">${l.map(s => schedCard(s, iso)).join('')}</div>` : ''; }).join('');
    };

    function renderJadwal() {
        const el = root('mk-jadwal'); if (!el) return; const tabs = [['today', 'Hari ini'], ['week', 'Mingguan'], ['cal', 'Kalender']];
        let body = '';
        if (ui.jMode === 'today') {
            const items = itemsOn(today()), done = items.filter(s => isDone(s, today())).length;
            body = `<div class="mx-card"><div class="mx-row"><b>${Mx.fmtDateLong(today())}</b><span class="mx-count" style="margin-left:auto">${done}/${items.length} sudah makan</span></div><div class="mx-progress"><div style="width:${items.length ? done / items.length * 100 : 0}%"></div></div></div>${daySections(today())}`;
        } else if (ui.jMode === 'week') {
            const days = Array.from({ length: 7 }, (_, i) => Mx.addDays(ui.weekStart, i));
            body = `<div class="mx-card"><div class="mx-cal-head"><button type="button" class="mx-btn mx-btn-sm" data-act="wk-prev" aria-label="Minggu sebelumnya">‹</button><b>${Mx.fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${Mx.fmtDate(days[6])}</b><button type="button" class="mx-btn mx-btn-sm" data-act="wk-next" aria-label="Minggu berikutnya">›</button></div></div>
            <div class="mk-week">${days.map(d => `<div class="mx-card mk-day${d === today() ? ' is-today' : ''}"><b>${Mx.fmtDate(d, { weekday: 'short', day: 'numeric' })}</b>${itemsOn(d).map(s => `<button type="button" class="mk-mini${isDone(s, d) ? ' done' : ''}" data-act="sedit" data-id="${esc(s.id)}" title="${esc(s.name)}"><span>${SLOTS[s.slot][0]} ${esc(s.time || '')}</span> ${esc(s.name)}</button>`).join('') || '<span class="mx-muted mx-xs">—</span>'}</div>`).join('')}</div>`;
        } else {
            const marks = {}; D().schedules.forEach(s => { for (let d = 1; d <= 31; d++) { const iso = `${ui.cal.y}-${String(ui.cal.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; if (Mx.parse(iso) && Mx.parse(iso).getMonth() === ui.cal.m && occurs(s, iso)) marks[iso] = (marks[iso] || 0) + 1; } });
            body = `<div class="dy-calwrap"><div class="mx-card">${Mx.calHTML(ui.cal, marks, ui.calSel)}</div><div class="mx-card"><h3 class="mx-h3">${Mx.fmtDateLong(ui.calSel)}</h3>${daySections(ui.calSel)}</div></div>`;
        }
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🍽️ Jadwal Makan</h2></div><button type="button" class="mx-btn mx-btn-primary" data-act="sadd" data-date="${ui.jMode === 'cal' ? ui.calSel : today()}">＋ Tambah jadwal</button></div>
        <div class="mx-chips">${tabs.map(([k, l]) => `<button type="button" class="mx-chip${ui.jMode === k ? ' on' : ''}" data-act="jmode" data-m="${k}">${l}</button>`).join('')}</div>${body}`;
    }

    // ----- form catatan makanan (dipakai inline & di modal) -----
    function recordForm(r) {
        r = r || { name: '', place: '', location: '', price: 0, rating: 0, image: '', withoutRice: false, desc: '', notes: '', category: 'Makanan berat', date: today(), favorite: false };
        return `<form class="mk-form" novalidate>
        <div class="mx-field"><label>Nama makanan *</label><input name="name" class="mx-input" maxlength="100" placeholder="Contoh: Nasi goreng spesial" value="${esc(r.name)}"></div>
        <div class="mx-two"><div class="mx-field"><label>Nama tempat / restoran</label><input name="place" class="mx-input" maxlength="100" value="${esc(r.place)}"></div><div class="mx-field"><label>Lokasi (area / kota)</label><input name="location" class="mx-input" maxlength="120" value="${esc(r.location)}"></div></div>
        <div class="mx-two"><div class="mx-field"><label>Harga (Rp)</label><input name="price" class="mx-input" inputmode="numeric" placeholder="0" value="${r.price ? new Intl.NumberFormat('id-ID').format(r.price) : ''}"></div><div class="mx-field"><label>Tanggal kunjungan</label><input type="date" name="date" class="mx-input" value="${esc(r.date)}"></div></div>
        <div class="mx-two"><div class="mx-field"><label>Kategori</label><select name="category" class="mx-input">${CATS.map(c => `<option ${r.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="mx-field"><label>Rating</label><div class="mk-stars" role="radiogroup" aria-label="Rating bintang">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="mk-star${i <= r.rating ? ' on' : ''}" data-star="${i}" role="radio" aria-checked="${i === r.rating}" aria-label="${i} bintang">★</button>`).join('')}</div><input type="hidden" name="rating" value="${r.rating}"></div></div>
        <div class="mx-row"><label class="mx-switch"><span>🍚 Without Rice</span><input type="checkbox" name="withoutRice" ${r.withoutRice ? 'checked' : ''}></label><label class="mx-switch"><span>❤️ Favorit</span><input type="checkbox" name="favorite" ${r.favorite ? 'checked' : ''}></label></div>
        <div class="mx-field" style="margin-top:.8rem"><label>Foto makanan (rasio 16:9)</label>${Mx.imageFieldHTML('rec', r.image)}</div>
        <div class="mx-field"><label>Deskripsi</label><textarea name="desc" class="mx-input" rows="2" maxlength="1000">${esc(r.desc)}</textarea></div>
        <div class="mx-field"><label>Catatan pribadi</label><textarea name="notes" class="mx-input" rows="2" maxlength="1000">${esc(r.notes)}</textarea></div>
        <small class="mx-err" data-err hidden></small><div class="mx-foot"><button type="button" class="mx-btn" data-mx-cancel hidden>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan catatan makanan</button></div></form>`;
    }
    function bindRecordForm(box, rec, done, cancel) {
        const f = box.querySelector('form'), getImg = Mx.bindImageField(f), price = f.elements.price, err = f.querySelector('[data-err]');
        price.addEventListener('input', () => { const n = Mx.parseRp(price.value); price.value = n ? new Intl.NumberFormat('id-ID').format(n) : ''; });
        f.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', () => {
            const v = +b.dataset.star, cur = +f.elements.rating.value, nv = v === cur ? 0 : v; f.elements.rating.value = nv;
            f.querySelectorAll('[data-star]').forEach(x => { x.classList.toggle('on', +x.dataset.star <= nv); x.setAttribute('aria-checked', String(+x.dataset.star === nv)); });
        }));
        if (cancel) { const c = f.querySelector('[data-mx-cancel]'); c.hidden = false; c.addEventListener('click', cancel); }
        f.addEventListener('submit', e => {
            e.preventDefault(); err.hidden = true; const g = n => f.elements[n].value.trim(), name = g('name');
            if (!name) { err.textContent = 'Nama makanan wajib diisi.'; err.hidden = false; f.elements.name.focus(); return; }
            const now = new Date().toISOString(), vals = { name, place: g('place'), location: g('location'), price: Mx.parseRp(g('price')), date: g('date') || today(), category: g('category'), rating: +f.elements.rating.value || 0, withoutRice: f.elements.withoutRice.checked, favorite: f.elements.favorite.checked, image: getImg(), desc: g('desc'), notes: g('notes') };
            if (rec) Object.assign(rec, vals, { updated: now }); else D().records.push({ id: uid(), created: now, updated: now, ...vals });
            save(); done(!!rec);
        });
    }
    function renderCatat() {
        const el = root('mk-catat'); if (!el) return;
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📝 Catat Makanan</h2><p class="mx-muted">Simpan pengalaman makan: harga, rating, foto, dan apakah tanpa nasi.</p></div></div><div class="mx-card" id="mkCatatBox">${recordForm(null)}</div>`;
        bindRecordForm(el.querySelector('#mkCatatBox'), null, () => { Mx.toast('Catatan makanan tersimpan'); renderCatat(); });
    }
    function recordModal(rec) {
        Mx.modal({ title: 'Edit catatan makanan', size: 600, body: recordForm(rec), onMount(api) { bindRecordForm(api.body, rec, () => { api.close(); rerender(); Mx.toast('Catatan diperbarui'); }, api.close); } });
    }

    // ----- riwayat -----
    const placeOf = r => r.place || r.location || '';
    function filtered() {
        const f = ui.f, q = f.q.toLowerCase();
        const list = D().records.filter(r => (!q || `${r.name} ${r.place} ${r.location}`.toLowerCase().includes(q)) && (!f.place || placeOf(r) === f.place || r.location === f.place) && (!f.rating || r.rating >= f.rating) && (!f.cat || r.category === f.cat) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.fav || r.favorite) && (!f.norice || r.withoutRice));
        const S = { new: (a, b) => (b.date + b.created).localeCompare(a.date + a.created), old: (a, b) => (a.date + a.created).localeCompare(b.date + b.created), phi: (a, b) => b.price - a.price, plo: (a, b) => a.price - b.price, rhi: (a, b) => b.rating - a.rating, rlo: (a, b) => a.rating - b.rating };
        return list.sort(S[f.sort] || S.new);
    }
    function recCard(r) {
        return `<article class="mk-rec" data-act="detail" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Detail ${esc(r.name)}">${img169(r.image)}<div class="mk-rbody"><div class="mx-row"><b class="mk-sname">${esc(r.name)}</b>${r.favorite ? '<span title="Favorit">❤️</span>' : ''}</div>
        <div class="mx-muted mx-xs">📍 ${esc([r.place, r.location].filter(Boolean).join(' · ') || '—')}</div><div class="mx-row"><span class="mk-rate">${r.rating ? Mx.stars(r.rating) : '<span class="mx-muted mx-xs">belum dinilai</span>'}</span><b style="margin-left:auto">${r.price ? Mx.fmtRp(r.price) : '—'}</b></div>
        <div class="mx-row mx-gap-s"><span class="mx-pill">${esc(r.category)}</span>${r.withoutRice ? '<span class="mx-pill pri-low">🍚 Without Rice</span>' : ''}<span class="mx-pill">${Mx.fmtDate(r.date)}</span></div></div></article>`;
    }
    function renderRiwayat() {
        const el = root('mk-riwayat'); if (!el) return; const f = ui.f, list = filtered();
        const places = [...new Set(D().records.flatMap(r => [r.place, r.location]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
        const grid = el.querySelector('#mkList');
        const listHtml = `<p class="mx-muted mx-xs">${list.length} dari ${D().records.length} catatan.</p>` + (list.length ? `<div class="mk-grid">${list.map(recCard).join('')}</div>` : Mx.empty('🍜', D().records.length ? 'Tidak ada yang cocok dengan filter' : 'Belum ada catatan makanan', D().records.length ? '' : 'Mulai dari tab "Catat".'));
        if (grid) { grid.innerHTML = listHtml; return; }
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🍜 Riwayat Makanan</h2></div><button type="button" class="mx-btn mx-btn-primary" data-act="goto" data-v="mk-catat">＋ Catat makanan</button></div>
        <div class="mx-card"><input id="mkQ" class="mx-input" type="search" placeholder="🔍 Cari nama makanan / tempat…" value="${esc(f.q)}" aria-label="Cari makanan">
        <div class="mx-tools" style="margin-top:.6rem"><select id="mkPlace" class="mx-input" aria-label="Filter lokasi"><option value="">Semua lokasi</option>${places.map(p => `<option ${p === f.place ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select id="mkRating" class="mx-input" aria-label="Filter rating"><option value="0">Semua rating</option>${[5, 4, 3, 2, 1].map(i => `<option value="${i}" ${f.rating === i ? 'selected' : ''}>${i}★ ke atas</option>`).join('')}</select>
        <select id="mkCat" class="mx-input" aria-label="Filter kategori"><option value="">Semua kategori</option>${CATS.map(c => `<option ${c === f.cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <select id="mkSort" class="mx-input" aria-label="Urutkan">${[['new', 'Terbaru'], ['old', 'Terlama'], ['phi', 'Harga tertinggi'], ['plo', 'Harga terendah'], ['rhi', 'Rating tertinggi'], ['rlo', 'Rating terendah']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="mx-tools"><label class="mx-muted mx-xs">Dari <input type="date" id="mkFrom" class="mx-input" value="${f.from}"></label><label class="mx-muted mx-xs">Sampai <input type="date" id="mkTo" class="mx-input" value="${f.to}"></label>
        <label class="mx-check"><input type="checkbox" id="mkFav" ${f.fav ? 'checked' : ''}> ❤️ Favorit saja</label><label class="mx-check"><input type="checkbox" id="mkNoRice" ${f.norice ? 'checked' : ''}> 🍚 Without Rice</label><button type="button" class="mx-btn mx-btn-sm" data-act="freset">Reset filter</button></div></div><div id="mkList">${listHtml}</div>`;
    }
    // Catat harga makanan sebagai pengeluaran (kategori Jajan) di Keuangan — sekali per catatan, tidak menggandakan.
    const WALLETS = [['seabank', 'SeaBank'], ['krombank', 'KromBank'], ['gopay', 'GoPay'], ['dana', 'DANA'], ['shopeepay', 'ShopeePay']];
    function logExpense(r) {
        if (r.txId || !(r.price > 0) || !window.App || !App.State) return;
        Mx.modal({ title: 'Catat ke Keuangan', size: 420, body: `<p class="mx-muted">Pengeluaran <b>${esc(Mx.fmtRp(r.price))}</b> untuk "${esc(r.name)}" akan masuk ke kategori Jajan tanggal ${esc(Mx.fmtDate(r.date))}.</p>
            <div class="mx-field"><label for="mkFinAcc">Dibayar dari</label><select id="mkFinAcc" class="mx-input"><option value="cash">💵 Cash / Tunai</option>${WALLETS.map(w => `<option value="saldo:${w[0]}">🪪 ${w[1]}</option>`).join('')}</select></div>
            <div class="mx-foot"><button type="button" class="mx-btn" data-x="cancel">Batal</button><button type="button" class="mx-btn mx-btn-primary" data-x="ok">Catat pengeluaran</button></div>`,
            onMount(api) {
                api.body.querySelector('[data-x=cancel]').addEventListener('click', api.close);
                api.body.querySelector('[data-x=ok]').addEventListener('click', () => {
                    if (r.txId) return api.close(); // jaga dari klik ganda
                    const v = api.body.querySelector('#mkFinAcc').value, saldo = v.startsWith('saldo:');
                    const tx = { id: Date.now(), tanggal: r.date, jenisAkun: saldo ? 'saldo' : 'cash', subWallet: saldo ? v.slice(6) : null, pemasukan: 0, pengeluaran: r.price, kategori: 'jajan', keterangan: r.name + (r.place ? ' @ ' + r.place : ''), excludeFromBudget: false, _source: 'meal' };
                    App.State.transactions.push(tx); r.txId = String(tx.id); r.updated = new Date().toISOString(); save();
                    if (App.DB && App.DB.save) App.DB.save(); if (App.UI && App.UI.renderAll) App.UI.renderAll();
                    api.close(); rerender(); Mx.toast('Tercatat di Keuangan (Jajan)');
                });
            } });
    }
    function detailModal(r) {
        Mx.modal({ title: r.name, size: 560, body: `${img169(r.image)}<div class="mk-detail"><div class="mx-row"><span class="mk-rate big">${r.rating ? Mx.stars(r.rating) : 'Belum dinilai'}</span><b style="margin-left:auto">${r.price ? Mx.fmtRp(r.price) : '—'}</b></div>
        <div class="mx-row mx-gap-s"><span class="mx-pill">${esc(r.category)}</span>${r.withoutRice ? '<span class="mx-pill pri-low">🍚 Without Rice</span>' : ''}${r.favorite ? '<span class="mx-pill pri-high">❤️ Favorit</span>' : ''}</div>
        <dl class="mk-dl"><dt>Tempat</dt><dd>${esc(r.place || '—')}</dd><dt>Lokasi</dt><dd>${esc(r.location || '—')}</dd><dt>Tanggal</dt><dd>${Mx.fmtDateLong(r.date)}</dd>${r.desc ? `<dt>Deskripsi</dt><dd>${esc(r.desc)}</dd>` : ''}${r.notes ? `<dt>Catatan pribadi</dt><dd>${esc(r.notes)}</dd>` : ''}</dl>
        <div class="mx-foot"><button type="button" class="mx-btn" data-d="fav">${r.favorite ? '💔 Hapus favorit' : '❤️ Jadikan favorit'}</button>${r.price > 0 ? (r.txId ? '<span class="mx-pill" title="Sudah dicatat sebagai pengeluaran">✅ Tercatat di Keuangan</span>' : '<button type="button" class="mx-btn" data-d="fin">💸 Catat ke Keuangan</button>') : ''}<button type="button" class="mx-btn" data-d="edit">✎ Edit</button><button type="button" class="mx-btn mx-btn-danger" data-d="del">🗑 Hapus</button></div></div>`,
            onMount(api) {
                api.body.querySelector('[data-d=fav]').addEventListener('click', () => { r.favorite = !r.favorite; r.updated = new Date().toISOString(); save(); api.close(); rerender(); Mx.toast(r.favorite ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit'); });
                const finBtn = api.body.querySelector('[data-d=fin]'); if (finBtn) finBtn.addEventListener('click', () => { api.close(); logExpense(r); });
                api.body.querySelector('[data-d=edit]').addEventListener('click', () => { api.close(); recordModal(r); });
                api.body.querySelector('[data-d=del]').addEventListener('click', async () => { if (!(await Mx.confirm(`Hapus catatan "${r.name}"?`))) return; D().records = D().records.filter(x => x.id !== r.id); save(); api.close(); rerender(); Mx.toast('Catatan dihapus'); });
            } });
    }

    // ----- statistik -----
    function renderStatistik() {
        const el = root('mk-statistik'); if (!el) return; const rs = D().records, total = rs.reduce((a, r) => a + r.price, 0), rated = rs.filter(r => r.rating), avg = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : 0;
        const cnt = {}; rs.forEach(r => { const p = placeOf(r); if (p) cnt[p] = (cnt[p] || 0) + 1; });
        const topPlace = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], favs = rs.filter(r => r.favorite).sort((a, b) => b.rating - a.rating).slice(0, 5);
        const buckets = []; const P = ui.period;
        if (P === 'day') for (let i = 13; i >= 0; i--) { const d = Mx.addDays(today(), -i); buckets.push({ l: Mx.fmtDate(d, { day: 'numeric', month: 'short' }), test: r => r.date === d }); }
        else if (P === 'week') for (let i = 7; i >= 0; i--) { const s = Mx.weekStart(Mx.addDays(today(), -7 * i)), e = Mx.addDays(s, 6); buckets.push({ l: Mx.fmtDate(s, { day: 'numeric', month: 'short' }), test: r => r.date >= s && r.date <= e }); }
        else for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const k = Mx.iso(d).slice(0, 7); buckets.push({ l: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), test: r => r.date.slice(0, 7) === k }); }
        const vals = buckets.map(b => rs.filter(b.test).reduce((a, r) => a + r.price, 0)), max = Math.max(1, ...vals);
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📊 Statistik Makan</h2><p class="mx-muted">Dihitung dari catatan makanan yang tersimpan.</p></div></div>
        <div class="mx-stats"><div class="mx-stat"><span>Makanan dicatat</span><b>${rs.length}</b><small>${rs.filter(r => r.withoutRice).length} tanpa nasi</small></div><div class="mx-stat"><span>Total pengeluaran</span><b class="mx-sm">${Mx.fmtRp(total)}</b><small>rata-rata ${rs.length ? Mx.fmtRp(total / rs.length) : 'Rp0'} / catatan</small></div><div class="mx-stat"><span>Rata-rata rating</span><b>${avg ? avg.toFixed(1) : '—'}</b><small>${rated.length} dinilai</small></div></div>
        <div class="mx-grid2"><div class="mx-card"><h3 class="mx-h3">📍 Paling sering dikunjungi</h3>${topPlace ? `<b>${esc(topPlace[0])}</b> <span class="mx-count">${topPlace[1]}×</span>` : '<span class="mx-muted">Belum ada data tempat.</span>'}</div>
        <div class="mx-card"><h3 class="mx-h3">❤️ Makanan favorit</h3>${favs.length ? favs.map(r => `<div class="mx-row"><span>${esc(r.name)}</span><span class="mx-muted mx-xs" style="margin-left:auto">${r.rating ? Mx.stars(r.rating) : ''}</span></div>`).join('') : '<span class="mx-muted">Belum ada favorit.</span>'}</div></div>
        <div class="mx-card"><div class="mx-row"><h3 class="mx-h3">Riwayat pengeluaran</h3><span class="mx-chips" style="margin-left:auto">${[['day', 'Harian'], ['week', 'Mingguan'], ['month', 'Bulanan']].map(([k, l]) => `<button type="button" class="mx-chip${P === k ? ' on' : ''}" data-act="period" data-p="${k}">${l}</button>`).join('')}</span></div>
        <div class="mx-bars">${buckets.map((b, i) => `<div class="mx-bar"><div class="mx-bar-v">${vals[i] ? Mx.fmtRp(vals[i]).replace('Rp', '') : ''}</div><div class="mx-bar-col"><i style="height:${vals[i] / max * 100}%"></i></div><div class="mx-bar-l">${esc(b.l)}</div></div>`).join('')}</div></div>`;
    }

    // ----- tambahan -----
    function renderExtra() {
        const el = root('mk-extra'); if (!el) return; const rs = D().records;
        const good = rs.filter(r => r.favorite || r.rating >= 4); const pick = ui.pick && byId(rs, ui.pick);
        const groups = {}; rs.forEach(r => { const k = r.name.trim().toLowerCase(); (groups[k] = groups[k] || []).push(r); });
        const cmp = Object.values(groups).filter(g => g.length >= 2 && g.some(r => r.price)).map(g => { const p = g.filter(r => r.price), min = p.reduce((a, b) => b.price < a.price ? b : a), max = p.reduce((a, b) => b.price > a.price ? b : a); return { name: g[0].name, n: g.length, min, max, avg: p.reduce((a, r) => a + r.price, 0) / p.length }; }).sort((a, b) => b.n - a.n);
        const freq = Object.values(groups).map(g => ({ name: g[0].name, n: g.length, last: g.map(r => r.date).sort().pop() })).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 8);
        const marks = {}; rs.forEach(r => { marks[r.date] = (marks[r.date] || 0) + 1; });
        const dayRecs = ui.hSel ? rs.filter(r => r.date === ui.hSel) : [];
        const wl = D().wishlist.filter(w => w.type === ui.wishType);
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">✨ Fitur Tambahan</h2></div></div>
        <div class="mx-card"><h3 class="mx-h3">🎲 Rekomendasi dari favoritmu</h3><p class="mx-muted mx-xs">Dipilih acak dari makanan favorit / rating ≥ 4★ yang sudah kamu catat (bukan AI).</p>
        ${pick ? `<div class="mk-grid" style="max-width:360px">${recCard(pick)}</div>` : ''}<div class="mx-foot" style="justify-content:flex-start"><button type="button" class="mx-btn mx-btn-primary" data-act="pick" ${good.length ? '' : 'disabled'}>${pick ? 'Acak lagi' : 'Hari ini makan apa?'}</button>${good.length ? '' : '<span class="mx-muted mx-xs">Tandai favorit atau beri rating tinggi dulu.</span>'}</div></div>
        <div class="mx-card"><div class="mx-row"><h3 class="mx-h3">📌 Wishlist</h3><span class="mx-chips" style="margin-left:auto">${[['food', 'Ingin dicoba'], ['place', 'Restoran']].map(([k, l]) => `<button type="button" class="mx-chip${ui.wishType === k ? ' on' : ''}" data-act="wtype" data-t="${k}">${l}</button>`).join('')}</span></div>
        <form id="mkWishForm" class="mx-tools" novalidate><input name="name" class="mx-input" maxlength="100" placeholder="${ui.wishType === 'food' ? 'Makanan yang ingin dicoba…' : 'Nama restoran…'}" aria-label="Nama wishlist"><input name="note" class="mx-input" maxlength="200" placeholder="Catatan (opsional)" aria-label="Catatan wishlist"><button type="submit" class="mx-btn mx-btn-primary">Tambah</button></form>
        ${wl.length ? wl.map(w => `<div class="mk-wish${w.done ? ' done' : ''}"><label class="mx-check"><input type="checkbox" data-act="wdone" data-id="${esc(w.id)}" ${w.done ? 'checked' : ''}> <span><b>${esc(w.name)}</b>${w.note ? `<span class="mx-muted mx-xs"> — ${esc(w.note)}</span>` : ''}</span></label><button type="button" class="mx-icon" data-act="wdel" data-id="${esc(w.id)}" aria-label="Hapus">🗑</button></div>`).join('') : Mx.empty('📌', 'Wishlist kosong')}</div>
        <div class="mx-card"><h3 class="mx-h3">💸 Perbandingan harga</h3>${cmp.length ? `<div class="mk-table"><div class="mk-tr head"><span>Makanan</span><span>Termurah</span><span>Termahal</span><span>Rata-rata</span></div>${cmp.map(c => `<div class="mk-tr"><span><b>${esc(c.name)}</b> <span class="mx-count">${c.n}×</span></span><span>${Mx.fmtRp(c.min.price)}<small class="mx-muted"> ${esc(placeOf(c.min))}</small></span><span>${Mx.fmtRp(c.max.price)}<small class="mx-muted"> ${esc(placeOf(c.max))}</small></span><span>${Mx.fmtRp(c.avg)}</span></div>`).join('')}</div>` : '<p class="mx-muted">Butuh minimal 2 catatan dengan nama makanan yang sama (dan berharga) untuk dibandingkan.</p>'}</div>
        <div class="mx-card"><h3 class="mx-h3">🔁 Paling sering dibeli</h3>${freq.length ? freq.map((f, i) => `<div class="mx-row"><span class="mx-count">${i + 1}</span><b>${esc(f.name)}</b><span class="mx-muted mx-xs" style="margin-left:auto">${f.n}× · terakhir ${Mx.fmtDate(f.last)}</span></div>`).join('') : '<span class="mx-muted">Belum ada data.</span>'}</div>
        <div class="mx-card"><h3 class="mx-h3">📅 Kalender riwayat makan</h3><div class="dy-calwrap"><div id="mkHcal">${Mx.calHTML(ui.hCal, marks, ui.hSel)}</div><div>${ui.hSel ? `<b>${Mx.fmtDateLong(ui.hSel)}</b>${dayRecs.length ? `<div class="mk-grid">${dayRecs.map(recCard).join('')}</div>` : '<p class="mx-muted">Tidak ada catatan di tanggal ini.</p>'}` : '<p class="mx-muted">Pilih tanggal untuk melihat apa yang kamu makan.</p>'}</div></div></div>`;
    }

    // ----- modal jadwal -----
    function schedModal(s, presetDate) {
        Mx.modal({ title: s ? 'Edit jadwal makan' : 'Tambah jadwal makan', body: `<form novalidate><div class="mx-two"><div class="mx-field"><label>Waktu makan</label><select name="slot" class="mx-input">${Object.entries(SLOTS).map(([k, v]) => `<option value="${k}" ${(s ? s.slot : 'siang') === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></div><div class="mx-field"><label>Jam</label><input type="time" name="time" class="mx-input" value="${esc(s ? s.time : '')}"></div></div>
            <div class="mx-field"><label>Nama makanan *</label><input name="name" class="mx-input" maxlength="100" value="${esc(s ? s.name : '')}"></div>
            <div class="mx-two"><div class="mx-field"><label>Tanggal</label><input type="date" name="date" class="mx-input" value="${esc(s ? s.date : (presetDate || today()))}"></div><div class="mx-field"><label>Pengulangan</label><select name="repeat" class="mx-input">${Object.entries(REPEAT).map(([k, v]) => `<option value="${k}" ${(s ? s.repeat : 'none') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
            <div class="mx-field"><label>Deskripsi</label><textarea name="desc" class="mx-input" rows="2" maxlength="500">${esc(s ? s.desc : '')}</textarea></div>
            <div class="mx-field"><label>Gambar makanan (16:9)</label>${Mx.imageFieldHTML('sch', s ? s.image : '')}</div><small class="mx-err" data-err hidden></small>
            <div class="mx-foot"><button type="button" class="mx-btn" data-mx-close>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount(api) {
                const f = api.body.querySelector('form'), getImg = Mx.bindImageField(f); f.querySelector('[data-mx-close]').addEventListener('click', api.close);
                f.addEventListener('submit', e => {
                    e.preventDefault(); const name = f.elements.name.value.trim(), er = f.querySelector('[data-err]');
                    if (!name) { er.textContent = 'Nama makanan wajib diisi.'; er.hidden = false; return; }
                    const vals = { slot: f.elements.slot.value, time: f.elements.time.value, name, date: f.elements.date.value || today(), repeat: f.elements.repeat.value, desc: f.elements.desc.value.trim(), image: getImg() };
                    if (s) Object.assign(s, vals); else D().schedules.push({ id: uid(), doneDates: [], created: new Date().toISOString(), ...vals });
                    save(); api.close(); rerender(); Mx.toast(s ? 'Jadwal diperbarui' : 'Jadwal ditambahkan');
                });
            } });
    }

    const go = v => App.UI.switchTab(v, document.getElementById('subtab-' + v));
    const acts = {
        goto: el => go(el.dataset.v), jmode: el => { ui.jMode = el.dataset.m; renderJadwal(); }, sadd: el => schedModal(null, el.dataset.date),
        sedit: el => { const s = byId(D().schedules, el.dataset.id); if (s) schedModal(s); },
        sdel: async el => { const s = byId(D().schedules, el.dataset.id); if (!s || !(await Mx.confirm(`Hapus jadwal "${s.name}"${s.repeat !== 'none' ? ' (termasuk seluruh pengulangannya)' : ''}?`))) return; D().schedules = D().schedules.filter(x => x.id !== s.id); save(); rerender(); Mx.toast('Jadwal dihapus'); },
        sdone: el => { const s = byId(D().schedules, el.dataset.id); if (!s) return; const iso = el.dataset.iso; s.doneDates = el.checked ? [...new Set([...s.doneDates, iso])] : s.doneDates.filter(d => d !== iso); save(); rerender(); },
        'wk-prev': () => { ui.weekStart = Mx.addDays(ui.weekStart, -7); renderJadwal(); }, 'wk-next': () => { ui.weekStart = Mx.addDays(ui.weekStart, 7); renderJadwal(); },
        'cal-prev': el => { const h = el.closest('#mkHcal'); Mx.calShift(h ? ui.hCal : ui.cal, -1); rerender(); }, 'cal-next': el => { const h = el.closest('#mkHcal'); Mx.calShift(h ? ui.hCal : ui.cal, 1); rerender(); },
        'cal-day': el => { if (el.closest('#mkHcal')) ui.hSel = el.dataset.iso; else ui.calSel = el.dataset.iso; rerender(); },
        detail: el => { const r = byId(D().records, el.dataset.id); if (r) detailModal(r); },
        freset: () => { ui.f = { q: '', place: '', rating: 0, cat: '', from: '', to: '', fav: false, norice: false, sort: 'new' }; const r = root('mk-riwayat'); r.innerHTML = ''; renderRiwayat(); },
        period: el => { ui.period = el.dataset.p; renderStatistik(); },
        pick: () => { const good = D().records.filter(r => r.favorite || r.rating >= 4); if (!good.length) return; let c; do { c = good[Math.floor(Math.random() * good.length)]; } while (good.length > 1 && c.id === ui.pick); ui.pick = c.id; renderExtra(); },
        wtype: el => { ui.wishType = el.dataset.t; renderExtra(); }, wdone: el => { const w = byId(D().wishlist, el.dataset.id); if (w) { w.done = el.checked; save(); renderExtra(); } },
        wdel: async el => { const w = byId(D().wishlist, el.dataset.id); if (!w || !(await Mx.confirm(`Hapus "${w.name}" dari wishlist?`))) return; D().wishlist = D().wishlist.filter(x => x.id !== w.id); save(); renderExtra(); }
    };
    const RENDER = { 'mk-jadwal': renderJadwal, 'mk-catat': renderCatat, 'mk-riwayat': renderRiwayat, 'mk-statistik': renderStatistik, 'mk-extra': renderExtra };
    let current = 'mk-jadwal';
    const rerender = () => { const f = RENDER[current]; if (f) f(); };

    AppModules.register(KEY, {
        label: 'Makan', views: Object.keys(RENDER), normalize, validate,
        todayItems() { const t = today(); return itemsOn(t).map(s => ({ name: s.name, time: s.time, slot: SLOTS[s.slot][1], icon: SLOTS[s.slot][0], done: isDone(s, t) })); },
        init() {
            Object.keys(RENDER).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id === 'mkQ') { ui.f.q = e.target.value; renderRiwayat(); } },
                    change: e => { const id = e.target.id, f = ui.f, set = (k, val) => { f[k] = val; renderRiwayat(); };
                        if (id === 'mkPlace') set('place', e.target.value); if (id === 'mkRating') set('rating', +e.target.value); if (id === 'mkCat') set('cat', e.target.value); if (id === 'mkSort') set('sort', e.target.value);
                        if (id === 'mkFrom') set('from', e.target.value); if (id === 'mkTo') set('to', e.target.value); if (id === 'mkFav') set('fav', e.target.checked); if (id === 'mkNoRice') set('norice', e.target.checked); }
                });
                r.addEventListener('submit', e => {
                    if (e.target.id !== 'mkWishForm') return; e.preventDefault(); const name = e.target.elements.name.value.trim();
                    if (!name) { Mx.toast('Nama wajib diisi', 'error'); return; }
                    D().wishlist.push({ id: uid(), type: ui.wishType, name, note: e.target.elements.note.value.trim(), done: false, created: new Date().toISOString() }); save(); renderExtra(); Mx.toast('Ditambahkan ke wishlist');
                });
                r.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mk-rec')) { e.preventDefault(); acts.detail(e.target); } });
            });
        },
        show(v) { current = v; if (v === 'mk-riwayat') { root(v).innerHTML = ''; } rerender(); },
        refresh() { const r = root(current); if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { if (current === 'mk-riwayat') { r.innerHTML = ''; } rerender(); } },
        isBusy: () => !!document.querySelector('.mx-overlay')
    });
})();
