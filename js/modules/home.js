/* ==========================================================================
   MODUL BERANDA "HARI INI" — ringkasan satu layar dari semua fitur (hanya baca; tanpa data sendiri)
   Sumber: jadwal & tugas Kuliah, Tugas, jadwal Makan, saldo & pengeluaran, Jurnal harian.
   ========================================================================== */
(function () {
    'use strict';
    const { esc, today } = Mx;
    const root = () => document.getElementById('view-home-today');
    const mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null;
    const api = k => (window.AppModules && AppModules.api) ? AppModules.api(k) : null;
    const RATE = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
    const go = (g, sub) => { if (!window.App || !App.UI) return; if (sub) App.UI._lastSubTab[g] = sub; App.UI.switchMainGroup(g); };

    function greeting() { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }
    const hm = s => (s || '').slice(0, 5);

    function agendaTugas() {
        const d = mod('daily'), t0 = today(), out = { overdue: [], today: [] };
        ((d && d.tasks) || []).filter(t => !t.done && t.date).forEach(t => { if (t.date < t0) out.overdue.push(t); else if (t.date === t0) out.today.push(t); });
        const rank = { high: 0, medium: 1, low: 2, none: 3 }, by = (a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || (a.time || '99').localeCompare(b.time || '99');
        out.overdue.sort(by); out.today.sort(by); return out;
    }
    function kuliahTugas() { // tugas kuliah belum selesai: terlambat atau deadline <= 3 hari lagi
        if (!window.KuliahPro || !KuliahPro.getTasks) return [];
        const limit = Mx.addDays(today(), 3);
        return KuliahPro.getTasks().filter(t => !t.done && t.deadline && t.deadline.slice(0, 10) <= limit).sort((a, b) => a.deadline.localeCompare(b.deadline));
    }
    function monthFinance() {
        const st = window.App && App.State; if (!st) return { in: 0, out: 0 };
        const m = today().slice(0, 7); let i = 0, o = 0;
        (st.transactions || []).forEach(t => { if (!t.isAdjustment && String(t.tanggal).startsWith(m)) { i += t.pemasukan || 0; o += t.pengeluaran || 0; } });
        return { in: i, out: o };
    }

    const card = (cls, title, body, act) => `<section class="mx-card hm-card ${cls}"><div class="hm-head"><h3 class="mx-h3">${title}</h3>${act || ''}</div>${body}</section>`;
    const row = (dot, main, sub, tag) => `<div class="hm-row"><i class="hm-dot" style="background:${dot}"></i><div class="hm-main"><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${tag ? `<span class="mx-pill">${esc(tag)}</span>` : ''}</div>`;
    const more = (g, sub, label) => `<button type="button" class="hm-link" data-go="${g}" data-sub="${sub || ''}">${label} ›</button>`;

    function render() {
        const el = root(); if (!el) return;
        const t0 = today(), name = (window.App && App.State && App.State.user && (App.State.user.displayName || App.State.user.name)) || '';
        const sched = (window.KuliahPro && KuliahPro.todaySchedule) ? KuliahPro.todaySchedule() : [];
        const ag = agendaTugas(), kt = kuliahTugas();
        const meal = (api('meal') && api('meal').todayItems) ? api('meal').todayItems() : [];
        const fin = monthFinance();
        const bal = (document.getElementById('homeNetBalance') || {}).textContent || '';
        const entry = ((mod('journal') && mod('journal').entries) || []).find(e => e.date === t0);
        const pri = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6', none: '#94a3b8' };

        const kuliahBody = sched.length ? sched.map(s => row(s.libur ? '#94a3b8' : '#4f46e5', s.nama, [hm(s.jamMulai) && `${hm(s.jamMulai)}–${hm(s.jamSelesai)}`, s.mode === 'online' ? 'Online' : s.lokasi].filter(Boolean).join(' · '), s.libur ? 'Libur' : s.status === 'hadir' ? '✅ Hadir' : s.status ? '❌ Tidak hadir' : '')).join('') : Mx.empty('🎓', 'Tidak ada kuliah hari ini');
        const tugasRows = [...ag.overdue.slice(0, 4).map(t => row(pri[t.priority], t.title, 'Terlewat · ' + Mx.fmtDate(t.date), 'Terlambat')), ...ag.today.slice(0, 6).map(t => row(pri[t.priority], t.title, t.time ? 'Pukul ' + t.time : '', 'Hari ini')),
            ...kt.slice(0, 4).map(t => row('#4f46e5', '🎓 ' + t.judul, (t.matkul ? t.matkul + ' · ' : '') + 'Deadline ' + Mx.fmtDate(t.deadline.slice(0, 10)), t.deadline.slice(0, 10) < t0 ? 'Terlambat' : ''))];
        const mealBody = meal.length ? meal.map(m => row(m.done ? '#10b981' : '#f59e0b', m.name, [m.slot, m.time].filter(Boolean).join(' · '), m.done ? '✅' : '')).join('') : Mx.empty('🍽️', 'Belum ada jadwal makan hari ini');
        const jr = entry && (entry.rating || entry.good || entry.problem || entry.lesson || entry.tomorrow || entry.note)
            ? `<div class="hm-journal"><span class="hm-emoji">${entry.rating ? RATE[entry.rating] : '📝'}</span><div><b>${entry.rating ? 'Rating ' + entry.rating + '/5' : 'Jurnal terisi'}</b><small>${esc((entry.good || entry.problem || entry.note || entry.lesson || '').slice(0, 90))}</small></div></div>`
            : `<p class="mx-muted">Belum diisi. Ceritakan suasana harimu — hanya butuh satu menit.</p><button type="button" class="mx-btn mx-btn-primary" data-go="notes" data-sub="jr-today">Isi jurnal hari ini</button>`;

        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">${greeting()}${name ? ', ' + esc(name) : ''} 👋</h2><p class="mx-muted">${esc(Mx.fmtDateLong(t0))}</p></div></div>
        <div class="hm-quick" role="group" aria-label="Aksi cepat"><button type="button" class="mx-btn" data-go="keuangan" data-sub="input">💸 Catat transaksi</button><button type="button" class="mx-btn" data-go="daily" data-sub="daily-home">✅ Tugas</button><button type="button" class="mx-btn" data-go="kuliah" data-sub="ck-catat">✍️ Catat kuliah</button><button type="button" class="mx-btn" data-go="notes" data-sub="jr-today">📔 Jurnal</button></div>
        <div class="hm-grid">
        ${card('hm-fin', '💰 Keuangan', `<div class="hm-bal">${esc(bal || '—')}</div><small class="mx-muted">Saldo bersih</small><div class="hm-two"><div><span class="hm-in">⬆ ${esc(Mx.fmtRp(fin.in))}</span><small>masuk bulan ini</small></div><div><span class="hm-out">⬇ ${esc(Mx.fmtRp(fin.out))}</span><small>keluar bulan ini</small></div></div>`, more('keuangan', 'input', 'Buka'))}
        ${card('hm-jr', '📔 Jurnal hari ini', jr)}
        ${card('hm-kuliah', '🎓 Kuliah hari ini', kuliahBody, more('kuliah', 'kuliah', 'Jadwal'))}
        ${card('hm-tugas', '✅ Tugas', tugasRows.length ? tugasRows.join('') : Mx.empty('🎉', 'Tidak ada tugas yang perlu dikejar'), more('daily', 'daily-home', 'Semua tugas'))}
        ${card('hm-meal', '🍽️ Makan hari ini', mealBody, more('makan', 'mk-jadwal', 'Jadwal'))}
        </div>`;
    }

    AppModules.register('home', {
        label: 'Beranda', views: ['home-today'], normalize: () => ({}), validate: () => [],
        init() { const r = root(); if (!r) return; r.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go, b.dataset.sub); }); },
        show() { render(); },
        refresh() { const r = root(); if (r && r.classList.contains('active')) render(); }
    });
})();
