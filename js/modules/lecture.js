/* ==========================================================================
   MODUL CATATAN KULIAH — catatan bertahap per mata kuliah & tanggal
   Data: AppModules 'lecture' = { courses (warisan, dikosongkan setelah migrasi), notes, summaries }
   Daftar mata kuliah diambil dari tab Kuliah (KuliahPro.getCourses); catatan merujuk id matkul Kuliah.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'lecture';
    const TYPES = { note: ['📝', 'Catatan'], imp: ['⭐', 'Penting'], todo: ['✅', 'Tugas'], q: ['❓', 'Pertanyaan'], def: ['📖', 'Definisi'] };
    const COLORS = ['#2f8f6b', '#d1693b', '#4a7bd1', '#b04fa0', '#c9a227', '#c0463f', '#3b9aa8'];
    const { esc, uid, today, byId } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const ui = { courseId: '', date: today(), type: 'note', archive: { q: '', course: '', from: '', to: '', tag: '' }, sumScope: 'all', sumTypes: new Set(Object.keys(TYPES)) };

    // ----- data -----
    const parseTags = s => [...new Set(String(s || '').split(/[,\s]+/).map(x => x.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    function normalize(raw) {
        raw = raw || {};
        const courses = arr(raw.courses).filter(c => c && c.name).map((c, i) => ({ id: String(c.id || uid()), name: String(c.name).slice(0, 80), code: String(c.code || '').slice(0, 20), lecturer: String(c.lecturer || '').slice(0, 60), color: c.color || COLORS[i % COLORS.length] }));
        const notes = arr(raw.notes).filter(n => n && (n.courseId || n.cid)).map(n => ({
            id: String(n.id || uid()), courseId: String(n.courseId || n.cid), date: /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : today(),
            title: String(n.title || '').slice(0, 150), body: String(n.body ?? n.text ?? '').slice(0, 20000), tags: arr(n.tags).map(String).slice(0, 10),
            type: TYPES[n.type] ? n.type : 'note', done: !!n.done, due: /^\d{4}-\d{2}-\d{2}$/.test(n.due || '') ? n.due : '', time: String(n.time || ''), created: n.created || new Date().toISOString(), updated: n.updated || n.created || new Date().toISOString()
        }));
        const summaries = arr(raw.summaries).filter(s => s && s.courseId).map(s => ({ id: String(s.id || uid()), courseId: String(s.courseId), title: String(s.title || 'Rangkuman').slice(0, 120), text: String(s.text || '').slice(0, 100000), created: s.created || new Date().toISOString(), updated: s.updated || s.created || new Date().toISOString() }));
        return { courses, notes, summaries };
    }
    function validate(raw) {
        const e = []; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        ['courses', 'notes', 'summaries'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        arr(raw.notes).forEach((n, i) => { if (!n || typeof n !== 'object' || !(n.courseId || n.cid)) e.push(`catatan #${i + 1} tidak punya mata kuliah`); });
        return e.slice(0, 5);
    }
    // ----- daftar mata kuliah = tab Kuliah -----
    const colorFor = name => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
    const kp = () => (window.KuliahPro && KuliahPro.getCourses) ? KuliahPro.getCourses() : [];
    const courses = () => kp().map(c => ({ id: c.id, name: c.name, color: colorFor(c.name) }));
    const course = id => courses().find(c => c.id === id) || { name: '(mata kuliah tidak ada di Kuliah)', color: '#999', id: '' };
    // Migrasi satu kali: matkul lama Catatan Kuliah digabung ke Kuliah berdasarkan nama (yang belum ada ditambahkan), catatan dipetakan ulang.
    function migrateCourses() {
        const d = D(); if (!d || !d.courses.length || !window.KuliahPro || !KuliahPro.ensureCourse) return false;
        const map = {}; d.courses.forEach(c => { map[c.id] = KuliahPro.ensureCourse(c.name); });
        d.notes.forEach(n => { if (map[n.courseId]) n.courseId = map[n.courseId]; });
        d.summaries.forEach(x => { if (map[x.courseId]) x.courseId = map[x.courseId]; });
        d.courses = []; save(); return true;
    }
    const countFor = id => D().notes.filter(n => n.courseId === id).length;
    const go = v => App.UI.switchTab(v, document.getElementById('subtab-' + v));
    const courseOptions = (sel, withAll) => (withAll ? `<option value="">Semua mata kuliah</option>` : '') + courses().map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const needCourse = () => Mx.empty('🎓', 'Belum ada mata kuliah', 'Tambahkan mata kuliah dulu di tab Kuliah (Jadwal).') + `<div class="mx-center"><button type="button" class="mx-btn mx-btn-primary" data-act="goto" data-v="kuliah">Buka tab Kuliah</button></div>`;

    // ----- komponen -----
    function entry(n, showCourse) {
        const c = course(n.courseId);
        return `<div class="ck-entry${n.done ? ' done' : ''}" data-id="${esc(n.id)}"><span class="ck-ico">${n.type === 'todo' ? `<input type="checkbox" data-act="chk" data-id="${esc(n.id)}" ${n.done ? 'checked' : ''} aria-label="Selesai">` : TYPES[n.type][0]}</span>
            <div class="ck-main">${n.title ? `<div class="ck-title">${esc(n.title)}</div>` : ''}${n.body ? `<div class="ck-body">${esc(n.body)}</div>` : ''}
            <div class="mx-row mx-gap-s mx-xs mx-muted">${showCourse ? `<span><i class="mx-dot" style="background:${esc(c.color)}"></i> ${esc(c.name)}</span>` : ''}<span>${Mx.fmtDate(n.date)} ${esc(n.time)}</span>${n.due ? `<span>⏰ ${Mx.fmtDate(n.due)}</span>` : ''}${n.tags.map(t => `<span class="mx-tag">#${esc(t)}</span>`).join('')}</div></div>
            <div class="ck-actions"><button type="button" class="mx-icon" data-act="edit" data-id="${esc(n.id)}" title="Edit" aria-label="Edit">✎</button><button type="button" class="mx-icon" data-act="copy" data-id="${esc(n.id)}" title="Salin" aria-label="Salin">⧉</button><button type="button" class="mx-icon" data-act="dup" data-id="${esc(n.id)}" title="Tambahkan lagi" aria-label="Tambahkan lagi">＋</button><button type="button" class="mx-icon" data-act="del" data-id="${esc(n.id)}" title="Hapus" aria-label="Hapus">🗑</button></div></div>`;
    }
    const entryText = n => `${TYPES[n.type][0]} ${[n.title, n.body].filter(Boolean).join(' — ')}${n.tags.length ? '  ' + n.tags.map(t => '#' + t).join(' ') : ''}`;
    function groupList(notes, showCourse) { // kumpulan harian: per mata kuliah + tanggal
        const g = new Map();
        notes.forEach(n => { const k = n.courseId + '|' + n.date; if (!g.has(k)) g.set(k, []); g.get(k).push(n); });
        return [...g.entries()].sort((a, b) => b[0].split('|')[1].localeCompare(a[0].split('|')[1])).map(([k, list]) => {
            const [cid, date] = k.split('|'), c = course(cid); list.sort((a, b) => (a.time + a.created).localeCompare(b.time + b.created));
            return `<div class="mx-card ck-group"><div class="ck-ghead"><span><i class="mx-dot" style="background:${esc(c.color)}"></i> <b>${esc(c.name)}</b> · ${Mx.fmtDateLong(date)}</span><span class="mx-row"><span class="mx-count">${list.length}</span><button type="button" class="mx-btn mx-btn-sm" data-act="copygroup" data-k="${esc(k)}">⧉ Salin kumpulan</button></span></div>${list.map(n => entry(n, false)).join('')}</div>`;
        }).join('');
    }

    // ----- tampilan -----
    function renderDashboard() {
        const el = root('ck-dashboard'); if (!el) return; const d = D();
        const recent = [...d.notes].sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 5);
        const tasks = d.notes.filter(n => n.type === 'todo' && !n.done).sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date)).slice(0, 5);
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📓 Catatan Kuliah</h2></div><button type="button" class="mx-btn mx-btn-primary" data-act="goto" data-v="ck-catat">✍️ Mulai mencatat</button></div>
        <div class="mx-stats"><div class="mx-stat"><span>Catatan</span><b>${d.notes.length}</b><small>seluruh mata kuliah</small></div><div class="mx-stat"><span>Mata kuliah</span><b>${courses().length}</b><small>di tab Kuliah</small></div><div class="mx-stat"><span>Tugas</span><b>${d.notes.filter(n => n.type === 'todo' && !n.done).length}</b><small>belum selesai</small></div></div>
        <div class="mx-card"><h3 class="mx-h3">Akses cepat mata kuliah</h3>${courses().length ? `<div class="mx-chips">${courses().map(c => `<button type="button" class="mx-chip" data-act="quick" data-id="${esc(c.id)}"><i class="mx-dot" style="background:${esc(c.color)}"></i> ${esc(c.name)} <span class="mx-count">${countFor(c.id)}</span></button>`).join('')}</div>` : needCourse()}</div>
        <div class="mx-grid2"><div class="mx-card"><h3 class="mx-h3">Catatan terbaru</h3>${recent.length ? recent.map(n => entry(n, true)).join('') : Mx.empty('📝', 'Belum ada catatan')}</div>
        <div class="mx-card"><h3 class="mx-h3">Tugas terdekat</h3>${tasks.length ? tasks.map(n => entry(n, true)).join('') : Mx.empty('✅', 'Tidak ada tugas', 'Catatan berjenis Tugas akan muncul di sini.')}</div></div>`;
    }
    function renderCatat() {
        const el = root('ck-catat'); if (!el) return; const d = D();
        const cs = courses(); if (!cs.length) { el.innerHTML = needCourse(); return; }
        if (!byId(cs, ui.courseId)) ui.courseId = cs[0].id;
        const list = d.notes.filter(n => n.courseId === ui.courseId && n.date === ui.date);
        const keepBody = el.querySelector('#ckBody') ? el.querySelector('#ckBody').value : '', keepTitle = el.querySelector('#ckTitle') ? el.querySelector('#ckTitle').value : '', keepTags = el.querySelector('#ckTags') ? el.querySelector('#ckTags').value : '';
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">✍️ Catat</h2><p class="mx-muted">Simpan satu poin, lalu lanjut menambah. Catatan di tanggal & mata kuliah yang sama otomatis satu kumpulan.</p></div></div>
        <div class="mx-card"><div class="mx-tools"><select id="ckCourse" class="mx-input" aria-label="Mata kuliah">${courseOptions(ui.courseId)}</select><input type="date" id="ckDate" class="mx-input" value="${ui.date}" aria-label="Tanggal pertemuan"><button type="button" class="mx-btn" data-act="today">Hari ini</button></div>
        <div class="mx-chips">${Object.entries(TYPES).map(([k, v]) => `<button type="button" class="mx-chip${ui.type === k ? ' on' : ''}" data-act="type" data-t="${k}">${v[0]} ${v[1]}</button>`).join('')}</div>
        <div class="mx-field"><input id="ckTitle" class="mx-input" maxlength="150" placeholder="Judul / poin singkat (opsional)" value="${esc(keepTitle)}"></div>
        <div class="mx-field"><textarea id="ckBody" class="mx-input" rows="4" maxlength="20000" placeholder="Isi catatan… (Ctrl+Enter untuk menyimpan)">${esc(keepBody)}</textarea></div>
        <div class="mx-field"><input id="ckTags" class="mx-input" placeholder="Tag / kata kunci, pisahkan dengan koma" value="${esc(keepTags)}"></div>
        ${ui.type === 'todo' ? `<div class="mx-field"><label for="ckDue">Batas waktu (opsional)</label><input type="date" id="ckDue" class="mx-input"></div>` : ''}
        <small class="mx-err" id="ckErr" hidden></small><div class="mx-foot"><button type="button" class="mx-btn mx-btn-primary" data-act="add">Tambah catatan</button></div></div>
        <div class="mx-label">${Mx.fmtDateLong(ui.date)} · ${esc(course(ui.courseId).name)}</div>
        ${list.length ? groupList(list) : Mx.empty('📝', 'Belum ada catatan di tanggal ini', 'Tulis poin pertamamu di atas 👆')}`;
    }
    function buildSummary(scope, types) {
        const cs = courses().filter(c => scope === 'all' || c.id === scope), ns = D().notes.filter(n => (scope === 'all' || n.courseId === scope) && types.has(n.type));
        let txt = `# Rangkuman ${scope === 'all' ? 'Semua Mata Kuliah' : course(scope).name}\n`;
        cs.forEach(c => {
            const cn = ns.filter(n => n.courseId === c.id); if (!cn.length) return; txt += `\n## ${c.name}\n`;
            [...new Set(cn.map(n => n.date))].sort().forEach(dt => { txt += `\n### ${Mx.fmtDateLong(dt)}\n`; cn.filter(n => n.date === dt).sort((a, b) => a.time.localeCompare(b.time)).forEach(n => { txt += `- ${entryText(n).replace(/\n/g, '\n  ')}${n.type === 'todo' && n.done ? ' (selesai)' : ''}\n`; }); });
        });
        return { txt, count: ns.length };
    }
    function renderRangkuman() {
        const el = root('ck-rangkuman'); if (!el) return; const sc = ui.sumScope === 'all' || byId(courses(), ui.sumScope) ? ui.sumScope : 'all'; ui.sumScope = sc;
        const pre = buildSummary(sc, ui.sumTypes), sums = [...D().summaries].sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📚 Rangkuman</h2><p class="mx-muted">Disusun otomatis dari catatanmu (bukan AI) — hasilnya bisa kamu edit sebelum disimpan.</p></div></div>
        <div class="mx-card"><div class="mx-tools"><select id="ckSumScope" class="mx-input" aria-label="Cakupan rangkuman"><option value="all" ${sc === 'all' ? 'selected' : ''}>Seluruh mata kuliah</option>${courses().map(c => `<option value="${esc(c.id)}" ${c.id === sc ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="mx-chips">${Object.entries(TYPES).map(([k, v]) => `<button type="button" class="mx-chip${ui.sumTypes.has(k) ? ' on' : ''}" data-act="sumtype" data-t="${k}">${v[0]} ${v[1]}</button>`).join('')}<button type="button" class="mx-chip" data-act="sumkey">⭐ Hanya poin kunci</button></div>
        <p class="mx-muted mx-xs">${pre.count} catatan cocok.</p><pre class="mx-pre">${esc(pre.txt)}</pre><div class="mx-foot"><button type="button" class="mx-btn" data-act="sumcopy">⧉ Salin</button><button type="button" class="mx-btn mx-btn-primary" data-act="sumcreate" ${pre.count ? '' : 'disabled'}>Buat rangkuman</button></div></div>
        <div class="mx-card"><h3 class="mx-h3">Rangkuman tersimpan</h3>${sums.length ? sums.map(s => `<div class="ck-course"><div class="ck-main"><b>${esc(s.title)}</b><div class="mx-muted mx-xs">${s.courseId === 'all' ? 'Semua mata kuliah' : esc(course(s.courseId).name)} · diperbarui ${Mx.fmtDateTime(s.updated)}</div></div>
        <button type="button" class="mx-icon" data-act="sum-edit" data-id="${esc(s.id)}" aria-label="Edit rangkuman" title="Edit">✎</button><button type="button" class="mx-icon" data-act="sum-copy" data-id="${esc(s.id)}" aria-label="Salin" title="Salin">⧉</button><button type="button" class="mx-icon" data-act="sum-del" data-id="${esc(s.id)}" aria-label="Hapus" title="Hapus">🗑</button></div>`).join('') : Mx.empty('📚', 'Belum ada rangkuman tersimpan')}</div>`;
    }
    function archiveList() {
        const f = ui.archive, q = f.q.toLowerCase();
        return D().notes.filter(n => (!f.course || n.courseId === f.course) && (!f.from || n.date >= f.from) && (!f.to || n.date <= f.to) && (!f.tag || n.tags.includes(f.tag)) && (!q || `${n.title} ${n.body} ${n.tags.join(' ')}`.toLowerCase().includes(q))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    }
    function renderArsip() {
        const el = root('ck-arsip'); if (!el) return; const f = ui.archive, list = archiveList(), tags = [...new Set(D().notes.flatMap(n => n.tags))].sort();
        const body = list.length ? groupList(list) : Mx.empty('🗂️', 'Tidak ada catatan yang cocok');
        const shell = el.querySelector('#ckArcList');
        if (shell) { shell.innerHTML = `<p class="mx-muted mx-xs">${list.length} catatan ditemukan.</p>` + body; return; }
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🗂️ Arsip</h2><p class="mx-muted">Seluruh catatan, bisa dicari dan disaring.</p></div><button type="button" class="mx-btn" data-act="export-txt">📤 Ekspor TXT</button></div>
        <div class="mx-card"><input id="ckArcQ" class="mx-input" type="search" placeholder="🔍 Cari judul, isi, atau tag…" value="${esc(f.q)}" aria-label="Cari catatan"><div class="mx-tools" style="margin-top:.6rem">
        <select id="ckArcCourse" class="mx-input" aria-label="Filter mata kuliah">${courseOptions(f.course, true)}</select><select id="ckArcTag" class="mx-input" aria-label="Filter tag"><option value="">Semua tag</option>${tags.map(t => `<option ${t === f.tag ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <label class="mx-muted mx-xs">Dari <input type="date" id="ckArcFrom" class="mx-input" value="${f.from}"></label><label class="mx-muted mx-xs">Sampai <input type="date" id="ckArcTo" class="mx-input" value="${f.to}"></label></div></div>
        <div id="ckArcList"><p class="mx-muted mx-xs">${list.length} catatan ditemukan.</p>${body}</div>`;
    }
    const RENDER = { 'ck-dashboard': renderDashboard, 'ck-catat': renderCatat, 'ck-rangkuman': renderRangkuman, 'ck-arsip': renderArsip };
    let current = 'ck-dashboard';
    const rerender = () => { const f = RENDER[current]; if (f) f(); };

    // ----- modal -----
    function noteModal(n) {
        Mx.modal({
            title: 'Edit catatan', body: `<form id="ckEditForm" novalidate>
            <div class="mx-two"><div class="mx-field"><label>Mata kuliah</label><select id="eCourse" class="mx-input">${courseOptions(n.courseId)}</select></div><div class="mx-field"><label>Tanggal pertemuan</label><input type="date" id="eDate" class="mx-input" value="${n.date}"></div></div>
            <div class="mx-field"><label>Jenis</label><select id="eType" class="mx-input">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${n.type === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></div>
            <div class="mx-field"><label>Judul / poin</label><input id="eTitle" class="mx-input" maxlength="150" value="${esc(n.title)}"></div><div class="mx-field"><label>Isi</label><textarea id="eBody" class="mx-input" rows="6">${esc(n.body)}</textarea></div>
            <div class="mx-two"><div class="mx-field"><label>Tag</label><input id="eTags" class="mx-input" value="${esc(n.tags.join(', '))}"></div><div class="mx-field"><label>Batas waktu (tugas)</label><input type="date" id="eDue" class="mx-input" value="${n.due}"></div></div>
            <small class="mx-err" id="eErr" hidden></small><div class="mx-foot"><button type="button" class="mx-btn" data-mx-close>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount(api) {
                const f = api.body.querySelector('form'); f.querySelector('[data-mx-close]').addEventListener('click', api.close);
                f.addEventListener('submit', e => {
                    e.preventDefault(); const g = s => f.querySelector(s).value, title = g('#eTitle').trim(), body = g('#eBody').trim();
                    if (!title && !body) { const er = f.querySelector('#eErr'); er.textContent = 'Isi judul atau isi catatan.'; er.hidden = false; return; }
                    Object.assign(n, { courseId: g('#eCourse'), date: g('#eDate') || n.date, type: g('#eType'), title, body, tags: parseTags(g('#eTags')), due: g('#eDue'), updated: new Date().toISOString() });
                    save(); api.close(); rerender(); Mx.toast('Catatan diperbarui');
                });
            }
        });
    }
    function summaryModal(s, scope, text) {
        Mx.modal({
            title: s ? 'Edit rangkuman' : 'Simpan rangkuman', size: 640, body: `<form novalidate><div class="mx-field"><label>Judul</label><input id="sTitle" class="mx-input" maxlength="120" value="${esc(s ? s.title : 'Rangkuman ' + (scope === 'all' ? 'Semua Mata Kuliah' : course(scope).name))}"></div>
            <div class="mx-field"><label>Isi rangkuman</label><textarea id="sText" class="mx-input" rows="14">${esc(s ? s.text : text)}</textarea></div><small class="mx-err" id="sErr" hidden></small>
            <div class="mx-foot"><button type="button" class="mx-btn" data-mx-close>Batal</button><button type="button" class="mx-btn" id="sCopy">⧉ Salin</button><button type="submit" class="mx-btn mx-btn-primary">Simpan</button></div></form>`,
            onMount(api) {
                const f = api.body.querySelector('form'); f.querySelector('[data-mx-close]').addEventListener('click', api.close);
                f.querySelector('#sCopy').addEventListener('click', () => Mx.copy(f.querySelector('#sText').value));
                f.addEventListener('submit', e => {
                    e.preventDefault(); const title = f.querySelector('#sTitle').value.trim(), t = f.querySelector('#sText').value.trim();
                    if (!title || !t) { const er = f.querySelector('#sErr'); er.textContent = 'Judul dan isi rangkuman wajib diisi.'; er.hidden = false; return; }
                    const now = new Date().toISOString();
                    if (s) Object.assign(s, { title, text: t, updated: now }); else D().summaries.push({ id: uid(), courseId: scope, title, text: t, created: now, updated: now });
                    save(); api.close(); rerender(); Mx.toast('Rangkuman disimpan');
                });
            }
        });
    }

    // ----- aksi -----
    function addNote() {
        const el = root('ck-catat'), err = el.querySelector('#ckErr'), title = el.querySelector('#ckTitle').value.trim(), body = el.querySelector('#ckBody').value.trim();
        if (!title && !body) { err.textContent = 'Isi judul atau isi catatan terlebih dahulu.'; err.hidden = false; return; }
        const now = new Date(), due = el.querySelector('#ckDue') ? el.querySelector('#ckDue').value : '';
        D().notes.push({ id: uid(), courseId: ui.courseId, date: ui.date || today(), title, body, tags: parseTags(el.querySelector('#ckTags').value), type: ui.type, done: false, due, time: Mx.nowHM(), created: now.toISOString(), updated: now.toISOString() });
        el.querySelector('#ckTitle').value = ''; el.querySelector('#ckBody').value = ''; el.querySelector('#ckTags').value = '';
        save(); renderCatat(); const b = el.querySelector('#ckBody'); if (b) b.focus(); Mx.toast('Catatan ditambahkan');
    }
    const acts = {
        goto: el => go(el.dataset.v), quick: el => { ui.courseId = el.dataset.id; ui.date = today(); go('ck-catat'); },
        add: addNote, today: () => { ui.date = today(); renderCatat(); }, type: el => { ui.type = el.dataset.t; renderCatat(); },
        chk: el => { const n = byId(D().notes, el.dataset.id); if (n) { n.done = el.checked; n.updated = new Date().toISOString(); save(); rerender(); } },
        edit: el => { const n = byId(D().notes, el.dataset.id); if (n) noteModal(n); },
        copy: el => { const n = byId(D().notes, el.dataset.id); if (n) Mx.copy(entryText(n)); },
        dup: el => { const n = byId(D().notes, el.dataset.id); if (!n) return; const now = new Date().toISOString(); D().notes.push({ ...Mx.clone(n), id: uid(), done: false, time: Mx.nowHM(), created: now, updated: now }); save(); rerender(); Mx.toast('Catatan ditambahkan lagi — silakan diedit'); },
        del: async el => { const n = byId(D().notes, el.dataset.id); if (!n || !(await Mx.confirm(`Hapus catatan "${n.title || n.body.slice(0, 40)}"?`))) return; D().notes = D().notes.filter(x => x.id !== n.id); save(); rerender(); Mx.toast('Catatan dihapus'); },
        copygroup: el => { const [cid, date] = el.dataset.k.split('|'); Mx.copy(`${course(cid).name} — ${Mx.fmtDateLong(date)}\n` + D().notes.filter(n => n.courseId === cid && n.date === date).map(entryText).join('\n')); },
        sumtype: el => { const k = el.dataset.t; ui.sumTypes.has(k) ? ui.sumTypes.delete(k) : ui.sumTypes.add(k); renderRangkuman(); },
        sumkey: () => { ui.sumTypes = new Set(['imp', 'def', 'todo']); renderRangkuman(); },
        sumcopy: () => Mx.copy(buildSummary(ui.sumScope, ui.sumTypes).txt), sumcreate: () => summaryModal(null, ui.sumScope, buildSummary(ui.sumScope, ui.sumTypes).txt),
        'sum-edit': el => { const s = byId(D().summaries, el.dataset.id); if (s) summaryModal(s, s.courseId); }, 'sum-copy': el => { const s = byId(D().summaries, el.dataset.id); if (s) Mx.copy(s.text); },
        'sum-del': async el => { const s = byId(D().summaries, el.dataset.id); if (!s || !(await Mx.confirm(`Hapus rangkuman "${s.title}"?`))) return; D().summaries = D().summaries.filter(x => x.id !== s.id); save(); rerender(); Mx.toast('Rangkuman dihapus'); },
        'export-txt': () => { const d = D(); if (!d.notes.length) return Mx.toast('Belum ada catatan untuk diekspor', 'info'); Mx.download(`Catatan_Kuliah_${today()}.txt`, buildSummary('all', new Set(Object.keys(TYPES))).txt.replace('# Rangkuman Semua Mata Kuliah', '# Catatan Kuliah'), 'text/plain'); }
    };

    AppModules.register(KEY, {
        label: 'Catatan Kuliah', views: Object.keys(RENDER), normalize, validate,
        init() {
            Object.keys(RENDER).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { const id = e.target.id;
                        if (id === 'ckArcQ') { ui.archive.q = e.target.value; renderArsip(); } },
                    change: e => { const id = e.target.id;
                        if (id === 'ckCourse') { ui.courseId = e.target.value; renderCatat(); } if (id === 'ckDate') { ui.date = e.target.value || today(); renderCatat(); }
                        if (id === 'ckArcCourse') { ui.archive.course = e.target.value; renderArsip(); } if (id === 'ckArcTag') { ui.archive.tag = e.target.value; renderArsip(); }
                        if (id === 'ckArcFrom') { ui.archive.from = e.target.value; renderArsip(); } if (id === 'ckArcTo') { ui.archive.to = e.target.value; renderArsip(); }
                        if (id === 'ckSumScope') { ui.sumScope = e.target.value; renderRangkuman(); } },
                    keydown: e => { if (e.target.id === 'ckBody' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } if (e.target.id === 'ckTitle' && e.key === 'Enter') { e.preventDefault(); addNote(); } }
                });
            });
        },
        afterLoad() { migrateCourses(); },
        migrateCourses,
        show(v) { migrateCourses(); current = v; if (v === 'ck-arsip') { const r = root(v); if (r) r.innerHTML = ''; } rerender(); },
        refresh() { const r = root(current); if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) rerender(); },
        isBusy: () => !!document.querySelector('.mx-overlay')
    });
})();
