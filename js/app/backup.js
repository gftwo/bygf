import { App } from './core.js';

App.Backup = {
    openTrash() { this.renderTrash(); App.UI.showModal('trashModal'); },
    renderTrash() {
        const box = document.getElementById('trashList'); if (!box) return;
        const items = App.State.trashedTransactions || [];
        if (!items.length) { box.innerHTML = '<p class="text-xs text-muted" style="padding:0.5rem 0;">Sampah kosong.</p>'; return; }
        box.innerHTML = items.map((t, i) => {
            const catObj = [...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === t.kategori) || { icon: '📦', name: t.kategori || '-' };
            const amt = t.pemasukan || t.pengeluaran || 0;
            const jenis = t.pemasukan ? 'Pemasukan' : 'Pengeluaran';
            const delDate = t._deletedAt ? App.Utils.formatDateStr(t._deletedAt.split('T')[0]) : '-';
            return `<div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem; background:var(--bg-body); border-radius:var(--radius-md);">
                <span style="font-size:1.1rem;">${catObj.icon}</span>
                <div style="flex:1; min-width:0;">
                    <div class="text-sm font-semibold">${t.keterangan || catObj.name}</div>
                    <div class="text-xs text-muted">${jenis} • ${App.Utils.formatCurrency(amt)} • Dihapus ${delDate}</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="App.Backup.restoreFromTrash(${i})">↩️ Pulihkan</button>
            </div>`;
        }).join('');
    },
    restoreFromTrash(idx) {
        const items = App.State.trashedTransactions || [];
        const tx = items[idx]; if (!tx) return;
        const restored = { ...tx }; delete restored._deletedAt;
        App.State.transactions.push(restored);
        App.State.trashedTransactions.splice(idx, 1);
        App.DB.save(); this.renderTrash(); App.UI.renderAll();
        App.UI.showToast('Transaksi dipulihkan', 'success');
    },
    async emptyTrash() {
        const yes = await App.UI.confirm('Semua transaksi di Sampah akan dihapus permanen. Lanjutkan?');
        if (!yes) return;
        App.State.trashedTransactions = [];
        App.DB.save(); this.renderTrash();
        App.UI.showToast('Sampah dikosongkan', 'success');
    },
    openHistory() { this.renderHistory(); App.UI.showModal('backupHistoryModal'); },
    renderHistory() {
        const box = document.getElementById('backupHistoryList'); if (!box) return;
        if (!App.State.user) { box.innerHTML = '<p class="text-xs text-muted">Belum login.</p>'; return; }
        let hist = []; try { hist = JSON.parse(localStorage.getItem('cloud_cache_history_' + App.State.user.uid) || '[]'); } catch(e){}
        if (!hist.length) { box.innerHTML = '<p class="text-xs text-muted" style="padding:0.5rem 0;">Belum ada riwayat cadangan.</p>'; return; }
        box.innerHTML = hist.map((h, i) => {
            const when = h.savedAt ? new Date(h.savedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
            return `<div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem; background:var(--bg-body); border-radius:var(--radius-md);">
                <span style="font-size:1.1rem;">🕒</span>
                <div style="flex:1; min-width:0;">
                    <div class="text-sm font-semibold">${when}</div>
                    <div class="text-xs text-muted">${h.txCount} transaksi tersimpan</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="App.Backup.restoreSnapshot(${i})">↩️ Pulihkan</button>
            </div>`;
        }).join('');
    },
    async restoreSnapshot(idx) {
        if (!App.State.user) return;
        const yes = await App.UI.confirm('Data saat ini akan diganti dengan cadangan ini. Lanjutkan?');
        if (!yes) return;
        let hist = []; try { hist = JSON.parse(localStorage.getItem('cloud_cache_history_' + App.State.user.uid) || '[]'); } catch(e){}
        const entry = hist[idx]; if (!entry || !entry.data) return;
        App.DB.applyData(entry.data);
        App.DB.save();
        App.UI.closeModal('backupHistoryModal');
        App.UI.renderAll();
        App.UI.showToast('Cadangan dipulihkan', 'success');
    }
};
