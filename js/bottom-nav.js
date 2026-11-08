/* ==========================================================================
   BYgf — Navigasi bawah (HP/tablet, < 1024px)
   4 tab utama + tombol "Lainnya" (panel berisi semua menu). Hanya lapisan tampilan:
   memanggil App.UI.switchMainGroup / switchTab yang sudah ada.
   ========================================================================== */
(function () {
    'use strict';
    const MAIN = [
        { g: 'home', icon: 'home', label: 'Beranda' },
        { g: 'keuangan', icon: 'keuangan', label: 'Keuangan' },
        { g: 'daily', icon: 'task', label: 'Tugas', badge: 'dailyNavBadge' },
        { g: 'kuliah', icon: 'kuliah', label: 'Kuliah', badge: 'kpNavBadge' },
    ];
    const MORE = [
        { g: 'makan', icon: 'makan', label: 'Makan' },
        { g: 'notes', icon: 'notes', label: 'Notes' },
        { g: 'vault', icon: 'vault', label: 'Brankas' },
        { g: 'laporan', icon: 'laporan', label: 'Laporan' },
        { g: 'settings', icon: 'setting', label: 'Setting' }
    ];
    const MORE_GROUPS = MORE.map(m => m.g);
    const $ = id => document.getElementById(id);
    let bar, sheet, active = 'home', lastFocus = null;

    const svg = k => `<svg class="ni" aria-hidden="true"><use href="#ni-${k}"/></svg>`;
    const badgeHTML = id => (id ? `<span class="bn-badge" data-src="${id}"></span>` : '');
    const item = (m, cls) => `<button type="button" class="${cls}" data-g="${m.g}"><span class="bn-ico">${svg(m.icon)}${badgeHTML(m.badge)}</span><span class="bn-lbl">${m.label}</span></button>`;

    function build() {
        if ($('bgBottomNav')) return;
        bar = document.createElement('nav'); bar.id = 'bgBottomNav'; bar.className = 'bn-bar'; bar.setAttribute('aria-label', 'Menu utama');
        bar.innerHTML = MAIN.map(m => item(m, 'bn-item')).join('') + `<button type="button" class="bn-item" id="bnMore" aria-haspopup="dialog" aria-expanded="false"><span class="bn-ico"><svg class="ni" aria-hidden="true"><use href="#ni-more"/></svg></span><span class="bn-lbl">Lainnya</span></button>`;
        sheet = document.createElement('div'); sheet.id = 'bgMoreSheet'; sheet.className = 'bn-sheet'; sheet.hidden = true;
        sheet.innerHTML = `<div class="bn-backdrop" data-close></div><div class="bn-panel" role="dialog" aria-modal="true" aria-label="Semua menu"><div class="bn-grab"></div><div class="bn-title">Semua menu</div><div class="bn-grid" id="bnGrid"></div></div>`;
        ($('appContainer') || document.body).append(bar, sheet);
        bar.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.id === 'bnMore') return openSheet();
            go(b.dataset.g);
        });
        sheet.addEventListener('click', e => {
            if (e.target.closest('[data-close]')) return closeSheet();
            const b = e.target.closest('[data-g]'); if (!b) return;
            closeSheet(true); if (b.dataset.g === 'admin') adminGo(); else go(b.dataset.g);
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
        // lencana mengikuti elemen lencana lama (dihitung oleh modul Task/Kuliah)
        ['dailyNavBadge', 'kpNavBadge'].forEach(id => { const src = $(id); if (src) new MutationObserver(syncBadges).observe(src, { attributes: true, childList: true, characterData: true, subtree: true }); });
        syncBadges();
    }
    function go(g) { if (window.App && App.UI) App.UI.switchMainGroup(g); }
    function adminGo() { const t = $('navAdminTab'); if (window.App && App.UI) App.UI.switchTab('admin', t); mark('admin'); }
    function syncBadges() {
        document.querySelectorAll('.bn-badge').forEach(b => {
            const src = $(b.dataset.src), show = src && src.classList.contains('show') && src.textContent.trim();
            b.textContent = show ? src.textContent.trim() : ''; b.classList.toggle('show', !!show);
        });
    }
    function mark(g) {
        active = g; if (!bar) return;
        const inMore = MORE_GROUPS.includes(g) || g === 'admin';
        bar.querySelectorAll('.bn-item[data-g]').forEach(b => { const on = b.dataset.g === g; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
        const more = $('bnMore'); if (more) more.classList.toggle('on', inMore);
    }
    function openSheet() {
        const list = MORE;
        $('bnGrid').innerHTML = list.map(m => item(m, 'bn-cell' + (m.g === active ? ' on' : ''))).join('');
        lastFocus = document.activeElement; sheet.hidden = false; $('bnMore').setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => { sheet.classList.add('open'); const f = sheet.querySelector('.bn-cell.on, .bn-cell'); if (f) f.focus(); });
    }
    function closeSheet(skipFocus) {
        sheet.classList.remove('open'); $('bnMore').setAttribute('aria-expanded', 'false');
        setTimeout(() => { sheet.hidden = true; }, 220);
        if (!skipFocus && lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function hook() {
        if (!window.App || !App.UI || !App.UI.switchMainGroup || App.UI.__bnHooked) return false;
        const orig = App.UI.switchMainGroup; App.UI.__bnHooked = true;
        App.UI.switchMainGroup = function (g) { const r = orig.apply(this, arguments); mark(this._activeGroup || g); return r; };
        mark(App.UI._activeGroup || 'home'); return true;
    }
    function start() { build(); let n = 0; const t = setInterval(() => { if (hook() || ++n > 100) clearInterval(t); }, 100); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
