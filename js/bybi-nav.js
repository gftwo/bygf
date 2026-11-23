/* ==========================================================================
   BYgf — Tema "Bybi": navigasi lewat maskot robot
   Robot melayang di kanan bawah semua halaman. Ketuk = ngobrol + animasi, tahan = menu
   navigasi melingkar (geser ke ikon lalu lepas). Hanya lapisan tampilan: memanggil
   App.UI.switchMainGroup yang sudah ada. Aktif hanya saat <html data-theme-preset="bybi">.
   ========================================================================== */
(function () {
    'use strict';
    const PRESET = 'bybi';
    const HOLD_MS = 420, MOVE_PX = 12, IDLE_SLEEP_MS = 15000, HINT_KEY = 'bygf.bybiHintShown';
    const ARC_START = 176, ARC_END = 274, RADII = [112, 168, 224];

    // [kunci grup di App.UI.NavGroups, ikon #ni-*, label]
    const NAV = [
        ['home', 'home', 'Beranda'], ['keuangan', 'keuangan', 'Keuangan'], ['daily', 'task', 'Tugas'], ['kuliah', 'kuliah', 'Kuliah'],
        ['makan', 'makan', 'Makan'], ['lemari', 'lemari', 'Lemari'], ['sholat', 'sholat', 'Sholat'], ['notes', 'notes', 'Notes'],
        ['laporan', 'laporan', 'Laporan'], ['settings', 'setting', 'Setting']
    ];
    const VAULT = ['vault', 'vault', 'Brankas'];
    // Lencana menu lama -> reaksi Bybi bila angkanya naik
    const BADGES = [
        { id: 'dailyNavBadge', mood: 'alert', anim: 'shake', text: 'Ada tugas yang perlu diperhatikan ⏰' },
        { id: 'kpNavBadge', mood: 'alert', anim: 'shake', text: 'Ada yang baru di Kuliah 🎓' },
        { id: 'shNavBadge', mood: 'happy', anim: 'wave', text: 'Ada sholat yang belum dicatat 🕌' },
        { id: 'lmNavBadge', mood: 'wow', anim: 'boing', text: 'Ada pakaian yang waktunya dicuci 🧺' }
    ];
    const LINES = {
        _: ['Halo! Ada yang bisa kubantu? 🤖', 'Tahan aku untuk buka menu ✨', 'Beep boop! Semangat ya 💛', 'Hehe, geli! 🤭', 'Aku siaga 24 jam, tanpa lembur 😎'],
        keuangan: ['Sudah catat pengeluaran hari ini? 💸', 'Cek saldo dulu sebelum jajan 😉'],
        daily: ['Cek tugas hari ini yuk ✅', 'Satu per satu, pasti beres 💪'],
        kuliah: ['Semangat kuliahnya! 🎓', 'Sudah cek jadwal hari ini?'],
        makan: ['Sudah makan? 🍜', 'Jangan lupa catat makanannya!'],
        lemari: ['Mau pakai baju apa hari ini? 👕', 'Cek yang waktunya dicuci 🧺'],
        sholat: ['Jangan lupa sholat ya 🕌', 'Tenang, satu waktu demi satu waktu 🌿'],
        notes: ['Tulis jurnal hari ini? 📔', 'Ada yang mau dicatat?']
    };

    const FACES = {
        idle: '<g class="bb-eyes"><ellipse class="bb-fe" cx="38" cy="46" rx="3.8" ry="5.2"/><ellipse class="bb-fe" cx="62" cy="46" rx="3.8" ry="5.2"/></g><path class="bb-se" d="M45.5 55.5q4.5 3.5 9 0"/>',
        happy: '<path class="bb-se" d="M32.5 49q5.5-9 11 0M56.5 49q5.5-9 11 0"/><path class="bb-fe" d="M43 54.5q7 9.5 14 0z"/>',
        sleepy: '<path class="bb-se" d="M32.5 47h11M56.5 47h11"/><path class="bb-se" d="M46.5 56h7"/>',
        wow: '<circle class="bb-fe" cx="38" cy="45" r="5.2"/><circle class="bb-fe" cx="62" cy="45" r="5.2"/><ellipse class="bb-fe" cx="50" cy="57" rx="3" ry="3.8"/>',
        alert: '<ellipse class="bb-fe" cx="38" cy="48" rx="3.8" ry="5"/><ellipse class="bb-fe" cx="62" cy="48" rx="3.8" ry="5"/><path class="bb-se" d="M31 38.5l13 3.5M69 38.5l-13 3.5"/><path class="bb-se" d="M45 57h10"/>',
        party: '<path class="bb-fe" transform="translate(38 46) scale(.55)" d="M0-9l2.6 6 6.4.6-4.9 4.2 1.5 6.3L0 4.7-5.6 8.1l1.5-6.3-4.9-4.2 6.4-.6z"/><path class="bb-fe" transform="translate(62 46) scale(.55)" d="M0-9l2.6 6 6.4.6-4.9 4.2 1.5 6.3L0 4.7-5.6 8.1l1.5-6.3-4.9-4.2 6.4-.6z"/><path class="bb-fe" d="M42 54q8 11 16 0z"/>'
    };

    const ROBOT_SVG = `<svg class="bb-svg" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="bbHead" cx=".3" cy=".22" r=".95"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#eef1f7"/><stop offset="1" stop-color="#a9b3c7"/></radialGradient>
        <linearGradient id="bbBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset="1" stop-color="#9aa6bc"/></linearGradient>
        <linearGradient id="bbVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303a5c"/><stop offset="1" stop-color="#090c19"/></linearGradient>
        <radialGradient id="bbPod" cx=".35" cy=".3" r=".9"><stop offset="0" style="stop-color:hsl(var(--hue-primary) 80% 78%)"/><stop offset="1" style="stop-color:hsl(var(--hue-primary) 65% 38%)"/></radialGradient>
        <radialGradient id="bbBulb" cx=".35" cy=".3" r=".9"><stop offset="0" style="stop-color:hsl(var(--hue-primary) 100% 90%)"/><stop offset="1" style="stop-color:hsl(var(--hue-primary) 100% 55%)"/></radialGradient>
        <radialGradient id="bbGloss" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="bbThrust" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:hsl(var(--hue-primary) 100% 70%)"/><stop offset="1" style="stop-color:hsl(var(--hue-primary) 100% 70%);stop-opacity:0"/></radialGradient>
      </defs>
      <ellipse class="bb-shadow" cx="50" cy="96" rx="20" ry="3.5" fill="#000"/>
      <g class="bb-float">
        <ellipse class="bb-glow" cx="50" cy="92" rx="13" ry="4" fill="url(#bbThrust)"/>
        <g class="bb-arm-l"><ellipse cx="24" cy="74" rx="6" ry="9" fill="url(#bbBody)" transform="rotate(14 24 74)"/></g>
        <g class="bb-arm-r"><ellipse cx="76" cy="74" rx="6" ry="9" fill="url(#bbBody)" transform="rotate(-14 76 74)"/></g>
        <rect x="32" y="64" width="36" height="27" rx="13" fill="url(#bbBody)"/>
        <ellipse cx="42" cy="70" rx="7" ry="3" fill="#fff" opacity=".55"/>
        <circle cx="50" cy="78" r="4.2" style="fill:hsl(var(--hue-primary) 100% 68%)" opacity=".95"/><circle cx="50" cy="78" r="6.5" style="fill:hsl(var(--hue-primary) 100% 68%)" opacity=".2"/>
        <ellipse cx="12" cy="47" rx="5.5" ry="9.5" fill="url(#bbPod)"/><ellipse cx="88" cy="47" rx="5.5" ry="9.5" fill="url(#bbPod)"/>
        <rect x="48.5" y="10" width="3" height="14" rx="1.5" fill="#9aa6bc"/>
        <g class="bb-bulb"><circle cx="50" cy="9" r="8" style="fill:hsl(var(--hue-primary) 100% 70%)" opacity=".28"/><circle cx="50" cy="9" r="5" fill="url(#bbBulb)"/></g>
        <rect x="12" y="22" width="76" height="50" rx="25" fill="url(#bbHead)" stroke="#8d99b0" stroke-opacity=".5" stroke-width=".8"/>
        <rect x="20" y="30" width="60" height="34" rx="17" fill="url(#bbVisor)"/>
        <ellipse cx="38" cy="35.5" rx="15" ry="3.6" fill="#fff" opacity=".16" transform="rotate(-7 38 35.5)"/>
        <g class="bb-face"></g>
        <g class="bb-zzz"><text x="70" y="30">z</text><text x="76" y="24">z</text><text x="82" y="18">Z</text></g>
        <ellipse cx="32" cy="27.5" rx="13" ry="5" fill="url(#bbGloss)" transform="rotate(-14 32 27.5)"/>
      </g>
    </svg>`;

    const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* abaikan */ } };
    const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } } };
    const $ = id => document.getElementById(id);

    let mounted = false, root, bot, svg, face, bubble, dot, menu, items, scrim, themeObs, badgeObs;
    let sleeping = false, moodT, idleT, bubT, hintT, lastReact = 0, tapN = 0;
    let menuOpen = false, centers = [], hot = -1, holdT, held = false, moved = false, sx = 0, sy = 0, wasOpen = false;
    let badgeCounts = {};

    /* ---------- pembantu data ---------- */
    function groups() {
        const admin = !!(window.App && App.State && App.State.isAdmin);   // admin hanya melihat Brankas (lihat auth.js)
        return admin ? [VAULT] : NAV;
    }
    function activeGroup() { return (window.App && App.UI && App.UI._activeGroup) || 'home'; }
    function go(g) { if (window.App && App.UI) App.UI.switchMainGroup(g); }

    /* ---------- ekspresi & animasi ---------- */
    function setMood(name, ms) {
        if (!mounted) return;
        clearTimeout(moodT);
        face.innerHTML = FACES[name] || FACES.idle; root.dataset.mood = name;
        if (ms) moodT = setTimeout(() => setMood(sleeping ? 'sleepy' : 'idle'), ms);
    }
    function anim(name) {
        if (!mounted) return;
        svg.classList.remove('bb-a-boing', 'bb-a-dance', 'bb-a-shake', 'bb-a-wave');
        if (reduced()) return;
        void svg.getBoundingClientRect(); svg.classList.add('bb-a-' + name);
    }
    function say(text, ms) {
        if (!mounted || menuOpen) return;
        bubble.hidden = false; bubble.textContent = text;
        bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
        clearTimeout(bubT); bubT = setTimeout(() => { if (bubble) bubble.hidden = true; }, ms || 3600);
    }
    function sparks(n) {
        if (!mounted || reduced()) return;
        for (let i = 0; i < n; i++) {
            const s = document.createElement('span'); s.className = 'bb-spark'; s.textContent = pick(['✨', '⭐', '💚', '✦']);
            const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 26;
            s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', (Math.sin(a) * r - 12) + 'px');
            bot.appendChild(s); setTimeout(() => s.remove(), 850);
        }
    }
    function setBadge(n) { if (!mounted) return; n = Math.max(0, n | 0); dot.hidden = !n; dot.textContent = n > 9 ? '9+' : n; }

    /* ---------- tidur saat tidak disentuh ---------- */
    function touched() { const was = sleeping; sleeping = false; clearTimeout(idleT); idleT = setTimeout(sleep, IDLE_SLEEP_MS); return was; }
    function sleep() { if (!mounted) return; sleeping = true; setMood('sleepy'); say('Zzz… ketuk aku kalau butuh bantuan 😴', 2600); }

    /* ---------- ketuk ---------- */
    function tap() {
        const woke = touched(); tapN++; anim('boing'); vib(8);
        if (woke) { setMood('wow', 700); setTimeout(() => { setMood('happy', 1600); say('Hehe, aku bangun! Ada apa?'); }, 700); return; }
        setMood(pick(['happy', 'happy', 'wow']), 1500);
        say(pick((LINES[activeGroup()] || []).concat(LINES._)));
        if (tapN % 5 === 0) { sparks(10); anim('dance'); setMood('party', 2200); } else sparks(4);
    }

    /* ---------- reaksi otomatis dari lencana menu yang sudah ada ---------- */
    function badgeCount(el) { return el && el.classList.contains('show') ? (parseInt(el.textContent, 10) || 1) : 0; }
    function readBadges(announce) {
        let total = 0, fired = false;
        BADGES.forEach(b => {
            const c = badgeCount($(b.id)); total += c;
            if (announce && c > (badgeCounts[b.id] || 0) && !fired && Date.now() - lastReact > 4000) {
                fired = true; lastReact = Date.now(); touched();
                setMood(b.mood, 3000); anim(b.anim); say(b.text, 4200); vib([20, 60, 20]);
            }
            badgeCounts[b.id] = c;
        });
        setBadge(total);
    }

    /* ---------- menu tahan ---------- */
    function buildMenu() {
        const r = bot.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, W = innerWidth, H = innerHeight;
        const list = groups(), cur = activeGroup();
        items.innerHTML = ''; centers = [];
        list.forEach(([g, icon, label], i) => {
            const ang = (ARC_START + (list.length > 1 ? i * (ARC_END - ARC_START) / (list.length - 1) : (ARC_END - ARC_START) / 2)) * Math.PI / 180, rad = RADII[i % RADII.length];
            let x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
            x = Math.min(Math.max(x, 30), W - 30); y = Math.min(Math.max(y, 30), H - 44);
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'bb-mi' + (g === cur ? ' cur' : ''); b.setAttribute('role', 'menuitem'); b.dataset.g = g; b.setAttribute('aria-label', label);
            b.style.left = (x - 23) + 'px'; b.style.top = (y - 23) + 'px';
            b.style.setProperty('--dx', (cx - x) + 'px'); b.style.setProperty('--dy', (cy - y) + 'px'); b.style.setProperty('--d', (i * 26) + 'ms');
            b.innerHTML = `<svg aria-hidden="true"><use href="#ni-${icon}"/></svg><span>${label}</span>`;
            b.addEventListener('click', () => choose(g));
            items.appendChild(b); centers.push({ g, label, x, y });
        });
    }
    function openMenu(focusFirst) {
        if (menuOpen || !mounted) return;
        menuOpen = true; clearTimeout(bubT); bubble.hidden = true; buildMenu();
        menu.hidden = false; bot.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => menu.classList.add('open'));
        setMood('happy'); anim('boing');
        if (focusFirst) { const c = items.querySelector('.cur') || items.firstChild; if (c) c.focus(); }
    }
    function closeMenu(refocus) {
        if (!menuOpen) return;
        menuOpen = false; hot = -1; menu.classList.remove('open'); bot.setAttribute('aria-expanded', 'false');
        setTimeout(() => { if (!menuOpen && menu) menu.hidden = true; }, 220);
        setMood(sleeping ? 'sleepy' : 'idle'); if (refocus) bot.focus();
    }
    function hover(px, py) {
        let best = -1, d = 34;
        centers.forEach((c, i) => { const k = Math.hypot(c.x - px, c.y - py); if (k < d) { d = k; best = i; } });
        if (best !== hot) {
            hot = best;
            items.querySelectorAll('.bb-mi').forEach((el, i) => el.classList.toggle('hot', i === best));
            if (best >= 0) vib(6);
        }
    }
    function choose(g) {
        const c = centers.find(x => x.g === g), label = c ? c.label : '';
        closeMenu(false); go(g); setMood('happy', 1800); anim('wave'); say('Ke ' + label + '! ➜', 1800);
    }
    function onKey(e) {
        if (!menuOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
        const els = Array.from(items.querySelectorAll('.bb-mi')), i = els.indexOf(document.activeElement);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1 + els.length) % els.length].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length].focus(); }
    }

    /* ---------- gestur ---------- */
    function onDown(e) {
        if (e.button > 0) return;
        try { bot.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
        held = false; moved = false; sx = e.clientX; sy = e.clientY; wasOpen = menuOpen; bot.classList.add('press'); touched();
        if (!wasOpen) holdT = setTimeout(() => { held = true; vib(18); openMenu(false); }, HOLD_MS);
    }
    function onMove(e) {
        if (held) { hover(e.clientX, e.clientY); return; }
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > MOVE_PX) { moved = true; clearTimeout(holdT); }
    }
    function onUp() {
        clearTimeout(holdT); bot.classList.remove('press');
        if (held) { held = false; if (hot >= 0) choose(centers[hot].g); return; }  // dilepas di ikon = pilih; di tempat lain = menu tetap terbuka
        if (moved) return;
        if (wasOpen) { closeMenu(false); return; }
        tap();
    }
    function onCancel() { clearTimeout(holdT); bot.classList.remove('press'); held = false; }
    function onClick(e) { if (e.detail === 0) { if (menuOpen) closeMenu(false); else tap(); } }  // papan ketik: Enter / Spasi
    function onBotKey(e) { if (['ArrowUp', 'ContextMenu', 'm', 'M'].includes(e.key)) { e.preventDefault(); openMenu(true); } }

    /* ---------- pasang / lepas ---------- */
    function mount() {
        if (mounted) return;
        const host = $('appContainer'); if (!host) return;
        mounted = true;
        menu = document.createElement('div'); menu.className = 'bb-menu'; menu.hidden = true;
        menu.innerHTML = '<div class="bb-scrim"></div><div class="bb-items" role="menu" aria-label="Navigasi"></div>';
        items = menu.querySelector('.bb-items'); scrim = menu.querySelector('.bb-scrim');
        root = document.createElement('div'); root.className = 'bb-root'; root.dataset.mood = 'idle';
        root.innerHTML = `<div class="bb-bubble" role="status" aria-live="polite" hidden></div>
            <button class="bb-bot" type="button" aria-label="Bybi, asisten BYgf. Ketuk untuk ngobrol, tahan untuk menu navigasi" aria-haspopup="menu" aria-expanded="false">${ROBOT_SVG}<span class="bb-dot" hidden>0</span></button>`;
        bubble = root.querySelector('.bb-bubble'); bot = root.querySelector('.bb-bot'); svg = root.querySelector('.bb-svg'); face = root.querySelector('.bb-face'); dot = root.querySelector('.bb-dot');
        host.append(menu, root);

        scrim.addEventListener('click', () => closeMenu(false));
        bot.addEventListener('contextmenu', e => e.preventDefault());
        bot.addEventListener('pointerdown', onDown); bot.addEventListener('pointermove', onMove);
        bot.addEventListener('pointerup', onUp); bot.addEventListener('pointercancel', onCancel);
        bot.addEventListener('click', onClick); bot.addEventListener('keydown', onBotKey);
        document.addEventListener('keydown', onKey);
        svg.addEventListener('animationend', e => { if (e.target === svg) svg.classList.remove('bb-a-boing', 'bb-a-dance', 'bb-a-shake'); });
        root.querySelector('.bb-arm-r').addEventListener('animationend', () => svg.classList.remove('bb-a-wave'));

        badgeCounts = {}; readBadges(false);
        badgeObs = new MutationObserver(() => readBadges(true));
        BADGES.forEach(b => { const el = $(b.id); if (el) badgeObs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });

        setMood('idle'); touched();
        if (!store.get(HINT_KEY)) { hintT = setTimeout(() => { say('Ketuk aku untuk ngobrol, tahan untuk buka menu 👆', 5200); store.set(HINT_KEY, '1'); }, 900); }
    }
    function unmount() {
        if (!mounted) return;
        [moodT, idleT, bubT, hintT, holdT].forEach(clearTimeout);
        document.removeEventListener('keydown', onKey);
        if (badgeObs) { badgeObs.disconnect(); badgeObs = null; }
        if (root) root.remove(); if (menu) menu.remove();
        root = bot = svg = face = bubble = dot = menu = items = scrim = null;
        mounted = false; menuOpen = false; sleeping = false; held = false;
    }
    function sync() {
        const on = document.documentElement.getAttribute('data-theme-preset') === PRESET;
        if (on) mount(); else unmount();
    }
    function start() {
        sync();
        themeObs = new MutationObserver(sync);
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-preset'] });
    }
    window.BybiNav = { say, setMood, setBadge, openMenu, closeMenu, isActive: () => mounted };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
