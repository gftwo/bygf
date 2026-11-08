/* ==========================================================================
   FITUR LUCU — maskot Bybi (mood + streak), lencana, "Hari ini di masa lalu", roda "Makan apa?", konfeti.
   Semua DATA TURUNAN: dihitung dari catatan yang sudah ada, tidak menambah skema data.
   Satu-satunya yang disimpan: penanda lencana yang sudah dirayakan (localStorage, per perangkat).
   ========================================================================== */
(function () {
    'use strict';
    const { esc, today } = Mx;
    const mod = k => (window.AppModules && AppModules.has(k)) ? AppModules.get(k) : null;
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pick = a => a[Math.floor(Math.random() * a.length)];

    // ---------- konfeti ----------
    function confetti(n) {
        if (reduced()) return;
        const c = document.createElement('canvas'); c.className = 'fn-confetti'; c.setAttribute('aria-hidden', 'true');
        c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
        const g = c.getContext('2d'), cols = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'], N = n || 140;
        const ps = Array.from({ length: N }, () => ({ x: c.width / 2 + (Math.random() - .5) * 120, y: c.height * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6.3, vr: (Math.random() - .5) * .4, col: pick(cols) }));
        let t = 0; (function frame() {
            g.clearRect(0, 0, c.width, c.height); t++;
            ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col; g.globalAlpha = Math.max(0, 1 - t / 130); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); g.restore(); });
            if (t < 130) requestAnimationFrame(frame); else c.remove();
        })();
    }

    // ---------- hari aktif & streak ----------
    function activityDays() { // semua tanggal yang punya catatan (transaksi, jurnal, tugas selesai)
        const s = new Set();
        ((window.App && App.State && App.State.transactions) || []).forEach(t => { if (t && !t.isAdjustment && isDate(t.tanggal)) s.add(t.tanggal); });
        const j = mod('journal'); arr(j && j.entries).forEach(e => { if (e && isDate(e.date) && (e.rating || e.good || e.problem || e.lesson || e.tomorrow || e.note)) s.add(e.date); });
        const d = mod('daily'); arr(d && d.tasks).forEach(t => { if (t && t.done && t.doneAt && isDate(String(t.doneAt).slice(0, 10))) s.add(String(t.doneAt).slice(0, 10)); });
        return s;
    }
    function streak(days) { // hari beruntun sampai hari ini (jika hari ini kosong, hitung dari kemarin agar streak tidak "mati" sebelum malam)
        days = days || activityDays(); let d = today(); if (!days.has(d)) d = Mx.addDays(d, -1); let n = 0;
        while (days.has(d)) { n++; d = Mx.addDays(d, -1); } return n;
    }
    const STAGES = [[0, '🥚', 'Telur'], [3, '🐣', 'Anak Bybi'], [14, '🐥', 'Bybi Remaja'], [45, '🦆', 'Bybi Dewasa'], [120, '🦢', 'Bybi Legenda']];
    const stage = total => STAGES.filter(s => total >= s[0]).pop();

    // ---------- mood maskot (skor 0–4 dari kegiatan hari ini) ----------
    function todayScore() { // hanya kegiatan yang relevan hari ini yang dihitung (tugas/kuliah kosong tidak menggelembungkan skor)
        const t0 = today(), parts = [];
        parts.push(['keuangan', ((App.State.transactions || []).some(t => t && !t.isAdjustment && t.tanggal === t0))]);
        const j = mod('journal'); parts.push(['jurnal', arr(j && j.entries).some(e => e && e.date === t0 && (e.rating || e.good || e.problem || e.lesson || e.tomorrow || e.note))]);
        const d = mod('daily'), tt = arr(d && d.tasks).filter(t => t && t.date === t0); if (tt.length) parts.push(['tugas', tt.every(t => t.done)]);
        const sch = (window.KuliahPro && KuliahPro.todaySchedule) ? KuliahPro.todaySchedule().filter(s => !s.libur) : []; if (sch.length) parts.push(['kuliah', sch.every(s => s.status)]);
        const done = parts.filter(p => p[1]).length, total = parts.length;
        return { score: Math.round(done / total * 4), done, total, parts };
    }
    const MOODS = [
        { face: 'sleepy', say: ['Zzz… ayo catat sesuatu hari ini?', 'Bybi ngantuk… bangunin dengan satu catatan dong 😴'] },
        { face: 'meh', say: ['Lumayan! Tinggal sedikit lagi.', 'Satu langkah kecil lagi, bisa!'] },
        { face: 'smile', say: ['Hari ini berjalan baik 🙂', 'Mantap, terus begini!'] },
        { face: 'happy', say: ['Wah hampir lengkap! Bybi senang ✨', 'Kamu keren hari ini!'] },
        { face: 'party', say: ['SEMUA BERES! Bybi joget! 🎉', 'Hari ini sempurna! 🥳'] }
    ];
    const TAPS = ['Eh, geli! 🤭', 'Bybi lapar… traktir sticker? 🍪', 'Kamu rajin banget deh 💛', 'Jangan lupa minum air 💧', 'Bybi bangga sama kamu 🌟', 'Hehe 😄', 'Psst… coba ketuk 7x logo di atas 🤫'];
    function face(kind) {
        const eyes = { sleepy: '<path d="M22 31q4 3 8 0M38 31q4 3 8 0" class="fn-s"/>', meh: '<circle cx="26" cy="31" r="2.4" class="fn-f"/><circle cx="42" cy="31" r="2.4" class="fn-f"/>', smile: '<circle cx="26" cy="30" r="2.8" class="fn-f"/><circle cx="42" cy="30" r="2.8" class="fn-f"/>', happy: '<path d="M22 32q4-6 8 0M38 32q4-6 8 0" class="fn-s"/>', party: '<path d="M22 32q4-6 8 0M38 32q4-6 8 0" class="fn-s"/>' }[kind];
        const mouth = { sleepy: '<path d="M30 42h8" class="fn-s"/>', meh: '<path d="M30 42h8" class="fn-s"/>', smile: '<path d="M28 40q6 6 12 0" class="fn-s"/>', happy: '<path d="M27 39q7 9 14 0z" class="fn-f2"/>', party: '<path d="M26 38q8 12 16 0z" class="fn-f2"/>' }[kind];
        return `<svg class="fn-bybi fn-${kind}" viewBox="0 0 68 68" role="img" aria-label="Bybi, maskot BYgf"><ellipse cx="34" cy="62" rx="16" ry="3.5" class="fn-shadow"/><path class="fn-body" d="M34 8c15 0 25 11 25 27 0 13-10 24-25 24S9 48 9 35C9 19 19 8 34 8z"/><ellipse cx="19" cy="40" rx="4" ry="2.5" class="fn-cheek"/><ellipse cx="49" cy="40" rx="4" ry="2.5" class="fn-cheek"/>${eyes}${mouth}${kind === 'party' ? '<path d="M24 9l10-9 10 9z" class="fn-hat"/>' : ''}</svg>`;
    }

    // ---------- lencana ----------
    function badgeList() {
        const days = activityDays(), st = streak(days), tx = (App.State.transactions || []).filter(t => t && !t.isAdjustment).length;
        const j = mod('journal'), je = arr(j && j.entries).filter(e => e && (e.rating || e.good || e.problem || e.lesson || e.tomorrow || e.note)).length;
        const d = mod('daily'), done = arr(d && d.tasks).filter(t => t && t.done).length;
        const g = mod('goals'), goalDone = arr(g && g.goals).some(x => x && x.target > 0 && x.saved >= x.target);
        const att = (window.KuliahPro && KuliahPro.attendanceStats) ? KuliahPro.attendanceStats() : [];
        const rajin = att.length && att.every(a => a.total >= 5 ? a.pct >= 90 : true) && att.some(a => a.total >= 5);
        const v = mod('vault');
        return [
            { id: 'first', icon: '🌱', name: 'Langkah pertama', how: 'Catat 1 transaksi', ok: tx >= 1 },
            { id: 'tx50', icon: '🧾', name: 'Pencatat setia', how: 'Catat 50 transaksi', ok: tx >= 50 },
            { id: 'st7', icon: '🔥', name: 'Seminggu konsisten', how: 'Streak 7 hari', ok: st >= 7 },
            { id: 'st30', icon: '🏆', name: 'Sebulan penuh', how: 'Streak 30 hari', ok: st >= 30 },
            { id: 'jr7', icon: '📔', name: 'Penulis jurnal', how: 'Isi 7 jurnal', ok: je >= 7 },
            { id: 'tg20', icon: '✅', name: 'Tukang tuntas', how: 'Selesaikan 20 tugas', ok: done >= 20 },
            { id: 'goal', icon: '🐷', name: 'Target tercapai', how: 'Penuhi satu target tabungan', ok: goalDone },
            { id: 'kul', icon: '🎓', name: 'Mahasiswa rajin', how: 'Kehadiran ≥90% di semua matkul (min. 5 pertemuan)', ok: !!rajin },
            { id: 'vault', icon: '🔐', name: 'Penjaga rahasia', how: 'Buat Brankas Sandi', ok: !!(v && v.salt) }
        ];
    }
    const SEEN = 'bygf.badgesSeen';
    function celebrateNew() { // dipanggil saat Beranda tampil; perayaan sekali per lencana. Saat pertama kali, lencana lama dicatat diam-diam.
        let seen = null; try { seen = JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch (e) { seen = null; }
        const earned = badgeList().filter(b => b.ok).map(b => b.id);
        if (!Array.isArray(seen)) { try { localStorage.setItem(SEEN, JSON.stringify(earned)); } catch (e) { /* abaikan */ } return []; }
        const fresh = earned.filter(id => !seen.includes(id)); if (!fresh.length) return [];
        try { localStorage.setItem(SEEN, JSON.stringify(earned)); } catch (e) { /* abaikan */ }
        const names = badgeList().filter(b => fresh.includes(b.id)); confetti(); Mx.toast(`🏅 Lencana baru: ${names.map(n => n.icon + ' ' + n.name).join(', ')}`, 'success'); return names;
    }

    // ---------- hari ini di masa lalu ----------
    function throwback() {
        const j = mod('journal'); if (!j) return null; const t0 = today(), md = t0.slice(5), ents = arr(j.entries).filter(e => e && isDate(e.date) && e.date < t0 && (e.good || e.problem || e.lesson || e.tomorrow || e.note));
        const yrs = ents.filter(e => e.date.slice(5) === md).sort((a, b) => b.date.localeCompare(a.date));
        const cands = [...yrs.map(e => [e, `${t0.slice(0, 4) - e.date.slice(0, 4)} tahun lalu`]), ...[30, 7].map(n => [ents.find(e => e.date === Mx.addDays(t0, -n)), n === 30 ? 'sebulan lalu' : 'seminggu lalu']).filter(x => x[0])];
        return cands.length ? cands[0] : null;
    }

    // ---------- roda "Makan apa?" ----------
    const DEFAULT_FOOD = ['Nasi goreng', 'Mie ayam', 'Soto ayam', 'Ayam geprek', 'Bakso', 'Pecel lele', 'Gado-gado', 'Nasi padang', 'Roti bakar', 'Bubur ayam', 'Sate', 'Indomie telur', 'Nasi uduk', 'Ketoprak'];
    function foodPool() {
        const m = mod('meal'), set = new Map();
        const add = (n, w) => { n = String(n || '').trim(); if (n) set.set(n.toLowerCase(), [n, (set.get(n.toLowerCase()) || [n, 0])[1] + w]); };
        arr(m && m.records).forEach(r => add(r.name, 2)); arr(m && m.wishlist).filter(w => w.type === 'food' && !w.done).forEach(w => add(w.name, 3)); arr(m && m.schedules).forEach(s => add(s.name, 1));
        if (set.size < 6) DEFAULT_FOOD.forEach(n => add(n, 1));
        return [...set.values()];
    }
    function spinFood() {
        const pool = foodPool(), names = pool.map(p => p[0]), bag = pool.flatMap(p => Array(Math.min(p[1], 5)).fill(p[0]));
        const winner = pick(bag), lead = Math.min(26, 14 + names.length);
        Mx.modal({
            title: '🎲 Makan apa hari ini?', size: 380,
            body: `<div class="fn-spin" aria-live="polite"><div class="fn-slot" id="fnSlot">…</div><p class="mx-muted" id="fnSub">Mengocok ${names.length} pilihan dari catatan makanmu…</p><div class="mx-row" style="justify-content:center"><button type="button" class="mx-btn mx-btn-primary" id="fnAgain" disabled>🔄 Putar lagi</button><button type="button" class="mx-btn" id="fnOk" disabled>Oke, ini aja</button></div></div>`,
            onMount(m) {
                const slot = m.el.querySelector('#fnSlot'), again = m.el.querySelector('#fnAgain'), ok = m.el.querySelector('#fnOk'), sub = m.el.querySelector('#fnSub');
                function run(final) {
                    again.disabled = ok.disabled = true; sub.textContent = 'Mengocok…'; let i = 0, delay = 60;
                    (function step() {
                        if (!m.el.isConnected) return; const last = i >= lead; slot.textContent = last ? final : pick(names); slot.classList.toggle('fn-final', last);
                        if (last) { sub.textContent = 'Keputusan Bybi! 🎉'; again.disabled = ok.disabled = false; if (!reduced()) confetti(60); return; }
                        i++; delay += (i > lead - 7 ? 45 : 6); setTimeout(step, reduced() ? 10 : delay);
                    })();
                }
                again.addEventListener('click', () => run(pick(bag))); ok.addEventListener('click', () => m.close()); run(winner);
            }
        });
    }

    // ---------- telur paskah: ketuk logo 7x ----------
    let taps = 0, tapT = null;
    document.addEventListener('click', e => {
        if (!e.target.closest || !e.target.closest('.bg-logo, .brand-icon, .sn-rail-logo')) return;
        taps++; clearTimeout(tapT); tapT = setTimeout(() => { taps = 0; }, 1500);
        if (taps >= 7) { taps = 0; confetti(220); Mx.toast('🥚 Kamu menemukan telur paskah! Bybi bilang: terima kasih sudah rajin mencatat 💛', 'success'); }
    });

    window.BYFun = { confetti, activityDays, streak, stage, todayScore, MOODS, TAPS, face, badgeList, celebrateNew, throwback, spinFood, foodPool, _pick: pick };
})();
