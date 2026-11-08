import { initializeApp, getDatabase } from './firebase.js';
import { App } from './core.js';
import './state.js';
import './config.js';
import './auth.js';
import './premium.js';
import './db.js';
import './theme.js';
import './quick-scan.js';
import './quick-template.js';
import './backup.js';
import './utils.js';
import './ui.js';
import './handlers.js';
import './insights.js';
import './pwa.js';
import './guard.js';
import './notify.js';

// Titik masuk aplikasi: App sudah terisi semua modul di atas.

App.Init = function () {
        this.UI.init();
        if (typeof __firebase_config !== 'undefined') { const canvasConfig = JSON.parse(__firebase_config); this.Config.Firebase.apiKey = canvasConfig.apiKey; this.Config.Firebase.authDomain = canvasConfig.authDomain; this.Config.Firebase.projectId = canvasConfig.projectId; this.Config.Firebase.storageBucket = canvasConfig.storageBucket; this.Config.Firebase.messagingSenderId = canvasConfig.messagingSenderId; this.Config.Firebase.appId = canvasConfig.appId; }
        const fApp = initializeApp(this.Config.Firebase); this.Auth.init(fApp); this.DB.dbInstance = getDatabase(fApp);
        const savedSet = localStorage.getItem('backup_v6'); if(savedSet) { try { const parsed = JSON.parse(savedSet); if(parsed.settings) this.State.settings = {...this.State.settings, ...parsed.settings}; } catch(e){} }

        // 📶 Pantau koneksi: kalau offline, tandai statusnya; begitu online lagi, coba sinkron ulang
        // supaya perubahan yang sempat cuma tersimpan lokal ikut terkirim ke cloud.
        window.addEventListener('offline', () => this.UI.updateSyncStatus('error'));
        window.addEventListener('online', () => { if (this.State.user) { this.DB.save(); this.UI.updateSyncStatus('active'); this.UI.showToast('Kembali online, menyinkronkan data...', 'success'); } });
};

window.App = App; // dipakai onclick="App.xxx" di index.html & script Tugas/Kuliah
document.addEventListener('DOMContentLoaded', () => App.Init());
