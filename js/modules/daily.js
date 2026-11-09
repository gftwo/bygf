/* ==========================================================================
   MODUL DAILY — to-do harian + pengingat + tugas berulang
   Data: AppModules 'daily' = { tasks: [...] }
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'daily';
    const CATS = ['Kuliah', 'Pribadi', 'Pekerjaan', 'Belanja', 'Lainnya'];
    const PRI = { high: 'Tinggi', medium: 'Sedang', low: 'Rendah', none: 'Tanpa' };
    const PRI_RANK = { high: 0, medium: 1, low: 2, none: 3 };
    const PROJ_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const UNIT_LABEL = { day: 'hari', week: 'minggu', month: 'bulan' };
    const { esc, uid, today, byId } = Mx;

    const ui = { view: 'all', project: '', tag: '', filter: 'all', q: '', sort: 'date', cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, calSel: Mx.today(), miniCal: { y: new Date().getFullYear(), m: new Date().getMonth() } };
    const root = id => document.getElementById('view-' + id);
    const D = () => AppModules.get(KEY);
    const save = () => AppModules.changed(KEY);

    // ----- normalisasi & validasi (data dari Firebase bisa kehilangan array/objek kosong) -----
    function normTask(t) {
        const r = t.repeat || {};
        return {
            id: String(t.id || uid()), title: String(t.title || '').slice(0, 120), note: String(t.note || '').slice(0, 500),
            date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? t.date : '', time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : '',
            priority: PRI[t.priority] ? t.priority : 'medium', category: String(t.category || 'Lainnya'),
            repeat: { enabled: !!r.enabled, interval: Math.max(1, Math.min(365, Number(r.interval) || 1)), unit: UNIT_LABEL[r.unit] ? r.unit : 'day', type: r.type === 'normal' ? 'normal' : 'feature', weekdays: Array.isArray(r.weekdays) ? r.weekdays.filter(n => n >= 0 && n <= 6) : [] },
            done: !!t.done, doneAt: t.doneAt || '', created: t.created || new Date().toISOString(), notified: t.notified || '', repeatParent: t.repeatParent ? String(t.repeatParent) : '',
            project: t.project ? String(t.project) : '',
            tags: asList(t.tags).map(x => String(x).replace(/^#/, '').trim().slice(0, 30)).filter(Boolean).slice(0, 12),
            subtasks: asList(t.subtasks).filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id || uid()), title: String(x.title || '').slice(0, 120), done: !!x.done })).filter(x => x.title).slice(0, 50)
        };
    }
    const asList = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    function normProject(p) { return { id: String(p.id || uid()), name: String(p.name || '').trim().slice(0, 40), color: /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : PROJ_COLORS[0] }; }
    const normalize = raw => ({
        tasks: asList(raw && raw.tasks).filter(t => t && typeof t === 'object').map(normTask),
        projects: asList(raw && raw.projects).filter(p => p && typeof p === 'object').map(normProject).filter(p => p.name),
        legacyImported: (raw && raw.legacyImported) ? String(raw.legacyImported) : ''
    });
    const validate = raw => (raw && typeof raw === 'object' && !Array.isArray(raw)) ? ((raw.tasks == null || typeof raw.tasks === 'object') && (raw.projects == null || typeof raw.projects === 'object') ? [] : ['daftar tugas tidak valid']) : ['format data tidak valid'];

    // ----- tanggal berulang -----
    function addInterval(dateStr, rep) {
        const d = Mx.parse(dateStr || today()), n = Math.max(1, Math.min(365, Number(rep.interval) || 1));
        if (rep.unit === 'week') d.setDate(d.getDate() + n * 7);
        else if (rep.unit === 'month') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
        else d.setDate(d.getDate() + n);
        return Mx.iso(d);
    }
    function nextDate(base, rep) {
        const n = Math.max(1, Number(rep.interval) || 1);
        if (rep.unit === 'week' && rep.weekdays && rep.weekdays.length) { // hari tertentu dalam minggu
            const baseWeek = Mx.parse(Mx.weekStart(base));
            for (let i = 1; i <= 7 * n + 7; i++) {
                const c = Mx.addDays(base, i), wd = (Mx.parse(c).getDay() + 6) % 7;
                if (!rep.weekdays.includes(wd)) continue;
                const diff = Math.round((Mx.parse(Mx.weekStart(c)) - baseWeek) / (7 * 864e5));
                if (diff % n === 0) return c;
            }
        }
        return addInterval(base, rep);
    }
    function computeNext(t) {
        if (t.repeat.type === 'feature') return nextDate(today(), t.repeat); // dari tanggal selesai
        let d = nextDate(t.date || today(), t.repeat); let guard = 0; // dari jadwal awal
        while (d <= today() && guard++ < 1000) d = nextDate(d, t.repeat);
        return d;
    }

    // ----- query -----
    const isOverdue = t => !!t.date && t.date < today() && !t.done;
    function visible() {
        const q = ui.q.trim().toLocaleLowerCase('id-ID'), td = today();
        return D().tasks.filter(t => {
            if (ui.view === 'today' && t.date !== td) return false;
            if (ui.view === 'upcoming' && (!t.date || t.date <= td || t.done)) return false;
            if (ui.view === 'overdue' && !isOverdue(t)) return false;
            if (ui.view === 'done' && !t.done) return false;
            if (ui.view === 'recurring' && !(t.repeat.enabled && !t.done)) return false;
            if (ui.project && t.project !== ui.project) return false;
            if (ui.tag && !t.tags.includes(ui.tag)) return false;
            if (ui.filter === 'high' && t.priority !== 'high') return false;
            if (ui.filter === 'reminder' && !t.time) return false;
            if (q && !`${t.title} ${t.note} ${t.category} ${t.tags.join(' ')} ${t.subtasks.map(x => x.title).join(' ')}`.toLocaleLowerCase('id-ID').includes(q)) return false;
            return true;
        }).sort(sorter());
    }
    function sorter() {
        const P = PRI_RANK;
        return (a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            if (ui.sort === 'priority') return P[a.priority] - P[b.priority] || (a.date || '9').localeCompare(b.date || '9');
            if (ui.sort === 'created') return String(b.created).localeCompare(String(a.created));
            if (ui.sort === 'alpha') return a.title.localeCompare(b.title, 'id');
            const x = a.date || '9999-99-99', y = b.date || '9999-99-99';
            return x !== y ? x.localeCompare(y) : (a.time || '99:99').localeCompare(b.time || '99:99');
        };
    }

    // ----- tampilan -----
    function card(t) {
        const rep = t.repeat.enabled ? `<span class="mx-pill">↻ Setiap ${t.repeat.interval} ${UNIT_LABEL[t.repeat.unit]}${t.repeat.unit === 'week' && t.repeat.weekdays.length ? ' (' + t.repeat.weekdays.map(i => DAYS[i]).join(', ') + ')' : ''}</span>` : '';
        const proj = t.project && projectById(t.project);
        const subDone = t.subtasks.filter(x => x.done).length;
        const subs = t.subtasks.length ? `<div class="dy-subs">${t.subtasks.map(x => `<label class="dy-sub${x.done ? ' done' : ''}"><input type="checkbox" class="dy-check dy-sub-check" aria-label="Subtugas: ${esc(x.title)}" data-act="subtoggle" data-id="${esc(t.id)}" data-sid="${esc(x.id)}" ${x.done ? 'checked' : ''}><span>${esc(x.title)}</span></label>`).join('')}</div>` : '';
        const tagPills = t.tags.map(g => `<button type="button" class="mx-pill dy-tag" data-act="tag" data-tag="${esc(g)}">#${esc(g)}</button>`).join('');
        return `<article class="dy-task${t.done ? ' done' : ''}${isOverdue(t) ? ' overdue' : ''}">
            <input class="dy-check" type="checkbox" aria-label="Tandai selesai" data-act="toggle" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''}>
            <div class="dy-body"><div class="dy-title">${esc(t.title)}</div>${t.note ? `<div class="dy-note">${esc(t.note)}</div>` : ''}
            <div class="mx-row mx-gap-s">${proj ? `<button type="button" class="mx-pill dy-proj" data-act="proj" data-pid="${esc(proj.id)}"><i class="dy-dot" style="background:${proj.color}"></i>${esc(proj.name)}</button>` : ''}<span class="mx-pill">${esc(t.category)}</span>${t.priority !== 'none' ? `<span class="mx-pill pri-${t.priority}">Prioritas ${PRI[t.priority].toLowerCase()}</span>` : ''}${t.date ? `<span class="mx-pill">▦ ${Mx.fmtDate(t.date)}</span>` : ''}${t.time ? `<span class="mx-pill">◷ ${esc(t.time)}</span>` : ''}${isOverdue(t) ? '<span class="mx-pill pri-high">Terlambat</span>' : ''}${t.subtasks.length ? `<span class="mx-pill">☑ ${subDone}/${t.subtasks.length}</span>` : ''}${rep}${tagPills}</div>${subs}</div>
            <div class="dy-actions"><button type="button" class="mx-icon" title="Edit tugas" aria-label="Edit tugas" data-act="edit" data-id="${esc(t.id)}">✎</button><button type="button" class="mx-icon" title="Hapus tugas" aria-label="Hapus tugas" data-act="delete" data-id="${esc(t.id)}">🗑</button></div></article>`;
    }
    const counts = () => {
        const td = today(), ts = D().tasks, done = ts.filter(t => t.done).length;
        return { total: ts.length, done, pending: ts.length - done, all: ts.length, today: ts.filter(t => t.date === td && !t.done).length, upcoming: ts.filter(t => t.date > td && !t.done).length, overdue: ts.filter(isOverdue).length, recurring: ts.filter(t => t.repeat.enabled && !t.done).length, doneC: done, pct: ts.length ? Math.round(done / ts.length * 100) : 0 };
    };
    const calMarks = () => { const m = {}; D().tasks.forEach(t => { if (t.date && !t.done) m[t.date] = (m[t.date] || 0) + 1; }); return m; };
    const projectById = id => D().projects.find(p => p.id === id);
    const VIEW_LABEL = { all: ['Semua tugas', 'Semua hal yang ingin kamu selesaikan.'], today: ['Tugas hari ini', 'Fokus pada hal yang perlu dilakukan hari ini.'], upcoming: ['Tugas mendatang', 'Persiapan untuk hari-hari berikutnya.'], overdue: ['Tugas terlambat', 'Tanggalnya sudah lewat dan belum selesai.'], done: ['Tugas selesai', 'Semua yang sudah kamu tuntaskan.'], recurring: ['Tugas berulang', 'Tugas yang dijadwalkan muncul kembali.'] };

    // Tugas kuliah (disimpan di tab Kuliah) ditampilkan juga di sini agar semua kewajiban ada di satu tempat.
    function kuliahCard() {
        if (!window.KuliahPro || !KuliahPro.getTasks) return '';
        const list = KuliahPro.getTasks().filter(t => !t.done && t.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
        if (!list.length) return '';
        const now = new Date().toISOString().slice(0, 10);
        return `<section class="mx-card dy-kuliah"><div class="mx-head"><div><h3 class="mx-h3">🎓 Tugas kuliah</h3><p class="mx-muted mx-xs">Diambil dari tab Kuliah — centang untuk menandai selesai.</p></div><button type="button" class="mx-btn" data-act="open-kuliah">Buka Kuliah</button></div>
        ${list.map(t => `<label class="dy-krow"><input type="checkbox" data-act="ktoggle" data-id="${esc(t.id)}"><span><b>${esc(t.judul)}</b><small>${esc(t.matkul)}${t.matkul ? ' · ' : ''}Deadline ${esc(Mx.fmtDate(t.deadline.slice(0, 10)))}</small></span>${t.deadline.slice(0, 10) < now ? '<span class="mx-pill dy-late">Terlambat</span>' : ''}</label>`).join('')}</section>`;
    }
    function renderHome() {
        const el = root('daily-home'); if (!el) return; const c = counts(), list = visible(), L = VIEW_LABEL[ui.view];
        const nav = [['all', '☷ Semua tugas', c.all], ['today', '☀ Hari ini', c.today], ['upcoming', '◷ Mendatang', c.upcoming], ['overdue', '⚠ Terlambat', c.overdue], ['recurring', '↻ Berulang', c.recurring], ['done', '✓ Selesai', c.doneC]]
            .map(([k, l, n]) => `<button type="button" class="dy-nav${ui.view === k && !ui.project ? ' active' : ''}" data-act="view" data-v="${k}"><span>${l}</span><span class="mx-count">${n}</span></button>`).join('');
        const focus = { sel: document.activeElement && document.activeElement.id === 'dySearch' };
        const projNav = D().projects.map(p => `<div class="dy-projrow"><button type="button" class="dy-nav${ui.project === p.id ? ' active' : ''}" data-act="proj" data-pid="${esc(p.id)}"><span><i class="dy-dot" style="background:${p.color}"></i>${esc(p.name)}</span><span class="mx-count">${D().tasks.filter(t => t.project === p.id && !t.done).length}</span></button><button type="button" class="mx-icon dy-projedit" title="Ubah proyek" aria-label="Ubah proyek ${esc(p.name)}" data-act="proj-edit" data-pid="${esc(p.id)}">✎</button></div>`).join('');
        const activeProj = ui.project && projectById(ui.project);
        const head = activeProj ? [activeProj.name, 'Tugas dalam proyek ini.'] : L;
        const tagBar = ui.tag ? `<div class="mx-chips"><button type="button" class="mx-chip on" data-act="tag" data-tag="${esc(ui.tag)}">#${esc(ui.tag)} ✕</button></div>` : '';
        const td0 = today(), dayList = D().tasks.filter(t => t.date === td0 || isOverdue(t)).sort((a, b) => (a.done - b.done) || (isOverdue(b) - isOverdue(a)) || String(a.time || '99').localeCompare(String(b.time || '99')));
        const dayDone = dayList.filter(t => t.done).length, dayOver = dayList.filter(isOverdue).length;
        const todayCard = `<section class="mx-card dy-today" aria-label="Tugas hari ini"><div class="mx-head"><div><h3 class="mx-h3">☀️ Hari ini</h3><p class="mx-muted mx-xs">${esc(Mx.fmtDateLong(td0))} · ${dayList.length - dayDone} belum selesai${dayOver ? ` · ${dayOver} terlambat` : ''}</p></div></div>
            <div class="dy-list">${dayList.length ? dayList.map(card).join('') : Mx.empty('🎉', 'Tidak ada tugas hari ini', 'Nikmati harimu, atau tambahkan tugas baru.')}</div></section>`;
        el.innerHTML = `
        <div class="mx-head"><div><h2 class="mx-h2">Tugas</h2></div>
            <div class="mx-row"><button type="button" class="mx-btn mx-btn-primary" data-act="add">＋ Tambah tugas</button></div></div>
        ${todayCard}
        <div class="mx-stats">
            <div class="mx-stat"><span>Semua tugas</span><b>${c.total}</b><small>tercatat</small></div>
            <div class="mx-stat"><span>Belum selesai</span><b>${c.pending}</b><small>pelan-pelan, pasti selesai</small></div>
            <div class="mx-stat"><span>Selesai</span><b>${c.done}</b><small>${c.pct}% dari semua tugas</small></div></div>
        <div class="mx-progress" role="progressbar" aria-valuenow="${c.pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${c.pct}%"></div></div>
        ${kuliahCard()}
        <div class="dy-layout">
            <aside class="mx-card dy-side"><div class="mx-label">Menu tugas</div><nav class="dy-navlist">${nav}</nav><div class="mx-label dy-labelrow"><span>Proyek</span><button type="button" class="mx-icon" title="Proyek baru" aria-label="Proyek baru" data-act="proj-add">＋</button></div><nav class="dy-navlist">${projNav || '<p class="mx-muted mx-xs">Belum ada proyek.</p>'}</nav><div class="mx-label">Kalender</div>
                <div id="dyMini">${Mx.calHTML(ui.miniCal, calMarks(), '', true)}</div></aside>
            <section class="mx-card"><div class="mx-head"><div><h3 class="mx-h3">${esc(head[0])}</h3><p class="mx-muted mx-xs">${head[1]}</p></div></div>
                <div class="mx-tools"><input id="dySearch" class="mx-input" type="search" placeholder="🔍 Cari nama / catatan…" value="${esc(ui.q)}" aria-label="Cari tugas">
                <select id="dySort" class="mx-input" aria-label="Urutkan"><option value="date">Urutkan: tanggal</option><option value="priority">Urutkan: prioritas</option><option value="created">Urutkan: terbaru dibuat</option><option value="alpha">Urutkan: nama A–Z</option></select></div>
                <div class="mx-chips">${[['all', 'Semua'], ['high', 'Prioritas tinggi'], ['reminder', 'Ada pengingat']].map(([k, l]) => `<button type="button" class="mx-chip${ui.filter === k ? ' on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
                ${tagBar}<div class="dy-list">${list.length ? list.map(card).join('') : Mx.empty('✦', 'Belum ada tugas di sini', 'Tambahkan tugas baru agar rencanamu tidak terlupakan.')}</div></section></div>`;
        el.querySelector('#dySort').value = ui.sort;
        if (focus.sel) { const s = el.querySelector('#dySearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
        updateBadge();
    }
    function renderKalender() {
        const el = root('daily-kalender'); if (!el) return;
        const list = D().tasks.filter(t => t.date === ui.calSel).sort(sorter());
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">Kalender tugas</h2><p class="mx-muted">Titik angka = jumlah tugas belum selesai pada tanggal itu.</p></div><button type="button" class="mx-btn mx-btn-primary" data-act="add" data-date="${ui.calSel}">＋ Tambah di tanggal ini</button></div>
        <div class="dy-calwrap"><div class="mx-card">${Mx.calHTML(ui.cal, calMarks(), ui.calSel)}</div>
        <div class="mx-card"><h3 class="mx-h3">${Mx.fmtDateLong(ui.calSel)}</h3><div class="dy-list">${list.length ? list.map(card).join('') : Mx.empty('📅', 'Tidak ada tugas', 'Belum ada tugas di tanggal ini.')}</div></div></div>`;
    }
    function updateBadge() {
        const b = document.getElementById('dailyNavBadge'); if (!b) return; const n = counts().today + counts().overdue;
        if (n > 0) { b.textContent = n > 9 ? '9+' : n; b.classList.add('show'); } else b.classList.remove('show');
    }
    const ALL = { 'daily-home': renderHome, 'daily-kalender': renderKalender };
    let current = 'daily-home';
    const renderCurrent = () => { (ALL[current] || renderHome)(); updateBadge(); };

    // ----- modal tambah / edit -----
    function openModal(t, presetDate) {
        const r = t ? t.repeat : { enabled: false, interval: 3, unit: 'day', type: 'feature', weekdays: [] };
        const m = Mx.modal({
            title: t ? 'Edit tugas' : 'Tambah tugas baru', size: 520, body: `
            <form id="dyForm" novalidate>
              <div class="mx-field"><label for="dyTitle">Nama tugas *</label><input id="dyTitle" class="mx-input" maxlength="120" placeholder="Contoh: Kerjakan tugas pemrograman" value="${esc(t ? t.title : '')}"><small class="mx-err" id="dyErr" hidden></small></div>
              <div class="mx-field"><label for="dyNote">Deskripsi / catatan</label><textarea id="dyNote" class="mx-input" maxlength="500" rows="3" placeholder="Detail atau hal yang perlu diingat…">${esc(t ? t.note : '')}</textarea></div>
              <div class="mx-two"><div class="mx-field"><label for="dyDate">Tanggal deadline</label><input type="date" id="dyDate" class="mx-input" value="${esc(t ? t.date : (presetDate || today()))}"></div>
              <div class="mx-field"><label for="dyTime">Jam pengingat</label><input type="time" id="dyTime" class="mx-input" value="${esc(t ? t.time : '')}"></div></div>
              <div class="mx-two"><div class="mx-field"><label for="dyPri">Prioritas</label><select id="dyPri" class="mx-input">${Object.entries(PRI).map(([k, v]) => `<option value="${k}" ${(t ? t.priority : 'medium') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
              <div class="mx-field"><label for="dyCat">Kategori</label><select id="dyCat" class="mx-input">${CATS.map(c => `<option ${(t ? t.category : 'Kuliah') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
              <div class="mx-two"><div class="mx-field"><label for="dyProj">Proyek</label><select id="dyProj" class="mx-input"><option value="">— Tanpa proyek —</option>${D().projects.map(p => `<option value="${esc(p.id)}" ${t && t.project === p.id ? 'selected' : (!t && ui.project === p.id ? 'selected' : '')}>${esc(p.name)}</option>`).join('')}<option value="__new__">＋ Proyek baru…</option></select>
              <input id="dyNewProj" class="mx-input" maxlength="40" placeholder="Nama proyek baru" hidden style="margin-top:.4rem"></div>
              <div class="mx-field"><label for="dyTags">Tag (pisahkan dengan koma)</label><input id="dyTags" class="mx-input" maxlength="120" placeholder="mis. rutin, desain" value="${esc(t ? t.tags.join(', ') : (ui.tag || ''))}"></div></div>
              <div class="mx-field"><label>Subtugas</label><div id="dySubList" class="dy-sublist"></div>
                <div class="mx-row"><input id="dySubIn" class="mx-input" maxlength="120" placeholder="Tambah subtugas lalu tekan Enter"><button type="button" class="mx-btn" id="dySubAdd">Tambah</button></div></div>
              <div class="dy-repeat"><label class="mx-switch"><span>↻ Ulangi tugas</span><input type="checkbox" id="dyRep" ${r.enabled ? 'checked' : ''}></label>
                <div id="dyRepOpt" ${r.enabled ? '' : 'hidden'}>
                  <div class="mx-two"><div class="mx-field"><label for="dyInt">Setiap</label><input type="number" id="dyInt" class="mx-input" min="1" max="365" value="${r.interval}"></div>
                  <div class="mx-field"><label for="dyUnit">Satuan</label><select id="dyUnit" class="mx-input">${Object.entries(UNIT_LABEL).map(([k, v]) => `<option value="${k}" ${r.unit === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
                  <div class="mx-field" id="dyWdBox" ${r.unit === 'week' ? '' : 'hidden'}><label>Hari tertentu (opsional)</label><div class="mx-chips">${DAYS.map((d, i) => `<button type="button" class="mx-chip${r.weekdays.includes(i) ? ' on' : ''}" data-wd="${i}">${d}</button>`).join('')}</div></div>
                  <div class="mx-label">Jenis pengulangan</div>
                  <div class="mx-two"><button type="button" class="dy-rtype${r.type === 'feature' ? ' on' : ''}" data-rt="feature"><b>◉ Dari tanggal selesai</b><span>Jadwal berikutnya dihitung dari saat kamu menyelesaikan. Telat selesai → jadwal ikut mundur.</span></button>
                  <button type="button" class="dy-rtype${r.type === 'normal' ? ' on' : ''}" data-rt="normal"><b>▣ Dari jadwal awal</b><span>Terkunci ke pola jadwal asli. Telat selesai → jadwal berikutnya tetap.</span></button></div>
                  <div class="mx-alert" id="dyRepInfo"></div></div></div>
              <div class="mx-foot"><button type="button" class="mx-btn" data-mx-close>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan tugas</button></div></form>`,
            onMount(api) {
                const f = api.body.querySelector('#dyForm'), q = s => f.querySelector(s);
                f.querySelector('[data-mx-close]').addEventListener('click', api.close);
                let rtype = r.type, wds = new Set(r.weekdays);
                let subs = (t ? t.subtasks : []).map(x => ({ ...x }));
                const subBox = q('#dySubList');
                const drawSubs = () => { subBox.innerHTML = subs.map((x, i) => `<div class="dy-subedit"><label><input type="checkbox" class="dy-check" data-si="${i}" ${x.done ? 'checked' : ''} aria-label="Selesai"><span>${esc(x.title)}</span></label><button type="button" class="mx-icon" data-sdel="${i}" aria-label="Hapus subtugas">✕</button></div>`).join(''); };
                const addSub = () => { const v = q('#dySubIn').value.trim(); if (!v || subs.length >= 50) return; subs.push({ id: uid(), title: v.slice(0, 120), done: false }); q('#dySubIn').value = ''; drawSubs(); };
                subBox.addEventListener('click', e => { const b = e.target.closest('[data-sdel]'); if (b) { subs.splice(+b.dataset.sdel, 1); drawSubs(); } });
                subBox.addEventListener('change', e => { if (e.target.dataset.si != null) subs[+e.target.dataset.si].done = e.target.checked; });
                q('#dySubAdd').addEventListener('click', addSub);
                q('#dySubIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
                q('#dyProj').addEventListener('change', e => { q('#dyNewProj').hidden = e.target.value !== '__new__'; if (e.target.value === '__new__') q('#dyNewProj').focus(); });
                drawSubs();
                const info = () => {
                    const rep = { interval: Number(q('#dyInt').value) || 1, unit: q('#dyUnit').value, weekdays: [...wds] };
                    const nx = rtype === 'feature' ? nextDate(today(), rep) : nextDate(q('#dyDate').value || today(), rep);
                    q('#dyRepInfo').textContent = rtype === 'feature' ? `Dihitung dari tanggal kamu menyelesaikan. Jika selesai hari ini, berikutnya ${Mx.fmtDate(nx)}.` : `Mengikuti jadwal awal. Perkiraan berikutnya: ${Mx.fmtDate(nx)}.`;
                };
                q('#dyRep').addEventListener('change', e => { q('#dyRepOpt').hidden = !e.target.checked; info(); });
                q('#dyUnit').addEventListener('change', () => { q('#dyWdBox').hidden = q('#dyUnit').value !== 'week'; info(); });
                ['#dyInt', '#dyDate'].forEach(s => q(s).addEventListener('input', info));
                f.querySelectorAll('[data-rt]').forEach(b => b.addEventListener('click', () => { rtype = b.dataset.rt; f.querySelectorAll('[data-rt]').forEach(x => x.classList.toggle('on', x === b)); info(); }));
                f.querySelectorAll('[data-wd]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.wd; wds.has(i) ? wds.delete(i) : wds.add(i); b.classList.toggle('on', wds.has(i)); info(); }));
                info(); setTimeout(() => q('#dyTitle').focus(), 50);
                f.addEventListener('submit', e => {
                    e.preventDefault(); const err = q('#dyErr'); err.hidden = true;
                    const title = q('#dyTitle').value.trim(), date = q('#dyDate').value, time = q('#dyTime').value, on = q('#dyRep').checked;
                    const fail = m => { err.textContent = m; err.hidden = false; };
                    if (!title) return fail('Nama tugas wajib diisi.');
                    if (time && !date) return fail('Pengingat jam membutuhkan tanggal.');
                    if (on && !(Number(q('#dyInt').value) >= 1 && Number(q('#dyInt').value) <= 365)) return fail('Interval pengulangan harus 1–365.');
                    const unit = q('#dyUnit').value;
                    let projId = q('#dyProj').value;
                    if (projId === '__new__') {
                        const nm = q('#dyNewProj').value.trim(); if (!nm) return fail('Isi nama proyek baru, atau pilih proyek lain.');
                        const ex = D().projects.find(p => p.name.toLocaleLowerCase('id-ID') === nm.toLocaleLowerCase('id-ID'));
                        if (ex) projId = ex.id; else { const np = normProject({ id: uid(), name: nm, color: PROJ_COLORS[D().projects.length % PROJ_COLORS.length] }); D().projects.push(np); projId = np.id; }
                    }
                    const next = normTask({
                        ...(t || {}), id: t ? t.id : uid(), title, note: q('#dyNote').value.trim(), date, time, priority: q('#dyPri').value, category: q('#dyCat').value, project: projId, tags: q('#dyTags').value.split(','), subtasks: subs,
                        repeat: { enabled: on, interval: Number(q('#dyInt').value), unit, type: rtype, weekdays: unit === 'week' ? [...wds].sort() : [] },
                        notified: t && t.date === date && t.time === time ? t.notified : '', created: t ? t.created : new Date().toISOString()
                    });
                    if (t) D().tasks = D().tasks.map(x => x.id === t.id ? next : x); else D().tasks.push(next);
                    save(); api.close(); renderCurrent(); Mx.toast(t ? 'Tugas diperbarui' : 'Tugas ditambahkan');
                });
            }
        });
    }

    function projectModal(p) {
        let color = p ? p.color : PROJ_COLORS[D().projects.length % PROJ_COLORS.length];
        Mx.modal({
            title: p ? 'Ubah proyek' : 'Proyek baru', size: 420, body: `<form id="dyPForm" novalidate>
              <div class="mx-field"><label for="dyPName">Nama proyek *</label><input id="dyPName" class="mx-input" maxlength="40" value="${esc(p ? p.name : '')}"><small class="mx-err" id="dyPErr" hidden></small></div>
              <div class="mx-field"><label>Warna</label><div class="mx-chips">${PROJ_COLORS.map(c => `<button type="button" class="dy-swatch${c === color ? ' on' : ''}" style="background:${c}" data-c="${c}" aria-label="Warna ${c}"></button>`).join('')}</div></div>
              <div class="mx-foot">${p ? '<button type="button" class="mx-btn" id="dyPDel" style="margin-right:auto">🗑 Hapus proyek</button>' : ''}<button type="button" class="mx-btn" data-mx-close>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount(api) {
                const f = api.body.querySelector('#dyPForm');
                f.querySelector('[data-mx-close]').addEventListener('click', api.close);
                f.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { color = b.dataset.c; f.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); }));
                setTimeout(() => f.querySelector('#dyPName').focus(), 50);
                const del = f.querySelector('#dyPDel');
                if (del) del.addEventListener('click', async () => {
                    if (!(await Mx.confirm(`Hapus proyek "${p.name}"? Tugasnya tidak ikut dihapus, hanya dilepas dari proyek.`))) return;
                    D().tasks.forEach(t => { if (t.project === p.id) t.project = ''; });
                    D().projects = D().projects.filter(x => x.id !== p.id); if (ui.project === p.id) ui.project = '';
                    save(); api.close(); renderCurrent(); Mx.toast('Proyek dihapus');
                });
                f.addEventListener('submit', e => {
                    e.preventDefault(); const name = f.querySelector('#dyPName').value.trim(), err = f.querySelector('#dyPErr');
                    if (!name) { err.textContent = 'Nama proyek wajib diisi.'; err.hidden = false; return; }
                    if (D().projects.some(x => x.id !== (p && p.id) && x.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) { err.textContent = 'Nama proyek sudah dipakai.'; err.hidden = false; return; }
                    if (p) { p.name = name; p.color = color; } else D().projects.push(normProject({ id: uid(), name, color }));
                    save(); api.close(); renderCurrent(); Mx.toast(p ? 'Proyek diperbarui' : 'Proyek dibuat');
                });
            }
        });
    }

    // ----- migrasi sekali jalan dari Tugas Pro lama (data.todos di akun) -----
    function importLegacy(todos) {
        const d = D(); if (d.legacyImported || !todos || typeof todos !== 'object') return false;
        const oldTasks = asList(todos.tasks).filter(x => x && typeof x === 'object'), oldProjects = asList(todos.projects).filter(x => x && typeof x === 'object');
        const iso = ts => { const n = Number(ts); return n > 0 ? new Date(n).toISOString() : ''; };
        const pName = {}; oldProjects.forEach(op => { pName[op.id] = op.name; });
        oldProjects.forEach(op => { if (op.id && op.name && !d.projects.some(p => p.id === 'tp_' + op.id)) d.projects.push(normProject({ id: 'tp_' + op.id, name: op.name, color: op.color })); });
        const PM = { high: 'high', med: 'medium', low: 'low' };
        oldTasks.forEach(o => {
            const id = 'tp_' + (o.id || uid()); if (d.tasks.some(t => t.id === id)) return;
            const r = o.repeat && typeof o.repeat === 'object' ? o.repeat : null;
            d.tasks.push(normTask({
                id, title: o.title, note: o.notes || '', date: o.due || '', time: '', priority: PM[o.priority] || 'none',
                category: CATS.includes(pName[o.project]) ? pName[o.project] : 'Lainnya', project: o.project ? 'tp_' + o.project : '',
                tags: o.tags, subtasks: asList(o.subtasks).map(x => ({ ...x, id: 'tp_' + (x.id || uid()) })),
                repeat: r ? { enabled: true, interval: r.interval, unit: r.unit, type: r.from === 'schedule' ? 'normal' : 'feature', weekdays: [] } : {},
                done: !!o.done, doneAt: o.done ? (iso(o.completedAt) || iso(o.created)) : '', created: iso(o.created) || new Date().toISOString()
            }));
        });
        d.legacyImported = new Date().toISOString(); save(); renderCurrent();
        if (oldTasks.length) Mx.toast(`${oldTasks.length} tugas dari Tugas Pro dipindahkan ke Tugas`, 'success');
        return true;
    }

    // ----- aksi -----
    function toggle(id, checked) {
        const t = byId(D().tasks, id); if (!t) return;
        t.done = checked; t.doneAt = checked ? new Date().toISOString() : '';
        if (checked && t.repeat.enabled) {
            const nd = computeNext(t); // satu kemunculan berikutnya, tanpa duplikat
            if (!D().tasks.some(x => !x.done && x.repeatParent === t.id && x.date === nd)) D().tasks.push(normTask({ ...t, id: uid(), date: nd, done: false, doneAt: '', notified: '', repeatParent: t.id, subtasks: t.subtasks.map(x => ({ ...x, id: uid(), done: false })), created: new Date().toISOString() }));
        }
        if (!checked) { // batal selesai: hapus kemunculan berikutnya yang belum disentuh agar tidak dobel
            D().tasks = D().tasks.filter(x => !(x.repeatParent === t.id && !x.done && x.repeat.enabled));
        }
        save(); renderCurrent(); Mx.toast(checked ? 'Tugas ditandai selesai' : 'Tugas dikembalikan ke daftar');
    }
    async function remove(id) {
        const t = byId(D().tasks, id); if (!t) return;
        if (!(await Mx.confirm(`Hapus tugas "${t.title}"?`))) return;
        D().tasks = D().tasks.filter(x => x.id !== t.id); save(); renderCurrent(); Mx.toast('Tugas dihapus');
    }
    const acts = {
        ktoggle: el => { if (window.KuliahPro) { KuliahPro.toggleTaskDone(el.dataset.id); renderCurrent(); } },
        'open-kuliah': () => { App.UI._lastSubTab.kuliah = 'kuliah'; App.UI.switchMainGroup('kuliah'); },
        add: el => openModal(null, el.dataset.date), edit: el => { const t = byId(D().tasks, el.dataset.id); if (t) openModal(t); },
        delete: el => remove(el.dataset.id), undo: el => toggle(el.dataset.id, false),
        view: el => { ui.view = el.dataset.v; ui.project = ''; ui.tag = ''; renderCurrent(); },
        subtoggle: el => { const t = byId(D().tasks, el.dataset.id); const x = t && t.subtasks.find(y => y.id === el.dataset.sid); if (!x) return; x.done = el.checked; save(); renderCurrent(); },
        tag: el => { ui.tag = ui.tag === el.dataset.tag ? '' : el.dataset.tag; current = 'daily-home'; if (!root('daily-home').classList.contains('active')) App.UI.switchTab('daily-home', document.getElementById('subtab-daily-home')); else renderCurrent(); },
        proj: el => { ui.project = ui.project === el.dataset.pid ? '' : el.dataset.pid; ui.view = 'all'; current = 'daily-home'; if (!root('daily-home').classList.contains('active')) App.UI.switchTab('daily-home', document.getElementById('subtab-daily-home')); else renderCurrent(); },
        'proj-add': () => projectModal(null), 'proj-edit': el => { const p = projectById(el.dataset.pid); if (p) projectModal(p); }, filter: el => { ui.filter = el.dataset.f; renderCurrent(); },
        toggle: el => toggle(el.dataset.id, el.checked),
        'cal-prev': el => { const mini = el.closest('#dyMini'); Mx.calShift(mini ? ui.miniCal : ui.cal, -1); renderCurrent(); },
        'cal-next': el => { const mini = el.closest('#dyMini'); Mx.calShift(mini ? ui.miniCal : ui.cal, 1); renderCurrent(); },
        'cal-day': el => {
            if (el.closest('#dyMini')) { ui.calSel = el.dataset.iso; ui.cal = { y: +el.dataset.iso.slice(0, 4), m: +el.dataset.iso.slice(5, 7) - 1 }; current = 'daily-kalender'; App.UI.switchTab('daily-kalender', document.getElementById('subtab-daily-kalender')); }
            else { ui.calSel = el.dataset.iso; renderCurrent(); }
        }
    };

    AppModules.register(KEY, {
        label: 'Tugas', views: Object.keys(ALL), normalize, validate,
        init() {
            Object.keys(ALL).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id === 'dySearch') { ui.q = e.target.value; renderHome(); } },
                    change: e => { if (e.target.id === 'dySort') { ui.sort = e.target.value; renderHome(); } }
                });
            });
            setInterval(() => { if (current === 'daily-home') updateBadge(); }, 60000);
        },
        show(v) { current = v; renderCurrent(); },
        afterLoad(cloud) { if (cloud && cloud.todos) importLegacy(cloud.todos); },
        importLegacy,
        refresh() { if (document.getElementById('view-' + current) && document.getElementById('view-' + current).classList.contains('active')) renderCurrent(); else updateBadge(); },
        isBusy: () => !!document.querySelector('.mx-overlay #dyForm')
    });
})();
