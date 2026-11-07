import { App } from './core.js';

/* ==========================================================================
   Pengingat di HP (notifikasi lokal Android via Capacitor)
   - buildPlan(): fungsi murni → daftar notifikasi yang harus dijadwalkan (mudah diuji, tanpa efek samping).
   - Penjadwalan ulang otomatis setiap data berubah; semua alarm lama dibatalkan lalu dibuat ulang (tidak pernah dobel).
   - Preferensi disimpan per perangkat (localStorage) karena notifikasi bersifat per-HP.
   - Di web biasa: hanya menampilkan pratinjau jadwal (notifikasi sistem tidak tersedia).
   - TIDAK ada notifikasi untuk Alokasi, Rencana Budget, jadwal makan, jurnal malam, maupun backup.
   ========================================================================== */
const PREF_KEY = 'bygf.notifyPrefs';
const HORIZON_DAYS = 35, MAX_SCHEDULE = 250;
const DEFAULTS = {
    finance: { on: true, time: '20:00' },
    bills: { on: true, time: '09:00' },       // H-3, H-1, hari-H
    recurring: { on: true, time: '08:00' },   // H-1 (19:00) & hari-H
    tugas: { on: true },                      // tugas harian
    kuliahTugas: { on: true },                // deadline tugas kuliah
    kuliah: { on: true, minutes: 30 },        // sebelum kuliah mulai
    absen: { on: true },                      // setelah kuliah selesai bila belum dicatat
    weekly: { on: true, day: 0, time: '19:00' }
};

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (dateISO, hhmm) => { const [y, m, d] = dateISO.split('-').map(Number), [h, mi] = String(hhmm || '00:00').split(':').map(Number); return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0); };
const addDays = (dateISO, n) => { const d = at(dateISO, '12:00'); d.setDate(d.getDate() + n); return iso(d); };
const minus = (dt, min) => new Date(dt.getTime() - min * 60000);
const hhmm = v => /^\d{2}:\d{2}$/.test(v || '') ? v : null;
const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n || 0);
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 1) || 1; }; // 31-bit positif

function mergePrefs(raw) {
    const p = JSON.parse(JSON.stringify(DEFAULTS)); raw = raw && typeof raw === 'object' ? raw : {};
    Object.keys(p).forEach(k => { if (raw[k] && typeof raw[k] === 'object') Object.keys(p[k]).forEach(f => { if (raw[k][f] !== undefined && typeof raw[k][f] === typeof p[k][f]) p[k][f] = raw[k][f]; }); });
    Object.keys(p).forEach(k => { if (p[k].time !== undefined && !hhmm(p[k].time)) p[k].time = DEFAULTS[k].time; });
    p.kuliah.minutes = Math.max(5, Math.min(180, parseInt(p.kuliah.minutes) || 30));
    p.weekly.day = Math.max(0, Math.min(6, parseInt(p.weekly.day) || 0));
    return p;
}

