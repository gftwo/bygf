import { App } from './core.js';

App.QuickTemplate = {
    render() {
        const box = document.getElementById('quickTemplateChips'); if (!box) return;
        try { if (localStorage.getItem('bygf.quickOpen') === '1' && document.getElementById('quickBody') && document.getElementById('quickBody').style.display === 'none') App.UI.toggleQuickRespons(); } catch (e) { /* abaikan */ }
        const chips = App.State.quickTemplates.map((t, i) =>
            `<button type="button" class="qt-chip" onclick="App.QuickTemplate.openQuickAdd(${i})">${t.icon || '⚡'} ${t.name}</button>`
        ).join('');
        box.innerHTML = chips + `<button type="button" class="qt-chip qt-chip-add" onclick="App.QuickTemplate.openManage()">+ Tambah</button>`;
    },
    _subWalletLabels: { seabank: 'SeaBank', krombank: 'KromBank', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay' },
    openQuickAdd(idx) {
        const t = App.State.quickTemplates[idx]; if (!t) return;
        document.getElementById('qaTemplateId').value = idx;
        document.getElementById('qaModalTitle').textContent = `${t.icon || '⚡'} ${t.name}`;
        document.getElementById('qaAmount').value = '';
        document.getElementById('qaNote').value = t.name;
        const accLabel = t.jenisAkun === 'cash' ? '💵 Cash / Tunai' : `🪪 Saldo${t.subWallet && this._subWalletLabels[t.subWallet] ? ' · ' + this._subWalletLabels[t.subWallet] : ''}`;
        const info = document.getElementById('qaAccountInfo'); if (info) info.textContent = `Akun tujuan: ${accLabel}`;
        App.UI.showModal('quickAddModal');
        setTimeout(() => document.getElementById('qaAmount').focus(), 150);
    },
    submitQuickAdd(e) {
        e.preventDefault();
        const idx = parseInt(document.getElementById('qaTemplateId').value);
        const t = App.State.quickTemplates[idx]; if (!t) return;
        const amount = App.Utils.parseCurrency(document.getElementById('qaAmount').value);
        if (!amount) return App.UI.showToast('Isi nominalnya dulu ya', 'error');
        const note = document.getElementById('qaNote').value.trim() || t.name;
        const tx = { id: Date.now(), tanggal: new Date().toISOString().split('T')[0], jenisAkun: t.jenisAkun, subWallet: t.jenisAkun === 'saldo' ? (t.subWallet || null) : null, pemasukan: t.type === 'in' ? amount : 0, pengeluaran: t.type === 'out' ? amount : 0, kategori: t.kategori, keterangan: note, excludeFromBudget: false };
        App.State.transactions.push(tx);
        App.DB.save(); App.UI.renderAll(); App.UI.closeModal('quickAddModal');
        App.UI.showToast(`✅ ${t.name} dicatat!`, 'success');
    },
    openManage() {
        document.getElementById('qtCategory').innerHTML = [...App.Config.DefaultCategories, ...App.State.customCategories].map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
        document.getElementById('qtSubWalletWrap').style.display = document.getElementById('qtAccount').value === 'saldo' ? 'block' : 'none';
        this.renderManageList();
        App.UI.showModal('manageTemplatesModal');
    },
    renderManageList() {
        const list = document.getElementById('qtManageList'); if (!list) return;
        if (!App.State.quickTemplates.length) { list.innerHTML = '<p class="text-xs text-muted">Belum ada template. Tambah di bawah ya.</p>'; return; }
        list.innerHTML = App.State.quickTemplates.map((t, i) => {
            const catObj = [...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === t.kategori) || { icon: '📝', name: t.kategori };
            const accLabel = t.jenisAkun === 'cash' ? 'Cash' : ('Saldo' + (t.subWallet && this._subWalletLabels[t.subWallet] ? ' · ' + this._subWalletLabels[t.subWallet] : ''));
            return `<div class="qt-manage-item">
                <span style="font-size:1.2rem;">${t.icon || '⚡'}</span>
                <div style="flex:1; min-width:0;">
                    <div class="font-bold text-sm">${t.name}</div>
                    <div class="text-xs text-muted">${t.type === 'in' ? 'Pemasukan' : 'Pengeluaran'} • ${accLabel} • ${catObj.icon} ${catObj.name}</div>
                </div>
                <button type="button" class="btn btn-icon" style="background:var(--danger-light); color:var(--danger-dark); width:30px; height:30px;" onclick="App.QuickTemplate.deleteTemplate(${i})">🗑️</button>
            </div>`;
        }).join('');
    },
    addTemplate() {
        const name = document.getElementById('qtName').value.trim();
        if (!name) return App.UI.showToast('Isi nama template dulu', 'error');
        const icon = document.getElementById('qtIcon').value.trim() || '⚡';
        const type = document.getElementById('qtType').value;
        const jenisAkun = document.getElementById('qtAccount').value;
        const subWallet = jenisAkun === 'saldo' ? (document.getElementById('qtSubWallet').value || null) : null;
        const kategori = document.getElementById('qtCategory').value;
        App.State.quickTemplates.push({ id: Date.now(), icon, name, type, jenisAkun, subWallet, kategori });
        App.DB.save(); this.render(); this.renderManageList();
        document.getElementById('qtName').value = ''; document.getElementById('qtIcon').value = '⚡';
        App.UI.showToast('Template ditambahkan!', 'success');
    },
    deleteTemplate(idx) {
        App.State.quickTemplates.splice(idx, 1);
        App.DB.save(); this.render(); this.renderManageList();
    }
};
