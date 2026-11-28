import { App } from './core.js';

/* ==========================================================================
   Pengingat di HP (notifikasi lokal Android via Capacitor)
   - buildPlan(): fungsi murni → daftar notifikasi yang harus dijadwalkan (mudah diuji, tanpa efek samping).
   - Penjadwalan ulang otomatis setiap data berubah; semua alarm lama dibatalkan lalu dibuat ulang (tidak pernah dobel).
   - Preferensi disimpan per perangkat (localStorage) karena notifikasi bersifat per-HP.
   - Di web biasa: hanya menampilkan pratinjau jadwal (notifikasi sistem tidak tersedia).
   - Tiap jenis punya 3 mode: Mati · Biasa (bisa digeser) · Stay (tidak bisa digeser, hilang otomatis saat urusannya selesai).
   - Notifikasi yang sudah tampil dibersihkan tiap data berubah: bila tugas/absen/outfit/transaksi sudah selesai, notifikasinya ikut dihapus.
   - TIDAK ada notifikasi untuk Alokasi, Rencana Budget, jadwal makan, jurnal malam, maupun backup.
   ========================================================================== */
const PREF_KEY = 'bygf.notifyPrefs';
const HORIZON_DAYS = 35, MAX_SCHEDULE = 250;
const MODES = ['off', 'normal', 'stay'];
const POPUPS = ['popupTugas', 'popupBackup'];        // popup di dalam aplikasi: hanya Mati / Muncul
const DUE_WINDOW_MS = 7 * 86400000;                  // notifikasi yang sudah lewat tetap dianggap "belum selesai" sampai 7 hari
const DEFAULTS = {
    finance: { mode: 'normal', time: '20:00' },
    bills: { mode: 'normal', time: '09:00' },       // H-3, H-1, hari-H
    recurring: { mode: 'normal', time: '08:00' },   // H-1 (19:00) & hari-H
    weekly: { mode: 'normal', day: 0, time: '19:00' },
    tugas: { mode: 'normal' },                      // tugas harian
    kuliahTugas: { mode: 'normal' },                // deadline tugas kuliah
    kuliah: { mode: 'normal', minutes: 30 },        // sebelum kuliah mulai
    absen: { mode: 'normal' },                      // setelah kuliah selesai bila belum dicatat
    outfit: { mode: 'normal', time: '18:00' },      // isi Pakaian Hari Ini (Lemari)
    sholat: { mode: 'normal' },                     // 30 menit setelah waktu sholat bila belum dicatat
    popupTugas: { mode: 'normal' },                 // popup tugas hari ini saat aplikasi dibuka
    popupBackup: { mode: 'normal' }                 // popup pengingat jurnal & backup
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
    Object.keys(p).forEach(k => {
        const r = raw[k]; if (!r || typeof r !== 'object') return;
        Object.keys(p[k]).forEach(f => { if (f !== 'mode' && r[f] !== undefined && typeof r[f] === typeof p[k][f]) p[k][f] = r[f]; });
        if (MODES.includes(r.mode)) p[k].mode = r.mode; else if (r.on === false) p[k].mode = 'off';   // migrasi saklar lama: hidup → Biasa, mati → Mati
        if (POPUPS.includes(k) && p[k].mode === 'stay') p[k].mode = 'normal';
    });
    Object.keys(p).forEach(k => { if (p[k].time !== undefined && !hhmm(p[k].time)) p[k].time = DEFAULTS[k].time; });
    p.kuliah.minutes = Math.max(5, Math.min(180, parseInt(p.kuliah.minutes) || 30));
    p.weekly.day = Math.max(0, Math.min(6, parseInt(p.weekly.day) || 0));
    return p;
}

/* data = { paylaters, recurring, transactions, tasks, kuliahTasks, classes, prayer, wardrobe }; now = Date.
   build() → { plan: [{id,key,grp,stay,tc,title,body,at,route,ent}] terurut (yang akan datang), keep: Set id notifikasi yang sudah lewat tapi urusannya BELUM selesai }.
   Satu "urusan" (ent) hanya menyimpan notifikasi terbarunya (mis. tugas: "Besok" diganti "1 jam lagi" lalu "Sekarang"). */