/* data = { paylaters, recurring, transactions, tasks, kuliahTasks, classes }; now = Date. Mengembalikan [{id,title,body,at,route}] terurut. */
function buildPlan(data, prefsIn, now) {
    const P = mergePrefs(prefsIn), out = [], seen = new Set(), arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const todayISO = iso(now), endISO = addDays(todayISO, HORIZON_DAYS);
    const push = (key, title, body, when, route) => {
        if (!(when instanceof Date) || isNaN(when) || when <= now || iso(when) > endISO) return;
        if (seen.has(key)) return; seen.add(key);
        out.push({ id: hash(key), key, title, body, at: when, route: route || null });
    };

    // 1) Pengingat harian isi keuangan (dilewati hari ini bila sudah ada transaksi hari ini)
    if (P.finance.on) {
        const hasToday = arr(data.transactions).some(t => t && !t.isAdjustment && t.tanggal === todayISO);
        for (let i = 0; i <= HORIZON_DAYS; i++) { const d = addDays(todayISO, i); if (i === 0 && hasToday) continue; push('fin:' + d, '💸 Catat keuanganmu', 'Sudah catat pemasukan & pengeluaran hari ini?', at(d, P.finance.time), { g: 'keuangan', sub: 'input' }); }
    }

    // 2) Tagihan & cicilan: tiap tanggal jatuh tempo bulanan → H-3, H-1, hari-H
    if (P.bills.on) {
        arr(data.paylaters).forEach(p => {
            const day = parseInt(p && p.dueDay); if (!(day >= 1 && day <= 31) || !(p.amount > 0)) return;
            for (let m = 0; m < 3; m++) {
                const y = now.getFullYear(), mo = now.getMonth() + m, last = new Date(y, mo + 1, 0).getDate(), d = new Date(y, mo, Math.min(day, last)), due = iso(d);
                [[3, 'H-3'], [1, 'besok'], [0, 'hari ini']].forEach(([b, lbl]) => {
                    const t = b === 0 ? hhmm(P.bills.time) : P.bills.time;
                    push(`bill:${p.id}:${due}:${b}`, b === 0 ? '⚠️ Tagihan jatuh tempo hari ini' : `📅 Tagihan jatuh tempo ${lbl === 'H-3' ? '3 hari lagi' : 'besok'}`, `${p.name} · sisa ${rp(p.amount)}`, at(addDays(due, -b), t), { g: 'keuangan', sub: 'input' });
                });
            }
        });
    }

    // 3) Transaksi otomatis: H-1 (19:00) & hari-H
    if (P.recurring.on) {
        arr(data.recurring).forEach(r => {
            if (!r || r.status === 'paused' || !/^\d{4}-\d{2}-\d{2}$/.test(r.nextExecution || '')) return;
            const label = (r.template && (r.template.keterangan || r.template.kategori)) || 'Transaksi otomatis', amt = r.template ? (r.template.pengeluaran || r.template.pemasukan || 0) : 0;
            const interval = Math.max(1, parseInt(r.interval) || 1); let d = at(r.nextExecution, '12:00'), guard = 0;
            while (iso(d) <= endISO && guard++ < 60) {
                const due = iso(d); if (r.endDate && due > r.endDate) break;
                push(`rec:${r.id}:${due}:0`, '🔁 Transaksi otomatis hari ini', `${label}${amt ? ' · ' + rp(amt) : ''}`, at(due, P.recurring.time), { g: 'settings', sub: '' });
                push(`rec:${r.id}:${due}:1`, '🔁 Transaksi otomatis besok', `${label}${amt ? ' · ' + rp(amt) : ''}`, at(addDays(due, -1), '19:00'), { g: 'settings', sub: '' });
                if (r.type === 'daily') d.setDate(d.getDate() + interval); else if (r.type === 'weekly') d.setDate(d.getDate() + interval * 7); else if (r.type === 'monthly') d.setMonth(d.getMonth() + interval); else break;
            }
        });
    }

    // 4) Tugas harian ("full"): H-1 18:00 · hari-H 08:00 (jika tanpa jam) · 1 jam sebelum & tepat waktu (jika ada jam)
    if (P.tugas.on) {
        arr(data.tasks).forEach(t => {
            if (!t || t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return;
            const route = { g: 'daily', sub: 'daily-home' }, hi = t.priority === 'high' ? '❗ ' : '';
            push(`task:${t.id}:eve`, `${hi}📝 Besok: ${t.title}`, t.time ? `Pukul ${t.time}` : 'Jangan lupa dikerjakan besok', at(addDays(t.date, -1), '18:00'), route);
            if (t.time) {
                const start = at(t.date, t.time);
                push(`task:${t.id}:1h`, `${hi}⏰ 1 jam lagi: ${t.title}`, `Pukul ${t.time}`, minus(start, 60), route);
                push(`task:${t.id}:now`, `${hi}⏰ Sekarang: ${t.title}`, `Waktunya sudah tiba (${t.time})`, start, route);
            } else push(`task:${t.id}:day`, `${hi}📝 Hari ini: ${t.title}`, 'Tugas hari ini belum selesai', at(t.date, '08:00'), route);
        });
    }

    // 5) Deadline tugas kuliah: H-2, H-1 (18:00), 2 jam sebelum deadline
    if (P.kuliahTugas.on) {
        arr(data.kuliahTasks).forEach(t => {
            if (!t || t.done || !t.deadline) return;
            const dl = String(t.deadline), dISO = dl.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(dISO)) return;
            const time = hhmm(dl.slice(11, 16)) || '23:59', route = { g: 'kuliah', sub: 'kuliah' }, name = (t.matkul ? t.matkul + ' · ' : '') + t.judul;
            push(`kt:${t.id}:2d`, '🎓 Deadline 2 hari lagi', name, at(addDays(dISO, -2), '09:00'), route);
            push(`kt:${t.id}:1d`, '🎓 Deadline besok', `${name} (${time})`, at(addDays(dISO, -1), '18:00'), route);
            push(`kt:${t.id}:2h`, '🚨 Deadline 2 jam lagi', name, minus(at(dISO, time), 120), route);
        });
    }

    // 6) Kuliah: N menit sebelum mulai · 7) absen: tepat saat kuliah selesai bila belum dicatat
    arr(data.classes).forEach(c => {
        if (!c || !hhmm(c.jamMulai)) return;
        const route = { g: 'kuliah', sub: 'kuliah' }, place = [c.mode === 'online' ? 'Online' : c.lokasi, `${c.jamMulai}${c.jamSelesai ? '–' + c.jamSelesai : ''}`].filter(Boolean).join(' · ');
        if (P.kuliah.on) push(`cls:${c.courseId}:${c.dateISO}:pre`, `🎓 ${P.kuliah.minutes} menit lagi: ${c.nama}`, place, minus(at(c.dateISO, c.jamMulai), P.kuliah.minutes), route);
        if (P.absen.on && hhmm(c.jamSelesai) && !c.recorded) push(`cls:${c.courseId}:${c.dateISO}:abs`, `✍️ Catat absen: ${c.nama}`, 'Kuliah sudah selesai — tandai hadir / tidak hadir', at(c.dateISO, c.jamSelesai), { g: 'kuliah', sub: 'ck-catat' });
    });

    // 8) Laporan mingguan
    if (P.weekly.on) {
        for (let i = 0; i <= HORIZON_DAYS; i++) { const d = addDays(todayISO, i); if (at(d, '12:00').getDay() === P.weekly.day) push('wk:' + d, '📊 Laporan mingguan', 'Lihat ringkasan pemasukan & pengeluaran minggu ini', at(d, P.weekly.time), { g: 'laporan', sub: '' }); }
    }

    out.sort((a, b) => a.at - b.at);
    return out.slice(0, MAX_SCHEDULE);
}

