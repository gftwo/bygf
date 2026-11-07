/* ==========================================================================
   PENCARIAN GLOBAL — satu kotak untuk mencari di semua fitur (tekan "/" atau Ctrl/Cmd+K)
   Sumber: transaksi, tugas, tugas & matkul Kuliah, Catatan Kuliah, Notes, Jurnal, Makan, Target.
   ========================================================================== */
(function () {
    'use strict';
    const { esc } = Mx;
    const MAXPER = 6;
    const mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null;
    const nav = (g, sub) => { if (sub) App.UI._lastSubTab[g] = sub; App.UI.switchMainGroup(g); };
    const plain = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const snip = (s, q) => { s = plain(s); const i = s.toLowerCase().indexOf(q[0]); const a = Math.max(0, i - 25); return (a ? '…' : '') + s.slice(a, a + 90) + (s.length > a + 90 ? '…' : ''); };

    function search(raw) {
        const q = raw.toLowerCase().split(/\s+/).filter(Boolean); if (!q.length || raw.trim().length < 2) return [];
        const hit = (...f) => { const t = f.map(plain).join(' ').toLowerCase(); return q.every(w => t.includes(w)); };
        const G = [];
        const add = (title, icon, items) => { if (items.length) G.push({ title, icon, items: items.slice(0, MAXPER), more: Math.max(0, items.length - MAXPER) }); };
        const st = window.App && App.State;
        if (st) add('Transaksi', '💰', (st.transactions || []).filter(t => hit(t.keterangan, t.kategori, t.tanggal)).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))
            .map(t => ({ t: t.keterangan || t.kategori, s: `${Mx.fmtDate(t.tanggal)} · ${t.pemasukan ? '+' : '−'}${Mx.fmtRp(t.pemasukan || t.pengeluaran)}`, go: () => nav('keuangan', 'history') })));
        const d = mod('daily'); if (d) add('Tugas', '✅', d.tasks.filter(t => hit(t.title, t.note, t.tags.join(' '), t.category)).map(t => ({ t: t.title, s: (t.done ? 'Selesai' : t.date ? 'Tenggat ' + Mx.fmtDate(t.date) : 'Tanpa tanggal') + (t.note ? ' · ' + snip(t.note, q) : ''), go: () => nav('daily', 'daily-home') })));
        const kp = window.KuliahPro;
        if (kp && kp.getTasks) add('Tugas Kuliah', '🎓', kp.getTasks().filter(t => hit(t.judul, t.matkul)).map(t => ({ t: t.judul, s: `${t.matkul} · Deadline ${Mx.fmtDate((t.deadline || '').slice(0, 10))}${t.done ? ' · selesai' : ''}`, go: () => nav('kuliah', 'kuliah') })));
        if (kp && kp.getCourses) add('Mata Kuliah', '📚', kp.getCourses().filter(c => hit(c.name)).map(c => ({ t: c.name, s: 'Buka tab Kuliah', go: () => nav('kuliah', 'kuliah') })));
        const l = mod('lecture'); if (l) add('Catatan Kuliah', '📓', l.notes.filter(n => hit(n.title, n.body, n.tags.join(' '))).sort((a, b) => b.date.localeCompare(a.date)).map(n => ({ t: n.title || '(Tanpa judul)', s: Mx.fmtDate(n.date) + ' · ' + snip(n.body, q), go: () => nav('kuliah', 'ck-arsip') })));
        const nt = mod('notes'); if (nt) add('Catatan Bebas', '🗒️', nt.notes.filter(n => !n.trashed && hit(n.title, n.text, n.tags.join(' '))).map(n => ({ t: n.title || '(Tanpa judul)', s: snip(n.text || n.html, q), go: () => nav('notes', 'nt-list') })));
        const j = mod('journal'); if (j) add('Jurnal', '📔', j.entries.filter(e => hit(e.date, e.good, e.problem, e.lesson, e.tomorrow, e.note)).sort((a, b) => b.date.localeCompare(a.date)).map(e => ({ t: Mx.fmtDateLong(e.date), s: snip([e.good, e.problem, e.lesson, e.tomorrow, e.note].filter(Boolean).join(' · '), q), go: () => { nav('notes', 'jr-today'); const a = AppModules.api('journal'); if (a && a.openDate) a.openDate(e.date); } })));
        const m = mod('meal'); if (m) add('Makan', '🍽️', m.records.filter(r => hit(r.name, r.place, r.location, r.desc, r.notes)).map(r => ({ t: r.name, s: [r.place, r.location].filter(Boolean).join(' · ') || Mx.fmtDate(r.date), go: () => nav('makan', 'mk-riwayat') })));
        const g = mod('goals'); if (g) add('Target Tabungan', '🐷', g.goals.filter(x => hit(x.name, x.note)).map(x => ({ t: x.name, s: `${Mx.fmtRp(x.saved)} / ${Mx.fmtRp(x.target)}`, go: () => nav('keuangan', 'goal-home') })));
        return G;
    }

    let box, input, out, results = [], sel = -1, lastFocus = null;
    function flat() { const a = []; results.forEach(g => g.items.forEach(i => a.push(i))); return a; }
    function paint(raw) {
        results = search(raw); sel = -1; const n = flat().length; let k = 0;
        out.innerHTML = !raw.trim() ? '<p class="gs-hint">Ketik untuk mencari transaksi, tugas, catatan, jurnal, makanan, dan lainnya.</p>' : raw.trim().length < 2 ? '<p class="gs-hint">Ketik minimal 2 huruf…</p>' : n ? results.map(g => `<div class="gs-group"><div class="gs-gt">${g.icon} ${g.title}</div>${g.items.map(i => `<button type="button" class="gs-item" role="option" data-i="${k++}"><b>${esc(i.t)}</b><small>${esc(i.s)}</small></button>`).join('')}${g.more ? `<div class="gs-more">+${g.more} hasil lain — persempit kata kunci</div>` : ''}</div>`).join('') : '<p class="gs-hint">Tidak ada hasil. Coba kata lain.</p>';
    }
    function mark(i) { const els = out.querySelectorAll('.gs-item'); els.forEach((e, x) => e.classList.toggle('on', x === i)); if (els[i]) els[i].scrollIntoView({ block: 'nearest' }); sel = i; }
    function choose(i) { const it = flat()[i]; if (!it) return; close(true); it.go(); }
    function open() {
        if (box) return; lastFocus = document.activeElement;
        box = document.createElement('div'); box.className = 'gs-overlay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Pencarian');
        box.innerHTML = `<div class="gs-panel"><div class="gs-bar"><svg class="ni" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="gsInput" type="search" autocomplete="off" placeholder="Cari di semua tab…" aria-label="Kata kunci" role="combobox" aria-expanded="true" aria-controls="gsOut"><button type="button" class="gs-x" aria-label="Tutup">Esc</button></div><div id="gsOut" class="gs-out" role="listbox"></div></div>`;
        document.body.appendChild(box); input = box.querySelector('#gsInput'); out = box.querySelector('#gsOut'); paint('');
        const run = Mx.debounce(() => paint(input.value), 120); input.addEventListener('input', run);
        input.addEventListener('keydown', e => { const n = flat().length; if (e.key === 'ArrowDown') { e.preventDefault(); if (n) mark((sel + 1) % n); } else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) mark((sel - 1 + n) % n); } else if (e.key === 'Enter') { e.preventDefault(); run.flush(); choose(sel >= 0 ? sel : 0); } });
        out.addEventListener('click', e => { const b = e.target.closest('.gs-item'); if (b) choose(+b.dataset.i); });
        box.addEventListener('mousedown', e => { if (e.target === box || e.target.closest('.gs-x')) close(); });
        input.focus();
    }
    function close(skipFocus) { if (!box) return; box.remove(); box = null; if (!skipFocus && lastFocus && lastFocus.focus) lastFocus.focus(); }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && box) { close(); return; }
        const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName) || (document.activeElement && document.activeElement.isContentEditable);
        if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { if (document.getElementById('appContainer') && document.getElementById('appContainer').style.display === 'none') return; e.preventDefault(); open(); }
    });
    document.addEventListener('click', e => { if (e.target.closest('#globalSearchBtn')) open(); });
    window.GlobalSearch = { open, close, search };
})();
