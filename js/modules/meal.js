/* ==========================================================================
   MODUL MAKAN — catatan makan hari ini, riwayat, dan wishlist
   Data: AppModules 'meal' = { records, wishlist, schedules (warisan, tanpa tampilan sejak v9.11) }
   - records: nasi per makan lewat `rice` ('own' nasi sendiri | 'bought' beli nasi | 'none' tanpa nasi | '' belum diisi).
     `withoutRice` tetap diisi (rice === 'none') agar backup lama/baru saling kompatibel.
   - schedules: jadwal makan lama dipertahankan di data (ikut backup & sumber roda "Makan apa?"), tapi tidak ada tampilannya.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'meal';
    const SLOTS = { sarapan: ['🌅', 'Sarapan'], siang: ['☀️', 'Makan siang'], malam: ['🌙', 'Makan malam'], camilan: ['🍿', 'Camilan'] };
    const REPEAT = { none: 'Sekali saja', daily: 'Setiap hari', weekly: 'Setiap minggu (hari yang sama)' };
    const RICE = { own: ['🍚', 'Nasi sendiri'], bought: ['🛒', 'Beli nasi'], none: ['🚫', 'Tanpa nasi'] };
    const { esc, uid, today, byId } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const FILTER0 = () => ({ q: '', place: '', rating: 0, rice: '', from: '', to: '', fav: false, sort: 'new' });
    const ui = { f: FILTER0(), wishType: 'food' };

    function normalize(raw) {
        raw = raw || {};
        const schedules = arr(raw.schedules).filter(s => s && s.name).map(s => ({ id: String(s.id || uid()), slot: SLOTS[s.slot] ? s.slot : 'siang', name: String(s.name).slice(0, 100), time: /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '', desc: String(s.desc || '').slice(0, 500), image: Mx.safeImg(s.image), date: isoOk(s.date) ? s.date : today(), repeat: REPEAT[s.repeat] ? s.repeat : 'none', doneDates: arr(s.doneDates).filter(isoOk), created: s.created || new Date().toISOString() }));
        const records = arr(raw.records).filter(r => r && r.name).map(r => {
            const rice = RICE[r.rice] ? r.rice : (r.withoutRice ? 'none' : '');
            return { id: String(r.id || uid()), name: String(r.name).slice(0, 100), place: String(r.place || '').slice(0, 100), location: String(r.location || '').slice(0, 120), price: Math.max(0, Number(r.price) || 0), rating: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))), image: Mx.safeImg(r.image), rice, withoutRice: rice === 'none', desc: String(r.desc || '').slice(0, 1000), notes: String(r.notes || '').slice(0, 1000), category: String(r.category || 'Lainnya'), date: isoOk(r.date) ? r.date : today(), favorite: !!r.favorite, txId: r.txId ? String(r.txId) : '', created: r.created || new Date().toISOString(), updated: r.updated || r.created || new Date().toISOString() };
        });
        const wishlist = arr(raw.wishlist).filter(w => w && w.name).map(w => ({ id: String(w.id || uid()), type: w.type === 'place' ? 'place' : 'food', name: String(w.name).slice(0, 100), note: String(w.note || '').slice(0, 200), done: !!w.done, created: w.created || new Date().toISOString() }));
        return { schedules, records, wishlist };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; ['schedules', 'records', 'wishlist'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        arr(raw.records).forEach((r, i) => { if (!r || typeof r !== 'object' || !r.name) e.push(`catatan makanan #${i + 1} tidak punya nama`); });
        return e.slice(0, 5);
    }

    // ----- komponen bersama -----
    const img169 = (src, ico) => `<div class="mx-img169">${src ? `<img loading="lazy" decoding="async" alt="" src="${esc(src)}">` : `<span class="mx-img-ph">${ico || '🍽️'}</span>`}</div>`;
    const ricePill = r => r.rice ? `<span class="mx-pill${r.rice === 'own' ? ' pri-low' : ''}">${RICE[r.rice][0]} ${RICE[r.rice][1]}</span>` : '';
    const placeOf = r => r.place || r.location || '';
    const todayRecords = () => D().records.filter(r => r.date === today()).sort((a, b) => String(a.created).localeCompare(String(b.created)));

    // ----- form catatan makanan (dipakai inline & di modal) -----
    function recordForm(r, expanded) {
        r = r || { name: '', place: '', location: '', price: 0, rating: 0, image: '', rice: '', notes: '', date: today(), favorite: false };
        return `<form class="mk-form" novalidate>
        <div class="mx-field"><label>Nama makanan *</label><input name="name" class="mx-input" maxlength="100" placeholder="Contoh: Nasi goreng spesial" value="${esc(r.name)}"></div>
        <div class="mx-field"><label>Nasi</label><div class="mx-chips mk-rice" role="radiogroup" aria-label="Sumber nasi">${Object.entries(RICE).map(([k, v]) => `<button type="button" class="mx-chip${r.rice === k ? ' on' : ''}" role="radio" aria-checked="${r.rice === k}" data-rice="${k}">${v[0]} ${v[1]}</button>`).join('')}</div><input type="hidden" name="rice" value="${esc(r.rice)}"></div>
        <div class="mx-two"><div class="mx-field"><label>Harga (Rp)</label><input name="price" class="mx-input" inputmode="numeric" placeholder="0" value="${r.price ? new Intl.NumberFormat('id-ID').format(r.price) : ''}"></div>
        <div class="mx-field"><label>Rating</label><div class="mk-stars" role="radiogroup" aria-label="Rating bintang">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="mk-star${i <= r.rating ? ' on' : ''}" data-star="${i}" role="radio" aria-checked="${i === r.rating}" aria-label="${i} bintang">★</button>`).join('')}</div><input type="hidden" name="rating" value="${r.rating}"></div></div>
        <div class="mx-row"><label class="mx-switch"><span>❤️ Favorit</span><input type="checkbox" name="favorite" ${r.favorite ? 'checked' : ''}></label></div>
        <details class="mk-more"${expanded ? ' open' : ''}><summary>Detail tambahan <small class="mx-muted">tempat, tanggal, foto, catatan</small></summary>
        <div class="mx-two"><div class="mx-field"><label>Nama tempat / restoran</label><input name="place" class="mx-input" maxlength="100" value="${esc(r.place)}"></div><div class="mx-field"><label>Lokasi (area / kota)</label><input name="location" class="mx-input" maxlength="120" value="${esc(r.location)}"></div></div>
        <div class="mx-field"><label>Tanggal</label><input type="date" name="date" class="mx-input" value="${esc(r.date)}"></div>
        <div class="mx-field"><label>Foto makanan (rasio 16:9)</label>${Mx.imageFieldHTML('rec', r.image)}</div>
        <div class="mx-field"><label>Catatan</label><textarea name="notes" class="mx-input" rows="2" maxlength="1000">${esc(r.notes)}</textarea></div></details>
        <small class="mx-err" data-err hidden></small><div class="mx-foot">${r.id ? '<button type="button" class="mx-btn" data-mx-cancel>Batal</button>' : ''}<button type="submit" class="mx-btn mx-btn-primary">${r.id ? 'Simpan perubahan' : 'Catat makanan'}</button></div></form>`;
    }
    function bindRecordForm(box, rec, done, cancel) {
        const f = box.querySelector('form'), getImg = Mx.bindImageField(f), price = f.elements.price, err = f.querySelector('[data-err]');
        price.addEventListener('input', () => { const n = Mx.parseRp(price.value); price.value = n ? new Intl.NumberFormat('id-ID').format(n) : ''; });
        f.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', () => {
            const v = +b.dataset.star, cur = +f.elements.rating.value, nv = v === cur ? 0 : v; f.elements.rating.value = nv;
            f.querySelectorAll('[data-star]').forEach(x => { x.classList.toggle('on', +x.dataset.star <= nv); x.setAttribute('aria-checked', String(+x.dataset.star === nv)); });
        }));
        f.querySelectorAll('[data-rice]').forEach(b => b.addEventListener('click', () => {
            const nv = f.elements.rice.value === b.dataset.rice ? '' : b.dataset.rice; f.elements.rice.value = nv; // tekan lagi = batalkan pilihan
            f.querySelectorAll('[data-rice]').forEach(x => { const on = x.dataset.rice === nv; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
        }));
        const cancelBtn = f.querySelector('[data-mx-cancel]'); if (cancel && cancelBtn) cancelBtn.addEventListener('click', cancel);
        f.addEventListener('submit', e => {
            e.preventDefault(); err.hidden = true; const g = n => f.elements[n].value.trim(), name = g('name');
            if (!name) { err.textContent = 'Nama makanan wajib diisi.'; err.hidden = false; f.elements.name.focus(); return; }
            const now = new Date().toISOString(), rice = RICE[g('rice')] ? g('rice') : '';
            const vals = { name, place: g('place'), location: g('location'), price: Mx.parseRp(g('price')), date: g('date') || today(), rating: +f.elements.rating.value || 0, rice, withoutRice: rice === 'none', favorite: f.elements.favorite.checked, image: getImg(), notes: g('notes') };
            if (rec) Object.assign(rec, vals, { updated: now }); else D().records.push({ id: uid(), created: now, updated: now, category: 'Lainnya', desc: '', txId: '', ...vals });
            save(); done(!!rec);
        });
    }
    function recordModal(rec) {
        Mx.modal({ title: 'Edit catatan makanan', size: 600, body: recordForm(rec, true), onMount(api) { bindRecordForm(api.body, rec, () => { api.close(); rerender(); Mx.toast('Catatan diperbarui'); }, api.close); } });
    }

    // ----- kartu catatan -----
    function recCard(r, quickRate) {
        const stars = quickRate
            ? `<span class="mk-qrate" role="group" aria-label="Rating ${esc(r.name)}">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="mk-star${i <= r.rating ? ' on' : ''}" data-act="qrate" data-id="${esc(r.id)}" data-v="${i}" aria-label="${i} bintang">★</button>`).join('')}</span>`
            : `<span class="mk-rate">${r.rating ? Mx.stars(r.rating) : '<span class="mx-muted mx-xs">belum dinilai</span>'}</span>`;
        return `<article class="mk-rec" data-act="detail" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Detail ${esc(r.name)}">${img169(r.image)}<div class="mk-rbody"><div class="mx-row"><b class="mk-sname">${esc(r.name)}</b>${r.favorite ? '<span title="Favorit">❤️</span>' : ''}</div>
        ${placeOf(r) ? `<div class="mx-muted mx-xs">📍 ${esc([r.place, r.location].filter(Boolean).join(' · '))}</div>` : ''}<div class="mx-row">${stars}<b style="margin-left:auto">${r.price ? Mx.fmtRp(r.price) : ''}</b></div>
        <div class="mx-row mx-gap-s">${ricePill(r)}<span class="mx-pill">${Mx.fmtDate(r.date)}</span></div></div></article>`;
    }

    // ----- hari ini -----
    function renderToday(resetForm) {
        const el = root('mk-today'); if (!el) return;
        if (resetForm || !el.querySelector('#mkCatatBox')) { // kerangka + form dibuat sekali; render berikutnya hanya memperbarui statistik & daftar agar ketikan tidak hilang
            el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🍽️ Makan Hari Ini</h2></div></div><div class="mx-stats" id="mkStats"></div>
            <div class="mx-card" id="mkCatatBox">${recordForm(null, false)}</div><div id="mkTodayList"></div>`;
            bindRecordForm(el.querySelector('#mkCatatBox'), null, () => { Mx.toast('Catatan makanan tersimpan'); renderToday(true); });
        }
        const recs = todayRecords(), month = today().slice(0, 7), mrs = D().records.filter(r => r.date.slice(0, 7) === month);
        const own = mrs.filter(r => r.rice === 'own').length, bought = mrs.filter(r => r.rice === 'bought').length;
        el.querySelector('#mkStats').innerHTML = `<div class="mx-stat"><span>Hari ini</span><b>${recs.length}</b><small>makanan dicatat</small></div><div class="mx-stat"><span>Nasi sendiri</span><b>${own}×</b><small>bulan ini</small></div><div class="mx-stat"><span>Beli nasi</span><b>${bought}×</b><small>bulan ini</small></div>`;
        renderTodayList(el, recs, D().wishlist.filter(w => w.type === ui.wishType));
    }
    function renderTodayList(el, recs, wl) {
        el.querySelector('#mkTodayList').innerHTML = `${recs.length ? `<div class="mk-grid">${recs.map(r => recCard(r, true)).join('')}</div>` : Mx.empty('🍽️', 'Belum ada makanan dicatat hari ini', 'Catat makanan pertamamu di atas 👆')}
        <div class="mx-card" style="margin-top:1rem"><div class="mx-row"><h3 class="mx-h3">📌 Wishlist</h3><span class="mx-chips" style="margin-left:auto">${[['food', 'Ingin dicoba'], ['place', 'Restoran']].map(([k, l]) => `<button type="button" class="mx-chip${ui.wishType === k ? ' on' : ''}" data-act="wtype" data-t="${k}">${l}</button>`).join('')}</span></div>
        <form id="mkWishForm" class="mx-tools" novalidate><input name="name" class="mx-input" maxlength="100" placeholder="${ui.wishType === 'food' ? 'Makanan yang ingin dicoba…' : 'Nama restoran…'}" aria-label="Nama wishlist"><input name="note" class="mx-input" maxlength="200" placeholder="Catatan (opsional)" aria-label="Catatan wishlist"><button type="submit" class="mx-btn mx-btn-primary">Tambah</button></form>
        ${wl.length ? wl.map(w => `<div class="mk-wish${w.done ? ' done' : ''}"><label class="mx-check"><input type="checkbox" data-act="wdone" data-id="${esc(w.id)}" ${w.done ? 'checked' : ''}> <span><b>${esc(w.name)}</b>${w.note ? `<span class="mx-muted mx-xs"> — ${esc(w.note)}</span>` : ''}</span></label><button type="button" class="mx-icon" data-act="wdel" data-id="${esc(w.id)}" aria-label="Hapus">🗑</button></div>`).join('') : Mx.empty('📌', 'Wishlist kosong')}</div>`;
    }

    // ----- riwayat -----
    function filtered() {
        const f = ui.f, q = f.q.toLowerCase();
        const list = D().records.filter(r => (!q || `${r.name} ${r.place} ${r.location}`.toLowerCase().includes(q)) && (!f.place || placeOf(r) === f.place || r.location === f.place) && (!f.rating || r.rating >= f.rating) && (!f.rice || r.rice === f.rice) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.fav || r.favorite));
        const S = { new: (a, b) => (b.date + b.created).localeCompare(a.date + a.created), old: (a, b) => (a.date + a.created).localeCompare(b.date + b.created), phi: (a, b) => b.price - a.price, plo: (a, b) => a.price - b.price, rhi: (a, b) => b.rating - a.rating, rlo: (a, b) => a.rating - b.rating };
        return list.sort(S[f.sort] || S.new);
    }
    function renderRiwayat() {
        const el = root('mk-riwayat'); if (!el) return; const f = ui.f, list = filtered();
        const places = [...new Set(D().records.flatMap(r => [r.place, r.location]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
        const grid = el.querySelector('#mkList');
        const listHtml = `<p class="mx-muted mx-xs">${list.length} dari ${D().records.length} catatan.</p>` + (list.length ? `<div class="mk-grid">${list.map(r => recCard(r, false)).join('')}</div>` : Mx.empty('🍜', D().records.length ? 'Tidak ada yang cocok dengan filter' : 'Belum ada catatan makanan', D().records.length ? '' : 'Mulai dari tab "Hari Ini".'));
        if (grid) { grid.innerHTML = listHtml; return; }
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🍜 Riwayat Makanan</h2></div><button type="button" class="mx-btn mx-btn-primary" data-act="goto" data-v="mk-today">＋ Catat makanan</button></div>
        <div class="mx-card"><input id="mkQ" class="mx-input" type="search" placeholder="🔍 Cari nama makanan / tempat…" value="${esc(f.q)}" aria-label="Cari makanan">
        <div class="mx-tools" style="margin-top:.6rem"><select id="mkPlace" class="mx-input" aria-label="Filter lokasi"><option value="">Semua lokasi</option>${places.map(p => `<option ${p === f.place ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select id="mkRating" class="mx-input" aria-label="Filter rating"><option value="0">Semua rating</option>${[5, 4, 3, 2, 1].map(i => `<option value="${i}" ${f.rating === i ? 'selected' : ''}>${i}★ ke atas</option>`).join('')}</select>
        <select id="mkRice" class="mx-input" aria-label="Filter nasi"><option value="">Semua nasi</option>${Object.entries(RICE).map(([k, v]) => `<option value="${k}" ${f.rice === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select>
        <select id="mkSort" class="mx-input" aria-label="Urutkan">${[['new', 'Terbaru'], ['old', 'Terlama'], ['phi', 'Harga tertinggi'], ['plo', 'Harga terendah'], ['rhi', 'Rating tertinggi'], ['rlo', 'Rating terendah']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="mx-tools"><label class="mx-muted mx-xs">Dari <input type="date" id="mkFrom" class="mx-input" value="${f.from}"></label><label class="mx-muted mx-xs">Sampai <input type="date" id="mkTo" class="mx-input" value="${f.to}"></label>
        <label class="mx-check"><input type="checkbox" id="mkFav" ${f.fav ? 'checked' : ''}> ❤️ Favorit saja</label><button type="button" class="mx-btn mx-btn-sm" data-act="freset">Reset filter</button></div></div><div id="mkList">${listHtml}</div>`;
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
        <div class="mx-row mx-gap-s">${ricePill(r)}${r.favorite ? '<span class="mx-pill pri-high">❤️ Favorit</span>' : ''}</div>
        <dl class="mk-dl"><dt>Tempat</dt><dd>${esc(r.place || '—')}</dd><dt>Lokasi</dt><dd>${esc(r.location || '—')}</dd><dt>Tanggal</dt><dd>${Mx.fmtDateLong(r.date)}</dd>${r.desc ? `<dt>Deskripsi</dt><dd>${esc(r.desc)}</dd>` : ''}${r.notes ? `<dt>Catatan</dt><dd>${esc(r.notes)}</dd>` : ''}</dl>
        <div class="mx-foot"><button type="button" class="mx-btn" data-d="fav">${r.favorite ? '💔 Hapus favorit' : '❤️ Jadikan favorit'}</button>${r.price > 0 ? (r.txId ? '<span class="mx-pill" title="Sudah dicatat sebagai pengeluaran">✅ Tercatat di Keuangan</span>' : '<button type="button" class="mx-btn" data-d="fin">💸 Catat ke Keuangan</button>') : ''}<button type="button" class="mx-btn" data-d="edit">✎ Edit</button><button type="button" class="mx-btn mx-btn-danger" data-d="del">🗑 Hapus</button></div></div>`,
            onMount(api) {
                api.body.querySelector('[data-d=fav]').addEventListener('click', () => { r.favorite = !r.favorite; r.updated = new Date().toISOString(); save(); api.close(); rerender(); Mx.toast(r.favorite ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit'); });
                const finBtn = api.body.querySelector('[data-d=fin]'); if (finBtn) finBtn.addEventListener('click', () => { api.close(); logExpense(r); });
                api.body.querySelector('[data-d=edit]').addEventListener('click', () => { api.close(); recordModal(r); });
                api.body.querySelector('[data-d=del]').addEventListener('click', async () => { if (!(await Mx.confirm(`Hapus catatan "${r.name}"?`))) return; D().records = D().records.filter(x => x.id !== r.id); save(); api.close(); rerender(); Mx.toast('Catatan dihapus'); });
            } });
    }

    const go = v => App.UI.switchTab(v, document.getElementById('subtab-' + v));
    const acts = {
        goto: el => go(el.dataset.v),
        detail: el => { const r = byId(D().records, el.dataset.id); if (r) detailModal(r); },
        qrate: el => { // rating cepat dari kartu hari ini; tekan bintang yang sama = hapus rating
            const r = byId(D().records, el.dataset.id); if (!r) return; const v = +el.dataset.v;
            r.rating = r.rating === v ? 0 : v; r.updated = new Date().toISOString(); save(); renderToday();
        },
        freset: () => { ui.f = FILTER0(); const r = root('mk-riwayat'); r.innerHTML = ''; renderRiwayat(); },
        wtype: el => { ui.wishType = el.dataset.t; renderToday(); },
        wdone: el => { const w = byId(D().wishlist, el.dataset.id); if (w) { w.done = el.checked; save(); renderToday(); } },
        wdel: async el => { const w = byId(D().wishlist, el.dataset.id); if (!w || !(await Mx.confirm(`Hapus "${w.name}" dari wishlist?`))) return; D().wishlist = D().wishlist.filter(x => x.id !== w.id); save(); renderToday(); }
    };
    const RENDER = { 'mk-today': renderToday, 'mk-riwayat': renderRiwayat };
    let current = 'mk-today';
    const rerender = () => { const f = RENDER[current]; if (f) f(); };

    AppModules.register(KEY, {
        label: 'Makan', views: Object.keys(RENDER), normalize, validate,
        // Kartu "Makan hari ini" di Beranda: makanan yang sudah dicatat hari ini
        todayItems() { return todayRecords().map(r => ({ name: r.name, time: r.rating ? '★'.repeat(r.rating) : '', slot: r.rice ? RICE[r.rice][1] : '', icon: r.rice ? RICE[r.rice][0] : '🍽️', done: true })); },
        init() {
            Object.keys(RENDER).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id === 'mkQ') { ui.f.q = e.target.value; renderRiwayat(); } },
                    change: e => { const id = e.target.id, f = ui.f, set = (k, val) => { f[k] = val; renderRiwayat(); };
                        if (id === 'mkPlace') set('place', e.target.value); if (id === 'mkRating') set('rating', +e.target.value); if (id === 'mkRice') set('rice', e.target.value); if (id === 'mkSort') set('sort', e.target.value);
                        if (id === 'mkFrom') set('from', e.target.value); if (id === 'mkTo') set('to', e.target.value); if (id === 'mkFav') set('fav', e.target.checked); }
                });
                r.addEventListener('submit', e => {
                    if (e.target.id !== 'mkWishForm') return; e.preventDefault(); const name = e.target.elements.name.value.trim();
                    if (!name) { Mx.toast('Nama wajib diisi', 'error'); return; }
                    D().wishlist.push({ id: uid(), type: ui.wishType, name, note: e.target.elements.note.value.trim(), done: false, created: new Date().toISOString() }); save(); renderToday(); Mx.toast('Ditambahkan ke wishlist');
                });
                r.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mk-rec')) { e.preventDefault(); acts.detail(e.target); } });
            });
        },
        show(v) { current = v; if (v === 'mk-riwayat') { root(v).innerHTML = ''; } rerender(); },
        refresh() { const r = root(current); if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { if (current === 'mk-riwayat') { r.innerHTML = ''; } rerender(); } },
        isBusy: () => !!document.querySelector('.mx-overlay')
    });
})();
