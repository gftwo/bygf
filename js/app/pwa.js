import { App } from './core.js';

// PWA install prompt, popup riwayat, dan shortcut URL (?action=add / ?action=history)
// ── PWA Install Prompt ──
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstall = e;
    // Tampilkan banner setelah 3 detik (beri waktu app load)
    if(!localStorage.getItem('pwa_install_dismissed')) {
        setTimeout(() => {
            const b = document.getElementById('installBanner');
            if(b) b.classList.add('show');
        }, 3000);
    }
});
document.getElementById('installBtn')?.addEventListener('click', async () => {
    const b = document.getElementById('installBanner');
    if(_deferredInstall) {
        _deferredInstall.prompt();
        const { outcome } = await _deferredInstall.userChoice;
        if(outcome === 'accepted') { if(b) b.classList.remove('show'); }
        _deferredInstall = null;
    }
});
document.getElementById('installClose')?.addEventListener('click', () => {
    document.getElementById('installBanner')?.classList.remove('show');
    localStorage.setItem('pwa_install_dismissed', '1');
});
window.addEventListener('appinstalled', () => {
    document.getElementById('installBanner')?.classList.remove('show');
    _deferredInstall = null;
});

// ── History Premium Popup handlers ──
document.getElementById('historyPopupClose')?.addEventListener('click', () => {
    if(document.getElementById('historyPopupDontShow')?.checked)
        localStorage.setItem('history_popup_hide', '1');
    document.getElementById('historyPremiumPopup')?.classList.remove('show');
});
document.getElementById('historyPremiumPopup')?.addEventListener('click', (e) => {
    if(e.target === e.currentTarget) {
        if(document.getElementById('historyPopupDontShow')?.checked)
            localStorage.setItem('history_popup_hide', '1');
        e.currentTarget.classList.remove('show');
    }
});

// ── Handle shortcut URL params (?action=add / ?action=history) ──
window.addEventListener('load', () => {
    const action = new URLSearchParams(window.location.search).get('action');
    if(action === 'add') setTimeout(() => App.UI.showModal('txModal'), 800);
    else if(action === 'history') setTimeout(() => App.UI.switchTab('history', document.getElementById('navHistory')), 600);
});

// ── Service worker: akses offline (hanya cache aset, tanpa notifikasi push) ──
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker tidak aktif (diabaikan):', err)); });
}
