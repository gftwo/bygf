/* ==========================================================================
   MODUL TARGET TABUNGAN — tujuan menabung dengan progres, setoran, dan riwayat
   Data: AppModules 'goals' = { goals: [{ id, name, icon, target, saved, deadline, note, created, history:[{ id, at, amount, note }] }] }
   Berdiri sendiri (tidak mengubah saldo Keuangan); riwayat setoran/penarikan dicatat per target.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'goals', ICONS = ['🎯', '💻', '📱', '✈️', '🎓', '🏠', '🚲', '🎧', '👟', '🎁', '💍', '🛟'];
    const { esc, uid, today } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = () => document.getElementById('view-goal-home');
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const num = v => Math.max(0, Math.round(Number(v) || 0));
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

    function normalize(raw) {
        return { goals: arr(raw && raw.goals).filter(g => g && typeof g === 'object' && g.name).map(g => ({
            id: String(g.id || uid()), name: String(g.name).slice(0, 60), icon: ICONS.includes(g.icon) ? g.icon : '🎯', target: num(g.target), saved: num(g.saved),
            deadline: isDate(g.deadline) ? g.deadline : '', note: String(g.note || '').slice(0, 200), created: g.created || new Date().toISOString(),
            history: arr(g.history).filter(h => h && h.at && Number.isFinite(Number(h.amount))).map(h => ({ id: String(h.id || uid()), at: h.at, amount: Math.round(Number(h.amount)), note: String(h.note || '').slice(0, 80) })).slice(0, 100)
        })) };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; if (raw.goals != null && typeof raw.goals !== 'object') e.push('daftar target tidak valid');
        arr(raw.goals).forEach((g, i) => { if (!g || typeof g !== 'object' || !g.name) e.push(`target #${i + 1} tidak punya nama`); });
        return e.slice(0, 5);
    }
    const pct = g => g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0;
    function perMonth(g) { // kebutuhan setoran per bulan sampai deadline
        if (!g.deadline || g.saved >= g.target) return null;
        const d = Mx.parse(g.deadline), n = new Date(); const months = (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth() + (d.getDate() >= n.getDate() ? 1 : 0);
        return months <= 0 ? { late: true } : { amount: Math.ceil((g.target - g.saved) / months), months };
    }

    function card(g) {
        const p = pct(g), done = g.target > 0 && g.saved >= g.target, pm = perMonth(g), left = Math.max(0, g.target - g.saved);
        return `<article class="mx-card gl-card${done ? ' done' : ''}"><div class="gl-top"><span class="gl-icon">${g.icon}</span><div class="gl-title"><b>${esc(g.name)}</b>${g.note ? `<small>${esc(g.note)}</small>` : ''}</div>${done ? '<span class="mx-pill">🎉 Tercapai</span>' : ''}</div>
        <div class="gl-amount"><b>${esc(Mx.fmtRp(g.saved))}</b><span class="mx-muted"> / ${esc(Mx.fmtRp(g.target))}</span></div>
        <div class="mx-progress" role="progressbar" aria-label="Progres ${esc(g.name)}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><div style="width:${p}%"></div></div>
        <div class="gl-meta"><span>${p}%</span><span>${done ? 'Target tercapai' : 'Kurang ' + esc(Mx.fmtRp(left))}</span></div>
        ${g.deadline ? `<div class="mx-muted mx-xs">⏳ Tenggat ${esc(Mx.fmtDate(g.deadline))}${pm ? (pm.late ? ' — sudah lewat' : ` · perlu ±${esc(Mx.fmtRp(pm.amount))}/bulan (${pm.months} bln)`) : ''}</div>` : ''}
        <div class="mx-foot gl-foot"><button type="button" class="mx-btn mx-btn-primary" data-act="dep" data-id="${esc(g.id)}">＋ Setor</button><button type="button" class="mx-btn" data-act="wd" data-id="${esc(g.id)}" ${g.saved ? '' : 'disabled'}>− Tarik</button><button type="button" class="mx-btn" data-act="hist" data-id="${esc(g.id)}">Riwayat</button><button type="button" class="mx-icon" data-act="edit" data-id="${esc(g.id)}" title="Ubah" aria-label="Ubah ${esc(g.name)}">✎</button><button type="button" class="mx-icon" data-act="del" data-id="${esc(g.id)}" title="Hapus" aria-label="Hapus ${esc(g.name)}">🗑</button></div></article>`;
    }
    function render() {
        const el = root(); if (!el) return; const gs = D().goals, tot = gs.reduce((s, g) => s + g.target, 0), sv = gs.reduce((s, g) => s + g.saved, 0), ok = gs.filter(g => g.target && g.saved >= g.target).length;
        el.innerHTML = `<div class="mx-head"><div><h2 class="mx-h2">🐷 Target Tabungan</h2><p class="mx-muted">Menabung untuk sesuatu yang kamu mau, selangkah demi selangkah.</p></div><button type="button" class="mx-btn mx-btn-primary" data-act="add">＋ Target baru</button></div>
        ${gs.length ? `<div class="mx-stats"><div class="mx-stat"><span>Terkumpul</span><b>${esc(Mx.fmtRp(sv))}</b><small>dari ${esc(Mx.fmtRp(tot))}</small></div><div class="mx-stat"><span>Target aktif</span><b>${gs.length - ok}</b><small>sedang berjalan</small></div><div class="mx-stat"><span>Tercapai</span><b>${ok}</b><small>target</small></div></div>
        <div class="gl-grid">${gs.map(card).join('')}</div>` : Mx.empty('🐷', 'Belum ada target tabungan', 'Buat target pertamamu, misalnya laptop baru atau liburan.')}`;
    }

    function form(g) {
        g = g || { name: '', icon: '🎯', target: '', deadline: '', note: '' };
        return `<div class="mx-field"><label for="glName">Nama target</label><input id="glName" class="mx-input" maxlength="60" value="${esc(g.name)}" placeholder="Contoh: Laptop baru"></div>
        <div class="mx-field"><label>Ikon</label><div class="mx-chips" id="glIcons">${ICONS.map(i => `<button type="button" class="mx-chip${i === g.icon ? ' on' : ''}" data-ico="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}</div></div>
        <div class="mx-two"><div class="mx-field"><label for="glTarget">Jumlah target (Rp)</label><input id="glTarget" class="mx-input" inputmode="numeric" value="${g.target ? esc(String(g.target)) : ''}" placeholder="8000000"></div>
        <div class="mx-field"><label for="glDeadline">Tenggat (opsional)</label><input id="glDeadline" type="date" class="mx-input" value="${esc(g.deadline)}" min="${today()}"></div></div>
        <div class="mx-field"><label for="glNote">Catatan (opsional)</label><input id="glNote" class="mx-input" maxlength="200" value="${esc(g.note)}"></div><small class="mx-err" id="glErr" hidden></small>
        <div class="mx-foot"><button type="button" class="mx-btn" data-x="cancel">Batal</button><button type="button" class="mx-btn mx-btn-primary" data-x="ok">Simpan</button></div>`;
    }
    function goalModal(g) {
        Mx.modal({ title: g ? 'Ubah target' : 'Target baru', size: 460, body: form(g), onMount(api) {
            let icon = g ? g.icon : '🎯'; const b = api.body, err = b.querySelector('#glErr');
            b.querySelector('#glIcons').addEventListener('click', e => { const c = e.target.closest('[data-ico]'); if (!c) return; icon = c.dataset.ico; b.querySelectorAll('#glIcons .mx-chip').forEach(x => x.classList.toggle('on', x === c)); });
            b.querySelector('[data-x=cancel]').addEventListener('click', api.close);
            b.querySelector('[data-x=ok]').addEventListener('click', () => {
                const name = b.querySelector('#glName').value.trim(), target = Mx.parseRp(b.querySelector('#glTarget').value), dl = b.querySelector('#glDeadline').value;
                if (!name) { err.textContent = 'Nama target wajib diisi.'; err.hidden = false; return; }
                if (target <= 0) { err.textContent = 'Jumlah target harus lebih dari 0.'; err.hidden = false; return; }
                const note = b.querySelector('#glNote').value.trim();
                if (g) Object.assign(g, { name, icon, target, deadline: isDate(dl) ? dl : '', note });
                else D().goals.unshift({ id: uid(), name, icon, target, saved: 0, deadline: isDate(dl) ? dl : '', note, created: new Date().toISOString(), history: [] });
                save(); api.close(); render(); Mx.toast(g ? 'Target diperbarui' : 'Target dibuat');
            });
        } });
    }
    function moveModal(g, sign) {
        const dep = sign > 0;
        Mx.modal({ title: `${dep ? 'Setor ke' : 'Tarik dari'} "${g.name}"`, size: 400, body: `<p class="mx-muted">Terkumpul saat ini: <b>${esc(Mx.fmtRp(g.saved))}</b></p><div class="mx-field"><label for="glAmt">Jumlah (Rp)</label><input id="glAmt" class="mx-input" inputmode="numeric" placeholder="100000"></div><div class="mx-field"><label for="glMemo">Catatan (opsional)</label><input id="glMemo" class="mx-input" maxlength="80"></div><small class="mx-err" id="glErr" hidden></small>
            <div class="mx-foot"><button type="button" class="mx-btn" data-x="cancel">Batal</button><button type="button" class="mx-btn mx-btn-primary" data-x="ok">${dep ? 'Setor' : 'Tarik'}</button></div>`,
            onMount(api) {
                const b = api.body, err = b.querySelector('#glErr'); b.querySelector('[data-x=cancel]').addEventListener('click', api.close);
                b.querySelector('[data-x=ok]').addEventListener('click', () => {
                    const amt = Mx.parseRp(b.querySelector('#glAmt').value);
                    if (amt <= 0) { err.textContent = 'Masukkan jumlah lebih dari 0.'; err.hidden = false; return; }
                    if (!dep && amt > g.saved) { err.textContent = 'Jumlah melebihi dana yang terkumpul.'; err.hidden = false; return; }
                    g.saved += sign * amt; g.history.unshift({ id: uid(), at: new Date().toISOString(), amount: sign * amt, note: b.querySelector('#glMemo').value.trim() }); g.history = g.history.slice(0, 100);
                    save(); api.close(); render(); Mx.toast(dep ? 'Setoran dicatat' : 'Penarikan dicatat');
                });
            } });
    }
    function histModal(g) {
        Mx.modal({ title: `Riwayat — ${g.name}`, size: 460, body: g.history.length ? g.history.map(h => `<div class="hm-row"><i class="hm-dot" style="background:${h.amount > 0 ? '#10b981' : '#ef4444'}"></i><div class="hm-main"><b>${h.amount > 0 ? '+' : '−'}${esc(Mx.fmtRp(Math.abs(h.amount)))}</b><small>${esc(Mx.fmtDateTime(h.at))}${h.note ? ' · ' + esc(h.note) : ''}</small></div></div>`).join('') : Mx.empty('🧾', 'Belum ada riwayat') });
    }
    const acts = {
        add: () => goalModal(null), edit: el => { const g = Mx.byId(D().goals, el.dataset.id); if (g) goalModal(g); },
        dep: el => { const g = Mx.byId(D().goals, el.dataset.id); if (g) moveModal(g, 1); }, wd: el => { const g = Mx.byId(D().goals, el.dataset.id); if (g) moveModal(g, -1); },
        hist: el => { const g = Mx.byId(D().goals, el.dataset.id); if (g) histModal(g); },
        del: async el => { const g = Mx.byId(D().goals, el.dataset.id); if (!g || !(await Mx.confirm(`Hapus target "${g.name}"?`))) return; D().goals = D().goals.filter(x => x.id !== g.id); save(); render(); Mx.toast('Target dihapus'); }
    };
    AppModules.register(KEY, {
        label: 'Target Tabungan', views: ['goal-home'], normalize, validate,
        init() { const r = root(); if (r) Mx.delegate(r, acts); },
        show() { render(); },
        refresh() { const r = root(); if (r && r.classList.contains('active')) render(); },
        isBusy: () => !!document.querySelector('.mx-overlay')
    });
})();
