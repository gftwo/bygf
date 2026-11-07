/* ==========================================================================
   MODUL NOTES — catatan umum (ide, rencana, referensi, dsb.)
   Data: AppModules 'notes' = { notes, categories, activity }
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'notes', VIEWMODE_KEY = 'notes.viewmode';
    const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const { esc, uid, byId } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } } };
    const ui = { filter: 'all', cat: '', q: '', sort: 'upd', mode: store.get(VIEWMODE_KEY) === 'list' ? 'list' : 'grid', editing: null };
    let editor = null; // { note, isNew, dirty, status }

    const plainOf = html => { const d = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html'); d.body.querySelectorAll('br,div,p,li,h1,h2,h3').forEach(e => e.insertAdjacentText('afterend', ' ')); return d.body.textContent.replace(/\s+/g, ' ').trim(); };
    function normalize(raw) {
        raw = raw || {};
        const categories = arr(raw.categories).filter(c => c && c.name).map((c, i) => ({ id: String(c.id || uid()), name: String(c.name).slice(0, 40), color: c.color || COLORS[i % COLORS.length] }));
        const cids = new Set(categories.map(c => c.id));
        const notes = arr(raw.notes).filter(n => n && typeof n === 'object').map(n => {
            const html = String(n.html ?? '');
            return { id: String(n.id || uid()), title: String(n.title || '').slice(0, 150), html, text: typeof n.text === 'string' ? n.text : plainOf(html), category: cids.has(String(n.category)) ? String(n.category) : '', tags: arr(n.tags).map(String).slice(0, 15),
                favorite: !!n.favorite, pinned: !!n.pinned, archived: !!n.archived, trashed: !!n.trashed, trashedAt: n.trashedAt || '', created: n.created || new Date().toISOString(), updated: n.updated || n.created || new Date().toISOString(),
                history: arr(n.history).filter(h => h && h.at).map(h => ({ at: h.at, title: String(h.title || ''), html: String(h.html || '') })).slice(0, 10) };
        });
        const activity = arr(raw.activity).filter(a => a && a.at && a.text).map(a => ({ at: a.at, text: String(a.text).slice(0, 140) })).slice(0, 20);
        return { notes, categories, activity };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; ['notes', 'categories', 'activity'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        arr(raw.notes).forEach((n, i) => { if (!n || typeof n !== 'object' || (n.title == null && n.html == null)) e.push(`catatan #${i + 1} tidak valid`); });
        return e.slice(0, 5);
    }
    const log = text => { D().activity.unshift({ at: new Date().toISOString(), text }); D().activity = D().activity.slice(0, 20); };
    const cat = id => byId(D().categories, id);
    const label = n => n.title || (n.text ? n.text.slice(0, 40) : 'Tanpa judul');
    const live = () => D().notes.filter(n => !n.trashed);
    const go = v => App.UI.switchTab(v, document.getElementById('subtab-' + v));

    // ----- daftar -----
    function filteredList() {
        const q = ui.q.trim().toLowerCase(); let list = D().notes.filter(n => ui.filter === 'trash' ? n.trashed : ui.filter === 'archive' ? (n.archived && !n.trashed) : (!n.trashed && !n.archived));
        if (ui.filter === 'fav') list = list.filter(n => n.favorite); if (ui.filter === 'pinned') list = list.filter(n => n.pinned);
        if (ui.cat === '_none') list = list.filter(n => !n.category); else if (ui.cat) list = list.filter(n => n.category === ui.cat);
        if (q) list = list.filter(n => `${n.title} ${n.text} ${n.tags.join(' ')} ${(cat(n.category) || {}).name || ''}`.toLowerCase().includes(q));
        let sort = ui.sort; if (ui.filter === 'recent') sort = 'upd'; if (ui.filter === 'old') sort = 'old';
        const S = { upd: (a, b) => b.updated.localeCompare(a.updated), old: (a, b) => a.updated.localeCompare(b.updated), az: (a, b) => label(a).localeCompare(label(b), 'id'), za: (a, b) => label(b).localeCompare(label(a), 'id') };
        list.sort(S[sort] || S.upd); if (ui.filter === 'all') list.sort((a, b) => (b.pinned - a.pinned)); return list;
    }
    function noteCard(n) {
        const c = cat(n.category), trash = n.trashed;
        return `<article class="nt-card" data-id="${esc(n.id)}"><div class="nt-open" data-act="open" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="Buka ${esc(label(n))}">
            <div class="mx-row"><b class="nt-title">${n.pinned ? '📌 ' : ''}${esc(label(n))}</b>${n.favorite ? '<span title="Favorit">⭐</span>' : ''}</div>
            <p class="nt-snip">${esc(n.text.slice(0, 160)) || '<i class="mx-muted">Kosong</i>'}</p>
            <div class="mx-row mx-gap-s">${c ? `<span class="mx-pill" style="background:${esc(c.color)}22;color:${esc(c.color)}">${esc(c.name)}</span>` : ''}${n.tags.slice(0, 4).map(t => `<span class="mx-tag">#${esc(t)}</span>`).join('')}</div><div class="mx-muted mx-xs">Diperbarui ${Mx.fmtDateTime(n.updated)}</div></div>
            <div class="nt-cact">${trash ? `<button type="button" class="mx-btn mx-btn-sm" data-act="restore" data-id="${esc(n.id)}">↩ Pulihkan</button><button type="button" class="mx-btn mx-btn-sm mx-btn-danger" data-act="purge" data-id="${esc(n.id)}">Hapus permanen</button>` :
            `<button type="button" class="mx-icon" data-act="pin" data-id="${esc(n.id)}" title="${n.pinned ? 'Lepas sematan' : 'Sematkan'}" aria-label="Sematkan">📌</button><button type="button" class="mx-icon" data-act="fav" data-id="${esc(n.id)}" title="Favorit" aria-label="Favorit">${n.favorite ? '⭐' : '☆'}</button><button type="button" class="mx-icon" data-act="archive" data-id="${esc(n.id)}" title="${n.archived ? 'Keluarkan dari arsip' : 'Arsipkan'}" aria-label="Arsip">🗄</button><button type="button" class="mx-icon" data-act="trash" data-id="${esc(n.id)}" title="Pindahkan ke sampah" aria-label="Sampah">🗑</button>`}</div></article>`;
    }
    function listBody() {
        const list = filteredList();
        return `<p class="mx-muted mx-xs">${list.length} catatan${ui.filter === 'trash' && list.length ? ' · <button type="button" class="mx-btn mx-btn-sm mx-btn-danger" data-act="empty">Kosongkan sampah</button>' : ''}</p>` + (list.length ? `<div class="nt-${ui.mode}">${list.map(noteCard).join('')}</div>` : Mx.empty(ui.filter === 'trash' ? '🗑' : '🗒️', ui.q ? 'Tidak ada hasil' : ui.filter === 'trash' ? 'Sampah kosong' : 'Belum ada catatan', ui.q ? '' : 'Klik "＋ Catatan baru" atau Ctrl+Alt+N.'));
    }
    function renderList() {
        const el = root('nt-list'); if (!el) return; if (ui.editing) return renderEditor();
        const holder = el.querySelector('#ntListBody'); if (holder) { holder.innerHTML = listBody(); return; }
        const F = [['all', 'Semua'], ['recent', 'Terbaru'], ['old', 'Terlama'], ['fav', '⭐ Favorit'], ['pinned', '📌 Disematkan'], ['archive', '🗄 Arsip'], ['trash', '🗑 Sampah']];
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🗒️ Semua Catatan</h2></div><div class="mx-row"><button type="button" class="mx-btn" data-act="cats">🏷 Kategori</button><button type="button" class="mx-btn mx-btn-primary" data-act="new">＋ Catatan baru</button></div></div>
        <div class="mx-card"><input id="ntQ" class="mx-input" type="search" placeholder="🔍 Cari judul, isi, tag, kategori…" value="${esc(ui.q)}" aria-label="Cari catatan">
        <div class="mx-chips">${F.map(([k, l]) => `<button type="button" class="mx-chip${ui.filter === k ? ' on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
        <div class="mx-tools"><select id="ntCat" class="mx-input" aria-label="Filter kategori"><option value="">Semua kategori</option><option value="_none" ${ui.cat === '_none' ? 'selected' : ''}>Tanpa kategori</option>${D().categories.map(c => `<option value="${esc(c.id)}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id="ntSort" class="mx-input" aria-label="Urutkan">${[['upd', 'Terbaru diperbarui'], ['old', 'Terlama diperbarui'], ['az', 'A–Z'], ['za', 'Z–A']].map(([k, l]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="mx-chips"><button type="button" class="mx-chip${ui.mode === 'grid' ? ' on' : ''}" data-act="mode" data-m="grid" aria-label="Tampilan grid">▦ Grid</button><button type="button" class="mx-chip${ui.mode === 'list' ? ' on' : ''}" data-act="mode" data-m="list" aria-label="Tampilan list">☰ List</button></span></div></div><div id="ntListBody">${listBody()}</div>`;
    }
    function renderDashboard() {
        const el = root('nt-dashboard'); if (!el) return; const L = live().filter(n => !n.archived), sortU = (a, b) => b.updated.localeCompare(a.updated);
        const sect = (t, list, empty) => `<div class="mx-card"><h3 class="mx-h3">${t}</h3>${list.length ? list.map(n => `<button type="button" class="nt-row" data-act="open" data-id="${esc(n.id)}"><b>${esc(label(n))}</b><span class="mx-muted mx-xs">${Mx.fmtDateTime(n.updated)}</span></button>`).join('') : `<span class="mx-muted mx-xs">${empty}</span>`}</div>`;
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🗒️ Notes</h2><p class="mx-muted">Ide, rencana, referensi, dan hal-hal yang ingin kamu ingat.</p></div><button type="button" class="mx-btn mx-btn-primary" data-act="new">＋ Catatan baru</button></div>
        <div class="mx-stats"><div class="mx-stat"><span>Total catatan</span><b>${L.length}</b><small>${live().filter(n => n.archived).length} diarsipkan</small></div><div class="mx-stat"><span>Favorit</span><b>${L.filter(n => n.favorite).length}</b><small>ditandai ⭐</small></div><div class="mx-stat"><span>Disematkan</span><b>${L.filter(n => n.pinned).length}</b><small>📌 di atas daftar</small></div></div>
        <div class="mx-grid2">${sect('📌 Disematkan', L.filter(n => n.pinned).sort(sortU).slice(0, 5), 'Belum ada catatan yang disematkan.')}${sect('🕒 Terbaru', [...L].sort(sortU).slice(0, 5), 'Belum ada catatan.')}${sect('⭐ Favorit', L.filter(n => n.favorite).sort(sortU).slice(0, 5), 'Belum ada favorit.')}
        <div class="mx-card"><h3 class="mx-h3">🏷 Kategori</h3>${D().categories.length ? `<div class="mx-chips">${D().categories.map(c => `<button type="button" class="mx-chip" data-act="gocat" data-id="${esc(c.id)}"><i class="mx-dot" style="background:${esc(c.color)}"></i> ${esc(c.name)} <span class="mx-count">${L.filter(n => n.category === c.id).length}</span></button>`).join('')}</div>` : '<span class="mx-muted mx-xs">Belum ada kategori.</span>'}<div class="mx-foot" style="justify-content:flex-start"><button type="button" class="mx-btn mx-btn-sm" data-act="cats">Kelola kategori</button></div></div></div>
        <div class="mx-card"><h3 class="mx-h3">⏱ Aktivitas terakhir</h3>${D().activity.length ? D().activity.slice(0, 8).map(a => `<div class="mx-row"><span>${esc(a.text)}</span><span class="mx-muted mx-xs" style="margin-left:auto">${Mx.fmtDateTime(a.at)}</span></div>`).join('') : '<span class="mx-muted mx-xs">Belum ada aktivitas.</span>'}</div>`;
    }

    // ----- konversi ke TXT / Markdown -----
    function convert(html, md) {
        const doc = new DOMParser().parseFromString('<body>' + Mx.sanitizeHtml(html) + '</body>', 'text/html'); let out = '';
        const inl = n => { if (n.nodeType === 3) return n.textContent; if (n.nodeType !== 1) return ''; const t = n.tagName, c = Array.from(n.childNodes).map(inl).join('');
            if (t === 'B' || t === 'STRONG') return md ? `**${c}**` : c; if (t === 'I' || t === 'EM') return md ? `*${c}*` : c; if (t === 'A') { const h = n.getAttribute('href'); return md && h ? `[${c}](${h})` : (h ? `${c} (${h})` : c); }
            if (t === 'IMG') return md ? '![gambar]()' : '[gambar]'; if (t === 'BR') return '\n'; if (t === 'INPUT') return n.hasAttribute('checked') ? '[x] ' : '[ ] '; return c; };
        const blk = (n, ctx) => { if (n.nodeType === 3) { if (n.textContent.trim()) out += n.textContent + '\n'; return; } if (n.nodeType !== 1) return; const t = n.tagName;
            if (/^H[1-3]$/.test(t)) out += (md ? '#'.repeat(+t[1]) + ' ' : '') + inl(n).trim() + '\n\n';
            else if (t === 'UL' || t === 'OL') { Array.from(n.children).forEach((li, i) => { out += (t === 'OL' ? `${i + 1}. ` : '- ') + inl(li).trim() + '\n'; }); out += '\n'; }
            else if (t === 'HR') out += (md ? '---' : '--------') + '\n\n';
            else if (n.classList && n.classList.contains('nt-todo')) out += '- ' + inl(n).trim().replace(/^\[/, '[') + '\n';
            else if (['DIV', 'P', 'BLOCKQUOTE', 'PRE'].includes(t) && Array.from(n.children).some(c => /^(DIV|P|UL|OL|H[1-3]|HR)$/.test(c.tagName))) Array.from(n.childNodes).forEach(c => blk(c, ctx));
            else out += inl(n).trim() + '\n' + (t === 'DIV' ? '' : '\n'); };
        Array.from(doc.body.childNodes).forEach(c => blk(c, 0)); return out.replace(/\n{3,}/g, '\n\n').trim();
    }
    const exportText = (n, md) => { const tags = n.tags.length ? '\nTag: ' + n.tags.map(t => '#' + t).join(' ') : ''; const c = cat(n.category); return (md ? `# ${label(n)}\n` : `${label(n)}\n${'='.repeat(Math.min(40, label(n).length))}\n`) + `${c ? 'Kategori: ' + c.name : ''}${tags}\nDiperbarui: ${Mx.fmtDateTime(n.updated)}\n\n` + convert(n.html, md) + '\n'; };
    const safeName = n => label(n).replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'catatan';

    // ----- editor -----
    function openEditor(note, isNew) {
        editor = { note, isNew, dirty: false, lastSnap: note.history.length ? new Date(note.history[0].at).getTime() : 0, snapHtml: note.history.length ? note.history[0].html : '' }; ui.editing = note.id; renderEditor();
        App.UI.switchTab('nt-list', document.getElementById('subtab-nt-list'));
    }
    function renderEditor() {
        const el = root('nt-list'), n = editor.note; if (!el) return;
        el.innerHTML = `<div class="nt-editor"><div class="nt-etop"><button type="button" class="mx-btn" data-act="back">← Kembali</button><span class="mx-muted mx-xs" id="ntStatus" role="status">${editor.isNew ? 'Catatan baru' : 'Diperbarui ' + Mx.fmtDateTime(n.updated)}</span>
        <span class="mx-row" style="margin-left:auto"><button type="button" class="mx-icon" id="ntFav" data-act="efav" title="Favorit" aria-label="Favorit">${n.favorite ? '⭐' : '☆'}</button><button type="button" class="mx-icon" id="ntPin" data-act="epin" title="Sematkan" aria-label="Sematkan" style="${n.pinned ? '' : 'opacity:.45'}">📌</button><button type="button" class="mx-btn mx-btn-sm" data-act="emenu" aria-haspopup="true">⋯ Lainnya</button></span></div>
        <input id="ntTitle" class="nt-etitle" maxlength="150" placeholder="Judul catatan" value="${esc(n.title)}" aria-label="Judul catatan">
        <div class="mx-tools"><select id="ntECat" class="mx-input" aria-label="Kategori"><option value="">Tanpa kategori</option>${D().categories.map(c => `<option value="${esc(c.id)}" ${n.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><input id="ntETags" class="mx-input" placeholder="Tag, pisahkan dengan koma" value="${esc(n.tags.join(', '))}" aria-label="Tag"></div>
        <div class="nt-toolbar" role="toolbar" aria-label="Format teks">${[['bold', '<b>B</b>', 'Tebal (Ctrl+B)'], ['italic', '<i>I</i>', 'Miring (Ctrl+I)'], ['underline', '<u>U</u>', 'Garis bawah (Ctrl+U)'], ['h2', 'H', 'Heading'], ['ul', '• Daftar', 'Bullet list'], ['ol', '1. Daftar', 'Numbered list'], ['todo', '☑ Checklist', 'Checklist'], ['link', '🔗', 'Link (Ctrl+K)'], ['hr', '―', 'Pemisah'], ['img', '🖼', 'Lampirkan gambar']].map(([c, l, t]) => `<button type="button" class="nt-tb" data-cmd="${c}" title="${t}" aria-label="${t}">${l}</button>`).join('')}<input type="file" id="ntImgFile" accept="image/*" hidden></div>
        <div id="ntBody" class="nt-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Isi catatan" data-ph="Mulai menulis…"></div></div>`;
        el.querySelector('#ntBody').innerHTML = Mx.sanitizeHtml(n.html); setTimeout(() => (editor.isNew ? el.querySelector('#ntTitle') : el.querySelector('#ntBody')).focus(), 30);
    }
    function setStatus(t) { const s = document.getElementById('ntStatus'); if (s) s.textContent = t; }
    function commit(now) {
        if (!editor) return; const el = root('nt-list'), body = el && el.querySelector('#ntBody'); if (!body) return; const n = editor.note;
        const html = Mx.sanitizeHtml(body.innerHTML), title = el.querySelector('#ntTitle').value.trim(), tags = [...new Set(el.querySelector('#ntETags').value.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 15), category = el.querySelector('#ntECat').value;
        const changed = html !== n.html || title !== n.title || category !== n.category || tags.join() !== n.tags.join(); if (!changed && !now) return;
        const ts = Date.now(), noImg = h => h.replace(/<img[^>]*>/gi, '[gambar]');
        if (changed && (n.html || n.title) && ts - editor.lastSnap > 5 * 60 * 1000 && noImg(n.html) !== editor.snapHtml) { n.history.unshift({ at: new Date().toISOString(), title: n.title, html: noImg(n.html) }); n.history = n.history.slice(0, 10); editor.lastSnap = ts; editor.snapHtml = noImg(n.html); }
        Object.assign(n, { html, title, tags, category, text: plainOf(html) }); if (changed) n.updated = new Date().toISOString();
        if (editor.isNew && (n.title || n.text || /<img/i.test(n.html))) { D().notes.unshift(n); editor.isNew = false; log(`Membuat catatan "${label(n)}"`); }
        else if (!editor.isNew && changed && !editor.logged) { editor.logged = true; log(`Mengedit catatan "${label(n)}"`); }
        if (!editor.isNew) { save(); setStatus('Tersimpan • ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })); } editor.dirty = false;
    }
    const autosave = Mx.debounce(() => commit(false), 700);
    function closeEditor() {
        if (editor) { autosave.cancel(); commit(false); /* catatan baru yang kosong tidak pernah masuk ke daftar */ }
        editor = null; ui.editing = null; const el = root('nt-list'); if (el) el.innerHTML = ''; renderList();
    }
    function newNote() {
        const now = new Date().toISOString(), cid = ui.cat && ui.cat !== '_none' ? ui.cat : '';
        openEditor({ id: uid(), title: '', html: '', text: '', category: cid, tags: [], favorite: false, pinned: false, archived: false, trashed: false, trashedAt: '', created: now, updated: now, history: [] }, true);
    }
    function exec(cmd, val) { document.execCommand(cmd, false, val); autosave(); }
    function savedRange() { const s = window.getSelection(); return s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
    function restoreRange(r) { const body = document.getElementById('ntBody'); body.focus(); if (r) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } }
    function toolbar(cmd) {
        const body = document.getElementById('ntBody'); if (!body) return; body.focus();
        if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') return exec(cmd);
        if (cmd === 'h2') return exec('formatBlock', document.queryCommandValue('formatBlock').toLowerCase() === 'h2' ? 'p' : 'h2');
        if (cmd === 'ul') return exec('insertUnorderedList'); if (cmd === 'ol') return exec('insertOrderedList'); if (cmd === 'hr') return exec('insertHorizontalRule');
        if (cmd === 'todo') return exec('insertHTML', '<div class="nt-todo"><input type="checkbox">&nbsp;</div>');
        if (cmd === 'img') return document.getElementById('ntImgFile').click();
        if (cmd === 'link') {
            const rng = savedRange(), selText = String(window.getSelection());
            Mx.modal({ title: 'Sisipkan link', size: 440, body: `<form novalidate><div class="mx-field"><label>URL</label><input name="url" class="mx-input" placeholder="https://…"></div><div class="mx-field"><label>Teks (opsional)</label><input name="text" class="mx-input" value="${esc(selText)}"></div><small class="mx-err" data-err hidden></small><div class="mx-foot"><button type="button" class="mx-btn" data-mx-close>Batal</button><button type="submit" class="mx-btn mx-btn-primary">Sisipkan</button></div></form>`,
                onMount(api) { const f = api.body.querySelector('form'); f.querySelector('[data-mx-close]').addEventListener('click', api.close); setTimeout(() => f.elements.url.focus(), 30);
                    f.addEventListener('submit', e => { e.preventDefault(); let u = f.elements.url.value.trim(); if (u && !/^(https?:|mailto:)/i.test(u)) u = 'https://' + u; if (!/^(https?:\/\/\S+|mailto:\S+)$/i.test(u)) { const er = f.querySelector('[data-err]'); er.textContent = 'Masukkan URL yang valid.'; er.hidden = false; return; }
                        api.close(); restoreRange(rng); exec('insertHTML', `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(f.elements.text.value.trim() || u)}</a>&nbsp;`); }); } });
        }
    }
    async function insertImage(file) {
        try { const src = await Mx.compressImage(file, 800, 0.7); document.getElementById('ntBody').focus(); exec('insertImage', src); Mx.toast('Gambar dilampirkan (dikompres)'); } catch (e) { Mx.toast(e.message || 'Gagal melampirkan gambar', 'error'); }
    }
    function handleEnterTodo(e) {
        const sel = window.getSelection(); if (!sel.rangeCount) return false; let n = sel.anchorNode; while (n && n.id !== 'ntBody' && !(n.classList && n.classList.contains('nt-todo'))) n = n.parentNode;
        if (!n || n.id === 'ntBody') return false; e.preventDefault();
        const empty = !n.textContent.replace(/ /g, '').trim();
        const nxt = document.createElement('div');
        if (empty) { n.replaceWith(nxt); nxt.innerHTML = '<br>'; } else { nxt.className = 'nt-todo'; nxt.innerHTML = '<input type="checkbox">&nbsp;'; n.after(nxt); }
        const r = document.createRange(); r.selectNodeContents(nxt); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); autosave(); return true;
    }

    // ----- modal & menu -----
    function categoriesModal() {
        Mx.modal({ title: 'Kategori Notes', body: `<div id="ntCatBody"></div>`, onMount(api) {
            const draw = () => {
                api.body.innerHTML = `<form id="ntCatForm" class="mx-tools" novalidate><input name="name" class="mx-input" maxlength="40" placeholder="Nama kategori baru" aria-label="Nama kategori"><button type="submit" class="mx-btn mx-btn-primary">Tambah</button></form><small class="mx-err" data-err hidden></small>
                ${D().categories.length ? D().categories.map(c => `<div class="ck-course" data-cid="${esc(c.id)}"><i class="mx-dot lg" style="background:${esc(c.color)}"></i><input class="mx-input" data-rename value="${esc(c.name)}" maxlength="40" aria-label="Nama kategori"><span class="mx-count">${live().filter(n => n.category === c.id).length}</span><button type="button" class="mx-icon" data-del aria-label="Hapus kategori" title="Hapus">🗑</button></div>`).join('') : Mx.empty('🏷', 'Belum ada kategori', 'Buat kategori seperti Ide, Proyek, Referensi.')}`;
                api.body.querySelector('#ntCatForm').addEventListener('submit', e => { e.preventDefault(); const name = e.target.elements.name.value.trim(), er = api.body.querySelector('[data-err]');
                    if (!name) { er.textContent = 'Nama kategori wajib diisi.'; er.hidden = false; return; } if (D().categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { er.textContent = 'Kategori sudah ada.'; er.hidden = false; return; }
                    D().categories.push({ id: uid(), name, color: COLORS[D().categories.length % COLORS.length] }); save(); draw(); rerender(); });
                api.body.querySelectorAll('[data-rename]').forEach(inp => inp.addEventListener('change', () => { const c = cat(inp.closest('[data-cid]').dataset.cid), v = inp.value.trim(); if (!v) { inp.value = c.name; return; } c.name = v; save(); rerender(); }));
                api.body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => { const c = cat(b.closest('[data-cid]').dataset.cid), n = D().notes.filter(x => x.category === c.id).length; if (!(await Mx.confirm(`Hapus kategori "${c.name}"?${n ? ` ${n} catatan akan menjadi tanpa kategori.` : ''}`))) return; D().notes.forEach(x => { if (x.category === c.id) x.category = ''; }); D().categories = D().categories.filter(x => x.id !== c.id); if (ui.cat === c.id) ui.cat = ''; save(); draw(); rerender(); }));
            }; draw(); } });
    }
    function historyModal(n) {
        Mx.modal({ title: 'Riwayat pembaruan', body: n.history.length ? n.history.map((h, i) => `<div class="ck-course"><div class="ck-main"><b>${esc(h.title || 'Tanpa judul')}</b><div class="mx-muted mx-xs">${Mx.fmtDateTime(h.at)} · ${esc(plainOf(h.html).slice(0, 80))}</div></div><button type="button" class="mx-btn mx-btn-sm" data-i="${i}">Pulihkan</button></div>`).join('') + '<p class="mx-muted mx-xs">Versi lama disimpan tanpa gambar. Memulihkan versi akan mengganti isi saat ini (isi saat ini disimpan sebagai versi baru).</p>' : Mx.empty('🕘', 'Belum ada riwayat', 'Versi lama tersimpan otomatis saat kamu mengedit.'),
            onMount(api) { api.body.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', async () => { const h = n.history[+b.dataset.i]; if (!(await Mx.confirm('Pulihkan versi ini? Isi saat ini akan diganti.'))) return; commit(true); n.history.unshift({ at: new Date().toISOString(), title: n.title, html: n.html.replace(/<img[^>]*>/gi, '[gambar]') }); n.history = n.history.slice(0, 10);
                n.title = h.title; n.html = h.html; n.text = plainOf(h.html); n.updated = new Date().toISOString(); save(); api.close(); renderEditor(); Mx.toast('Versi dipulihkan'); })); } });
    }
    function moreMenu(btn) {
        const n = editor.note; const old = document.getElementById('ntMenu'); if (old) { old.remove(); return; }
        const m = document.createElement('div'); m.id = 'ntMenu'; m.className = 'nt-menu'; m.setAttribute('role', 'menu');
        m.innerHTML = [['dup', '⧉ Duplikat'], ['copy', '📋 Salin seluruh isi'], ['txt', '⬇ Ekspor TXT'], ['md', '⬇ Ekspor Markdown'], ['hist', '🕘 Riwayat pembaruan'], ['archive', n.archived ? '↩ Keluarkan dari arsip' : '🗄 Arsipkan'], ['trash', '🗑 Pindahkan ke sampah']].map(([k, l]) => `<button type="button" role="menuitem" data-m="${k}">${l}</button>`).join('');
        btn.parentNode.style.position = 'relative'; btn.parentNode.appendChild(m);
        const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }; setTimeout(() => document.addEventListener('mousedown', off), 0);
        m.addEventListener('click', async e => { const k = e.target.closest('[data-m]'); if (!k) return; m.remove(); document.removeEventListener('mousedown', off); commit(true);
            if (k.dataset.m === 'copy') Mx.copy(convert(n.html, false)); else if (k.dataset.m === 'txt') Mx.download(`${safeName(n)}.txt`, exportText(n, false), 'text/plain'); else if (k.dataset.m === 'md') Mx.download(`${safeName(n)}.md`, exportText(n, true), 'text/markdown');
            else if (k.dataset.m === 'hist') historyModal(n); else if (k.dataset.m === 'dup') { if (editor.isNew) return Mx.toast('Isi catatan dulu sebelum menduplikasi', 'info'); const now = new Date().toISOString(); const c = { ...Mx.clone(n), id: uid(), title: (n.title || 'Tanpa judul') + ' (salinan)', created: now, updated: now, pinned: false, history: [] }; D().notes.unshift(c); log(`Menduplikasi "${label(n)}"`); save(); Mx.toast('Catatan diduplikasi'); }
            else if (k.dataset.m === 'archive') { n.archived = !n.archived; log(`${n.archived ? 'Mengarsipkan' : 'Mengeluarkan dari arsip'} "${label(n)}"`); save(); closeEditor(); Mx.toast(n.archived ? 'Catatan diarsipkan' : 'Catatan dikeluarkan dari arsip'); }
            else if (k.dataset.m === 'trash') { if (!(await Mx.confirm(`Pindahkan "${label(n)}" ke sampah?`))) return; if (editor.isNew) { editor = null; ui.editing = null; root('nt-list').innerHTML = ''; renderList(); return; } n.trashed = true; n.trashedAt = new Date().toISOString(); log(`Memindahkan "${label(n)}" ke sampah`); save(); closeEditor(); Mx.toast('Dipindahkan ke sampah'); } });
    }

    const acts = {
        new: newNote, open: el => { const n = byId(D().notes, el.dataset.id); if (n && !n.trashed) openEditor(n, false); else if (n) Mx.toast('Pulihkan catatan dari sampah untuk membukanya', 'info'); },
        back: closeEditor, filter: el => { ui.filter = el.dataset.f; const r = root('nt-list'); r.innerHTML = ''; renderList(); }, mode: el => { ui.mode = el.dataset.m; store.set(VIEWMODE_KEY, ui.mode); root('nt-list').innerHTML = ''; renderList(); },
        cats: categoriesModal, gocat: el => { ui.cat = el.dataset.id; ui.filter = 'all'; root('nt-list').innerHTML = ''; go('nt-list'); },
        pin: el => { const n = byId(D().notes, el.dataset.id); n.pinned = !n.pinned; log(`${n.pinned ? 'Menyematkan' : 'Melepas sematan'} "${label(n)}"`); save(); rerender(); },
        fav: el => { const n = byId(D().notes, el.dataset.id); n.favorite = !n.favorite; save(); rerender(); },
        archive: el => { const n = byId(D().notes, el.dataset.id); n.archived = !n.archived; log(`${n.archived ? 'Mengarsipkan' : 'Mengeluarkan dari arsip'} "${label(n)}"`); save(); rerender(); Mx.toast(n.archived ? 'Diarsipkan' : 'Dikeluarkan dari arsip'); },
        trash: async el => { const n = byId(D().notes, el.dataset.id); if (!(await Mx.confirm(`Pindahkan "${label(n)}" ke sampah?`))) return; n.trashed = true; n.trashedAt = new Date().toISOString(); log(`Memindahkan "${label(n)}" ke sampah`); save(); rerender(); Mx.toast('Dipindahkan ke sampah'); },
        restore: el => { const n = byId(D().notes, el.dataset.id); n.trashed = false; n.trashedAt = ''; log(`Memulihkan "${label(n)}"`); save(); rerender(); Mx.toast('Catatan dipulihkan'); },
        purge: async el => { const n = byId(D().notes, el.dataset.id); if (!(await Mx.confirm(`Hapus permanen "${label(n)}"? Tidak bisa dibatalkan.`))) return; D().notes = D().notes.filter(x => x.id !== n.id); save(); rerender(); Mx.toast('Dihapus permanen'); },
        empty: async () => { const c = D().notes.filter(n => n.trashed).length; if (!c || !(await Mx.confirm(`Hapus permanen ${c} catatan di sampah?`))) return; D().notes = D().notes.filter(n => !n.trashed); save(); rerender(); Mx.toast('Sampah dikosongkan'); },
        efav: () => { const n = editor.note; n.favorite = !n.favorite; document.getElementById('ntFav').textContent = n.favorite ? '⭐' : '☆'; if (!editor.isNew) save(); },
        epin: () => { const n = editor.note; n.pinned = !n.pinned; document.getElementById('ntPin').style.opacity = n.pinned ? '' : '.45'; if (!editor.isNew) save(); },
        emenu: el => moreMenu(el)
    };
    const RENDER = { 'nt-dashboard': renderDashboard, 'nt-list': renderList };
    let current = 'nt-dashboard';
    const rerender = () => { const f = RENDER[current]; if (f) { if (current === 'nt-list' && !ui.editing) { const el = root('nt-list'); if (el) el.innerHTML = ''; } f(); } };

    AppModules.register(KEY, {
        label: 'Notes', views: Object.keys(RENDER), normalize, validate,
        init() {
            Object.keys(RENDER).forEach(v => {
                const r = root(v); if (!r) return;
                Mx.delegate(r, acts, {
                    input: e => { if (e.target.id === 'ntQ') { ui.q = e.target.value; renderList(); } if (editor && /^(ntBody|ntTitle|ntETags)$/.test(e.target.id)) { editor.dirty = true; setStatus('Menyimpan…'); autosave(); } },
                    change: e => { if (e.target.id === 'ntCat') { ui.cat = e.target.value; renderList(); } if (e.target.id === 'ntSort') { ui.sort = e.target.value; renderList(); } if (e.target.id === 'ntECat') { commit(false); }
                        if (e.target.id === 'ntImgFile') { const f = e.target.files[0]; e.target.value = ''; if (f) insertImage(f); } },
                    keydown: e => {
                        if (e.target.classList && e.target.classList.contains('nt-open') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); acts.open(e.target); }
                        if (!editor) return; const mod = e.ctrlKey || e.metaKey;
                        if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); autosave.cancel(); commit(true); Mx.toast('Catatan tersimpan'); }
                        else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); toolbar('link'); }
                        else if (e.key === 'Escape' && !document.querySelector('.mx-overlay')) { closeEditor(); }
                        else if (e.key === 'Enter' && e.target.id === 'ntBody' && !e.shiftKey) handleEnterTodo(e);
                    }
                });
                r.addEventListener('mousedown', e => { if (e.target.closest('.nt-tb')) e.preventDefault(); });
                r.addEventListener('click', e => {
                    const tb = e.target.closest('.nt-tb'); if (tb) toolbar(tb.dataset.cmd);
                    if (e.target.matches('#ntBody input[type=checkbox]')) { e.target.toggleAttribute('checked', e.target.checked); autosave(); }
                });
                r.addEventListener('paste', e => {
                    if (e.target.id !== 'ntBody') return; e.preventDefault(); const cd = e.clipboardData; if (!cd) return;
                    const img = Array.from(cd.files || []).find(f => /^image\//.test(f.type)); if (img) return insertImage(img);
                    exec('insertText', cd.getData('text/plain'));
                });
            });
            document.addEventListener('keydown', e => { const act = document.querySelector('.app-section.active'); if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n' && act && /^view-nt-/.test(act.id)) { e.preventDefault(); newNote(); } });
            window.addEventListener('beforeunload', () => { if (editor) { autosave.cancel(); commit(false); } });
        },
        show(v) { if (editor && v !== 'nt-list') { autosave.cancel(); commit(false); } current = v; if (v === 'nt-list' && !ui.editing) { const el = root(v); if (el) el.innerHTML = ''; } rerender(); },
        refresh() { if (editor) return; const r = root(current); if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) rerender(); },
        isBusy: () => !!editor || !!document.querySelector('.mx-overlay'),
        onChange() { /* dashboard diperbarui saat dibuka */ }
    });
})();
