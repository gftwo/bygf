/* ==========================================================================
   BYgf — Tema "Malam": sidebar kaca dengan submenu akordeon (gaya video referensi)
   Memakai ulang markup .side-nav yang sudah ada (id, lencana, SNav tetap utuh) dan menambahkan:
   · panah + submenu di tiap grup yang punya lebih dari satu sub-tab (data dari App.UI.NavGroups),
   · tombol ciutkan (desktop: jadi rel ikon, HP: tutup laci),
   · tombol menu melayang di HP (membuka laci dari kiri).
   Hanya lapisan tampilan; navigasi tetap lewat App.UI.switchMainGroup / switchTab.
   Aktif hanya saat <html data-theme-preset="malam">.
   ========================================================================== */
(function () {
    'use strict';
    const PRESET = 'malam', COLLAPSE_KEY = 'bygf.gnCollapsed';
    const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const BURGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    const UP = '<svg class="ni" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
    const $ = id => document.getElementById(id);
    const isOn = () => document.documentElement.getAttribute('data-theme-preset') === PRESET;
    const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } } };

    let decorated = false, hooked = false, openG = null, fab = null, fabLabel = null, fabIcon = null;

    function groupOfButton(btn) { const m = /^navGroup(.+)$/.exec(btn.id || ''); return m ? m[1].charAt(0).toLowerCase() + m[1].slice(1) : null; }
    function subsOf(g) { try { return (App.UI.NavGroups[g] || {}).subs || []; } catch (e) { return []; } }

    // Grup & sub-tab yang sedang tampil, dibaca dari halaman yang aktif (tahan terhadap perubahan tab dari tempat lain)
    function current() {
        const U = window.App && App.UI; if (!U) return { g: 'home', sub: null };
        const sec = document.querySelector('.app-section.active'), id = sec ? sec.id.replace(/^view-/, '') : null;
        if (id && U.NavGroups) for (const g of Object.keys(U.NavGroups)) if (U.NavGroups[g].subs.some(s => s.id === id)) return { g, sub: id };
        const g = U._activeGroup || 'home'; return { g, sub: (U._lastSubTab || {})[g] || null };
    }

    /* ---------- bangun elemen tambahan (sekali) ---------- */
    function decorate() {
        if (decorated) return;
        const menu = document.querySelector('#snPanel .sn-menu'), brand = document.querySelector('#snPanel .sn-brand');
        if (!menu || !brand) return;
        decorated = true;
        menu.querySelectorAll('.nav-item').forEach(btn => {
            const g = groupOfButton(btn); if (!g) return;
            btn.dataset.gnGroup = g;
            const label = btn.querySelector('.nav-label'); if (label) btn.title = label.textContent.trim();
            const chev = document.createElement('span'); chev.className = 'gn-chev'; chev.innerHTML = CHEV; btn.appendChild(chev);
            const sub = document.createElement('div'); sub.className = 'gn-sub'; sub.id = 'gnSub-' + g; sub.innerHTML = '<div class="gn-sub-in"></div>';
            btn.after(sub);
        });
        const col = document.createElement('button'); col.type = 'button'; col.className = 'gn-collapse'; col.innerHTML = BURGER;
        col.setAttribute('aria-label', 'Ciutkan atau tutup menu'); col.addEventListener('click', onCollapse); brand.append(col);

        fab = document.createElement('button'); fab.type = 'button'; fab.className = 'gn-fab'; fab.setAttribute('aria-label', 'Buka menu navigasi'); fab.setAttribute('aria-haspopup', 'true');
        fab.innerHTML = '<svg class="ni" aria-hidden="true"><use href="#ni-home"/></svg><span class="gn-fab-label">Beranda</span>' + UP;
        fabIcon = fab.querySelector('use'); fabLabel = fab.querySelector('.gn-fab-label');
        fab.addEventListener('click', () => { if (window.SNav) SNav.open(); const a = document.querySelector('#snPanel .nav-item.active') || document.querySelector('#snPanel .nav-item'); if (a) a.focus(); });
        ($('appContainer') || document.body).append(fab);

        // Fase tangkap: ambil alih klik grup berisi submenu sebelum onclick bawaan berjalan
        menu.addEventListener('click', onMenuClick, true);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOn() && !isDesktop() && $('snPanel') && $('snPanel').classList.contains('is-open')) { SNav.close(); if (fab) fab.focus(); } });
    }

    /* ---------- interaksi ---------- */
    function onMenuClick(e) {
        if (!isOn()) return;
        const subBtn = e.target.closest('.gn-sub-item');
        if (subBtn) { e.preventDefault(); e.stopPropagation(); goSub(subBtn.dataset.g, subBtn.dataset.sub); return; }
        const item = e.target.closest('.nav-item'); if (!item || !item.dataset.gnGroup) return;
        const g = item.dataset.gnGroup;
        if (isDesktop() && document.documentElement.classList.contains('gn-collapsed')) return;   // rel ikon: langsung pindah halaman
        if (subsOf(g).length > 1) { e.preventDefault(); e.stopPropagation(); openG = (openG === g) ? null : g; renderSubs(); }
    }
    function goSub(g, sub) {
        const U = App.UI; if (!U || !U.NavGroups[g]) return;
        U._lastSubTab = U._lastSubTab || {}; U._lastSubTab[g] = sub;   // switchMainGroup membuka sub-tab terakhir => langsung ke sub-tab yang dipilih
        U.switchMainGroup(g);
    }
    function onCollapse() {
        if (!isDesktop()) { if (window.SNav) SNav.close(); if (fab) fab.focus(); return; }
        const on = document.documentElement.classList.toggle('gn-collapsed');
        store.set(COLLAPSE_KEY, on ? '1' : '0');
    }

    /* ---------- render submenu & penanda aktif ---------- */
    function renderSubs() {
        const cur = current();
        document.querySelectorAll('#snPanel .nav-item[data-gn-group]').forEach(btn => {
            const g = btn.dataset.gnGroup, subs = subsOf(g), multi = subs.length > 1, wrap = $('gnSub-' + g);
            const visible = btn.style.display !== 'none', open = multi && visible && openG === g;
            if (multi) { btn.setAttribute('data-gn-multi', ''); btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-controls', 'gnSub-' + g); }
            else { btn.removeAttribute('data-gn-multi'); btn.removeAttribute('aria-expanded'); btn.removeAttribute('aria-controls'); }
            btn.classList.toggle('active', g === cur.g);
            if (!wrap) return;
            wrap.classList.toggle('open', open);
            wrap.firstChild.innerHTML = multi ? subs.map(s => `<button type="button" class="gn-sub-item${g === cur.g && s.id === cur.sub ? ' on' : ''}" data-g="${esc(g)}" data-sub="${esc(s.id)}"${g === cur.g && s.id === cur.sub ? ' aria-current="page"' : ''}>${esc(s.label)}</button>`).join('') : '';
        });
        updateFab(cur);
    }
    function updateFab(cur) {
        if (!fab) return;
        const btn = document.querySelector('#snPanel .nav-item[data-gn-group="' + cur.g + '"]'); if (!btn) return;
        const use = btn.querySelector('svg.ni use'), label = btn.querySelector('.nav-label');
        if (use && fabIcon) fabIcon.setAttribute('href', use.getAttribute('href'));
        if (label && fabLabel) fabLabel.textContent = label.textContent.trim();
    }
    function syncNav() {
        if (!isOn()) return;
        decorate();
        const cur = current(); openG = subsOf(cur.g).length > 1 ? cur.g : null;
        renderSubs();
    }

    /* ---------- kaitkan ke navigasi yang ada ---------- */
    function hook() {
        if (hooked) return true;
        if (!window.App || !App.UI || !App.UI.switchMainGroup || !App.UI.switchTab) return false;
        hooked = true;
        const U = App.UI, main = U.switchMainGroup, tab = U.switchTab;
        U.switchMainGroup = function () { const r = main.apply(this, arguments); syncNav(); return r; };
        U.switchTab = function () { const r = tab.apply(this, arguments); syncNav(); return r; };
        return true;
    }
    function syncTheme() {
        const on = isOn();
        document.documentElement.classList.toggle('gn-collapsed', on && store.get(COLLAPSE_KEY) === '1');
        if (on) { decorate(); syncNav(); } else if (window.SNav && $('snPanel')) { SNav.close(); }
    }
    function start() {
        let n = 0; const t = setInterval(() => { if (hook() || ++n > 100) { clearInterval(t); syncTheme(); } }, 100);
        syncTheme();
        new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-preset'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