function build(data, prefsIn, now) {
    const P = mergePrefs(prefsIn), out = [], due = [], seen = new Set(), arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const todayISO = iso(now), endISO = addDays(todayISO, HORIZON_DAYS), on = g => P[g].mode !== 'off';
    const push = (grp, key, title, body, when, route, ent) => {
        if (!(when instanceof Date) || isNaN(when) || !on(grp) || seen.has(key)) return;
        if (when <= now) { if (now - when <= DUE_WINDOW_MS) { seen.add(key); due.push({ id: hash(key), ent: ent || key, at: when }); } return; }
        if (iso(when) > endISO) return;
        seen.add(key);
        out.push({ id: hash(key), key, grp, stay: P[grp].mode === 'stay', tc: grp === 'weekly', title, body, at: when, route: route || null, ent: ent || key });
    };

    // 1) Pengingat harian isi keuangan (dilewati hari ini bila sudah ada transaksi hari ini)
    if (on('finance')) {
        const hasToday = arr(data.transactions).some(t => t && !t.isAdjustment && t.tanggal === todayISO);
        for (let i = 0; i <= HORIZON_DAYS; i++) { const d = addDays(todayISO, i); if (i === 0 && hasToday) continue; push('finance', 'fin:' + d, '💸 Catat keuanganmu', 'Sudah catat pemasukan & pengeluaran hari ini?', at(d, P.finance.time), { g: 'keuangan', sub: 'input' }); }
    }

    // 2) Tagihan & cicilan: tiap tanggal jatuh tempo bulanan → H-3, H-1, hari-H
    if (on('bills')) {
        arr(data.paylaters).forEach(p => {
            const day = parseInt(p && p.dueDay); if (!(day >= 1 && day <= 31) || !(p.amount > 0)) return;
            for (let m = 0; m < 3; m++) {
                const y = now.getFullYear(), mo = now.getMonth() + m, last = new Date(y, mo + 1, 0).getDate(), d = new Date(y, mo, Math.min(day, last)), due0 = iso(d);
                [[3, 'H-3'], [1, 'besok'], [0, 'hari ini']].forEach(([b, lbl]) => {
                    push('bills', `bill:${p.id}:${due0}:${b}`, b === 0 ? '⚠️ Tagihan jatuh tempo hari ini' : `📅 Tagihan jatuh tempo ${lbl === 'H-3' ? '3 hari lagi' : 'besok'}`, `${p.name} · sisa ${rp(p.amount)}`, at(addDays(due0, -b), P.bills.time), { g: 'keuangan', sub: 'input' }, `bill:${p.id}:${due0}`);
                });
            }
        });
    }

    // 3) Transaksi otomatis: H-1 (19:00) & hari-H. Selesai saat dieksekusi (nextExecution maju).
    if (on('recurring')) {
        arr(data.recurring).forEach(r => {
            if (!r || r.status === 'paused' || !/^\d{4}-\d{2}-\d{2}$/.test(r.nextExecution || '')) return;
            const label = (r.template && (r.template.keterangan || r.template.kategori)) || 'Transaksi otomatis', amt = r.template ? (r.template.pengeluaran || r.template.pemasukan || 0) : 0;
            const interval = Math.max(1, parseInt(r.interval) || 1); let d = at(r.nextExecution, '12:00'), guard = 0;
            while (iso(d) <= endISO && guard++ < 60) {
                const due0 = iso(d); if (r.endDate && due0 > r.endDate) break;
                const ent = `rec:${r.id}:${due0}`;
                push('recurring', `rec:${r.id}:${due0}:0`, '🔁 Transaksi otomatis hari ini', `${label}${amt ? ' · ' + rp(amt) : ''}`, at(due0, P.recurring.time), { g: 'settings', sub: '' }, ent);
                push('recurring', `rec:${r.id}:${due0}:1`, '🔁 Transaksi otomatis besok', `${label}${amt ? ' · ' + rp(amt) : ''}`, at(addDays(due0, -1), '19:00'), { g: 'settings', sub: '' }, ent);
                if (r.type === 'daily') d.setDate(d.getDate() + interval); else if (r.type === 'weekly') d.setDate(d.getDate() + interval * 7); else if (r.type === 'monthly') d.setMonth(d.getMonth() + interval); else break;
            }
        });
    }

    // 4) Tugas harian: H-1 18:00 · hari-H 08:00 (jika tanpa jam) · 1 jam sebelum & tepat waktu (jika ada jam). Selesai saat dicentang.
    if (on('tugas')) {
        arr(data.tasks).forEach(t => {
            if (!t || t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return;
            const route = { g: 'daily', sub: 'daily-home' }, hi = t.priority === 'high' ? '❗ ' : '', ent = 'task:' + t.id;
            push('tugas', `task:${t.id}:eve`, `${hi}📝 Besok: ${t.title}`, t.time ? `Pukul ${t.time}` : 'Jangan lupa dikerjakan besok', at(addDays(t.date, -1), '18:00'), route, ent);
            if (t.time) {
                const start = at(t.date, t.time);
                push('tugas', `task:${t.id}:1h`, `${hi}⏰ 1 jam lagi: ${t.title}`, `Pukul ${t.time}`, minus(start, 60), route, ent);
                push('tugas', `task:${t.id}:now`, `${hi}⏰ Sekarang: ${t.title}`, `Waktunya sudah tiba (${t.time})`, start, route, ent);
            } else push('tugas', `task:${t.id}:day`, `${hi}📝 Hari ini: ${t.title}`, 'Tugas hari ini belum selesai', at(t.date, '08:00'), route, ent);
        });
    }

    // 5) Deadline tugas kuliah: H-2, H-1 (18:00), 2 jam sebelum deadline. Selesai saat ditandai selesai.
    if (on('kuliahTugas')) {
        arr(data.kuliahTasks).forEach(t => {
            if (!t || t.done || !t.deadline) return;
            const dl = String(t.deadline), dISO = dl.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(dISO)) return;
            const time = hhmm(dl.slice(11, 16)) || '23:59', route = { g: 'kuliah', sub: 'kuliah' }, name = (t.matkul ? t.matkul + ' · ' : '') + t.judul, ent = 'kt:' + t.id;
            push('kuliahTugas', `kt:${t.id}:2d`, '🎓 Deadline 2 hari lagi', name, at(addDays(dISO, -2), '09:00'), route, ent);
            push('kuliahTugas', `kt:${t.id}:1d`, '🎓 Deadline besok', `${name} (${time})`, at(addDays(dISO, -1), '18:00'), route, ent);
            push('kuliahTugas', `kt:${t.id}:2h`, '🚨 Deadline 2 jam lagi', name, minus(at(dISO, time), 120), route, ent);
        });
    }

    // 6) Kuliah: N menit sebelum mulai · 7) absen: tepat saat kuliah selesai bila belum dicatat (selesai saat absen dicatat)
    arr(data.classes).forEach(c => {
        if (!c || !hhmm(c.jamMulai)) return;
        const route = { g: 'kuliah', sub: 'kuliah' }, place = [c.mode === 'online' ? 'Online' : c.lokasi, `${c.jamMulai}${c.jamSelesai ? '–' + c.jamSelesai : ''}`].filter(Boolean).join(' · '), ent = `cls:${c.courseId}:${c.dateISO}`;
        push('kuliah', `cls:${c.courseId}:${c.dateISO}:pre`, `🎓 ${P.kuliah.minutes} menit lagi: ${c.nama}`, place, minus(at(c.dateISO, c.jamMulai), P.kuliah.minutes), route, ent);
        if (hhmm(c.jamSelesai) && !c.recorded) push('absen', `cls:${c.courseId}:${c.dateISO}:abs`, `✍️ Catat absen: ${c.nama}`, 'Kuliah sudah selesai — tandai hadir / tidak hadir', at(c.dateISO, c.jamSelesai), { g: 'kuliah', sub: 'ck-catat' }, ent + ':abs');
    });

    // 7b) Sholat: 30 menit setelah waktu masuk (3 hari ke depan, hari ini dari awal). Selesai saat dicentang.
    if (on('sholat') && data.prayer && data.prayer.loc && window.PrayCalc) {
        const L = data.prayer.loc, names = { subuh: 'Subuh', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
        for (let i = 0; i < 3; i++) {
            const d = addDays(todayISO, i), [y, m, dd] = d.split('-').map(Number), t = PrayCalc.times({ y, m, d: dd }, L.lat, L.lng, L.tz); if (!t) continue;
            const rec = (data.prayer.days && data.prayer.days[d] && data.prayer.days[d].s) || {};
            Object.keys(names).forEach(k => {
                const startMin = PrayCalc.toMin(t[k]), end = PrayCalc.windowEnd(t, k); if (startMin == null || end == null || startMin + 30 >= end || rec[k]) return;
                const when = new Date(at(d, '00:00').getTime() + (startMin + 30) * 60000);
                push('sholat', `sh:${d}:${k}`, `🕌 Sudah sholat ${names[k]}?`, `Waktu ${names[k]} sudah lewat 30 menit. Ketuk untuk mencatat.`, when, { g: 'sholat', sub: 'sh-hari' });
            });
        }
    }

    // 7c) Lemari: isi "Pakaian Hari Ini". Dilewati/dihapus bila outfit hari itu sudah dicatat.
    if (on('outfit') && data.wardrobe && data.wardrobe.count > 0) {
        for (let i = 0; i <= HORIZON_DAYS; i++) { const d = addDays(todayISO, i); if (i === 0 && data.wardrobe.todayN > 0) continue; push('outfit', 'fit:' + d, '👗 Pakai apa hari ini?', 'Catat outfit hari ini di Lemari', at(d, P.outfit.time), { g: 'lemari', sub: 'lm-hari' }); }
    }

    // 8) Laporan mingguan (tidak punya kondisi "selesai": Stay hilang saat diketuk)
    if (on('weekly')) {
        for (let i = 0; i <= HORIZON_DAYS; i++) { const d = addDays(todayISO, i); if (at(d, '12:00').getDay() === P.weekly.day) push('weekly', 'wk:' + d, '📊 Laporan mingguan', 'Lihat ringkasan pemasukan & pengeluaran minggu ini', at(d, P.weekly.time), { g: 'laporan', sub: '' }); }
    }

    out.sort((a, b) => a.at - b.at);
    const latest = new Map(); due.forEach(x => { const c = latest.get(x.ent); if (!c || x.at > c.at) latest.set(x.ent, x); });
    return { plan: out.slice(0, MAX_SCHEDULE), keep: new Set([...latest.values()].map(x => x.id)) };
}
const buildPlan = (data, prefsIn, now) => build(data, prefsIn, now).plan;

const plugin = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) || null;
const isNative = () => !!(window.Capacitor && (Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : Capacitor.getPlatform && Capacitor.getPlatform() !== 'web') && plugin());

