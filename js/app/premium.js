import { App } from './core.js';

App.Premium = {
    applyState() {
        // Semua fitur (tema, dsb) terbuka untuk semua pengguna — tidak ada lagi status premium/reguler
        document.body.classList.add('is-premium');
        if(document.getElementById('userRoleBadge')) { document.getElementById('userRoleBadge').textContent = 'Pengguna'; document.getElementById('userRoleBadge').style.color = 'var(--text-muted)'; }
    }
};
