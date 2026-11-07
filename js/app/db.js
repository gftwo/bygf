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
        this.listener = onValue(dbRef, (snapshot) => {
            App.UI.updateSyncStatus('active');
            const localCache = this.getLocalMirror(uid);
            if (snapshot.exists()) {
                const data = snapshot.val();
                // 🛡️ Kalau cadangan lokal di HP ini ternyata lebih baru & lebih lengkap dari yang di cloud
                // (misalnya sempat offline, atau data cloud sempat kereset), pakai yang lokal & dorong ulang ke cloud.
                const localNewer = localCache && localCache.updatedAt && (!data.updatedAt || new Date(localCache.updatedAt) > new Date(data.updatedAt)) && (localCache.transactions||[]).length >= (data.transactions||[]).length;
                if (localNewer) {
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
            App.State.isLoading = false; App.Premium.applyState(); App.Theme.init(); App.UI.renderCategoriesSelect();
            // Cuma pindah ke tab Keuangan sekali di awal (pas baru login/buka app), bukan tiap kali
            // ada data baru masuk — sebelumnya ini bikin app "kelempar balik" ke Keuangan tiap kali
            // nambah/ubah apa pun di tab Kuliah (absen, tugas, dst) karena tiap App.DB.save() bikin
            // listener realtime ini kepanggil lagi.
            if(!App.State._navInitDone){ App.State._navInitDone = true; App.UI.switchMainGroup('home'); }
            App.UI.renderAll(); if(App.Guard && !App.State._guardDone){ App.State._guardDone = true; App.Guard.onLoaded(); if(App.Notify) App.Notify.onLoaded(); } setTimeout(() => { if(window.AppNotifyQueue) window.AppNotifyQueue.register('finance-alert', () => App.Handlers.checkStartupAlerts()); else App.Handlers.checkStartupAlerts(); }, 700);
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
       if (this.dbInstance) { try { set(ref(this.dbInstance, `users/${App.State.user.uid}/appData`), dataToSave); this._pendingSync = false; } catch(e){ console.warn('Gagal sync ke akun (diabaikan):', e); this._pendingSync = true; } }
  }
};