App.Notify = {
    buildPlan, build, mergePrefs, DEFAULTS,
    isNative,
    prefs() { try { return mergePrefs(JSON.parse(localStorage.getItem(PREF_KEY) || 'null')); } catch (e) { return mergePrefs(null); } },
    setPref(group, field, value) {
        const p = this.prefs(); if (!p[group] || p[group][field] === undefined) return;
        p[group][field] = value; try { localStorage.setItem(PREF_KEY, JSON.stringify(mergePrefs(p))); } catch (e) { /* abaikan */ }
        this.renderCard(); this.reschedule(0);
    },
    popupOn(key) { return this.prefs()[key].mode !== 'off'; },   // popup di dalam aplikasi: 'popupTugas' | 'popupBackup'
    collect() {
        const st = App.State, mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null, d = mod('daily');
        const pr = mod('prayer'), wd = (window.AppModules && AppModules.api) ? AppModules.api('wardrobe') : null, ws = wd && wd.summary ? wd.summary() : null;
        return {
            wardrobe: ws ? { count: ws.count || 0, todayN: (ws.today || []).length } : null,
            prayer: pr ? { loc: pr.loc, days: pr.days } : null,
            paylaters: st.paylaters, recurring: st.recurring, transactions: st.transactions, tasks: (d && d.tasks) || [],
            kuliahTasks: (window.KuliahPro && KuliahPro.getTasks) ? KuliahPro.getTasks() : [],
            classes: (window.KuliahPro && KuliahPro.upcomingClasses) ? KuliahPro.upcomingClasses(HORIZON_DAYS) : []
        };
    },
    state() { return App.State.isAdmin ? { plan: [], keep: new Set() } : build(this.collect(), this.prefs(), new Date()); }, // akun admin: tanpa pengingat
    plan() { return this.state().plan; },
    _timer: null,
    reschedule(delay) {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._apply().catch(e => console.warn('Jadwal notifikasi gagal:', e)), delay === undefined ? 1500 : delay);
    },
    async _apply() {
        if (!App.State.user || App.State.isLoading) return;
        const LN = plugin(); const st = this.state(), plan = st.plan; this._lastCount = plan.length;
        if (!isNative()) { this.renderCard(); return; }
        const perm = await LN.checkPermissions(); if (perm.display !== 'granted') { this.renderCard(); return; }
        const pend = await LN.getPending(); if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
        if (plan.length) await LN.schedule({ notifications: plan.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, channelId: 'bygf-reminders', ongoing: n.stay, autoCancel: !n.stay, extra: Object.assign({}, n.route || {}, n.stay && n.tc ? { tc: 1 } : {}) })) });
        await this._clean(LN, st.keep);
        this.renderCard();
    },
    // hapus notifikasi yang sudah tampil tapi urusannya selesai (tugas dicentang, absen/outfit/transaksi dicatat, jenisnya dimatikan, dsb.)
    async _clean(LN, keep) {
        try {
            const r = await LN.getDeliveredNotifications(), gone = ((r && r.notifications) || []).filter(n => !keep.has(n.id));
            if (gone.length) await LN.removeDeliveredNotifications({ notifications: gone.map(n => ({ id: n.id, title: n.title, body: n.body })) });
        } catch (e) { /* pembersihan tidak kritis */ }
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
    async openBattery() { const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.BygfNative; if (!N || !N.openBatterySettings) return App.UI.showToast('Hanya di aplikasi Android', 'info'); try { await N.openBatterySettings(); App.UI.showToast('Pilih BYgf lalu "Tidak dibatasi" / "Izinkan" agar pengingat tidak dimatikan sistem', 'info'); } catch (e) { App.UI.showToast('Tidak bisa membuka pengaturan baterai', 'error'); } },
    async openExactSettings() { const LN = plugin(); if (!LN || !LN.changeExactNotificationSetting) return; try { await LN.changeExactNotificationSetting(); } catch (e) { /* abaikan */ } },
    async test() {
        const LN = plugin(); if (!LN) return;
        try { await LN.schedule({ notifications: [{ id: 1, title: '🔔 Tes pengingat BYgf', body: 'Notifikasi berfungsi.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, channelId: 'bygf-reminders' }] }); App.UI.showToast('Notifikasi tes muncul dalam 5 detik — tutup aplikasinya untuk mengetes', 'success'); } catch (e) { App.UI.showToast('Gagal mengirim notifikasi tes', 'error'); }
    },
    _bindTap() {
        const LN = plugin(); if (!LN || this._tapBound) return; this._tapBound = true;
        LN.addListener('localNotificationActionPerformed', ev => {
            const n = ev && ev.notification, r = n && n.extra; if (!r || !r.g) return;
            if (r.tc && n.id != null) LN.removeDeliveredNotifications({ notifications: [{ id: n.id }] }).catch(() => {});   // Stay tanpa kondisi selesai: hilang saat diketuk
            if (r.sub) App.UI._lastSubTab[r.g] = r.sub; App.UI.switchMainGroup(r.g);
        });
    },
    async renderCard() {
        const el = document.getElementById('notifyCard'); if (!el) return;
        const P = this.prefs(), native = isNative(); let perm = '';
        if (native) { try { perm = (await plugin().checkPermissions()).display; } catch (e) { /* abaikan */ } }
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dis = k => P[k].mode === 'off' ? ' disabled' : '';
        const tm = (k, f, lbl) => `<label class="ns-f">${lbl || 'Jam'} <input type="time" class="ns-in" data-nt="${k}.${f}" value="${P[k][f]}"${dis(k)} aria-label="Jam ${k}"></label>`;
        const OPTS = [['off', '🔕', 'Mati'], ['normal', '🔔', 'Biasa'], ['stay', '📌', 'Stay']], POP = [['off', '🔕', 'Mati'], ['normal', '🔔', 'Muncul']];
        const row = (k, icon, label, hint, ctl, popup) => `<div class="ns-row${P[k].mode === 'off' ? ' is-off' : ''}"><div class="ns-main"><span class="ns-ic" aria-hidden="true">${icon}</span><div class="ns-tx"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}${ctl ? `<div class="ns-ctl">${ctl}</div>` : ''}</div></div>
            <div class="ns-seg" role="radiogroup" aria-label="Mode ${label}">${(popup ? POP : OPTS).map(([v, ic, lb]) => `<button type="button" role="radio" aria-checked="${P[k].mode === v}" class="ns-opt${P[k].mode === v ? ' on' : ''}" data-ns="${k}|${v}"><span aria-hidden="true">${ic}</span>${lb}</button>`).join('')}</div></div>`;
        const sec = (icon, title, rows) => `<section class="ns-sec"><h4>${icon} ${title}</h4>${rows}</section>`;
        const stateChip = native ? `<small class="ns-chip ${perm === 'granted' ? 'on' : 'off'}">${perm === 'granted' ? 'Aktif' : 'Belum aktif'}</small>` : '<small class="ns-chip off">Jadwal HP saja</small>';
        el.innerHTML = `<div class="ns-head"><h3>🔔 Notifikasi</h3>${stateChip}</div>
        <p class="ns-legend"><span>🔕 <b>Mati</b></span><span>🔔 <b>Biasa</b> bisa digeser</span><span>📌 <b>Stay</b> hilang setelah selesai</span></p>
        ${native ? `<div class="ns-acts"><button type="button" class="btn btn-primary btn-sm" data-nt-act="enable">${perm === 'granted' ? 'Perbarui jadwal' : 'Aktifkan pengingat'}</button><button type="button" class="btn btn-outline btn-sm" data-nt-act="test">Tes notifikasi</button><button type="button" class="btn btn-outline btn-sm" data-nt-act="exact">⏰ Alarm tepat waktu</button><button type="button" class="btn btn-outline btn-sm" data-nt-act="battery">🔋 Latar belakang</button></div>` : ''}
        ${sec('💰', 'Keuangan',
            row('finance', '💸', 'Catat keuangan harian', 'Hilang saat ada transaksi hari ini', tm('finance', 'time')) +
            row('bills', '📅', 'Tagihan &amp; cicilan', 'H-3, H-1, hari-H · hilang saat lunas', tm('bills', 'time')) +
            row('recurring', '🔁', 'Transaksi otomatis', 'H-1 dan hari-H · hilang saat dijalankan', tm('recurring', 'time')) +
            row('weekly', '📊', 'Laporan mingguan', 'Hilang saat diketuk', `<label class="ns-f">Hari <select class="ns-in" data-nt="weekly.day"${dis('weekly')} aria-label="Hari laporan">${days.map((n, i) => `<option value="${i}" ${P.weekly.day === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${tm('weekly', 'time')}`))}
        ${sec('🎓', 'Tugas &amp; Kuliah',
            row('tugas', '📝', 'Tugas harian', 'H-1, 1 jam sebelum, tepat waktu · hilang saat dicentang') +
            row('kuliahTugas', '🎓', 'Deadline tugas kuliah', 'H-2, H-1, 2 jam · hilang saat selesai') +
            row('kuliah', '⏳', 'Sebelum kuliah mulai', '', `<label class="ns-f"><input type="number" class="ns-in ns-num" min="5" max="180" data-nt="kuliah.minutes" value="${P.kuliah.minutes}"${dis('kuliah')} aria-label="Menit sebelum kuliah"> menit sebelumnya</label>`) +
            row('absen', '✍️', 'Catat absen', 'Saat kuliah selesai · hilang saat absen dicatat'))}
        ${sec('👗', 'Lemari', row('outfit', '👗', 'Isi outfit hari ini', 'Hilang saat Pakaian Hari Ini dicatat', tm('outfit', 'time')))}
        ${sec('🕌', 'Sholat', row('sholat', '🕌', 'Sudah sholat?', '30 menit setelah waktu masuk · hilang saat dicentang'))}
        ${sec('📱', 'Di dalam aplikasi',
            row('popupTugas', '📋', 'Popup tugas hari ini', 'Muncul saat aplikasi dibuka', '', true) +
            row('popupBackup', '🛡️', 'Popup jurnal &amp; backup', 'Muncul saat aplikasi dibuka', '', true))}`;
    },
    _esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    _bindCard() {
        const el = document.getElementById('notifyCard'); if (!el || el._bound) return; el._bound = true;
        el.addEventListener('click', e => { const b = e.target.closest('[data-ns]'); if (!b) return; const [g, m] = b.dataset.ns.split('|'); this.setPref(g, 'mode', m); });
        el.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.nt; if (!k) return; const [g, f] = k.split('.'); let v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' || e.target.tagName === 'SELECT' ? parseInt(e.target.value) : e.target.value; if (e.target.type === 'time' && !hhmm(v)) return; this.setPref(g, f, v); });
        el.addEventListener('click', e => { const b = e.target.closest('[data-nt-act]'); if (!b) return; const a = b.dataset.ntAct; if (a === 'enable') this.enable(); else if (a === 'test') this.test(); else if (a === 'battery') this.openBattery(); else if (a === 'exact') this.openExactSettings(); });
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
