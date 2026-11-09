/* ==========================================================================
   MODUL BRANKAS SANDI — penyimpan kata sandi pribadi, terenkripsi di perangkat.
   Keamanan:
   - Kunci utama TIDAK pernah disimpan. Kunci enkripsi diturunkan dengan PBKDF2-SHA256 (250.000 iterasi, salt acak 16 byte).
   - Isi brankas dienkripsi AES-256-GCM (IV acak tiap simpan). Yang tersimpan/ter-sinkron (Firebase, backup JSON) hanya ciphertext.
   - Teks asli hanya ada di memori saat terbuka; terkunci otomatis (diam 2 menit / app disembunyikan > 1 menit / ganti akun).
   - Lupa kunci utama = isi brankas tidak bisa dipulihkan (tidak ada jalur "reset sandi").
   Data: AppModules 'vault' = { v:1, salt, check:{iv,ct}, data:{iv,ct}|null }
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'vault', ITER = 250000, CHECK = 'BYGF-VAULT-OK', IDLE_MS = 120000, AWAY_MS = 60000, CLIP_MS = 30000;
    const CATS = [['akun', '🌐 Akun online'], ['kampus', '🎓 Kampus'], ['uang', '💳 Keuangan'], ['sosial', '💬 Sosial'], ['lain', '🔖 Lainnya']];
    const CAT = Object.fromEntries(CATS);
    const { esc, uid } = Mx;
    const D = () => AppModules.get(KEY), root = () => document.getElementById('view-vault-home');
    const hasCrypto = () => !!(window.crypto && crypto.subtle && window.isSecureContext !== false);
    const enc = new TextEncoder(), dec = new TextDecoder();
    const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const isB64 = s => typeof s === 'string' && s.length < 4000000 && /^[A-Za-z0-9+/]*={0,2}$/.test(s);
    const pair = o => (o && typeof o === 'object' && isB64(o.iv) && isB64(o.ct) && o.iv && o.ct) ? { iv: o.iv, ct: o.ct } : null;

    // ----- kripto -----
    async function derive(pass, salt) {
        const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function seal(key, text) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
        return { iv: b64(iv), ct: b64(ct) };
    }
    async function open(key, p) { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, key, unb64(p.ct))); }

    // ----- generator sandi -----
    function randInt(max) { const lim = Math.floor(0x100000000 / max) * max; const a = new Uint32Array(1); do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % max; }
    function generate(len, symbols) {
        const L = 'abcdefghijkmnopqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', N = '23456789', S = '!@#$%^&*-_=+?';
        const sets = [L, U, N].concat(symbols ? [S] : []), all = sets.join(''), out = sets.map(s => s[randInt(s.length)]);
        while (out.length < len) out.push(all[randInt(all.length)]);
        for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
        return out.join('');
    }
    function strength(p) {
        let pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^A-Za-z0-9]/.test(p)) pool += 20;
        const bits = p.length * Math.log2(pool || 1);
        return bits < 40 ? ['Lemah', '#ef4444', 25] : bits < 60 ? ['Cukup', '#f59e0b', 55] : bits < 80 ? ['Kuat', '#10b981', 80] : ['Sangat kuat', '#059669', 100];
    }

    // ----- normalisasi / validasi (hanya ciphertext) -----
    function normalize(raw) {
        raw = raw && typeof raw === 'object' ? raw : {};
        const salt = isB64(raw.salt) ? raw.salt : '';
        return { v: 1, salt, check: salt ? pair(raw.check) : null, data: salt ? pair(raw.data) : null };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format brankas tidak valid'];
        const e = []; if (raw.salt != null && !isB64(raw.salt)) e.push('salt tidak valid');
        if (raw.salt && !pair(raw.check)) e.push('penanda kunci tidak valid');
        if (raw.data != null && !pair(raw.data)) e.push('isi terenkripsi tidak valid');
        return e;
    }

    // ----- sesi (memori saja) -----
    let session = null, ui = { q: '', cat: '', reveal: new Set(), fails: 0, lockUntil: 0, busy: false }, idleT = null, hiddenAt = 0, writeQ = Promise.resolve();
    const curUid = () => (window.App && App.State.user && App.State.user.uid) || '';
    function touch() { clearTimeout(idleT); if (session) idleT = setTimeout(() => lock('Terkunci otomatis karena tidak ada aktivitas'), IDLE_MS); }
    function lock(msg) {
        const was = !!session; session = null; clearTimeout(idleT); ui.reveal.clear(); ui.q = ''; ui.cat = '';
        document.querySelectorAll('.vt-modal-ov').forEach(x => x.remove()); // tutup form yang masih berisi sandi
        render(); if (was && msg) Mx.toast(msg, 'info');
    }
    function persist() { // enkripsi ulang seluruh isi lalu simpan (antrean agar urutan tulis aman)
        const s = session; if (!s) return Promise.resolve();
        const snapshot = JSON.stringify(s.items);
        writeQ = writeQ.then(async () => {
            if (session !== s) return;
            const e = await seal(s.key, snapshot); D().data = e; s.lastCt = e.ct; AppModules.changed(KEY);
        }).catch(err => { console.error('Gagal menyimpan brankas', err); Mx.toast('Gagal menyimpan brankas', 'error'); });
        return writeQ;
    }

    async function setup(pass) {
        const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pass, salt);
        D().salt = b64(salt); D().check = await seal(key, CHECK); D().data = null;
        session = { key, items: [], salt: D().salt, uid: curUid(), lastCt: '' };
        await persist(); touch();
    }
    async function unlock(pass) {
        const d = D(); if (!d.salt || !d.check) throw new Error('belum-ada');
        const key = await derive(pass, unb64(d.salt));
        let ok = false; try { ok = (await open(key, d.check)) === CHECK; } catch (e) { ok = false; }
        if (!ok) throw new Error('salah');
        let items = []; if (d.data) { try { const a = JSON.parse(await open(key, d.data)); items = Array.isArray(a) ? a : []; } catch (e) { throw new Error('rusak'); } }
        session = { key, items: items.filter(i => i && typeof i === 'object' && i.id), salt: d.salt, uid: curUid(), lastCt: d.data ? d.data.ct : '' };
        touch();
    }

    // ----- tampilan -----
    const cardWrap = (inner) => `<section class="mx-card vt-card">${inner}</section>`;
    function viewUnsupported() { return cardWrap(Mx.empty('⚠️', 'Brankas tidak tersedia', 'Peramban ini tidak mendukung enkripsi (butuh alamat https). Buka lewat GitHub Pages / aplikasi Android.')); }
    function viewSetup() {
        return cardWrap(`<div class="vt-hero">🔐</div><h2 class="mx-h2">Buat Kunci Utama</h2>
        <p class="mx-muted">Satu kunci utama untuk membuka semua sandi di sini. Kunci ini <b>tidak disimpan di mana pun</b> — kalau lupa, isi brankas tidak bisa dipulihkan siapa pun, termasuk saya.</p>
        <form id="vtSetup" autocomplete="off"><div class="mx-field"><label for="vtP1">Kunci utama (min. 8 karakter)</label><input id="vtP1" type="password" class="mx-input" autocomplete="new-password" minlength="8" required></div>
        <div class="vt-meter" aria-hidden="true"><i id="vtBar"></i></div><small class="mx-muted" id="vtBarTxt"></small>
        <div class="mx-field"><label for="vtP2">Ulangi kunci utama</label><input id="vtP2" type="password" class="mx-input" autocomplete="new-password" required></div>
        <label class="vt-agree"><input type="checkbox" id="vtAgree"> <span>Saya mengerti: jika lupa kunci utama, isi brankas hilang permanen.</span></label>
        <p class="vt-err" id="vtErr" role="alert" hidden></p><button type="submit" class="mx-btn mx-btn-primary">Buat Brankas</button></form>`);
    }
    function viewLocked() {
        return cardWrap(`<div class="vt-hero">🔒</div><h2 class="mx-h2">Brankas terkunci</h2><p class="mx-muted">Masukkan kunci utama untuk membuka sandi-sandimu.</p>
        <form id="vtUnlock" autocomplete="off"><div class="mx-field"><label for="vtPass">Kunci utama</label><input id="vtPass" type="password" class="mx-input" autocomplete="current-password" required></div>
        <p class="vt-err" id="vtErr" role="alert" hidden></p><button type="submit" class="mx-btn mx-btn-primary" id="vtGo">Buka</button></form>`);
    }
    function listHTML() {
        const q = ui.q.trim().toLocaleLowerCase('id-ID');
        const rows = session.items.filter(i => (!ui.cat || i.category === ui.cat) && (!q || [i.title, i.username, i.url, i.note].some(v => String(v || '').toLocaleLowerCase('id-ID').includes(q))))
            .sort((a, b) => String(a.title).localeCompare(String(b.title), 'id'));
        if (!rows.length) return session.items.length ? Mx.empty('🔍', 'Tidak ada yang cocok') : Mx.empty('🔑', 'Brankas masih kosong', 'Tekan "+ Tambah" untuk menyimpan sandi pertamamu.');
        return rows.map(i => {
            const shown = ui.reveal.has(i.id), safeUrl = /^https?:\/\//i.test(i.url || '') ? i.url : '';
            return `<article class="vt-item" data-id="${esc(i.id)}"><div class="vt-ico" aria-hidden="true">${(CAT[i.category] || CAT.lain).split(' ')[0]}</div>
            <div class="vt-main"><b>${esc(i.title)}</b>
            ${i.username ? `<div class="vt-line"><span class="vt-val">${esc(i.username)}</span><button type="button" class="mx-icon" data-act="copy-user" aria-label="Salin nama pengguna">📋</button></div>` : ''}
            <div class="vt-line"><code class="vt-val vt-pw">${shown ? esc(i.password) : '••••••••••'}</code><button type="button" class="mx-icon" data-act="reveal" aria-label="${shown ? 'Sembunyikan' : 'Tampilkan'} sandi">${shown ? '🙈' : '👁️'}</button><button type="button" class="mx-icon" data-act="copy-pass" aria-label="Salin sandi">📋</button></div>
            ${safeUrl ? `<a class="vt-url" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(safeUrl.replace(/^https?:\/\//i, '').slice(0, 40))}</a>` : ''}
            ${i.note ? `<small class="mx-muted">${esc(i.note)}</small>` : ''}</div>
            <div class="vt-acts"><button type="button" class="mx-icon" data-act="edit" aria-label="Ubah">✏️</button><button type="button" class="mx-icon" data-act="del" aria-label="Hapus">🗑️</button></div></article>`;
        }).join('');
    }
    function viewOpen() {
        return `<div class="mx-head"><div><h2 class="mx-h2">🔐 Brankas Sandi</h2><p class="mx-muted">${session.items.length} sandi · terenkripsi AES-256 · kunci otomatis bila tidak dipakai 2 menit</p></div>
        <div class="mx-row"><button type="button" class="mx-btn mx-btn-primary" data-act="add">+ Tambah</button><button type="button" class="mx-btn" data-act="lock">🔒 Kunci</button></div></div>
        <div class="mx-tools"><input type="search" id="vtQ" class="mx-input" placeholder="Cari judul, pengguna, catatan…" value="${esc(ui.q)}" aria-label="Cari sandi"></div>
        <div class="mx-tools vt-chips"><button type="button" class="mx-chip${ui.cat ? '' : ' on'}" data-act="cat" data-c="">Semua</button>${CATS.map(([k, v]) => `<button type="button" class="mx-chip${ui.cat === k ? ' on' : ''}" data-act="cat" data-c="${k}">${v}</button>`).join('')}</div>
        <div class="mx-card vt-list" id="vtList">${listHTML()}</div>
        <details class="vt-adv"><summary>Pengaturan brankas</summary><div class="mx-row"><button type="button" class="mx-btn" data-act="chpass">Ubah kunci utama</button><button type="button" class="mx-btn mx-btn-danger" data-act="reset">Reset brankas…</button></div></details>`;
    }
    function render() {
        const el = root(); if (!el) return;
        if (!(window.App && App.State && App.State.isAdmin)) { el.innerHTML = ''; return; } // khusus admin
        if (!hasCrypto()) { el.innerHTML = viewUnsupported(); return; }
        const typing = document.activeElement && el.contains(document.activeElement) && document.activeElement.id === 'vtQ';
        if (typing && session) { const l = el.querySelector('#vtList'); if (l) { l.innerHTML = listHTML(); return; } }
        el.innerHTML = !D().salt ? viewSetup() : !session ? viewLocked() : viewOpen();
        const f = el.querySelector('#vtP1, #vtPass'); if (f && !session) setTimeout(() => f.focus(), 0);
    }

    // ----- form tambah / ubah -----
    function itemForm(item) {
        const it = item || { title: '', username: '', password: '', url: '', category: 'akun', note: '' };
        Mx.modal({
            title: item ? 'Ubah sandi' : 'Tambah sandi', size: 460,
            body: `<form id="vtForm" autocomplete="off"><div class="mx-field"><label for="vtT">Nama / situs</label><input id="vtT" class="mx-input" maxlength="80" required value="${esc(it.title)}"></div>
            <div class="mx-field"><label for="vtU">Nama pengguna / email</label><input id="vtU" class="mx-input" maxlength="120" value="${esc(it.username)}"></div>
            <div class="mx-field"><label for="vtW">Sandi</label><div class="vt-pwrow"><input id="vtW" type="password" class="mx-input" maxlength="200" required value="${esc(it.password)}" autocomplete="off"><button type="button" class="mx-icon" id="vtEye" aria-label="Tampilkan sandi">👁️</button></div>
            <div class="vt-meter" aria-hidden="true"><i id="vtBar2"></i></div><small class="mx-muted" id="vtBarTxt2"></small></div>
            <div class="vt-gen"><button type="button" class="mx-btn mx-btn-sm" id="vtGen">🎲 Buat sandi acak</button><label>Panjang <input type="number" id="vtLen" class="mx-input" min="8" max="64" value="16"></label><label class="vt-agree"><input type="checkbox" id="vtSym" checked> Simbol</label></div>
            <div class="mx-field"><label for="vtC">Kategori</label><select id="vtC" class="mx-input">${CATS.map(([k, v]) => `<option value="${k}" ${it.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="mx-field"><label for="vtL">Alamat situs (opsional)</label><input id="vtL" class="mx-input" maxlength="200" placeholder="https://…" value="${esc(it.url)}"></div>
            <div class="mx-field"><label for="vtN">Catatan (opsional)</label><textarea id="vtN" class="mx-input" maxlength="300">${esc(it.note)}</textarea></div>
            <p class="vt-err" id="vtFErr" role="alert" hidden></p><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></form>`,
            onMount(m) {
                m.el.classList.add('vt-modal-ov'); const $ = id => m.el.querySelector('#' + id), meter = () => { const s = strength($('vtW').value); $('vtBar2').style.width = (($('vtW').value ? s[2] : 0)) + '%'; $('vtBar2').style.background = s[1]; $('vtBarTxt2').textContent = $('vtW').value ? s[0] : ''; };
                meter(); $('vtW').addEventListener('input', meter); touch();
                $('vtEye').addEventListener('click', () => { const t = $('vtW').type === 'password'; $('vtW').type = t ? 'text' : 'password'; $('vtEye').textContent = t ? '🙈' : '👁️'; });
                $('vtGen').addEventListener('click', () => { $('vtW').value = generate(Math.max(8, Math.min(64, parseInt($('vtLen').value) || 16)), $('vtSym').checked); $('vtW').type = 'text'; $('vtEye').textContent = '🙈'; meter(); });
                $('vtForm').addEventListener('submit', e => {
                    e.preventDefault(); if (!session) { m.close(); return; }
                    const title = $('vtT').value.trim(), pw = $('vtW').value; if (!title || !pw) { $('vtFErr').textContent = 'Nama dan sandi wajib diisi'; $('vtFErr').hidden = false; return; }
                    const url = $('vtL').value.trim(), rec = { id: item ? item.id : uid(), title, username: $('vtU').value.trim(), password: pw, url: /^https?:\/\//i.test(url) || !url ? url : 'https://' + url, category: CAT[$('vtC').value] ? $('vtC').value : 'lain', note: $('vtN').value.trim(), created: item ? item.created : new Date().toISOString(), updated: new Date().toISOString() };
                    if (item) session.items = session.items.map(x => x.id === item.id ? rec : x); else session.items.push(rec);
                    persist(); m.close(); render(); Mx.toast(item ? 'Sandi diperbarui' : 'Sandi disimpan');
                });
                setTimeout(() => $('vtT').focus(), 0);
            }
        });
    }

    function copySecret(text, label) {
        Mx.copy(text).then(() => { Mx.toast(`${label} disalin — dihapus dari clipboard dalam 30 detik`, 'info'); setTimeout(() => { try { navigator.clipboard.writeText(''); } catch (e) { /* abaikan */ } }, CLIP_MS); });
    }
    const find = el => { const a = el.closest('.vt-item'); return a && session ? session.items.find(x => x.id === a.dataset.id) : null; };

    const acts = {
        add: () => itemForm(null),
        edit: el => { const i = find(el); if (i) itemForm(i); },
        del: async el => { const i = find(el); if (!i || !(await Mx.confirm(`Hapus sandi "${i.title}"?`))) return; session.items = session.items.filter(x => x.id !== i.id); ui.reveal.delete(i.id); persist(); render(); Mx.toast('Sandi dihapus'); },
        reveal: el => { const i = find(el); if (!i) return; if (ui.reveal.has(i.id)) ui.reveal.delete(i.id); else { ui.reveal.add(i.id); setTimeout(() => { if (ui.reveal.delete(i.id)) render(); }, 15000); } render(); },
        'copy-pass': el => { const i = find(el); if (i) copySecret(i.password, 'Sandi'); },
        'copy-user': el => { const i = find(el); if (i) copySecret(i.username, 'Nama pengguna'); },
        cat: el => { ui.cat = el.dataset.c || ''; render(); },
        lock: () => lock('Brankas dikunci'),
        chpass: () => changeMaster(),
        reset: () => resetVault()
    };

    function changeMaster() {
        Mx.modal({
            title: 'Ubah kunci utama', size: 420, body: `<form id="vtCh" autocomplete="off"><div class="mx-field"><label for="vtO">Kunci utama saat ini</label><input id="vtO" type="password" class="mx-input" required autocomplete="current-password"></div>
            <div class="mx-field"><label for="vtN1">Kunci utama baru (min. 8 karakter)</label><input id="vtN1" type="password" class="mx-input" minlength="8" required autocomplete="new-password"></div>
            <div class="mx-field"><label for="vtN2">Ulangi kunci baru</label><input id="vtN2" type="password" class="mx-input" required autocomplete="new-password"></div>
            <p class="vt-err" id="vtCErr" role="alert" hidden></p><button type="submit" class="mx-btn mx-btn-primary">Ganti kunci</button></form>`,
            onMount(m) {
                m.el.classList.add('vt-modal-ov'); const $ = id => m.el.querySelector('#' + id), err = t => { $('vtCErr').textContent = t; $('vtCErr').hidden = false; };
                $('vtCh').addEventListener('submit', async e => {
                    e.preventDefault(); if (!session) return m.close();
                    if ($('vtN1').value.length < 8) return err('Kunci baru minimal 8 karakter'); if ($('vtN1').value !== $('vtN2').value) return err('Ulangi kunci baru dengan sama persis');
                    try {
                        const old = await derive($('vtO').value, unb64(D().salt)); let ok = false; try { ok = (await open(old, D().check)) === CHECK; } catch (x) { ok = false; }
                        if (!ok) return err('Kunci utama saat ini salah');
                        const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive($('vtN1').value, salt);
                        D().salt = b64(salt); D().check = await seal(key, CHECK); session.key = key; session.salt = D().salt; await persist(); m.close(); Mx.toast('Kunci utama diganti');
                    } catch (x) { err('Gagal mengganti kunci'); }
                });
            }
        });
    }
    function resetVault() {
        Mx.modal({
            title: 'Reset brankas', size: 420, body: `<p class="mx-muted">Semua sandi di brankas ini akan <b>dihapus permanen</b> (di perangkat ini dan di akun). Tidak bisa dibatalkan. Ketik <b>HAPUS</b> untuk melanjutkan.</p>
            <input id="vtRst" class="mx-input" autocomplete="off" aria-label="Ketik HAPUS"><button type="button" class="mx-btn mx-btn-danger" id="vtRstGo" style="margin-top:.75rem">Hapus semua</button>`,
            onMount(m) {
                m.el.classList.add('vt-modal-ov');
                m.el.querySelector('#vtRstGo').addEventListener('click', () => {
                    if (m.el.querySelector('#vtRst').value.trim() !== 'HAPUS') return Mx.toast('Ketik HAPUS dengan huruf besar', 'error');
                    session = null; clearTimeout(idleT); AppModules.get(KEY).salt = ''; D().check = null; D().data = null; AppModules.changed(KEY); m.close(); render(); Mx.toast('Brankas direset');
                });
            }
        });
    }

    // ----- aksi form setup / buka -----
    async function onSubmit(e) {
        if (e.target.id === 'vtSetup') {
            e.preventDefault(); const p1 = root().querySelector('#vtP1').value, p2 = root().querySelector('#vtP2').value, err = root().querySelector('#vtErr');
            const bad = t => { err.textContent = t; err.hidden = false; };
            if (p1.length < 8) return bad('Kunci utama minimal 8 karakter'); if (p1 !== p2) return bad('Pengulangan kunci tidak sama'); if (!root().querySelector('#vtAgree').checked) return bad('Centang pernyataan di atas dulu');
            const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Membuat…';
            try { await setup(p1); render(); Mx.toast('Brankas dibuat'); } catch (x) { console.error(x); bad('Gagal membuat brankas'); btn.disabled = false; btn.textContent = 'Buat Brankas'; }
        } else if (e.target.id === 'vtUnlock') {
            e.preventDefault(); const inp = root().querySelector('#vtPass'), err = root().querySelector('#vtErr'), bad = t => { err.textContent = t; err.hidden = false; inp.value = ''; inp.focus(); };
            if (Date.now() < ui.lockUntil) return bad(`Terlalu banyak percobaan, tunggu ${Math.ceil((ui.lockUntil - Date.now()) / 1000)} detik`);
            const btn = root().querySelector('#vtGo'); btn.disabled = true; btn.textContent = 'Membuka…';
            try { await unlock(inp.value); ui.fails = 0; render(); }
            catch (x) {
                btn.disabled = false; btn.textContent = 'Buka';
                if (x.message === 'salah') { ui.fails++; if (ui.fails >= 5) { ui.lockUntil = Date.now() + 10000; ui.fails = 0; bad('Kunci utama salah. Terlalu banyak percobaan — tunggu 10 detik.'); } else bad('Kunci utama salah'); }
                else bad('Isi brankas tidak bisa dibaca (data rusak)');
            }
        }
    }

    AppModules.register(KEY, {
        label: 'Brankas Sandi', views: ['vault-home'], normalize, validate,
        init() {
            const r = root(); if (!r) return;
            Mx.delegate(r, acts, { input: e => { touch(); if (e.target.id === 'vtQ') { ui.q = e.target.value; render(); } if (e.target.id === 'vtP1') { const s = strength(e.target.value); const bar = r.querySelector('#vtBar'); bar.style.width = (e.target.value ? s[2] : 0) + '%'; bar.style.background = s[1]; r.querySelector('#vtBarTxt').textContent = e.target.value ? s[0] : ''; } }, keydown: touch });
            r.addEventListener('submit', onSubmit); r.addEventListener('click', touch);
            document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (session && hiddenAt && Date.now() - hiddenAt > AWAY_MS) lock('Brankas dikunci karena aplikasi lama ditinggalkan'); });
        },
        show() { render(); },
        refresh() { // data berubah dari akun/perangkat lain, atau ganti akun
            if (session && (session.uid !== curUid() || D().salt !== session.salt)) { lock(session.uid !== curUid() ? '' : 'Kunci utama diganti di perangkat lain — brankas dikunci'); return; }
            if (session && D().data && D().data.ct !== session.lastCt) { // isi diubah di perangkat lain: baca ulang
                const s = session, p = D().data; open(s.key, p).then(t => { if (session === s) { const a = JSON.parse(t); s.items = Array.isArray(a) ? a : s.items; s.lastCt = p.ct; render(); } }).catch(() => lock('Isi brankas berubah — buka kembali'));
            }
            const r = root(); if (r && r.classList.contains('active') && !document.querySelector('.vt-modal-ov')) render();
        },
        isBusy: () => !!document.querySelector('.vt-modal-ov'),
        _test: { generate, strength }
    });
})();