const plugin = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) || null;
const isNative = () => !!(window.Capacitor && (Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : Capacitor.getPlatform && Capacitor.getPlatform() !== 'web') && plugin());

App.Notify = {
    buildPlan, mergePrefs, DEFAULTS,
    isNative,
    prefs() { try { return mergePrefs(JSON.parse(localStorage.getItem(PREF_KEY) || 'null')); } catch (e) { return mergePrefs(null); } },
    setPref(group, field, value) {
        const p = this.prefs(); if (!p[group] || p[group][field] === undefined) return;
        p[group][field] = value; try { localStorage.setItem(PREF_KEY, JSON.stringify(mergePrefs(p))); } catch (e) { /* abaikan */ }
        this.renderCard(); this.reschedule(0);
    },
    collect() {
        const st = App.State, mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null, d = mod('daily');
        return {
            paylaters: st.paylaters, recurring: st.recurring, transactions: st.transactions, tasks: (d && d.tasks) || [],
            kuliahTasks: (window.KuliahPro && KuliahPro.getTasks) ? KuliahPro.getTasks() : [],
            classes: (window.KuliahPro && KuliahPro.upcomingClasses) ? KuliahPro.upcomingClasses(HORIZON_DAYS) : []
        };
    },
    plan() { return buildPlan(this.collect(), this.prefs(), new Date()); },
    _timer: null,
    reschedule(delay) {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._apply().catch(e => console.warn('Jadwal notifikasi gagal:', e)), delay === undefined ? 1500 : delay);
    },
    async _apply() {
        if (!App.State.user || App.State.isLoading) return;
        const LN = plugin(); const plan = this.plan(); this._lastCount = plan.length;
        if (!isNative()) { this.renderCard(); return; }
        const perm = await LN.checkPermissions(); if (perm.display !== 'granted') { this.renderCard(); return; }
        const pend = await LN.getPending(); if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
        if (plan.length) await LN.schedule({ notifications: plan.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, channelId: 'bygf-reminders', extra: n.route || {} })) });
        this.renderCard();
    },
    async enable() {
        const LN = plugin(); if (!LN) return;
        try {
            await LN.createChannel({ id: 'bygf-reminders', name: 'Pengingat BYgf', description: 'Pengingat keuangan, tagihan, kuliah & tugas', importance: 4, visibility: 1 });
            const r = await LN.requestPermissions();
            if (r.display !== 'granted') { App.UI.showToast('Izin notifikasi ditolak — aktifkan di Pengaturan HP > Aplikasi > BYgf > Notifikasi', 'error'); return; }
            await this._apply(); App.UI.showToast('Pengingat HP aktif', 'success');
        } catch (e) { App.UI.showToast('Gagal mengaktifkan pengingat', 'error'); console.warn(e); }
    },
    async openExactSettings() { const LN = plugin(); if (!LN || !LN.changeExactNotificationSetting) return; try { await LN.changeExactNotificationSetting(); } catch (e) { /* abaikan */ } },
    async test() {
        const LN = plugin(); if (!LN) return;
        try { await LN.schedule({ notifications: [{ id: 1, title: '🔔 Tes pengingat BYgf', body: 'Notifikasi berfungsi.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, channelId: 'bygf-reminders' }] }); App.UI.showToast('Notifikasi tes muncul dalam 5 detik — tutup aplikasinya untuk mengetes', 'success'); } catch (e) { App.UI.showToast('Gagal mengirim notifikasi tes', 'error'); }
    },
    _bindTap() {
        const LN = plugin(); if (!LN || this._tapBound) return; this._tapBound = true;
        LN.addListener('localNotificationActionPerformed', ev => {
            const r = ev && ev.notification && ev.notification.extra; if (!r || !r.g) return;
            if (r.sub) App.UI._lastSubTab[r.g] = r.sub; App.UI.switchMainGroup(r.g);
        });
    },
    async renderCard() {
        const el = document.getElementById('notifyCard'); if (!el) return;
        const P = this.prefs(), native = isNative(); let perm = '', exact = '';
        if (native) { try { perm = (await plugin().checkPermissions()).display; } catch (e) { /* abaikan */ } }
        const sw = (g, label, extra) => `<div class="nt-row"><label class="nt-sw"><input type="checkbox" data-nt="${g}.on" ${P[g].on ? 'checked' : ''}><span>${label}</span></label>${extra || ''}</div>`;
        const tm = (g, f) => `<input type="time" class="nt-time" data-nt="${g}.${f}" value="${P[g][f]}" aria-label="Jam ${g}">`;
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const plan = this.plan(), fmt = d => d.toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        el.innerHTML = `<h3 class="font-bold" style="margin-bottom:.5rem;">🔔 Pengingat di HP</h3>
        <p class="text-xs text-muted" style="margin-bottom:.75rem;">${native ? (perm === 'granted' ? '✅ Aktif — pengingat muncul walau aplikasi ditutup.' : '⚠️ Izin notifikasi belum diberikan.') : 'Notifikasi sistem hanya tersedia di aplikasi Android. Di browser kamu tetap bisa melihat pratinjau jadwalnya.'} Alokasi & Rencana Budget tidak mengirim notifikasi.</p>
        ${native ? `<div class="nt-actions"><button type="button" class="btn btn-primary" data-nt-act="enable">${perm === 'granted' ? 'Perbarui jadwal' : 'Aktifkan pengingat'}</button><button type="button" class="btn btn-outline" data-nt-act="test">Tes notifikasi</button><button type="button" class="btn btn-outline" data-nt-act="exact">Izin alarm tepat waktu</button></div>` : ''}
        <div class="nt-list">
        ${sw('finance', '💸 Isi keuangan tiap hari', tm('finance', 'time'))}
        ${sw('bills', '📅 Tagihan & cicilan (H-3, H-1, hari-H)', tm('bills', 'time'))}
        ${sw('recurring', '🔁 Transaksi otomatis jatuh tempo', tm('recurring', 'time'))}
        ${sw('tugas', '📝 Tugas harian (H-1, 1 jam sebelum, tepat waktu)')}
        ${sw('kuliahTugas', '🎓 Deadline tugas kuliah (H-2, H-1, 2 jam)')}
        ${sw('kuliah', '🎓 Sebelum kuliah mulai', `<span class="nt-inline"><input type="number" class="nt-num" min="5" max="180" data-nt="kuliah.minutes" value="${P.kuliah.minutes}" aria-label="Menit sebelum kuliah"> menit</span>`)}
        ${sw('absen', '✍️ Ingatkan catat absen saat kuliah selesai')}
        ${sw('weekly', '📊 Laporan mingguan', `<span class="nt-inline"><select data-nt="weekly.day" aria-label="Hari laporan">${days.map((n, i) => `<option value="${i}" ${P.weekly.day === i ? 'selected' : ''}>${n}</option>`).join('')}</select>${tm('weekly', 'time')}</span>`)}
        </div>
        <details class="nt-prev"><summary>Pratinjau jadwal (${plan.length} pengingat)</summary>${plan.length ? '<ul>' + plan.slice(0, 25).map(n => `<li><b>${fmt(n.at)}</b> — ${App.Notify._esc(n.title)} <small>${App.Notify._esc(n.body)}</small></li>`).join('') + '</ul>' : '<p class="text-xs text-muted">Belum ada pengingat terjadwal.</p>'}</details>`;
    },
    _esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    _bindCard() {
        const el = document.getElementById('notifyCard'); if (!el || el._bound) return; el._bound = true;
        el.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.nt; if (!k) return; const [g, f] = k.split('.'); let v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' || e.target.tagName === 'SELECT' ? parseInt(e.target.value) : e.target.value; if (e.target.type === 'time' && !hhmm(v)) return; this.setPref(g, f, v); });
        el.addEventListener('click', e => { const b = e.target.closest('[data-nt-act]'); if (!b) return; const a = b.dataset.ntAct; if (a === 'enable') this.enable(); else if (a === 'test') this.test(); else if (a === 'exact') this.openExactSettings(); });
    },
    onLoaded() { // dipanggil setelah data akun termuat
        this._bindCard(); this._bindTap(); this.renderCard();
        if (!this._wrapped && App.DB && App.DB.save) { // jadwal ulang otomatis setiap data tersimpan
            this._wrapped = true; const orig = App.DB.save;
            App.DB.save = function (...a) { const r = orig.apply(this, a); App.Notify.reschedule(); return r; };
        }
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.reschedule(800); });
        if (isNative()) { plugin().checkPermissions().then(p => { if (p.display === 'granted') { plugin().createChannel({ id: 'bygf-reminders', name: 'Pengingat BYgf', importance: 4, visibility: 1 }).catch(() => {}); this.reschedule(500); } }).catch(() => {}); }
    }
};
