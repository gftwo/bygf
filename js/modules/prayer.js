/* ==========================================================================
   MODUL SHOLAT — jadwal sholat (dihitung di perangkat), checklist harian, sunnah & puasa, qadha,
   rekap bulan/tahun, capaian (streak, lencana, target), dan mode Ramadan.
   Data: AppModules 'prayer' = { v, loc, days, qadha, goals }
   - loc  : { kec, city, prov, lat, lng, tz, own, src }   lokasi sampai kecamatan (tz 7/8/9 = WIB/WITA/WIT)
   - days : { 'YYYY-MM-DD': { s:{subuh:1|2|3,...}, sn:{tahajud:1,...}, pu:0|1|2, tw:0|8|11|20|23, tr:0..604 } }
            s: 1 sendiri, 2 berjamaah, 3 terlewat (masuk qadha); pu: 1 berpuasa, 2 tidak puasa (udzur → qadha puasa)
   - qadha: { init:{subuh:n}, paid:[{d,k}], puInit, puPaid:[tanggal] }
   - goals: { jam, weekFull, weekJam }
   Jadwal: PrayCalc (js/pray-calc.js, metode Kemenag). Daftar kecamatan: js/data/wilayah.js (dimuat saat memilih lokasi).
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'prayer', DATA_VERSION = 3;
    const { esc, iso, today, parse, addDays } = Mx;
    const D = () => AppModules.get(KEY), save = () => AppModules.changed(KEY);
    const root = id => document.getElementById('view-' + id);
    const pad = n => String(n).padStart(2, '0');
    const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const int = (v, d = 0) => { const n = Math.floor(Number(v)); return isFinite(n) ? n : d; };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const toMin = t => PrayCalc.toMin(t);

    const PRAYERS = [['subuh', 'Subuh', '🌙'], ['dzuhur', 'Dzuhur', '☀️'], ['ashar', 'Ashar', '🌤️'], ['maghrib', 'Maghrib', '🌇'], ['isya', 'Isya', '🌌']];
    const SUNNAH = [['tahajud', 'Tahajud', '🌃', 'Sepertiga malam terakhir'], ['witir', 'Witir', '🕯️', 'Setelah Isya sampai Subuh'], ['dhuha', 'Dhuha', '🌅', 'Sekitar 15–20 menit setelah matahari terbit sampai sebelum Dzuhur'], ['rawatib', 'Rawatib', '🤲', 'Sebelum / sesudah sholat wajib']];
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const HIJRI = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Dzulkaidah', 'Dzulhijjah'];
    const REMIND_AFTER = 30, SNOOZE = 15, QURAN_PAGES = 604;
    const HEAT = ['var(--bg-surface-hover)', '#cfe4d8', '#a6d0ba', '#6fb08e', '#3f8f69', '#2f7d5b'];

    // ---------- normalisasi & validasi (data lama tetap terbaca) ----------
    const DEFAULT_LOC = () => ({ kec: 'Menteng', city: 'Kota Jakarta Pusat', prov: 'DKI Jakarta', lat: -6.195, lng: 106.838, tz: 7, own: true, src: 'list' });
    const hasData = o => Object.keys(o.s).length || Object.keys(o.sn).length || o.pu || o.tr || o.tw;
    function normalize(raw) {
        raw = raw && typeof raw === 'object' ? raw : {};
        const l = raw.loc && isFinite(raw.loc.lat) && isFinite(raw.loc.lng) && Math.abs(raw.loc.lat) <= 90 && Math.abs(raw.loc.lng) <= 180 ? raw.loc : null;
        const loc = l ? { kec: String(l.kec || '').slice(0, 80), city: String(l.city || '').slice(0, 80), prov: String(l.prov || '').slice(0, 60), lat: Number(l.lat), lng: Number(l.lng), tz: [7, 8, 9].includes(Number(l.tz)) ? Number(l.tz) : 7, own: l.own !== false, src: l.src === 'gps' ? 'gps' : 'list' } : DEFAULT_LOC();
        const days = {}, rd = raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : {};
        Object.keys(rd).forEach(d => {
            const e = rd[d]; if (!isoOk(d) || !e || typeof e !== 'object') return;
            const o = { s: {}, sn: {}, pu: [1, 2].includes(Number(e.pu)) ? Number(e.pu) : 0, tr: clamp(int(e.tr), 0, QURAN_PAGES), tw: [8, 11, 20, 23].includes(Number(e.tw)) ? Number(e.tw) : 0 };
            PRAYERS.forEach(([k]) => { const v = Number(e.s && e.s[k]); if (v === 1 || v === 2 || v === 3) o.s[k] = v; });
            SUNNAH.forEach(([k]) => { if (e.sn && e.sn[k]) o.sn[k] = 1; });
            if (hasData(o)) days[d] = o;
        });
        const q = raw.qadha && typeof raw.qadha === 'object' ? raw.qadha : {}, init = {};
        PRAYERS.forEach(([k]) => { const n = clamp(int(q.init && q.init[k]), 0, 9999); if (n) init[k] = n; });
        const paid = arr(q.paid).filter(e => e && isoOk(e.d) && PRAYERS.some(p => p[0] === e.k)).map(e => ({ d: e.d, k: e.k })).slice(-3000);
        const puPaid = arr(q.puPaid).filter(isoOk).slice(-500);
        const g = raw.goals && typeof raw.goals === 'object' ? raw.goals : {};
        return { v: DATA_VERSION, loc, days, qadha: { init, paid, puInit: clamp(int(q.puInit), 0, 999), puPaid }, goals: { jam: clamp(int(g.jam, 1), 0, 5), weekFull: clamp(int(g.weekFull, 5), 1, 7), weekJam: clamp(int(g.weekJam, 7), 0, 35) } };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; ['days', 'qadha', 'goals', 'loc'].forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') e.push(`"${k}" tidak valid`); });
        return e.slice(0, 5);
    }

    // ---------- waktu & jadwal ----------
    const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
    const schedCache = {};
    function getSched(date) {
        const L = D().loc, k = [L.lat, L.lng, L.tz, date].join('|');
        if (!schedCache[k]) {
            if (Object.keys(schedCache).length > 400) Object.keys(schedCache).forEach(x => delete schedCache[x]);
            const [y, m, d] = date.split('-').map(Number), t = PrayCalc.times({ y, m, d }, L.lat, L.lng, L.tz);
            schedCache[k] = t ? { st: 'ok', t } : { st: 'err', err: 'Matahari tidak terbit/terbenam normal di lokasi ini' };
        }
        return schedCache[k];
    }
    const fmtT = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m) % 60)}`;
    const fmtDur = m => { m = Math.max(0, Math.floor(m)); const h = Math.floor(m / 60); return h ? `${h}j ${m % 60}m` : `${m}m`; };
    const cdTxt = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
    const fmtDate = s => { const d = parse(s); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
    const fmtShort = s => { const d = parse(s); return `${HARI[d.getDay()].slice(0, 3)}, ${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`; };
    const locLabel = l => l.src === 'gps' ? `GPS · ${l.kec || l.city}` : (l.kec || l.city);
    const locFull = l => [l.kec, l.city, l.prov].filter(Boolean).join(', ');
    const windowEnd = (t, k) => PrayCalc.windowEnd(t, k);

    // ---------- hijriah & puasa sunnah ----------
    let hijriFmt;
    function hijri(date) {
        try {
            hijriFmt = hijriFmt || new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
            const p = hijriFmt.formatToParts(parse(date)), g = t => Number(p.find(x => x.type === t).value);
            return { d: g('day'), m: g('month'), y: g('year') };
        } catch (e) { return null; }
    }
    const hijriTxt = h => h ? `${h.d} ${HIJRI[h.m - 1]} ${h.y} H` : '';
    function puasaInfo(date) {
        const h = hijri(date), dow = parse(date).getDay(), ok = [], no = [];
        if (h) {
            if (h.m === 9) ok.push('Bulan Ramadan — puasa wajib');
            if ((h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13)) no.push(h.m === 10 ? 'Hari Raya Idul Fitri — dilarang berpuasa' : 'Idul Adha / hari Tasyrik — dilarang berpuasa');
            if (h.m === 12 && h.d === 9) ok.push('Puasa Arafah');
            if (h.m === 1 && (h.d === 9 || h.d === 10)) ok.push(h.d === 10 ? 'Puasa Asyura' : "Puasa Tasu'a");
            if (h.m === 10 && h.d >= 2) ok.push('Puasa 6 hari Syawal (boleh di hari ini)');
            if (h.d >= 13 && h.d <= 15 && h.m !== 12) ok.push('Ayyamul Bidh (13–15 Hijriah)');
        }
        if (dow === 1 || dow === 4) ok.push('Puasa sunnah ' + HARI[dow]);
        return { h, ok, no };
    }
    const inRamadan = d => { const h = hijri(d); return !!h && h.m === 9; };
    function ramadanRange(date) {
        const h = hijri(date); if (!h || h.m !== 9) return null;
        const start = addDays(date, -(h.d - 1)); let end = date, len = h.d;
        for (let i = 0; i < 31; i++) { const n = addDays(end, 1), hn = hijri(n); if (!hn || hn.m !== 9) break; end = n; len = hn.d; }
        return { start, end, len, year: h.y };
    }

    // ---------- logika inti (murni terhadap data) ----------
    const isDone = v => v === 1 || v === 2;
    const status = (d, k) => (D().days[d] && D().days[d].s[k]) || 0;
    const doneCount = d => PRAYERS.filter(([k]) => isDone(status(d, k))).length;
    const jamCount = d => PRAYERS.filter(([k]) => status(d, k) === 2).length;
    const fullDay = d => doneCount(d) === 5, jamDay = d => D().goals.jam > 0 && jamCount(d) >= D().goals.jam, subuhDay = d => isDone(status(d, 'subuh'));
    const day = d => D().days[d] || (D().days[d] = { s: {}, sn: {}, pu: 0, tr: 0, tw: 0 });
    const prune = () => { const S = D(); Object.keys(S.days).forEach(d => { if (!hasData(S.days[d])) delete S.days[d]; }); };
    function streakBy(pred) { // cur: beruntun sampai hari ini (atau kemarin bila hari ini belum), best: rekor
        let best = 0, run = 0, prev = null;
        Object.keys(D().days).sort().forEach(d => { if (pred(d)) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; prev = d; best = Math.max(best, run); } });
        let cur = 0, d = today(); if (!pred(d)) d = addDays(d, -1);
        while (pred(d) && cur < 4000) { cur++; d = addDays(d, -1); }
        return { cur, best: Math.max(best, cur) };
    }
    const streak = () => streakBy(fullDay).cur;
    function nextPrayer(t) {
        const n = nowMin();
        for (const [k, nm] of PRAYERS) { const m = toMin(t[k]); if (m > n) return { k, nm, at: m, tomorrow: false }; }
        return { k: 'subuh', nm: 'Subuh', at: toMin(t.subuh) + 1440, tomorrow: true };
    }
    function prevPrayerTime(t) { let p = null; const n = nowMin(); PRAYERS.forEach(([k]) => { const m = toMin(t[k]); if (m <= n) p = m; }); return p; }
    const snooze = {}; // 'tanggal|waktu' -> menit sampai kapan ditunda (hanya sesi ini)
    function pendingReminders() {
        const date = today(), s = getSched(date); if (s.st !== 'ok') return [];
        const n = nowMin(), out = [];
        PRAYERS.forEach(([k, nm]) => {
            const at = toMin(s.t[k]), end = windowEnd(s.t, k);
            if (status(date, k) > 0 || n < at + REMIND_AFTER || n >= end) return;
            if ((snooze[date + '|' + k] || 0) > n) return;
            out.push({ k, nm, at });
        });
        return out.slice(-2);
    }
    // qadha
    const missed3 = k => Object.keys(D().days).filter(d => D().days[d].s[k] === 3).length;
    const paidOf = k => D().qadha.paid.filter(e => e.k === k).length;
    const qBal = k => Math.max(0, (D().qadha.init[k] || 0) + missed3(k) - paidOf(k));
    const qTotal = () => PRAYERS.reduce((n, [k]) => n + qBal(k), 0);
    const puMissed = () => Object.keys(D().days).filter(d => D().days[d].pu === 2).length;
    const puBal = () => Math.max(0, D().qadha.puInit + puMissed() - D().qadha.puPaid.length);
    // pola terlewat (hanya hari yang sudah ada catatan sholatnya)
    function patterns() {
        const t = today(), per = {}, dw = Array.from({ length: 7 }, () => ({ miss: 0, total: 0 }));
        PRAYERS.forEach(([k]) => { per[k] = { miss: 0, total: 0, jam: 0, done: 0 }; });
        Object.keys(D().days).forEach(d => {
            if (d > t || !Object.keys(D().days[d].s).length) return;
            PRAYERS.forEach(([k]) => {
                const v = status(d, k); if (d === t && v === 0) return;
                per[k].total++; dw[parse(d).getDay()].total++;
                if (v === 2) { per[k].jam++; per[k].done++; } else if (v === 1) per[k].done++; else { per[k].miss++; dw[parse(d).getDay()].miss++; }
            });
        });
        return { per, dw };
    }
    function weekInfo() {
        const t = today(), dow = (parse(t).getDay() + 6) % 7, start = addDays(t, -dow), days = [];
        for (let i = 0; i < 7; i++) { const d = addDays(start, i); days.push({ d, c: doneCount(d), j: jamCount(d), fut: d > t }); }
        return { days, full: days.filter(x => x.c === 5).length, jam: days.reduce((n, x) => n + x.j, 0), total: days.reduce((n, x) => n + x.c, 0) };
    }
    function badges() {
        const all = Object.keys(D().days), total = all.reduce((n, d) => n + doneCount(d), 0), jamT = all.reduce((n, d) => n + jamCount(d), 0), perfect = all.filter(fullDay).length;
        const f = streakBy(fullDay).best, j = streakBy(jamDay).best, sb = streakBy(subuhDay).best, every = (n, x) => `${Math.min(n, x)}/${x}`;
        const qEver = Object.values(D().qadha.init).reduce((a, b) => a + b, 0) + PRAYERS.reduce((n, [k]) => n + missed3(k), 0);
        return [
            { ic: '🌱', nm: 'Hari pertama 5/5', ok: perfect >= 1, p: every(perfect, 1) }, { ic: '🔥', nm: '3 hari 5/5 beruntun', ok: f >= 3, p: every(f, 3) },
            { ic: '⭐', nm: 'Seminggu penuh', ok: f >= 7, p: every(f, 7) }, { ic: '🏆', nm: '30 hari 5/5 beruntun', ok: f >= 30, p: every(f, 30) }, { ic: '👑', nm: '100 hari 5/5 beruntun', ok: f >= 100, p: every(f, 100) },
            { ic: '🕌', nm: '7 hari berjamaah beruntun', ok: j >= 7, p: every(j, 7) }, { ic: '🤲', nm: '30 hari berjamaah beruntun', ok: j >= 30, p: every(j, 30) },
            { ic: '🌙', nm: 'Subuh 7 hari beruntun', ok: sb >= 7, p: every(sb, 7) }, { ic: '🌅', nm: 'Subuh 30 hari beruntun', ok: sb >= 30, p: every(sb, 30) },
            { ic: '📿', nm: '100 sholat tercatat', ok: total >= 100, p: every(total, 100) }, { ic: '📖', nm: '500 sholat tercatat', ok: total >= 500, p: every(total, 500) }, { ic: '🕋', nm: '1000 sholat tercatat', ok: total >= 1000, p: every(total, 1000) },
            { ic: '🤝', nm: '50× berjamaah', ok: jamT >= 50, p: every(jamT, 50) }, { ic: '🫶', nm: '200× berjamaah', ok: jamT >= 200, p: every(jamT, 200) },
            { ic: '⚖️', nm: 'Qadha lunas', ok: qEver > 0 && qTotal() === 0, p: qEver ? `sisa ${qTotal()}` : 'belum ada utang' }
        ];
    }
    function ramCount() {
        const t = today(), s = getSched(t); if (s.st !== 'ok') return null;
        const n = nowMin(), im = toMin(s.t.imsak), mg = toMin(s.t.maghrib);
        if (n < im) return { lbl: 'Menuju imsak', at: im };
        if (n < mg) return { lbl: 'Menuju berbuka', at: mg };
        const s2 = getSched(addDays(t, 1)); return { lbl: 'Menuju imsak besok', at: (s2.st === 'ok' ? toMin(s2.t.imsak) : im) + 1440 };
    }
    function summary(date) {
        date = date || today(); const e = D().days[date] || { s: {}, sn: {}, pu: 0, tr: 0, tw: 0 };
        return { date, done: doneCount(date), jamaah: jamCount(date), missed: PRAYERS.filter(([k]) => status(date, k) === 3).length, sunnah: Object.keys(e.sn), puasa: e.pu, tarawih: e.tw, tadarusHalaman: e.tr,
            streak: { full: streakBy(fullDay).cur, jamaah: streakBy(jamDay).cur }, qadhaSholat: qTotal(), qadhaPuasa: puBal() };
    }
    function bybiLine() {
        const t = today(), n = doneCount(t), st = streak(), s = getSched(t);
        if (s.st !== 'ok') return 'Semangat sholatnya ya!';
        const pend = pendingReminders()[0], np = nextPrayer(s.t);
        if (n === 5) return `Alhamdulillah, 5/5 hari ini!${st > 1 ? ' ' + st + ' hari beruntun 🔥' : ''}`;
        if (pend) return `${pend.nm} sudah lewat nih, sudah sholat belum? 🙏`;
        if (st >= 3) return `${st} hari beruntun, jaga terus ya! Berikutnya ${np.nm} pukul ${fmtT(np.at)}.`;
        return `Berikutnya ${np.nm} pukul ${fmtT(np.at)}. Yuk siap-siap!`;
    }
    function homeInfo() { // dipakai kartu Beranda
        const t = today(), s = getSched(t), ok = s.st === 'ok', np = ok ? nextPrayer(s.t) : null;
        return { ok, next: np && { nm: np.nm, time: fmtT(np.at), tomorrow: np.tomorrow }, done: doneCount(t), streak: streak(), pending: ok ? pendingReminders().map(r => r.nm) : [], line: bybiLine(), ramadan: inRamadan(t) };
    }

    // ---------- state tampilan ----------
    const ui = { date: today(), month: today().slice(0, 7), year: +today().slice(0, 4) };
    const VIEWS = { 'sh-hari': renderHari, 'sh-ramadan': renderRamadan, 'sh-sunnah': renderSunnah, 'sh-qadha': renderQadha, 'sh-rekap': renderRekap, 'sh-capaian': renderCapaian };
    let current = 'sh-hari', lastDay = today(), lastMin = -1, lastRemKey = '';
    const isActive = v => { const r = root(v); return !!(r && r.classList.contains('active')); };
    const rerender = () => { const f = VIEWS[current]; if (f && root(current)) { withFocus(f); updateBadge(); } };
    function withFocus(fn) { // render ulang tanpa kehilangan fokus tombol
        const r = root(current), a = document.activeElement; let key = null;
        if (a && r && r.contains(a) && a.dataset && a.dataset.act) key = [a.dataset.act, a.dataset.k || '', a.dataset.v || '', a.dataset.g || '', a.dataset.d || ''];
        fn();
        if (key) { const q = `[data-act="${key[0]}"]` + (key[1] ? `[data-k="${key[1]}"]` : '') + (key[2] ? `[data-v="${key[2]}"]` : '') + (key[3] ? `[data-g="${key[3]}"]` : '') + (key[4] ? `[data-d="${key[4]}"]` : ''); const el = r.querySelector(q); if (el && !el.disabled) el.focus(); }
    }
    function updateBadge() { // titik merah di menu bila ada sholat yang belum dicatat setelah H+30
        let n = 0; try { n = D().loc && !App.State.isAdmin ? pendingReminders().length : 0; } catch (e) { n = 0; }
        const b = document.getElementById('shNavBadge'); if (b) { b.textContent = n ? String(n) : ''; b.classList.toggle('show', n > 0); }
    }

    // ---------- bagian tampilan bersama ----------
    const head = title => `<div class="mx-head"><div><h2>${title}</h2></div><button type="button" class="mx-btn mx-btn-sm sh-city" data-act="city" aria-label="Ganti lokasi">📍 ${esc(locLabel(D().loc))}</button></div>`;
    function dateNav() {
        const t = today(), h = hijri(ui.date);
        return `<div class="sh-datenav"><button class="mx-btn mx-btn-sm" type="button" data-act="prev" aria-label="Hari sebelumnya">‹</button><div class="sh-mid"><b>${ui.date === t ? 'Hari ini · ' : ''}${fmtDate(ui.date)}</b><span class="mx-muted mx-xs">${esc(hijriTxt(h))}</span></div><button class="mx-btn mx-btn-sm" type="button" data-act="next" aria-label="Hari berikutnya"${ui.date >= t ? ' disabled' : ''}>›</button>${ui.date !== t ? '<button class="mx-btn mx-btn-sm" type="button" data-act="today">Hari ini</button>' : ''}</div>`;
    }
    const stat = items => `<div class="sh-stat">${items.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b>${c ? `<span>${c}</span>` : ''}</div>`).join('')}</div>`;

    // ---------- Hari Ini ----------
    function reminderHTML() {
        return pendingReminders().map(r => `<div class="sh-remind" role="alert"><b>🔔 Sudah sholat ${esc(r.nm)}?</b><span class="mx-xs">Waktu ${esc(r.nm)} sudah lewat ${Math.floor(nowMin() - r.at)} menit (pukul ${fmtT(r.at)}).</span><div class="mx-row"><button class="mx-btn mx-btn-sm mx-btn-primary" type="button" data-act="rm-done" data-k="${r.k}">✓ Sudah</button><button class="mx-btn mx-btn-sm" type="button" data-act="rm-jam" data-k="${r.k}">🕌 Sudah, berjamaah</button><button class="mx-btn mx-btn-sm" type="button" data-act="rm-later" data-k="${r.k}">Ingatkan ${SNOOZE} menit lagi</button></div></div>`).join('');
    }
    function nextHTML(t) {
        const np = nextPrayer(t), prev = prevPrayerTime(t), left = Math.max(0, Math.round((np.at - nowMin()) * 60));
        const span = prev != null && !np.tomorrow ? np.at - prev : null, pc = span ? clamp((nowMin() - prev) / span * 100, 0, 100) : 0;
        return `<div class="sh-next" role="timer" aria-live="off"><div class="sh-lbl">Menuju ${esc(np.nm)}${np.tomorrow ? ' (besok, perkiraan)' : ''} · ${fmtT(np.at)}</div><div class="sh-big" id="shCd">${cdTxt(left)}</div><div class="sh-sub">📍 ${esc(locFull(D().loc))}</div><div class="sh-bar"><i id="shBar" style="width:${pc}%"></i></div></div>`;
    }
    function renderHari() {
        const r = root('sh-hari'), isToday = ui.date === today(), s = getSched(ui.date), t = s.st === 'ok' ? s.t : null;
        let h = head('Sholat') + dateNav();
        if (isToday) {
            h += t ? nextHTML(t) : `<div class="sh-err" role="alert">${esc(s.err)}</div>`;
            h += `<div id="shRemind">${t ? reminderHTML() : ''}</div>`;
            if (!D().loc.own) h += `<p class="mx-muted mx-xs sh-gap">Jadwal memakai titik pusat ${esc(D().loc.city)}.</p>`;
        }
        h += stat([['Hari ini', `${doneCount(ui.date)}/5`], ['Beruntun', `${streak()} hari`], ['Berjamaah', jamCount(ui.date)]]);
        const nowM = nowMin();
        h += `<div class="mx-card"><h3 class="mx-h3">Sholat wajib</h3>${PRAYERS.map(([k, nm, ic]) => {
            const tm = t ? t[k] : null, endM = t ? windowEnd(t, k) : null, startM = t ? toMin(tm) : null, v = status(ui.date, k);
            const locked = isToday && t && startM > nowM, ended = isToday && t && nowM >= endM, curr = isToday && t && startM <= nowM && nowM < endM;
            const canMiss = !locked && (!isToday || ended);
            const label = nm === 'Dzuhur' && parse(ui.date).getDay() === 5 ? 'Dzuhur (Jumat)' : nm;
            let sub = tm ? `${esc(tm)} – ${fmtT(endM)}` : '—';
            if (locked) sub += ' 🔒'; else if (curr) sub += `<br>sisa <b>${fmtDur(endM - nowM)}</b>`; else if (isToday && ended && v === 0) sub += '<br><span class="sh-late">⚠ waktu habis</span>';
            if (v === 3) sub += '<br><span class="sh-late">qadha</span>';
            const b = (val, txt, extra = '') => `<button type="button" class="${extra}${v === val ? ' on' + val : ''}" data-act="set" data-k="${k}" data-v="${val}" aria-pressed="${v === val}"${(val === 3 ? !canMiss : locked) ? ' disabled' : ''}${val === 3 ? ' aria-label="Terlewat, perlu diqadha" title="Terlewat (qadha)"' : ''}>${txt}</button>`;
            return `<div class="sh-pr${curr ? ' cur' : ''}"><span class="sh-ic" aria-hidden="true">${ic}</span><div><div class="sh-nm">${label}${curr ? ' <span class="mx-xs mx-muted">· sekarang</span>' : ''}</div><div class="sh-tm">${sub}</div></div>
                <div class="sh-seg" role="group" aria-label="Status ${nm}">${b(0, 'Belum')}${b(1, 'Sendiri')}${b(2, 'Jamaah')}${b(3, '✗', 'x')}</div></div>`;
        }).join('')}
        ${t ? `<div class="sh-info"><span>🌅 Imsak <b>${esc(t.imsak)}</b></span><span>☀️ Terbit <b>${esc(t.terbit)}</b></span><span>🌄 Dhuha <b>${esc(t.dhuha)}</b></span></div>` : ''}</div>
        <p class="mx-muted mx-xs">✗ = terlewat, masuk daftar Qadha.</p>`;
        r.innerHTML = h;
    }

    // ---------- Sunnah & Puasa ----------
    function renderSunnah() {
        const r = root('sh-sunnah'), e = D().days[ui.date] || { sn: {}, pu: 0 }, info = puasaInfo(ui.date);
        let h = head('Sunnah & Puasa') + dateNav();
        info.no.forEach(x => { h += `<div class="sh-note no">⛔ ${esc(x)}</div>`; });
        info.ok.forEach(x => { h += `<div class="sh-note">🌿 ${esc(x)}</div>`; });
        h += `<div class="mx-card"><h3 class="mx-h3">Sholat sunnah</h3>${SUNNAH.map(([k, nm, ic, desc]) => `<div class="sh-sn"><span class="sh-emo" aria-hidden="true">${ic}</span><div class="sh-grow"><b>${nm}</b><small>${desc}</small></div><button type="button" class="sh-tg" role="switch" aria-checked="${!!(e.sn && e.sn[k])}" aria-label="${nm}" data-act="sn" data-k="${k}"></button></div>`).join('')}</div>`;
        h += `<div class="mx-card"><h3 class="mx-h3">Puasa</h3><div class="sh-sn"><span class="sh-emo" aria-hidden="true">🍃</span><div class="sh-grow"><b>Berpuasa hari ini</b>${info.ok.length ? `<small>${esc(info.ok.join(' · '))}</small>` : ''}</div><button type="button" class="sh-tg" role="switch" aria-checked="${e.pu === 1}" aria-label="Berpuasa hari ini" data-act="pu"></button></div></div>`;
        r.innerHTML = h;
    }

    // ---------- Qadha ----------
    function renderQadha() {
        const S = D(), r = root('sh-qadha');
        const rows = PRAYERS.map(([k, nm, ic]) => `<div class="sh-pr q"><span class="sh-ic" aria-hidden="true">${ic}</span><div><div class="sh-nm">${nm}</div><div class="sh-tm">Utang <b>${qBal(k)}</b> · terlewat ${missed3(k)}${S.qadha.init[k] ? ` · awal ${S.qadha.init[k]}` : ''} · diqadha ${paidOf(k)}</div></div><div class="mx-row sh-nowrap"><button class="mx-btn mx-btn-sm mx-btn-primary" type="button" data-act="qpay" data-k="${k}"${qBal(k) ? '' : ' disabled'}>+ Qadha</button><button class="mx-btn mx-btn-sm" type="button" data-act="qundo" data-k="${k}"${paidOf(k) ? '' : ' disabled'} aria-label="Batalkan qadha ${nm} terakhir">↩</button></div></div>`).join('');
        const missedList = []; Object.keys(S.days).sort().reverse().forEach(d => PRAYERS.forEach(([k, nm]) => { if (S.days[d].s[k] === 3) missedList.push([d, nm]); }));
        const paid = S.qadha.paid.slice().reverse().slice(0, 8);
        r.innerHTML = head('Qadha') + stat([['Utang sholat', qTotal()], ['Utang puasa', puBal()], ['Sudah diqadha', S.qadha.paid.length + S.qadha.puPaid.length]]) +
            `<div class="mx-card"><h3 class="mx-h3">Qadha sholat</h3>${rows}
            <details class="sh-fold"><summary><b>Atur utang awal</b> (sholat yang dulu terlewat)</summary><div class="mx-row sh-init">${PRAYERS.map(([k, nm]) => `<label class="mx-xs">${nm}<input class="mx-input" type="number" min="0" max="9999" id="shQi-${k}" value="${S.qadha.init[k] || 0}"></label>`).join('')}<label class="mx-xs">Puasa<input class="mx-input" type="number" min="0" max="999" id="shQi-pu" value="${S.qadha.puInit}"></label></div><button class="mx-btn mx-btn-sm mx-btn-primary" type="button" data-act="qinit">Simpan utang awal</button></details></div>
            <div class="mx-card"><h3 class="mx-h3">Qadha puasa</h3><div class="mx-row"><span>Sisa utang puasa</span><b class="sh-push">${puBal()} hari</b></div><div class="mx-row sh-gap"><button class="mx-btn mx-btn-sm mx-btn-primary" type="button" data-act="qpupay"${puBal() ? '' : ' disabled'}>+ Puasa qadha hari ini</button><button class="mx-btn mx-btn-sm" type="button" data-act="qpuundo"${S.qadha.puPaid.length ? '' : ' disabled'}>↩ Batalkan terakhir</button></div></div>
            <div class="mx-card"><h3 class="mx-h3">Terlewat yang tercatat</h3>${missedList.length ? missedList.slice(0, 12).map(([d, nm]) => `<div class="sh-sn"><div class="sh-grow"><b>${nm}</b><small>${fmtShort(d)}</small></div><button class="mx-btn mx-btn-sm" type="button" data-act="godate" data-d="${d}">Buka</button></div>`).join('') : Mx.empty('✅', 'Belum ada sholat yang ditandai terlewat')}</div>
            ${paid.length ? `<div class="mx-card"><h3 class="mx-h3">Riwayat qadha</h3>${paid.map(e => `<div class="mx-row mx-xs"><span>${fmtShort(e.d)}</span><b class="sh-push">${PRAYERS.find(p => p[0] === e.k)[1]}</b></div>`).join('')}</div>` : ''}`;
    }

    // ---------- Rekap (bulan + tahun) ----------
    function yearGrid(y) {
        const t = today(), lead = (parse(`${y}-01-01`).getDay() + 6) % 7, n = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365, cells = [], months = [];
        for (let i = 0; i < n; i++) { const d = addDays(`${y}-01-01`, i); cells.push({ d, c: doneCount(d), fut: d > t }); if (d.endsWith('-01')) months.push({ m: +d.slice(5, 7) - 1, col: Math.floor((lead + i) / 7) }); }
        return { cells, lead, months, cols: Math.floor((lead + n - 1) / 7) + 1 };
    }
    function yearStats(y) {
        const g = yearGrid(y); let total = 0, jam = 0, perfect = 0, el = 0; const per = Array(12).fill(0), pd = Array(12).fill(0);
        g.cells.forEach(c => { if (c.fut) return; el++; total += c.c; jam += jamCount(c.d); if (c.c === 5) perfect++; const m = +c.d.slice(5, 7) - 1; per[m] += c.c; pd[m]++; });
        let best = 0, run = 0, prev = null; g.cells.forEach(c => { if (!c.fut && c.c === 5) { run = prev && addDays(prev, 1) === c.d ? run + 1 : 1; prev = c.d; best = Math.max(best, run); } });
        return { total, jam, perfect, el, best, pct: el ? Math.round(total / (el * 5) * 100) : 0, jamPct: total ? Math.round(jam / total * 100) : 0, month: per.map((v, i) => pd[i] ? Math.round(v / (pd[i] * 5) * 100) : null) };
    }
    const legend = () => `<div class="sh-legend">Sedikit ${HEAT.map(c => `<i style="background:${c}"></i>`).join('')} 5/5</div>`;
    function heatHTML(y) {
        const g = yearGrid(y), blanks = Array.from({ length: g.lead }, () => '<i class="b"></i>').join('');
        return `<div class="sh-hmw"><div class="sh-hml" aria-hidden="true">${g.months.map(m => `<span style="grid-column:${m.col + 1}">${BULAN[m.m].slice(0, 3)}</span>`).join('')}</div><div class="sh-hm" role="img" aria-label="Peta panas sholat tahun ${y}">${blanks}${g.cells.map(c => `<i class="${c.c ? 'l' + c.c : ''}${c.fut ? ' f' : ''}" title="${fmtDate(c.d)}: ${c.c}/5"></i>`).join('')}</div></div>`;
    }
    function renderRekap() {
        const [y, m] = ui.month.split('-').map(Number), dim = new Date(y, m, 0).getDate(), t = today(), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7, cells = [];
        for (let i = 0; i < lead; i++) cells.push('<span></span>');
        let total = 0, jam = 0, perfect = 0, elapsed = 0, sun = 0, pu = 0;
        for (let d = 1; d <= dim; d++) {
            const ds = `${y}-${pad(m)}-${pad(d)}`, fut = ds > t, c = doneCount(ds), e = D().days[ds];
            if (!fut) { elapsed++; total += c; jam += jamCount(ds); if (c === 5) perfect++; if (e) { sun += Object.keys(e.sn).length; pu += e.pu === 1 ? 1 : 0; } }
            cells.push(`<span class="sh-d${c ? ' l' + c : ''}${fut ? ' fut' : ''}${ds === t ? ' now' : ''}" title="${fmtDate(ds)}: ${c}/5" role="img" aria-label="${d} ${BULAN[m - 1]}: ${c} dari 5">${d}</span>`);
        }
        const pct = elapsed ? Math.round(total / (elapsed * 5) * 100) : 0, ys = yearStats(ui.year);
        root('sh-rekap').innerHTML = head('Rekap') + `<div class="mx-card"><div class="sh-datenav"><button class="mx-btn mx-btn-sm" type="button" data-act="mprev" aria-label="Bulan sebelumnya">‹</button><div class="sh-mid"><b>${BULAN[m - 1]} ${y}</b></div><button class="mx-btn mx-btn-sm" type="button" data-act="mnext" aria-label="Bulan berikutnya"${ui.month >= t.slice(0, 7) ? ' disabled' : ''}>›</button></div>
            <div class="sh-cal">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => `<span class="sh-h">${x}</span>`).join('')}${cells.join('')}</div>${legend()}</div>` +
            stat([['Terlaksana', pct + '%'], ['Hari 5/5', perfect], ['Berjamaah', jam]]) +
            `<div class="mx-card"><div class="mx-row"><span>Total sholat wajib</span><b class="sh-push">${total} dari ${elapsed * 5}</b></div><div class="mx-row"><span>Sholat sunnah dicatat</span><b class="sh-push">${sun}×</b></div><div class="mx-row"><span>Hari berpuasa</span><b class="sh-push">${pu}</b></div><div class="mx-row"><span>Beruntun saat ini</span><b class="sh-push">${streak()} hari</b></div></div>
            <div class="mx-card"><div class="sh-datenav"><button class="mx-btn mx-btn-sm" type="button" data-act="yprev" aria-label="Tahun sebelumnya">‹</button><div class="sh-mid"><b>Setahun ${ui.year}</b></div><button class="mx-btn mx-btn-sm" type="button" data-act="ynext" aria-label="Tahun berikutnya"${ui.year >= +t.slice(0, 4) ? ' disabled' : ''}>›</button></div>
            ${heatHTML(ui.year)}${legend()}
            ${stat([['Terlaksana', ys.pct + '%'], ['Hari 5/5', ys.perfect], ['Beruntun terbaik', ys.best]]).replace('class="sh-stat"', 'class="sh-stat sh-gap"')}
            <div class="sh-bars"><div class="mx-xs mx-muted"><b>Capaian per bulan</b></div>${ys.month.map((v, i) => v == null ? '' : `<div class="sh-br"><span>${BULAN[i].slice(0, 3)}</span><div class="sh-tr"><i class="g" style="width:${v}%"></i></div><b>${v}%</b></div>`).join('')}</div>
            <div class="mx-row sh-gap"><span class="mx-xs">Berjamaah <b>${ys.jamPct}%</b> dari sholat tercatat (${ys.jam}×)</span><button class="mx-btn mx-btn-sm mx-btn-primary sh-push" type="button" data-act="export">🖼️ Simpan sebagai gambar</button></div></div>`;
    }

    // ---------- Capaian ----------
    function renderCapaian() {
        const w = weekInfo(), sf = streakBy(fullDay), sj = streakBy(jamDay), pt = patterns(), bs = badges(), g = D().goals;
        const stp = (key, val, min, max, label) => `<div class="mx-row sh-stprow"><span class="mx-xs">${label}</span><span class="sh-stp"><button class="mx-btn mx-btn-sm" type="button" data-act="goal" data-g="${key}" data-d="-1" aria-label="Kurangi ${label}"${val <= min ? ' disabled' : ''}>−</button><b>${val}</b><button class="mx-btn mx-btn-sm" type="button" data-act="goal" data-g="${key}" data-d="1" aria-label="Tambah ${label}"${val >= max ? ' disabled' : ''}>+</button></span></div>`;
        const rate = k => { const p = pt.per[k]; return p.total ? Math.round(p.miss / p.total * 100) : null; };
        const rated = PRAYERS.map(([k, nm]) => ({ k, nm, r: rate(k), n: pt.per[k].total })).filter(x => x.r != null);
        const worst = rated.slice().sort((a, b) => b.r - a.r)[0];
        const dwR = pt.dw.map((x, i) => ({ i, r: x.total >= 5 ? Math.round(x.miss / x.total * 100) : null })).filter(x => x.r != null), worstD = dwR.slice().sort((a, b) => b.r - a.r)[0];
        const insight = worst && worst.r > 0 ? `💡 <b>${worst.nm}</b> paling sering terlewat (${worst.r}% dari ${worst.n} catatan).${worstD && worstD.r > 0 ? ` Hari terlemahmu: <b>${HARI[worstD.i]}</b> (${worstD.r}% terlewat).` : ''}` : (rated.length ? '💡 Belum ada pola terlewat. Pertahankan!' : '💡 Pola akan muncul setelah beberapa hari tercatat.');
        const wmax = (parse(today()).getDay() + 6) % 7;
        root('sh-capaian').innerHTML = head('Capaian') + stat([['Beruntun 5/5', sf.cur, `rekor ${sf.best}`], ['Beruntun jamaah', sj.cur, `rekor ${sj.best}`], ['Minggu ini', `${w.total}/35`, 'sholat']]) +
            `<div class="mx-card"><h3 class="mx-h3">Target mingguan</h3><div class="sh-wk">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => `<div>${x}</div>`).join('')}${w.days.map((x, i) => `<span class="sh-d${x.c ? ' l' + x.c : ''}${x.fut ? ' fut' : ''}${i === wmax ? ' now' : ''}" title="${fmtDate(x.d)}: ${x.c}/5, ${x.j} jamaah">${x.c}</span>`).join('')}</div>
            <div class="mx-row mx-xs"><span>Hari 5/5</span><b class="sh-push">${w.full} / ${g.weekFull}</b></div><div class="sh-prog"><i style="width:${Math.min(100, w.full / g.weekFull * 100)}%"></i></div>
            <div class="mx-row mx-xs"><span>Sholat berjamaah</span><b class="sh-push">${w.jam} / ${g.weekJam}</b></div><div class="sh-prog"><i style="width:${g.weekJam ? Math.min(100, w.jam / g.weekJam * 100) : 100}%"></i></div>
            <details class="sh-fold"><summary><b>Atur target</b></summary>${stp('weekFull', g.weekFull, 1, 7, 'Target hari 5/5 per minggu')}${stp('weekJam', g.weekJam, 0, 35, 'Target berjamaah per minggu')}${stp('jam', g.jam, 0, 5, 'Berjamaah per hari (untuk streak jamaah)')}</details></div>
            <div class="mx-card"><h3 class="mx-h3">Pola sholat terlewat</h3><div class="sh-insight">${insight}</div>
            ${rated.length ? `<div class="sh-bars"><div class="mx-xs mx-muted"><b>Terlewat per waktu</b></div>${rated.map(x => `<div class="sh-br"><span>${x.nm}</span><div class="sh-tr"><i style="width:${x.r}%"></i></div><b>${x.r}%</b></div>`).join('')}</div>
            <div class="sh-bars sh-gap"><div class="mx-xs mx-muted"><b>Berjamaah per waktu</b></div>${PRAYERS.map(([k, nm]) => { const p = pt.per[k], v = p.done ? Math.round(p.jam / p.done * 100) : 0; return `<div class="sh-br"><span>${nm}</span><div class="sh-tr"><i class="g" style="width:${v}%"></i></div><b>${v}%</b></div>`; }).join('')}</div>
            ${dwR.length ? `<div class="sh-bars sh-gap"><div class="mx-xs mx-muted"><b>Terlewat per hari</b> (minimal 5 catatan)</div>${dwR.map(x => `<div class="sh-br"><span>${HARI[x.i]}</span><div class="sh-tr"><i style="width:${x.r}%"></i></div><b>${x.r}%</b></div>`).join('')}</div>` : ''}` : ''}</div>
            <div class="mx-card"><h3 class="mx-h3">Lencana (${bs.filter(b => b.ok).length}/${bs.length})</h3><div class="sh-badges">${bs.map(b => `<div class="sh-bdg ${b.ok ? 'ok' : 'lock'}"><span class="sh-e" aria-hidden="true">${b.ic}</span><b>${esc(b.nm)}</b><span>${b.ok ? '✓ tercapai' : esc(b.p)}</span></div>`).join('')}</div></div>`;
    }

    // ---------- Ramadan ----------
    function renderRamadan() {
        const r = root('sh-ramadan'), rg = ramadanRange(ui.date), tdy = today();
        if (!rg) { r.innerHTML = head('Ramadan') + `<div class="mx-card">${Mx.empty('🌙', 'Bukan bulan Ramadan', 'Tab ini aktif otomatis saat Ramadan.')}<div class="sh-center"><button class="mx-btn mx-btn-sm" type="button" data-act="today">Kembali ke hari ini</button></div></div>`; return; }
        const e = D().days[ui.date] || { pu: 0, tw: 0, tr: 0 }, dn = hijri(ui.date).d;
        const range = Array.from({ length: rg.len }, (_, i) => addDays(rg.start, i));
        const sum = range.reduce((a, d) => { const x = D().days[d]; if (x) { if (x.pu === 1) a.pu++; if (x.pu === 2) a.ud++; if (x.tw) a.tw++; a.tr += x.tr; } return a; }, { pu: 0, ud: 0, tw: 0, tr: 0 });
        const passed = range.filter(d => d <= tdy).length, remainDays = Math.max(1, range.filter(d => d > tdy).length), need = Math.max(0, Math.ceil((QURAN_PAGES - sum.tr) / remainDays));
        const rc = ui.date === tdy ? ramCount() : null, st = getSched(ui.date), t = st.st === 'ok' ? st.t : null;
        let h = head('Ramadan') + dateNav() + `<div class="sh-next"><div class="sh-lbl">Ramadan ${rg.year} H · hari ke-${dn} dari ${rg.len}</div>${rc ? `<div class="sh-sub" id="shRlbl">${rc.lbl} · ${fmtT(rc.at)}</div><div class="sh-big" id="shRcd">${cdTxt(Math.max(0, Math.round((rc.at - nowMin()) * 60)))}</div>` : `<div class="sh-big sh-small">Imsak ${t ? esc(t.imsak) : '—'} · Berbuka ${t ? esc(t.maghrib) : '—'}</div>`}<div class="sh-sub">📍 ${esc(locFull(D().loc))}</div></div>`;
        h += stat([['Puasa', sum.pu, `dari ${passed} hari`], ['Tarawih', sum.tw, 'malam'], ['Tadarus', sum.tr, `/ ${QURAN_PAGES} hlm`]]);
        h += `<div class="mx-card"><h3 class="mx-h3">Catatan ${ui.date === tdy ? 'hari ini' : fmtShort(ui.date)}</h3>
            <div class="sh-sn"><span class="sh-emo" aria-hidden="true">🍃</span><div class="sh-grow"><b>Puasa</b><small>"Tidak puasa (udzur)" menambah utang qadha puasa</small></div></div>
            <div class="sh-seg sh-wide" role="group" aria-label="Status puasa"><button type="button" class="${e.pu === 0 ? 'on0' : ''}" data-act="rpu" data-v="0" aria-pressed="${e.pu === 0}">Belum</button><button type="button" class="${e.pu === 1 ? 'on1' : ''}" data-act="rpu" data-v="1" aria-pressed="${e.pu === 1}">Berpuasa</button><button type="button" class="${e.pu === 2 ? 'on3' : ''}" data-act="rpu" data-v="2" aria-pressed="${e.pu === 2}">Tidak puasa (udzur)</button></div>
            <div class="sh-sn"><span class="sh-emo" aria-hidden="true">🕌</span><div class="sh-grow"><b>Tarawih</b><small>Pilih jumlah rakaat (termasuk witir)</small></div></div>
            <div class="sh-chips"><button type="button" class="mx-chip${e.tw === 0 ? ' on' : ''}" data-act="rtw" data-v="0">Tidak</button>${[8, 11, 20, 23].map(n => `<button type="button" class="mx-chip${e.tw === n ? ' on' : ''}" data-act="rtw" data-v="${n}">${n} rakaat</button>`).join('')}</div>
            <div class="sh-sn"><span class="sh-emo" aria-hidden="true">📖</span><div class="sh-grow"><b>Tadarus</b><small>Halaman dibaca hari ini · butuh ±${need} hlm/hari untuk khatam</small></div><span class="sh-stp"><button class="mx-btn mx-btn-sm" type="button" data-act="rtr" data-d="-5" aria-label="Kurangi 5 halaman">−5</button><button class="mx-btn mx-btn-sm" type="button" data-act="rtr" data-d="-1" aria-label="Kurangi 1 halaman">−</button><b>${e.tr}</b><button class="mx-btn mx-btn-sm" type="button" data-act="rtr" data-d="1" aria-label="Tambah 1 halaman">+</button><button class="mx-btn mx-btn-sm" type="button" data-act="rtr" data-d="5" aria-label="Tambah 5 halaman">+5</button></span></div>
            <div class="sh-prog" aria-label="Progres khatam"><i style="width:${Math.min(100, sum.tr / QURAN_PAGES * 100)}%"></i></div><div class="mx-xs mx-muted">${Math.round(sum.tr / QURAN_PAGES * 100)}% menuju khatam (${QURAN_PAGES} halaman mushaf)</div></div>`;
        h += `<div class="mx-card"><h3 class="mx-h3">${rg.len} hari Ramadan</h3><div class="sh-cal">${range.map((d, i) => { const x = D().days[d] || { pu: 0 }; return `<button type="button" class="sh-d${x.pu === 1 ? ' l5' : x.pu === 2 ? ' u' : ''}${d > tdy ? ' fut' : ''}${d === ui.date ? ' now' : ''}" data-act="godate" data-d="${d}" data-keep="1" title="${fmtDate(d)}" aria-label="Hari ke-${i + 1}${x.pu === 1 ? ' puasa' : x.pu === 2 ? ' udzur' : ''}">${i + 1}</button>`; }).join('')}</div>
            <div class="sh-legend"><i style="background:#2f7d5b"></i> puasa <i style="background:var(--warning-light)"></i> udzur <i style="background:var(--bg-surface-hover)"></i> belum</div></div>`;
        h += `<div class="mx-card"><h3 class="mx-h3">Jadwal imsakiyah</h3><div class="sh-scroll"><table class="sh-tbl"><thead><tr><th>Hari</th><th>Tanggal</th><th>Imsak</th><th>Subuh</th><th>Dzuhur</th><th>Berbuka</th></tr></thead><tbody>${range.map((d, i) => { const s2 = getSched(d).t; if (!s2) return ''; return `<tr class="${d === tdy ? 'now' : ''}"><td>${i + 1}</td><td>${parse(d).getDate()} ${BULAN[parse(d).getMonth()].slice(0, 3)}</td><td>${s2.imsak}</td><td>${s2.subuh}</td><td>${s2.dzuhur}</td><td>${s2.maghrib}</td></tr>`; }).join('')}</tbody></table></div></div>`;
        r.innerHTML = h;
    }

    // ---------- pewaktu: hitung mundur & penyegaran tiap menit (tanpa render ulang tiap detik) ----------
    function tick() {
        const t0 = today();
        if (t0 !== lastDay) { if (ui.date === lastDay) ui.date = t0; if (ui.month === lastDay.slice(0, 7)) ui.month = t0.slice(0, 7); lastDay = t0; if (VIEWS[current] && isActive(current)) rerender(); return; }
        const mi = Math.floor(nowMin());
        if (mi !== lastMin) { lastMin = mi; updateBadge(); if ((current === 'sh-hari' && ui.date === t0 && isActive('sh-hari')) || (current === 'sh-ramadan' && isActive('sh-ramadan'))) { rerender(); return; } }
        if (current === 'sh-ramadan' && isActive(current)) { const rc = ramCount(), el = document.getElementById('shRcd'); if (rc && el) el.textContent = cdTxt(Math.max(0, Math.round((rc.at - nowMin()) * 60))); return; }
        if (current !== 'sh-hari' || !isActive(current) || ui.date !== t0) return;
        const s = getSched(t0); if (s.st !== 'ok') return;
        const np = nextPrayer(s.t), cd = document.getElementById('shCd');
        if (cd) { cd.textContent = cdTxt(Math.max(0, Math.round((np.at - nowMin()) * 60))); const prev = prevPrayerTime(s.t), b = document.getElementById('shBar'); if (b && prev != null && !np.tomorrow) b.style.width = clamp((nowMin() - prev) / (np.at - prev) * 100, 0, 100) + '%'; }
        const key = pendingReminders().map(r => r.k).join() + '|' + np.k;
        if (key !== lastRemKey) { lastRemKey = key; rerender(); }
    }

    // ---------- ekspor gambar tahunan (canvas) ----------
    function exportYear(y) {
        const g = yearGrid(y), st = yearStats(y), cell = 16, gap = 4, W = Math.max(900, 60 + g.cols * (cell + gap)), H = 470, c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'), col = ['#f0e8d9', '#cfe4d8', '#a6d0ba', '#6fb08e', '#3f8f69', '#2f7d5b'];
        x.fillStyle = '#fbf8f1'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#2a2018'; x.font = 'italic 700 38px Georgia,serif'; x.fillText(`Sholat ${y}`, 30, 56);
        x.font = '600 18px sans-serif'; x.fillStyle = '#75654f'; x.fillText(`${st.pct}% terlaksana · ${st.perfect} hari 5/5 · beruntun terbaik ${st.best} hari · berjamaah ${st.jamPct}%`, 30, 90);
        const ox = 30, oy = 150; x.font = '12px sans-serif'; x.fillStyle = '#75654f';
        g.months.forEach(m => x.fillText(BULAN[m.m].slice(0, 3), ox + m.col * (cell + gap), oy - 10));
        g.cells.forEach((cl, i) => { const idx = g.lead + i, cx = ox + Math.floor(idx / 7) * (cell + gap), cy = oy + (idx % 7) * (cell + gap); x.globalAlpha = cl.fut ? .3 : 1; x.fillStyle = col[cl.c]; x.fillRect(cx, cy, cell, cell); x.globalAlpha = 1; });
        const by = oy + 7 * (cell + gap) + 40; x.fillStyle = '#2a2018'; x.font = '600 15px sans-serif'; x.fillText('Capaian per bulan', 30, by);
        st.month.forEach((v, i) => { if (v == null) return; const bx = 30 + i * ((W - 60) / 12), bw = (W - 60) / 12 - 12; x.fillStyle = '#f0e8d9'; x.fillRect(bx, by + 14, bw, 14); x.fillStyle = '#2f7d5b'; x.fillRect(bx, by + 14, bw * v / 100, 14); x.fillStyle = '#75654f'; x.font = '12px sans-serif'; x.fillText(`${BULAN[i].slice(0, 3)} ${v}%`, bx, by + 46); });
        x.fillStyle = '#a39581'; x.font = '12px sans-serif'; x.fillText('BYgf · metode Kemenag', 30, H - 16);
        return new Promise(res => c.toBlob(b => res({ blob: b, w: W, h: H }), 'image/png'));
    }
    async function openExport() {
        const y = ui.year, r = await exportYear(y); if (!r.blob) return Mx.toast('Gagal membuat gambar', 'error');
        const url = URL.createObjectURL(r.blob);
        Mx.modal({ title: `Rekap sholat ${y}`, size: 560, body: `<img alt="Rekap sholat ${y}" src="${url}" class="sh-exp"><a class="mx-btn mx-btn-primary" id="shDl" download="bygf-sholat-${y}.png" href="${url}">⬇ Unduh PNG</a>`});
        setTimeout(() => URL.revokeObjectURL(url), 600000);
        window.__shLastExport = { size: r.blob.size, w: r.w, h: r.h };
    }

    // ---------- lokasi ----------
    let wilayahLoading = null;
    function loadWilayah() {
        if (window.PRAY_WILAYAH) return Promise.resolve(window.PRAY_WILAYAH);
        if (!wilayahLoading) wilayahLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/data/wilayah.js'; s.onload = () => res(window.PRAY_WILAYAH); s.onerror = () => { wilayahLoading = null; rej(new Error('gagal memuat data kecamatan')); }; document.head.appendChild(s); });
        return wilayahLoading;
    }
    const makeLoc = (p, c, k) => { const own = k && k[1] != null; return { kec: k ? k[0] : '', city: c[1], prov: p[1], lat: own ? k[1] : c[2], lng: own ? k[2] : c[3], tz: PrayCalc.tzOfProvince(p[0]), own: !k || own, src: 'list' }; };
    function nearest(W, lat, lng) {
        let best = null, bd = 1e9;
        W.forEach(p => p[2].forEach(c => c[4].forEach(k => { const la = k[1] != null ? k[1] : c[2], lo = k[2] != null ? k[2] : c[3], dx = (lo - lng) * Math.cos(lat * Math.PI / 180), dy = la - lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [p, c, k]; } })));
        return best && { p: best[0], c: best[1], k: best[2], km: Math.sqrt(bd) * 111 };
    }
    const setLoc = (loc, msg) => { D().loc = loc; save(); Object.keys(schedCache).forEach(k => { delete schedCache[k]; }); lastRemKey = ''; rerender(); Mx.toast(msg); };
    function openCity() {
        const m = Mx.modal({ title: 'Pilih lokasi', size: 480, body: `<p class="mx-muted mx-xs">Saat ini: <b>${esc(locFull(D().loc))}</b></p><button class="mx-btn" type="button" data-gps style="width:100%">📍 Pakai lokasi saya (GPS)</button><div id="shGpsMsg" class="mx-xs mx-muted sh-gap"></div><div id="shLocBody" class="mx-muted mx-xs">Memuat daftar kecamatan…</div>` });
        const msg = m.body.querySelector('#shGpsMsg'); let W = null, hits = [];
        loadWilayah().then(w => {
            W = w; const box = m.body.querySelector('#shLocBody'); if (!box) return;
            box.className = '';
            box.innerHTML = `<label class="mx-xs mx-muted" for="shKq"><b>Cari kecamatan</b></label><input id="shKq" class="mx-input" placeholder="Ketik nama kecamatan, mis. Coblong…" autocomplete="off"><div id="shKres"></div>
                <div class="mx-xs mx-muted sh-gap"><b>Atau pilih bertahap</b></div>
                <select id="shSelP" class="mx-input" aria-label="Provinsi"><option value="">Provinsi…</option>${W.map(p => `<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select>
                <select id="shSelC" class="mx-input" aria-label="Kabupaten/Kota" disabled><option value="">Kabupaten / Kota…</option></select>
                <select id="shSelK" class="mx-input" aria-label="Kecamatan" disabled><option value="">Kecamatan…</option></select>`;
            const kres = box.querySelector('#shKres'), selP = box.querySelector('#shSelP'), selC = box.querySelector('#shSelC'), selK = box.querySelector('#shSelK');
            const pick = (p, c, k) => { m.close(); setLoc(makeLoc(p, c, k), 'Lokasi: ' + locLabel(makeLoc(p, c, k))); };
            const findP = () => W.find(x => String(x[0]) === selP.value), findC = () => { const p = findP(); return p && p[2].find(x => String(x[0]) === selC.value); };
            box.querySelector('#shKq').addEventListener('input', e => {
                const q = e.target.value.trim().toLowerCase(); hits = [];
                if (q.length >= 2) outer: for (const p of W) for (const c of p[2]) for (const k of c[4]) { if (k[0].toLowerCase().includes(q) || c[1].toLowerCase().includes(q)) { hits.push([p, c, k]); if (hits.length >= 40) break outer; } }
                kres.innerHTML = q.length < 2 ? '' : hits.length ? hits.map((h, i) => `<button type="button" class="sh-res" data-i="${i}"><span><b>${esc(h[2][0])}</b><br><span class="mx-xs mx-muted">${esc(h[1][1])} · ${esc(h[0][1])}</span></span><span class="mx-xs mx-muted">pilih</span></button>`).join('') : '<p class="mx-xs mx-muted">Tidak ditemukan.</p>';
            });
            kres.addEventListener('click', e => { const b = e.target.closest('.sh-res'); if (b && hits[+b.dataset.i]) { const h = hits[+b.dataset.i]; pick(h[0], h[1], h[2]); } });
            selP.addEventListener('change', () => { const p = findP(); selC.innerHTML = '<option value="">Kabupaten / Kota…</option>' + (p ? p[2].map(c => `<option value="${c[0]}">${esc(c[1])}</option>`).join('') : ''); selC.disabled = !p; selK.innerHTML = '<option value="">Kecamatan…</option>'; selK.disabled = true; });
            selC.addEventListener('change', () => { const c = findC(); selK.innerHTML = '<option value="">Kecamatan…</option>' + (c ? c[4].map((k, i) => `<option value="${i}">${esc(k[0])}</option>`).join('') : ''); selK.disabled = !c; if (c && !c[4].length) pick(findP(), c, null); });
            selK.addEventListener('change', () => { const c = findC(); if (c && selK.value !== '') pick(findP(), c, c[4][+selK.value]); });
            const q = box.querySelector('#shKq'); if (q) q.focus();
        }).catch(() => { const box = m.body.querySelector('#shLocBody'); if (box) box.textContent = 'Daftar kecamatan gagal dimuat. Periksa koneksi lalu coba lagi.'; });
        m.body.addEventListener('click', e => {
            if (!e.target.closest('[data-gps]')) return;
            if (!navigator.geolocation) { msg.textContent = 'Perangkat ini tidak mendukung GPS.'; return; }
            msg.textContent = 'Mencari lokasi…';
            navigator.geolocation.getCurrentPosition(pos => {
                loadWilayah().then(w => {
                    const n = nearest(w, pos.coords.latitude, pos.coords.longitude);
                    if (!n || n.km > 60) { msg.textContent = 'Lokasi di luar Indonesia atau terlalu jauh dari data kecamatan.'; return; }
                    m.close(); setLoc({ kec: n.k[0], city: n.c[1], prov: n.p[1], lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), tz: PrayCalc.tzOfProvince(n.p[0]), own: true, src: 'gps' }, 'Lokasi GPS: ' + n.k[0]);
                }).catch(() => { msg.textContent = 'Data kecamatan gagal dimuat.'; });
            }, err => { msg.textContent = err.code === 1 ? 'Izin lokasi ditolak. Pilih kecamatan secara manual.' : 'Gagal mendapat lokasi. Pilih kecamatan secara manual.'; }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
        });
    }

    // ---------- aksi ----------
    const goHari = () => App.UI.switchTab('sh-hari', document.getElementById('subtab-sh-hari'));
    const acts = {
        set: el => { const d = day(ui.date), v = Number(el.dataset.v); if (v) d.s[el.dataset.k] = v; else delete d.s[el.dataset.k]; prune(); save(); rerender(); },
        sn: el => { const d = day(ui.date); if (d.sn[el.dataset.k]) delete d.sn[el.dataset.k]; else d.sn[el.dataset.k] = 1; prune(); save(); rerender(); },
        pu: () => { const d = day(ui.date); d.pu = d.pu === 1 ? 0 : 1; prune(); save(); rerender(); },
        prev: () => { ui.date = addDays(ui.date, -1); rerender(); },
        next: () => { if (ui.date < today()) { ui.date = addDays(ui.date, 1); rerender(); } },
        today: () => { ui.date = today(); rerender(); },
        mprev: () => { ui.month = addDays(ui.month + '-01', -1).slice(0, 7); rerender(); },
        mnext: () => { if (ui.month < today().slice(0, 7)) { const d = parse(ui.month + '-01'); d.setMonth(d.getMonth() + 1); ui.month = iso(d).slice(0, 7); rerender(); } },
        yprev: () => { ui.year--; rerender(); }, ynext: () => { if (ui.year < +today().slice(0, 4)) { ui.year++; rerender(); } },
        export: openExport, city: openCity,
        godate: el => { ui.date = el.dataset.d; if (!el.dataset.keep) goHari(); else rerender(); },
        'rm-done': el => { day(today()).s[el.dataset.k] = 1; save(); lastRemKey = ''; rerender(); Mx.toast('Tercatat sudah sholat'); },
        'rm-jam': el => { day(today()).s[el.dataset.k] = 2; save(); lastRemKey = ''; rerender(); Mx.toast('Tercatat berjamaah'); },
        'rm-later': el => { snooze[today() + '|' + el.dataset.k] = nowMin() + SNOOZE; lastRemKey = ''; rerender(); Mx.toast(`Diingatkan lagi ${SNOOZE} menit`); },
        qpay: el => { const k = el.dataset.k; if (!qBal(k)) return; D().qadha.paid.push({ d: today(), k }); save(); rerender(); Mx.toast('Qadha tercatat'); },
        qundo: el => { const k = el.dataset.k, i = D().qadha.paid.map(e => e.k).lastIndexOf(k); if (i < 0) return; D().qadha.paid.splice(i, 1); save(); rerender(); },
        qpupay: () => { if (!puBal()) return; D().qadha.puPaid.push(today()); save(); rerender(); Mx.toast('Puasa qadha tercatat'); },
        qpuundo: () => { D().qadha.puPaid.pop(); save(); rerender(); },
        qinit: () => {
            const S = D(), v = id => clamp(int((document.getElementById(id) || {}).value), 0, id === 'shQi-pu' ? 999 : 9999);
            PRAYERS.forEach(([k]) => { const n = v('shQi-' + k); if (n) S.qadha.init[k] = n; else delete S.qadha.init[k]; });
            S.qadha.puInit = v('shQi-pu'); save(); rerender(); Mx.toast('Utang awal disimpan');
        },
        goal: el => { const k = el.dataset.g, lim = { weekFull: [1, 7], weekJam: [0, 35], jam: [0, 5] }[k]; if (!lim) return; D().goals[k] = clamp(D().goals[k] + Number(el.dataset.d), lim[0], lim[1]); save(); rerender(); },
        rpu: el => { day(ui.date).pu = Number(el.dataset.v); prune(); save(); rerender(); },
        rtw: el => { day(ui.date).tw = Number(el.dataset.v); prune(); save(); rerender(); },
        rtr: el => { const d = day(ui.date); d.tr = clamp(d.tr + Number(el.dataset.d), 0, QURAN_PAGES); prune(); save(); rerender(); }
    };

    AppModules.register(KEY, {
        label: 'Sholat', views: Object.keys(VIEWS), normalize, validate,
        onChange() { updateBadge(); },
        init() {
            Object.keys(VIEWS).forEach(v => { const r = root(v); if (r) Mx.delegate(r, acts); });
            updateBadge(); setInterval(tick, 1000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
        },
        show(v) {
            if (v === 'sh-ramadan' && !inRamadan(today())) v = 'sh-hari';
            current = v; if (ui.date > today()) ui.date = today();
            lastMin = -1; lastRemKey = ''; rerender();
        },
        refresh() {
            updateBadge(); const r = root(current);
            if (r && r.classList.contains('active') && !(document.activeElement && r.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) rerender();
        },
        isBusy() { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && (a.closest('.mx-modal') || a.closest('#view-sh-qadha'))); },
        // dipakai Beranda, pengingat HP, dan modul lain
        inRamadan: () => inRamadan(today()), summary, bybiLine, homeInfo, pendingCount: () => pendingReminders().length
    });
})();
