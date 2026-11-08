import { ref, set, onValue } from './firebase.js';
import { App } from './core.js';

App.DB = {
    dbInstance: null, listener: null,
    init() {},
    applyData(data) {
        App.State.isPremium = true; App.State.transactions = data.transactions || [];
        App.State.recurring = data.recurring || []; App.State.customCategories = data.customCategories || [];
        App.State.budgets = data.budgets || []; App.State.paylaters = data.paylaters || [];
        App.State.transfers = data.transfers || []; App.State.debts = data.debts || []; App.State.quickTemplates = data.quickTemplates || [];
        App.State.trashedTransactions = data.trashedTransactions || [];
        if(data.budgetAllocation) App.State.budgetAllocation = data.budgetAllocation;
        if(data.categoryBucketMap) App.State.categoryBucketMap = {...App.State.categoryBucketMap, ...data.categoryBucketMap};
        if(data.todos && window.TugasProBridge) window.TugasProBridge.applyExternalTodos(data.todos);
        if(data.kuliah && window.KuliahProBridge) window.KuliahProBridge.applyExternalData(data.kuliah);
        if(data.modules && window.AppModules) AppModules.apply(data.modules);
        if(window.AppModules && AppModules.afterCloudLoad) AppModules.afterCloudLoad(data);
        if(data.settings) App.State.settings = {...App.State.settings, ...data.settings};
    },
    getLocalMirror(uid) {
        try { const raw = localStorage.getItem('cloud_cache_' + uid); return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
    },
    saveLocalMirror(uid, dataToSave) {
        try {
            const cacheKey = 'cloud_cache_' + uid;
            const prevRaw = localStorage.getItem(cacheKey);
            if (prevRaw) {
                try {
                    const prev = JSON.parse(prevRaw);
                    const histKey = 'cloud_cache_history_' + uid;
                    let hist = []; try { hist = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch(e){}
                    const { modules: _m, ...prevLite } = prev; // riwayat cadangan keuangan tanpa modul (foto bisa besar)
                    hist.unshift({ savedAt: prev.updatedAt || new Date().toISOString(), txCount: (prev.transactions||[]).length, data: prevLite });
                    hist = hist.slice(0, 10);
                    localStorage.setItem(histKey, JSON.stringify(hist));
                } catch(e){}
            }
            localStorage.setItem(cacheKey, JSON.stringify(dataToSave));
        } catch(e) { console.warn('Gagal simpan cadangan lokal:', e); }
    },
    pendingKey(uid) { return 'bygf.pendingSync.' + uid; },
    hasPending(uid) { try { return !!localStorage.getItem(this.pendingKey(uid || (App.State.user && App.State.user.uid))); } catch(e) { return false; } },
    _watchConnection() { // status online/offline dari Firebase + browser
        if (this._connWatch || !this.dbInstance) return; this._connWatch = true;
        const setOn = on => {
            const was = App.State.online; App.State.online = on;
            App.UI.updateSyncStatus(on ? 'active' : 'offline');
            if (was !== undefined && was !== on) App.UI.showToast(on ? (this.hasPending() ? 'Kembali online — menyinkronkan perubahan…' : 'Kembali online') : 'Kamu offline — data tetap tersimpan di perangkat', on ? 'success' : 'info');
        };
        try { onValue(ref(this.dbInstance, '.info/connected'), snap => setOn(snap.val() === true)); } catch(e) { /* abaikan */ }
        window.addEventListener('offline', () => setOn(false));
    },
    _finishLoad() { // dipakai bersama oleh jalur online & jalur offline (cermin lokal)
        App.State.isLoading = false; App.Premium.applyState(); App.Theme.init(); App.UI.renderCategoriesSelect();
            // Cuma pindah ke tab Keuangan sekali di awal (pas baru login/buka app), bukan tiap kali
            // ada data baru masuk — sebelumnya ini bikin app "kelempar balik" ke Keuangan tiap kali
            // nambah/ubah apa pun di tab Kuliah (absen, tugas, dst) karena tiap App.DB.save() bikin
            // listener realtime ini kepanggil lagi.
            if(!App.State._navInitDone){ App.State._navInitDone = true; App.UI.switchMainGroup('home'); }
            App.UI.renderAll(); if(App.Guard && !App.State._guardDone){ App.State._guardDone = true; App.Guard.onLoaded(); if(App.Notify) App.Notify.onLoaded(); } setTimeout(() => { if(window.AppNotifyQueue) window.AppNotifyQueue.register('finance-alert', () => App.Handlers.checkStartupAlerts()); else App.Handlers.checkStartupAlerts(); }, 700);
    },
    listen(uid) {
        App.UI.updateSyncStatus('connecting'); if (this.listener) this.listener();
        if (App.Auth.isDummy) {
            App.UI.updateSyncStatus('active'); const localData = localStorage.getItem('dummy_db_' + uid);
            if (localData) {
                this.applyData(JSON.parse(localData));
            } else { this.save(); }
            App.State.isLoading = false; App.Premium.applyState(); App.Theme.init(); App.UI.renderCategoriesSelect();
            if(!App.State._navInitDone){ App.State._navInitDone = true; App.UI.switchMainGroup('home'); }
            App.UI.renderAll(); if(App.Guard && !App.State._guardDone){ App.State._guardDone = true; App.Guard.onLoaded(); if(App.Notify) App.Notify.onLoaded(); } setTimeout(() => { if(window.AppNotifyQueue) window.AppNotifyQueue.register('finance-alert', () => App.Handlers.checkStartupAlerts()); else App.Handlers.checkStartupAlerts(); }, 700);
            return;
        }

        const dbRef = ref(this.dbInstance, `users/${uid}/appData`);
        this._watchConnection();
        clearTimeout(this._loadTimer);
        this._loadTimer = setTimeout(() => { // belum ada data dari cloud (offline / koneksi buruk): pakai cermin lokal supaya tetap bisa dipakai
            if (!App.State.isLoading || App.State.user.uid !== uid) return;
            const mirror = this.getLocalMirror(uid);
            if (mirror) { this.applyData(mirror); App.UI.updateSyncStatus('offline'); App.UI.showToast('Mode offline — memakai data tersimpan di perangkat', 'info'); this._finishLoad(); }
            else App.UI.showToast('Belum ada data di perangkat ini — sambungkan internet untuk pertama kali', 'error');
        }, 4000);
        this.listener = onValue(dbRef, (snapshot) => {
            clearTimeout(this._loadTimer);
            App.UI.updateSyncStatus('active');
            const localCache = this.getLocalMirror(uid);
            if (snapshot.exists()) {
                const data = snapshot.val();
                // 🛡️ Kalau cadangan lokal di HP ini ternyata lebih baru & lebih lengkap dari yang di cloud
                // (misalnya sempat offline, atau data cloud sempat kereset), pakai yang lokal & dorong ulang ke cloud.
                const pending = this.hasPending(uid), lt = localCache && localCache.updatedAt ? new Date(localCache.updatedAt) : null, ct = data.updatedAt ? new Date(data.updatedAt) : null;
                const localNewer = localCache && lt && (!ct || lt > ct) && (pending || (localCache.transactions||[]).length >= (data.transactions||[]).length);
                if (pending && localCache && ct && lt && ct > lt) {
                    // Perubahan offline di perangkat ini BERBEDA dari cloud yang lebih baru (mis. diubah dari perangkat lain).
                    // Amankan salinan lokal dulu, lalu pakai cloud agar tidak saling menimpa tanpa sadar.
                    if (App.Guard && App.Guard.snapshotNow) App.Guard.snapshotNow(false);
                    try { localStorage.removeItem(this.pendingKey(uid)); } catch(e) { /* abaikan */ }
                    App.UI.showToast('Data di cloud lebih baru dari perubahan offline — salinan perubahan offline disimpan di Setelan → Pengaman Data', 'info');
                    this.applyData(data); this.saveLocalMirror(uid, data);
                } else if (localNewer) {
                    this.applyData(localCache);
                    this.save();
                    App.UI.showToast('Data lokal lebih baru, disinkronkan ke cloud', 'success');
                } else {
                    this.applyData(data);
                    this.saveLocalMirror(uid, data);
                }
            } else if (localCache && (localCache.transactions||[]).length > 0) {
                // ⚠️ Cloud kebaca kosong padahal cadangan lokal masih ada isinya — JANGAN dianggap "user baru".
                // Pulihkan dari cadangan lokal supaya data lama tidak ketiban kosong.
                this.applyData(localCache);
                this.save();
                App.UI.showToast('Data cloud kosong, dipulihkan dari cadangan lokal di HP ini', 'success');
            } else {
                this.save();
            }
            this._finishLoad();
        }, (error) => { console.error("Firebase DB Error:", error); App.UI.updateSyncStatus('error'); });
    },
    save() {
       if (!App.State.user) return;
       let todosData = null; try { const raw = localStorage.getItem('tugasPro.v2'); if(raw) todosData = JSON.parse(raw); } catch(e){}
       let kuliahData = null; try { const raw = localStorage.getItem('kuliahPro.v1'); if(raw) kuliahData = JSON.parse(raw); } catch(e){}
       const dataToSave = { isPremium: App.State.isPremium, transactions: App.State.transactions, recurring: App.State.recurring, customCategories: App.State.customCategories, budgets: App.State.budgets, paylaters: App.State.paylaters, transfers: App.State.transfers, debts: App.State.debts, quickTemplates: App.State.quickTemplates, budgetAllocation: App.State.budgetAllocation, categoryBucketMap: App.State.categoryBucketMap, trashedTransactions: App.State.trashedTransactions, todos: todosData, kuliah: kuliahData, modules: window.AppModules ? AppModules.collect() : null, settings: App.State.settings, updatedAt: new Date().toISOString() };

     // ✅ Selalu backup settings ke backup_v6 agar persist saat refresh
       localStorage.setItem('backup_v6', JSON.stringify({ settings: App.State.settings }));

     // 🛡️ Cermin lokal (offline & online) — selalu simpan salinan penuh ke device ini dulu,
     // sebelum (atau meski gagal) kirim ke cloud, supaya data asli tetap aman di HP/laptop.
       this.saveLocalMirror(App.State.user.uid, dataToSave);

       if (App.Auth.isDummy) { localStorage.setItem('dummy_db_' + App.State.user.uid, JSON.stringify(dataToSave)); return; }
       if (this.dbInstance) {
           const uid = App.State.user.uid, pk = this.pendingKey(uid), stamp = dataToSave.updatedAt;
           try { localStorage.setItem(pk, stamp); } catch(e) { /* abaikan */ }
           if (App.State.online === false) App.UI.updateSyncStatus('offline');
           try {
               set(ref(this.dbInstance, `users/${uid}/appData`), dataToSave).then(() => { // server mengakui: hapus penanda hanya bila tidak ada simpanan yang lebih baru
                   try { if (localStorage.getItem(pk) === stamp) localStorage.removeItem(pk); } catch(e) { /* abaikan */ }
                   this._pendingSync = false; if (App.State.online !== false) App.UI.updateSyncStatus('active');
               }).catch(e => { console.warn('Gagal sync ke akun (akan dicoba lagi):', e); this._pendingSync = true; });
           } catch(e){ console.warn('Gagal sync ke akun (diabaikan):', e); this._pendingSync = true; }
       }
  }
};
