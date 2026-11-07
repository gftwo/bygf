/* ==========================================================================
   MODUL JURNAL HARIAN — rating hari ini, hal baik, masalah, pelajaran, rencana besok
   Data: AppModules 'journal' = { entries: [{ id, date, rating, good, problem, lesson, tomorrow, note, created, updated }] }
   Satu entri per tanggal. Catatan bebas lama tetap ada di modul Notes.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'journal';
    const RATINGS = { 1: ['😞', 'Berat'], 2: ['😕', 'Kurang'], 3: ['😐', 'Biasa'], 4: ['🙂', 'Baik'], 5: ['😄', 'Hebat'] };
    const FIELDS = [
        ['good', '🌱 Hal baik / yang disyukuri', 'Apa yang bikin harimu terasa baik?'],
        ['problem', '⛈️ Masalah atau hambatan', 'Apa yang mengganggu atau belum beres hari ini?'],
        ['lesson', '💡 Pelajaran', 'Apa yang kamu pelajari hari ini?'],
        ['tomorrow', '🎯 Rencana besok', 'Apa yang mau kamu lakukan besok?'],
        ['note', '📝 Catatan bebas', 'Cerita apa saja tentang hari ini…']
    ];
    const MAXLEN = 5000;
    const { esc, uid, today } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const ui = { date: today(), rating: 0, q: '', month: '', loadedFor: '' };
    // Draf ketikan disimpan otomatis di perangkat ini supaya tidak hilang bila app ditutup sebelum menekan Simpan.
    const DRAFT = 'bygf.journalDraft';
    const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { return null; } };
    const writeDraft = d => { try { d ? localStorage.setItem(DRAFT, JSON.stringify(d)) : localStorage.removeItem(DRAFT); } catch (e) { /* abaikan */ } };
    const draftFor = date => { const d = readDraft(); return d && d.date === date ? d : null; };
    const dirty = (cur, v, rating) => rating !== cur.rating || FIELDS.some(f => (v[f[0]] || '').trim() !== (cur[f[0]] || ''));

    // ----- data -----
    function normalize(raw) {
        raw = raw || {}; const byDate = new Map();
        arr(raw.entries).filter(e => e && isDate(e.date)).forEach(e => {
            const r = Number(e.rating), item = {
                id: String(e.id || uid()), date: e.date, rating: r >= 1 && r <= 5 ? Math.round(r) : 0,
                good: String(e.good || '').slice(0, MAXLEN), problem: String(e.problem || '').slice(0, MAXLEN), lesson: String(e.lesson || '').slice(0, MAXLEN),
                tomorrow: String(e.tomorrow || '').slice(0, MAXLEN), note: String(e.note || '').slice(0, MAXLEN),
                created: e.created || new Date().toISOString(), updated: e.updated || e.created || new Date().toISOString()
            };
            const old = byDate.get(item.date); if (!old || String(item.updated) >= String(old.updated)) byDate.set(item.date, item); // satu entri per tanggal
        });
        return { entries: [...byDate.values()] };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; if (raw.entries != null && typeof raw.entries !== 'object') e.push('"entries" tidak valid');
        arr(raw.entries).forEach((x, i) => { if (!x || typeof x !== 'object' || !isDate(x.date)) e.push(`jurnal #${i + 1} tidak punya tanggal valid`); });
        return e.slice(0, 5);
    }
    const entryOf = date => D().entries.find(e => e.date === date);
    const hasContent = e => e && (e.rating || FIELDS.some(f => e[f[0]]));
    const sorted = () => [...D().entries].filter(hasContent).sort((a, b) => b.date.localeCompare(a.date));
    const avg = list => list.length ? (list.reduce((s, e) => s + e.rating, 0) / list.length) : 0;
    function streak() { // hari berurutan sampai hari ini (atau kemarin) yang sudah diisi
        const have = new Set(D().entries.filter(hasContent).map(e => e.date)); let d = today(), n = 0;
        if (!have.has(d)) d = Mx.addDays(d, -1);
        while (have.has(d)) { n++; d = Mx.addDays(d, -1); }
        return n;
    }
    const go = v => App.UI.switchTab(v, document.getElementById('subtab-' + v));

    // ----- tampilan: hari ini / isi jurnal -----
    function readForm(el) { const v = {}; FIELDS.forEach(f => { const t = el.querySelector('#jr_' + f[0]); v[f[0]] = t ? t.value : ''; }); return v; }
    function renderToday() {
        const el = root('jr-today'); if (!el) return;
        const cur = entryOf(ui.date) || { rating: 0, good: '', problem: '', lesson: '', tomorrow: '', note: '' };
        const saved = readDraft(), stored = draftFor(ui.date);
        if (ui.loadedFor !== ui.date) { ui.rating = stored ? stored.rating : cur.rating; ui.loadedFor = ui.date; }
        let draft = el.querySelector('#jr_good') && el.dataset.date === ui.date ? readForm(el) : null; // pertahankan ketikan saat render ulang
        if (!draft && stored) draft = stored.fields; // pulihkan draf dari penyimpanan perangkat
        void saved;
        const val = k => esc(draft ? draft[k] : cur[k]);
        const week = D().entries.filter(e => e.rating && e.date >= Mx.addDays(today(), -6)), a = avg(week);
        const isToday = ui.date === today();
        el.dataset.date = ui.date;
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📔 Jurnal Harian</h2></div></div>
        <div class="mx-stats"><div class="mx-stat"><span>Rata-rata 7 hari</span><b>${a ? a.toFixed(1) : '—'}</b><small>${a ? RATINGS[Math.round(a)][0] + ' ' + RATINGS[Math.round(a)][1] : 'belum ada rating'}</small></div>
        <div class="mx-stat"><span>Beruntun</span><b>${streak()}</b><small>hari terisi</small></div><div class="mx-stat"><span>Total jurnal</span><b>${sorted().length}</b><small>hari</small></div></div>
        <div class="mx-card"><div class="mx-tools jr-date"><button type="button" class="mx-btn" data-act="prev" aria-label="Hari sebelumnya">‹</button><input type="date" id="jrDate" class="mx-input" value="${ui.date}" max="${today()}" aria-label="Tanggal jurnal"><button type="button" class="mx-btn" data-act="next" aria-label="Hari berikutnya" ${isToday ? 'disabled' : ''}>›</button><button type="button" class="mx-btn" data-act="today" ${isToday ? 'disabled' : ''}>Hari ini</button></div>
        <div class="mx-label">${Mx.fmtDateLong(ui.date)} <span class="jr-draft" id="jrDraft" ${stored && dirty(cur, stored.fields, stored.rating) ? '' : 'hidden'}>• draf belum disimpan</span></div>
        <div class="mx-label">Bagaimana harimu?</div><div class="jr-rating" role="radiogroup" aria-label="Rating hari ini">${Object.entries(RATINGS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${ui.rating === +k}" class="jr-rate${ui.rating === +k ? ' on' : ''}" data-act="rate" data-r="${k}"><span class="jr-emoji">${v[0]}</span><small>${k} · ${v[1]}</small></button>`).join('')}</div>
        ${FIELDS.map(f => `<div class="mx-field"><label for="jr_${f[0]}">${f[1]}</label><textarea id="jr_${f[0]}" class="mx-input" rows="${f[0] === 'note' ? 4 : 3}" maxlength="${MAXLEN}" placeholder="${f[2]}">${val(f[0])}</textarea></div>`).join('')}
        <small class="mx-err" id="jrErr" hidden></small>
        <div class="mx-foot">${entryOf(ui.date) ? `<button type="button" class="mx-btn mx-btn-danger" data-act="del-day">Hapus jurnal hari ini</button>` : ''}<button type="button" class="mx-btn mx-btn-primary" data-act="save">Simpan jurnal</button></div></div>`;
    }
    function saveDay() {
        const el = root('jr-today'), err = el.querySelector('#jrErr'), v = readForm(el);
        if (!ui.rating && !FIELDS.some(f => v[f[0]].trim())) { err.textContent = 'Pilih rating atau isi minimal satu kolom.'; err.hidden = false; return; }
        const now = new Date().toISOString(); let e = entryOf(ui.date);
        if (!e) { e = { id: uid(), date: ui.date, created: now }; D().entries.push(e); }
        Object.assign(e, { rating: ui.rating }, Object.fromEntries(FIELDS.map(f => [f[0], v[f[0]].trim().slice(0, MAXLEN)])), { updated: now });
        save(); writeDraft(null); delete el.dataset.date; renderToday(); Mx.toast('Jurnal tersimpan');
    }

    // ----- tampilan: riwayat -----
    function moodStrip() { // 14 hari terakhir: tinggi batang = rating
        const days = Array.from({ length: 14 }, (_, i) => Mx.addDays(today(), i - 13));
        return `<div class="jr-strip" role="img" aria-label="Rating 14 hari terakhir">${days.map(d => { const e = entryOf(d), r = e ? e.rating : 0;
            return `<button type="button" class="jr-bar-wrap" data-act="open" data-date="${d}" title="${esc(Mx.fmtDate(d))}${r ? ' — ' + RATINGS[r][1] : ''}" aria-label="${esc(Mx.fmtDate(d))}${r ? ', rating ' + r : ', belum diisi'}"><span class="jr-bar r${r}" style="height:${r ? r * 18 : 6}px"></span><small>${+d.slice(8)}</small></button>`; }).join('')}</div>`;
    }
    function snippet(e) { const f = FIELDS.find(x => e[x[0]]); return f ? `<div class="jr-snip"><b>${f[1].replace(/^\S+\s/, '')}:</b> ${esc(e[f[0]].slice(0, 140))}</div>` : ''; }
    function renderHistory() {
        const el = root('jr-history'); if (!el) return; const all = sorted(), q = ui.q.trim().toLowerCase();
        const months = [...new Set(all.map(e => e.date.slice(0, 7)))];
        if (ui.month && !months.includes(ui.month)) ui.month = '';
        const list = all.filter(e => (!ui.month || e.date.startsWith(ui.month)) && (!q || FIELDS.map(f => e[f[0]]).join(' ').toLowerCase().includes(q)));
        const shell = el.querySelector('#jrList');
        const body = list.length ? list.map(e => `<div class="jr-item" data-act="open" data-date="${e.date}" tabindex="0" role="button"><span class="jr-emoji lg">${e.rating ? RATINGS[e.rating][0] : '📝'}</span><div class="ck-main"><b>${esc(Mx.fmtDateLong(e.date))}</b>${snippet(e)}${e.problem && !(FIELDS.find(x => e[x[0]])[0] === 'problem') ? `<div class="jr-snip mx-muted">⛈️ ${esc(e.problem.slice(0, 100))}</div>` : ''}</div><span class="mx-muted mx-xs">${e.rating ? e.rating + '/5' : ''}</span></div>`).join('') : Mx.empty('📔', all.length ? 'Tidak ada jurnal yang cocok' : 'Belum ada jurnal', 'Isi jurnal pertamamu di tab Hari Ini.');
        if (shell) { shell.innerHTML = body; return; }
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">📖 Riwayat Jurnal</h2></div><button type="button" class="mx-btn" data-act="export">📤 Ekspor TXT</button></div>
        <div class="mx-card"><h3 class="mx-h3">Suasana 14 hari terakhir</h3>${moodStrip()}</div>
        <div class="mx-card"><div class="mx-tools"><input id="jrQ" class="mx-input" type="search" placeholder="🔍 Cari isi jurnal…" value="${esc(ui.q)}" aria-label="Cari jurnal"><select id="jrMonth" class="mx-input" aria-label="Filter bulan"><option value="">Semua bulan</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${esc(Mx.fmtDate(m + '-01', { month: 'long', year: 'numeric' }))}</option>`).join('')}</select></div><div id="jrList">${body}</div></div>`;
    }
    function exportText() {
        const all = sorted().reverse(); if (!all.length) return Mx.toast('Belum ada jurnal untuk diekspor', 'info');
        const txt = '# Jurnal Harian\n' + all.map(e => `\n## ${Mx.fmtDateLong(e.date)}${e.rating ? ` — ${RATINGS[e.rating][0]} ${e.rating}/5 (${RATINGS[e.rating][1]})` : ''}\n` + FIELDS.filter(f => e[f[0]]).map(f => `- ${f[1].replace(/^\S+\s/, '')}: ${e[f[0]].replace(/\n/g, '\n  ')}`).join('\n')).join('\n');
        Mx.download(`Jurnal_${today()}.txt`, txt, 'text/plain');
    }

    // ----- aksi -----
    function stashDraft() { // simpan draf bila berbeda dari data tersimpan
        const el = root('jr-today'); if (!el || !el.querySelector('#jr_good')) return;
        const v = readForm(el), cur = entryOf(ui.date) || { rating: 0 }, flag = el.querySelector('#jrDraft');
        if (dirty(cur, v, ui.rating)) { writeDraft({ date: ui.date, rating: ui.rating, fields: v }); if (flag) flag.hidden = false; } else { if (draftFor(ui.date)) writeDraft(null); if (flag) flag.hidden = true; }
    }
    const stashSoon = Mx.debounce(stashDraft, 400);
    const setDate = d => { if (!isDate(d)) return; ui.date = d > today() ? today() : d; renderToday(); };
    const acts = {
        rate: el => { const r = +el.dataset.r; ui.rating = ui.rating === r ? 0 : r; const root_ = root('jr-today'); root_.querySelectorAll('.jr-rate').forEach(b => { const on = +b.dataset.r === ui.rating; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); stashDraft(); },
        save: saveDay, prev: () => { stashDraft(); const el = root('jr-today'); delete el.dataset.date; setDate(Mx.addDays(ui.date, -1)); }, next: () => { stashDraft(); const el = root('jr-today'); delete el.dataset.date; setDate(Mx.addDays(ui.date, 1)); },
        today: () => { stashDraft(); const el = root('jr-today'); delete el.dataset.date; setDate(today()); },
        'del-day': async () => { const e = entryOf(ui.date); if (!e || !(await Mx.confirm(`Hapus jurnal ${Mx.fmtDate(ui.date)}?`))) return; D().entries = D().entries.filter(x => x.id !== e.id); writeDraft(null); ui.rating = 0; ui.loadedFor = ''; save(); const el = root('jr-today'); delete el.dataset.date; renderToday(); Mx.toast('Jurnal dihapus'); },
        open: el => { if (!isDate(el.dataset.date)) return; ui.date = el.dataset.date; const t = root('jr-today'); if (t) delete t.dataset.date; go('jr-today'); },
        export: exportText
    };
    let current = 'jr-today';
    const RENDER = { 'jr-today': renderToday, 'jr-history': renderHistory };
    AppModules.register(KEY, {
        label: 'Jurnal Harian', views: Object.keys(RENDER), normalize, validate,
        init() {
            Object.keys(RENDER).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id && e.target.id.startsWith('jr_')) stashSoon(); if (e.target.id === 'jrQ') { ui.q = e.target.value; renderHistory(); } },
                    change: e => { if (e.target.id === 'jrDate') { const el = root('jr-today'); delete el.dataset.date; setDate(e.target.value || today()); } if (e.target.id === 'jrMonth') { ui.month = e.target.value; renderHistory(); } },
                    keydown: e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('jr-item')) { e.preventDefault(); acts.open(e.target); } }
                });
            });
        },
        openDate(date) { if (!isDate(date)) return; ui.date = date; const t = root('jr-today'); if (t) delete t.dataset.date; go('jr-today'); },
        show(v) { current = v; if (v === 'jr-history') { const r = root(v); if (r) r.innerHTML = ''; } (RENDER[v] || renderToday)(); },
        refresh() { const r = root(current); if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { if (current === 'jr-history') { const rr = root(current); rr.innerHTML = ''; } RENDER[current](); } },
        isBusy: () => !!document.querySelector('.mx-overlay')
    });
})();
