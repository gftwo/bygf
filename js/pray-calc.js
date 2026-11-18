/* Perhitungan waktu sholat di perangkat (tanpa internet).
   Metode Kemenag RI: Subuh −20°, Isya −18°, Ashar bayangan 1× (Syafi'i), terbit/terbenam −0,833°,
   ihtiyati +2 menit (terbit −2 menit), Imsak = Subuh − 10 menit, Dhuha = matahari +4,5°.
   Algoritma astronomi standar (deklinasi & equation of time), akurat ±1 menit dari perhitungan astronomis.
   Dipakai sebagai modul murni: PrayCalc.times({y,m,d}, lat, lng, tz[, opts]) -> {imsak,subuh,terbit,dhuha,dzuhur,ashar,maghrib,isya,tahajud,tengahmalam} 'HH:MM' */
(function (root) {
    'use strict';
    const R = Math.PI / 180, sin = d => Math.sin(d * R), cos = d => Math.cos(d * R), tan = d => Math.tan(d * R);
    const asin = x => Math.asin(x) / R, acos = x => Math.acos(Math.max(-1, Math.min(1, x))) / R, atan2 = (y, x) => Math.atan2(y, x) / R;
    const arccot = x => Math.atan(1 / x) / R, fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
    const DEF = { fajr: 20, isha: 18, asrFactor: 1, horizon: 0.833, dhuha: 4.5, ihtiyati: 2, imsakGap: 10 };
    function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
    function sunPos(jd) {
        const D = jd - 2451545.0, g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
        const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360), e = 23.439 - 0.00000036 * D;
        const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
        return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
    }
    // Jam desimal (waktu setempat) untuk semua waktu, tanpa ihtiyati
    function raw(date, lat, lng, tz, o) {
        o = Object.assign({}, DEF, o);
        const jd = julian(date.y, date.m, date.d) - lng / (15 * 24);
        const noon = t => fix(12 - sunPos(jd + t).eqt, 24);
        const ang = (a, t, ccw) => { const dc = sunPos(jd + t).decl, v = acos((-sin(a) - sin(dc) * sin(lat)) / (cos(dc) * cos(lat))) / 15; return noon(t) + (ccw ? -v : v); };
        const asr = (f, t) => { const dc = sunPos(jd + t).decl; return ang(-arccot(f + tan(Math.abs(lat - dc))), t); };
        const T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
        Object.keys(T).forEach(k => T[k] /= 24);
        const r = {
            fajr: ang(o.fajr, T.fajr, true), sunrise: ang(o.horizon, T.sunrise, true), dhuha: ang(-o.dhuha, T.sunrise, true),
            dhuhr: noon(T.dhuhr), asr: asr(o.asrFactor, T.asr), maghrib: ang(o.horizon, T.sunset), isha: ang(o.isha, T.isha)
        };
        const adj = tz - lng / 15; Object.keys(r).forEach(k => { r[k] += adj; });
        return r;
    }
    const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    function times(date, lat, lng, tz, o) {
        o = Object.assign({}, DEF, o);
        const r = raw(date, lat, lng, tz, o), nx = raw(nextDay(date), lat, lng, tz, o);
        if ([r.fajr, r.isha, r.dhuhr].some(x => !isFinite(x))) return null;
        const up = (h, add) => Math.ceil(h * 60 + add - 1e-6), dn = (h, add) => Math.floor(h * 60 + add + 1e-6);
        const subuh = up(r.fajr, o.ihtiyati), maghrib = up(r.maghrib, o.ihtiyati), nextSubuh = up(nx.fajr, o.ihtiyati) + 1440;
        return {
            imsak: hhmm(subuh - o.imsakGap), subuh: hhmm(subuh), terbit: hhmm(dn(r.sunrise, -o.ihtiyati)), dhuha: hhmm(dn(r.dhuha, 0)),
            dzuhur: hhmm(up(r.dhuhr, o.ihtiyati)), ashar: hhmm(up(r.asr, o.ihtiyati)), maghrib: hhmm(maghrib), isya: hhmm(up(r.isha, o.ihtiyati)),
            tahajud: hhmm(Math.round(maghrib + (nextSubuh - maghrib) * 2 / 3)), // awal sepertiga malam terakhir
            tengahmalam: hhmm(Math.round(maghrib + (nextSubuh - maghrib) / 2)) // tengah malam syar'i = batas akhir Isya
        };
    }
    function nextDay(d) { const t = new Date(Date.UTC(d.y, d.m - 1, d.d + 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
    // Zona waktu Indonesia dari kode provinsi: WIT / WITA / WIB
    function tzOfProvince(code) { return [51, 52, 53, 63, 64, 65, 71, 72, 73, 74, 75, 76].includes(code) ? 8 : (code >= 81 ? 9 : 7); }
    // Batas akhir tiap waktu (menit sejak 00:00): Subuh sampai terbit, Isya sampai tengah malam syar'i, lainnya sampai waktu berikutnya
    const ORDER = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    function windowEnd(t, k) {
        if (k === 'subuh') return toMin(t.terbit);
        if (k === 'isya') { const m = toMin(t.tengahmalam); return m < toMin(t.isya) ? m + 1440 : m; }
        return toMin(t[ORDER[ORDER.indexOf(k) + 1]]);
    }
    const api = { times, raw, tzOfProvince, DEF, toMin, windowEnd };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PrayCalc = api;
})(typeof self !== 'undefined' ? self : this);
