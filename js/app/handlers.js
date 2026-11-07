import { App } from './core.js';

App.Handlers = {
    addTransaction(e) {
        e.preventDefault();
        const p = App.Utils.parseCurrency(document.getElementById('txIn').value); const out = App.Utils.parseCurrency(document.getElementById('txOut').value); const errorEl = document.getElementById('err-tx');
        if (p === 0 && out === 0) { const amtDisp = document.getElementById('txAmountDisplay'); if(amtDisp) amtDisp.style.outline = '2px solid var(--danger)'; errorEl.classList.add('show'); return; }
        const amtDisp2 = document.getElementById('txAmountDisplay'); if(amtDisp2) amtDisp2.style.outline = ''; errorEl.classList.remove('show');
        if (document.getElementById('txRecurring').checked && !App.State.isPremium && App.State.recurring.length >= App.Config.FreeLimits.recurring) { App.UI.showToast(`Batas otomatisasi (${App.Config.FreeLimits.recurring}) tercapai.`, 'error'); App.UI.showModal('premiumModal'); return; }

        const tx = { id: Date.now(), tanggal: document.getElementById('txDate').value, jenisAkun: document.getElementById('txAccount').value, subWallet: document.getElementById('txAccount').value === 'saldo' ? (document.getElementById('txSubWallet').value || null) : null, pemasukan: p, pengeluaran: out, kategori: document.getElementById('txCategory').value, keterangan: document.getElementById('txNote').value.trim(), excludeFromBudget: false };
        App.State.transactions.push(tx);

        if (document.getElementById('txRecurring').checked) {
            const interval = Math.max(1, parseInt(document.getElementById('txRecurringInterval').value) || 1);
            const type = document.getElementById('txRecurringType').value;
            const startDate = document.getElementById('txRecurringStart').value || tx.tanggal;
            const endDate = document.getElementById('txRecurringEnd').value || null;
            let nextDate = new Date(startDate + 'T00:00:00');
            if(type === 'daily') nextDate.setDate(nextDate.getDate() + interval); else if(type === 'weekly') nextDate.setDate(nextDate.getDate() + interval*7); else if(type === 'monthly') nextDate.setMonth(nextDate.getMonth() + interval);
            App.State.recurring.push({ id: Date.now(), type, interval, startDate, endDate, template: tx, lastExecuted: tx.tanggal, nextExecution: nextDate.toISOString().split('T')[0], status: 'active' });
        }
        App.DB.save(); App.UI.renderAll(); e.target.reset(); App.UI.init(); App.UI.setTxType('in'); document.getElementById('txRecurring').checked = false; document.getElementById('recurringOpts').style.display = 'none'; document.getElementById('txSubWalletWrap').style.display = 'none'; App.UI.showToast('Transaksi Berhasil Dicatat!', 'success');
    },
    addPaylater(e) {
        e.preventDefault(); const name = document.getElementById('plName').value.trim(); const amt = App.Utils.parseCurrency(document.getElementById('plAmount').value);
        if(!name || amt <= 0) return App.UI.showToast('Form tidak valid', 'error');
        const due = parseInt(document.getElementById('plDue').value); const item = {id: Date.now(), name, amount: amt, originalAmount: amt}; if(due >= 1 && due <= 31) item.dueDay = due; App.State.paylaters.push(item); App.DB.save(); App.UI.renderPaylaters(); App.UI.closeModal('paylaterModal'); e.target.reset(); App.UI.showToast('Tagihan berhasil disimpan!', 'success');
    },
    setPaylaterDue(id) { // atur / hapus tanggal jatuh tempo bulanan
        const p = App.State.paylaters.find(x => x.id === id); if(!p) return;
        let m = document.getElementById('plDueModal'); if(m) m.remove();
        m = document.createElement('div'); m.id = 'plDueModal'; m.className = 'modal-overlay show'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = `<div class="modal-content" style="max-width:360px;"><div class="modal-header"><h2>📅 Jatuh tempo</h2><button type="button" class="modal-close" data-x="close" aria-label="Tutup">&times;</button></div><p class="text-sm" style="margin-bottom:.75rem;"><b>${p.name.replace(/</g, '&lt;')}</b></p><div class="form-group"><label for="plDueEdit">Jatuh tempo tiap tanggal (1–31)</label><input type="number" id="plDueEdit" min="1" max="31" inputmode="numeric" value="${p.dueDay || ''}" placeholder="Kosongkan untuk menghapus"></div><div class="grid-2"><button type="button" class="btn btn-secondary" data-x="close">Batal</button><button type="button" class="btn btn-primary" data-x="save">Simpan</button></div></div>`;
        m.addEventListener('click', e => {
            if(e.target === m || e.target.closest('[data-x=close]')) return m.remove();
            if(e.target.closest('[data-x=save]')) {
                const v = parseInt(document.getElementById('plDueEdit').value);
                if(document.getElementById('plDueEdit').value && !(v >= 1 && v <= 31)) return App.UI.showToast('Tanggal harus 1–31', 'error');
                if(v >= 1 && v <= 31) p.dueDay = v; else delete p.dueDay;
                App.DB.save(); App.UI.renderPaylaters(); m.remove(); App.UI.showToast('Jatuh tempo disimpan', 'success');
            }
        });
        document.body.appendChild(m); document.getElementById('plDueEdit').focus();
    },
    async deletePaylater(id) {
        const yes = await App.UI.confirm('Hapus tagihan ini tanpa mencatat pembayaran?');
        if(!yes) return;
        App.State.paylaters = App.State.paylaters.filter(p => p.id !== id);
        App.DB.save(); App.UI.renderPaylaters(); App.UI.showToast('Tagihan dihapus.', 'success');
    },
    openPayoffModal(id) {
        const p = App.State.paylaters.find(x => x.id === id); if(!p) return;
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('payoffId').value = id;
        document.getElementById('payoffNama').textContent = p.name;
        document.getElementById('payoffSisa').textContent = App.Utils.formatCurrency(p.amount);
        document.getElementById('payoffJumlah').value = p.amount.toLocaleString('id-ID');
        document.getElementById('payoffTanggal').value = today;
        document.getElementById('payoffAkun').value = 'cash';
        document.getElementById('payoffCatatan').value = `Lunas: ${p.name}`;
        document.getElementById('payoffFullBtn').onclick  = () => App.Handlers.submitPayoff('full');
        document.getElementById('payoffPartBtn').onclick  = () => App.Handlers.submitPayoff('partial');
        App.UI.showModal('payoffModal');
    },
    submitPayoff(mode) {
        const id      = parseInt(document.getElementById('payoffId').value);
        const akun    = document.getElementById('payoffAkun').value;
        const tanggal = document.getElementById('payoffTanggal').value;
        const catatan = document.getElementById('payoffCatatan').value.trim();
        const jumlah  = App.Utils.parseCurrency(document.getElementById('payoffJumlah').value);
        const p = App.State.paylaters.find(x => x.id === id); if(!p) return;
        if(!jumlah || jumlah <= 0) return App.UI.showToast('Masukkan jumlah yang valid', 'error');
        if(jumlah > p.amount) return App.UI.showToast('Jumlah melebihi sisa tagihan!', 'error');
        if(!tanggal) return App.UI.showToast('Pilih tanggal pembayaran', 'error');
        // Catat sebagai pengeluaran di history
        App.State.transactions.push({
            id: Date.now(), tanggal, jenisAkun: akun,
            pemasukan: 0, pengeluaran: jumlah,
            kategori: 'lainnya', keterangan: catatan,
            _source: 'paylater'
        });
        const isFullyPaid = mode === 'full' || jumlah >= p.amount;
        if(isFullyPaid) {
            App.State.paylaters = App.State.paylaters.filter(x => x.id !== id);
            App.UI.closeModal('payoffModal');
            App.UI.showToast(`🎉 Tagihan "${p.name}" LUNAS! Tercatat di riwayat.`, 'success');
        } else {
            p.amount -= jumlah;
            App.UI.closeModal('payoffModal');
            App.UI.showToast(`✅ Bayar ${App.Utils.formatCurrency(jumlah)} tercatat. Sisa: ${App.Utils.formatCurrency(p.amount)}`, 'success');
        }
        App.DB.save(); App.UI.renderAll();
    },
    openEdit(id) {
        const t = App.State.transactions.find(x => x.id === id); if(!t) return;
        document.getElementById('edit-id').value = id; document.getElementById('edit-tanggal').value = t.tanggal; document.getElementById('edit-jenis-akun').value = t.jenisAkun; document.getElementById('edit-pemasukan').value = t.pemasukan ? t.pemasukan.toLocaleString('id-ID') : ''; document.getElementById('edit-pengeluaran').value = t.pengeluaran ? t.pengeluaran.toLocaleString('id-ID') : ''; document.getElementById('edit-kategori').value = t.kategori; document.getElementById('edit-keterangan').value = t.keterangan || '';
        document.getElementById('edit-sub-wallet').value = t.subWallet || ''; document.getElementById('editSubWalletWrap').style.display = t.jenisAkun === 'saldo' ? 'block' : 'none';
        document.getElementById('edit-exclude-budget').checked = !!t.excludeFromBudget;
        // Gabungkan transaksi & transfer jadi satu garis waktu kronologis,
        // supaya hasilnya konsisten sama total di dashboard (yang juga menghitung transfer antar cash↔saldo).
        const events = [
            ...App.State.transactions.map((tx, idx) => ({ date: tx.tanggal, idx, kind: 'tx', tx })),
            ...(App.State.transfers || []).map((tf, idx) => ({ date: tf.tanggal, idx, kind: 'transfer', tf }))
        ];
        events.sort((a, b) => a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.kind !== b.kind ? (a.kind === 'tx' ? -1 : 1) : a.idx - b.idx));
        let bal = { cash: 0, saldo: 0 }, before = { cash: 0, saldo: 0 }, after = { cash: 0, saldo: 0 };
        for (const ev of events) {
            if (ev.kind === 'tx' && ev.tx.id === id) before = { ...bal };
            if (ev.kind === 'tx') { const amt = (ev.tx.pemasukan || 0) - (ev.tx.pengeluaran || 0); bal[ev.tx.jenisAkun] += amt; }
            else { bal[ev.tf.dari] -= ev.tf.jumlah; bal[ev.tf.ke] += ev.tf.jumlah; }
            if (ev.kind === 'tx' && ev.tx.id === id) { after = { ...bal }; break; }
        }
        const cashBefore = before.cash, saldoBefore = before.saldo, cashAfter = after.cash, saldoAfter = after.saldo;
        const isCash = t.jenisAkun === 'cash';
        const labelEl = document.getElementById('editRunningBalanceLabel');
        const runEl = document.getElementById('editRunningBalance');
        if (labelEl) labelEl.textContent = isCash ? '💵 Sisa Cash saat itu' : '🏦 Sisa Saldo Bank/E-Wallet saat itu';
        if (runEl) runEl.textContent = App.Utils.formatCurrency(isCash ? cashAfter : saldoAfter);
        const detailEl = document.getElementById('editRunningBalanceDetail');
        if (detailEl) {
            detailEl.style.display = 'none';
            detailEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.55rem;">
                    <span class="text-xs text-muted">💵 Cash</span>
                    <span class="text-xs font-semibold">${App.Utils.formatCurrency(cashBefore)} → <span class="text-main">${App.Utils.formatCurrency(cashAfter)}</span></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="text-xs text-muted">🏦 Saldo Bank/E-Wallet</span>
                    <span class="text-xs font-semibold">${App.Utils.formatCurrency(saldoBefore)} → <span class="text-main">${App.Utils.formatCurrency(saldoAfter)}</span></span>
                </div>`;
        }
        const btnDel = document.getElementById('btnDeleteTx'); const newBtnDel = btnDel.cloneNode(true); btnDel.parentNode.replaceChild(newBtnDel, btnDel); newBtnDel.onclick = () => this.deleteTx(id); App.UI.showModal('editModal');
    },
    saveEdit(e) {
        e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const index = App.State.transactions.findIndex(t => t.id === id); if (index === -1) return;
        const jenisAkun = document.getElementById('edit-jenis-akun').value;
        App.State.transactions[index] = { ...App.State.transactions[index], tanggal: document.getElementById('edit-tanggal').value, jenisAkun, subWallet: jenisAkun === 'saldo' ? (document.getElementById('edit-sub-wallet').value || null) : null, pemasukan: App.Utils.parseCurrency(document.getElementById('edit-pemasukan').value), pengeluaran: App.Utils.parseCurrency(document.getElementById('edit-pengeluaran').value), kategori: document.getElementById('edit-kategori').value, keterangan: document.getElementById('edit-keterangan').value.trim(), excludeFromBudget: document.getElementById('edit-exclude-budget').checked };
        App.DB.save(); App.UI.closeModal('editModal'); App.UI.renderAll(); App.UI.showToast('Perubahan disimpan!', 'success');
    },
    async deleteTx(id) {
        const yes = await App.UI.confirm('Transaksi ini akan dipindah ke Sampah dulu (bisa dipulihkan lewat menu Pengaturan).');
        if(!yes) return;
        const tx = App.State.transactions.find(t => t.id === id);
        App.State.transactions = App.State.transactions.filter(t => t.id !== id);
        if (tx) {
            if (!App.State.trashedTransactions) App.State.trashedTransactions = [];
            App.State.trashedTransactions.unshift({ ...tx, _deletedAt: new Date().toISOString() });
            App.State.trashedTransactions = App.State.trashedTransactions.slice(0, 200);
        }
        App.DB.save(); App.UI.closeModal('editModal'); App.UI.renderAll(); App.UI.showToast('Transaksi dipindah ke Sampah', 'success');
    },
    async deleteAdjustment(id) { const yes = await App.UI.confirm('Hapus catatan penyesuaian ini?'); if(!yes) return; App.State.transactions = App.State.transactions.filter(t => t.id !== id); App.DB.save(); App.UI.renderAll(); App.UI.showToast('Penyesuaian dihapus', 'success'); },
    debounceSearch() { clearTimeout(App.State.searchTimer); App.State.searchTimer = setTimeout(() => App.UI.renderHistory(), 300); },
    resetFilters() { document.getElementById('filterStart').value = ''; document.getElementById('filterEnd').value = ''; document.getElementById('filterSearch').value = ''; document.getElementById('filterCategory').value = ''; document.getElementById('filterAccount').value = ''; document.getElementById('filterType').value = 'all'; App.UI.renderHistory(); },
    
    openBudgetModal() { if (!App.State.isPremium && App.State.budgets.length >= App.Config.FreeLimits.budget) { App.UI.showModal('premiumModal'); return; } App.UI.showModal('budgetModal'); },
    addBudget(e) { e.preventDefault(); const category = document.getElementById('bCategory').value; const amount = App.Utils.parseCurrency(document.getElementById('bAmount').value); const period = document.getElementById('bPeriod').value; if(amount <= 0) return App.UI.showToast('Isi limit yang valid', 'error'); const existing = App.State.budgets.findIndex(b => b.category === category); if(existing > -1) App.State.budgets[existing] = { id: App.State.budgets[existing].id, category, amount, period }; else App.State.budgets.push({ id: Date.now(), category, amount, period }); App.DB.save(); App.UI.renderBudgets(); App.UI.closeModal('budgetModal'); e.target.reset(); App.UI.showToast('Budget tersimpan!', 'success'); },
    async deleteBudget(id) { const yes = await App.UI.confirm('Hapus limit budget ini?'); if(!yes) return; App.State.budgets = App.State.budgets.filter(b => b.id !== id); App.DB.save(); App.UI.renderBudgets(); },

    // ---------------------------------------------------------------------
    // ALOKASI BUDGET (Pokok / Kuliah & Transport / Fleksibel & Hiburan)
    // ---------------------------------------------------------------------
    allocBucketDefs: [
        { key: 'pokok', icon: '🍚', label: 'Kebutuhan Pokok' },
        { key: 'kuliah', icon: '🎓', label: 'Kuliah & Transport' },
        { key: 'fleksibel', icon: '🎉', label: 'Fleksibel & Hiburan' }
    ],
    getAllocationStatus(monthOffset = 0) {
        const alloc = App.State.budgetAllocation; const map = App.State.categoryBucketMap;
        const now = new Date(); now.setMonth(now.getMonth() + monthOffset);
        const ym = now.toISOString().slice(0, 7);
        const totals = { pokok: 0, kuliah: 0, fleksibel: 0 };
        App.State.transactions.forEach(t => {
            if (t.excludeFromBudget || !t.pengeluaran || !t.tanggal || t.tanggal.slice(0, 7) !== ym) return;
            const bucket = map[t.kategori] || 'fleksibel';
            if (totals.hasOwnProperty(bucket)) totals[bucket] += t.pengeluaran;
        });
        return this.allocBucketDefs.map(d => {
            const allocated = alloc.total * ((alloc.splits[d.key] || 0) / 100);
            const spent = totals[d.key];
            const perc = allocated > 0 ? (spent / allocated) * 100 : 0;
            return { ...d, allocated, spent, remaining: allocated - spent, perc };
        });
    },
    saveAllocationSettings() {
        const total = App.Utils.parseCurrency(document.getElementById('allocTotal').value);
        if (!total || total <= 0) return App.UI.showToast('Isi total budget yang valid', 'error');
        let splits = { pokok: 50, kuliah: 20, fleksibel: 30 };
        if (document.getElementById('allocCustomPct').checked) {
            const p = parseInt(document.getElementById('allocPctPokok').value) || 0;
            const k = parseInt(document.getElementById('allocPctKuliah').value) || 0;
            const f = parseInt(document.getElementById('allocPctFleksibel').value) || 0;
            if (p + k + f !== 100) return App.UI.showToast('Total persentase harus 100%', 'error');
            splits = { pokok: p, kuliah: k, fleksibel: f };
        }
        App.State.budgetAllocation = { total, splits };
        App.DB.save(); App.UI.renderAllocation();
        document.getElementById('allocSettingsPanel').style.display = 'none';
        App.UI.showToast('Pengaturan alokasi disimpan!', 'success');
    },
    setCategoryBucket(catId, bucket) {
        App.State.categoryBucketMap[catId] = bucket;
        App.DB.save(); App.UI.renderAllocation();
    },
    toggleExcludeBudget(id) {
        const t = App.State.transactions.find(x => x.id === id); if(!t) return;
        t.excludeFromBudget = !t.excludeFromBudget;
        App.DB.save(); App.UI.renderAll();
        App.UI.showToast(t.excludeFromBudget ? 'Transaksi dikecualikan dari budget' : 'Transaksi dihitung lagi ke budget', 'info');
    },
    _getCurrentBalances() {
        let bal = { cash: 0 }; const sub = { seabank: 0, krombank: 0, gopay: 0, dana: 0, shopeepay: 0 };
        App.State.transactions.forEach(t => {
            const amt = (t.pemasukan || 0) - (t.pengeluaran || 0);
            if (t.jenisAkun === 'cash') bal.cash += amt; else sub[t.subWallet && sub.hasOwnProperty(t.subWallet) ? t.subWallet : 'seabank'] += amt;
        });
        (App.State.transfers || []).forEach(tf => {
            if (tf.dari === 'cash') bal.cash -= tf.jumlah; else sub[tf.dariSubWallet && sub.hasOwnProperty(tf.dariSubWallet) ? tf.dariSubWallet : 'seabank'] -= tf.jumlah;
            if (tf.ke === 'cash') bal.cash += tf.jumlah; else sub[tf.keSubWallet && sub.hasOwnProperty(tf.keSubWallet) ? tf.keSubWallet : 'seabank'] += tf.jumlah;
        });
        return { cash: bal.cash, ...sub };
    },
    openSyncBalance() {
        const cur = this._getCurrentBalances();
        const fields = [
            { key: 'cash', icon: '💵', label: 'Cash / Tunai' },
            { key: 'seabank', icon: '🏦', label: 'SeaBank' },
            { key: 'krombank', icon: '🟣', label: 'KromBank' },
            { key: 'gopay', icon: '🟢', label: 'GoPay' },
            { key: 'dana', icon: '🔵', label: 'DANA' },
            { key: 'shopeepay', icon: '👛', label: 'ShopeePay' }
        ];
        document.getElementById('syncBalanceFields').innerHTML = fields.map(f => `
            <div class="sync-field">
                <div class="sync-field-label">
                    <span class="font-bold text-sm">${f.icon} ${f.label}</span>
                    <span class="sync-field-current">Tercatat: ${App.Utils.formatCurrency(cur[f.key])}</span>
                </div>
                <input type="text" id="sync-${f.key}" inputmode="numeric" value="${cur[f.key].toLocaleString('id-ID')}" oninput="App.Utils.formatInput(this)">
            </div>`).join('');
        App.UI.showModal('syncBalanceModal');
    },
    submitSyncBalance() {
        const cur = this._getCurrentBalances();
        const fields = [
            { key: 'cash', jenisAkun: 'cash', subWallet: null, label: 'Cash / Tunai' },
            { key: 'seabank', jenisAkun: 'saldo', subWallet: 'seabank', label: 'SeaBank' },
            { key: 'krombank', jenisAkun: 'saldo', subWallet: 'krombank', label: 'KromBank' },
            { key: 'gopay', jenisAkun: 'saldo', subWallet: 'gopay', label: 'GoPay' },
            { key: 'dana', jenisAkun: 'saldo', subWallet: 'dana', label: 'DANA' },
            { key: 'shopeepay', jenisAkun: 'saldo', subWallet: 'shopeepay', label: 'ShopeePay' }
        ];
        const today = new Date().toISOString().split('T')[0];
        let count = 0;
        fields.forEach((f, i) => {
            const input = document.getElementById('sync-' + f.key); if (!input) return;
            const actual = App.Utils.parseCurrency(input.value);
            const diff = actual - cur[f.key];
            if (diff === 0) return;
            App.State.transactions.push({
                id: Date.now() + i, tanggal: today, jenisAkun: f.jenisAkun, subWallet: f.subWallet,
                pemasukan: diff > 0 ? diff : 0, pengeluaran: diff < 0 ? -diff : 0,
                kategori: 'lainnya', keterangan: `Penyesuaian saldo ${f.label} (sinkronisasi)`, excludeFromBudget: true, isAdjustment: true
            });
            count++;
        });
        if (!count) { App.UI.closeModal('syncBalanceModal'); return App.UI.showToast('Semua sudah cocok, gak ada yang perlu disesuaikan 👍', 'info'); }
        App.DB.save(); App.UI.renderAll(); App.UI.closeModal('syncBalanceModal');
        App.UI.showToast(`✅ ${count} penyesuaian saldo dicatat, sekarang udah sinkron!`, 'success');
    },
    saveTransfer() {
        const dari   = document.getElementById('tfDari').value;
        const ke     = document.getElementById('tfKe').value;
        const dariSubWallet = dari === 'saldo' ? (document.getElementById('tfDariSub').value || null) : null;
        const keSubWallet   = ke === 'saldo' ? (document.getElementById('tfKeSub').value || null) : null;
        const jumlah = App.Utils.parseCurrency(document.getElementById('tfJumlah').value);
        const tgl    = document.getElementById('tfTanggal').value;
        const cat    = document.getElementById('tfCatatan').value.trim();
        if(dari === ke && (dari !== 'saldo' || dariSubWallet === keSubWallet)) return App.UI.showToast(dari === 'saldo' ? 'Pilih dompet asal & tujuan yang berbeda!' : 'Pilih akun yang berbeda!', 'error');
        if(!jumlah || jumlah <= 0) return App.UI.showToast('Masukkan jumlah yang valid', 'error');
        if(!tgl) return App.UI.showToast('Pilih tanggal transfer', 'error');
        App.State.transfers.push({ id: Date.now(), dari, ke, dariSubWallet, keSubWallet, jumlah, tanggal: tgl, catatan: cat });
        App.DB.save(); App.UI.renderTransfers(); App.UI.renderBalances(); App.UI.closeModal('transferModal');
        document.getElementById('tfJumlah').value = '';
        document.getElementById('tfCatatan').value = '';
        const fromName = dari === 'cash' ? 'Cash' : 'Saldo Bank';
        const toName   = ke   === 'cash' ? 'Cash' : 'Saldo Bank';
        App.UI.showToast(`✅ Transfer ${fromName} → ${toName} berhasil disimpan!`, 'success');
    },
    async deleteTransfer(id) {
        const yes = await App.UI.confirm('Hapus catatan transfer ini?'); if(!yes) return;
        App.State.transfers = App.State.transfers.filter(t => t.id !== id);
        App.DB.save(); App.UI.renderTransfers(); App.UI.renderBalances();
    },

    // ── Utang Piutang ──
    onDebtTypeChange() {
        const val = document.querySelector('input[name="debtType"]:checked').value;
        const isUtang = val === 'utang';
        const lU = document.getElementById('debtTypeLabelUtang');
        const lP = document.getElementById('debtTypeLabelPiutang');
        lU.style.border = isUtang ? '2px solid var(--danger)' : '2px solid var(--border-medium)';
        lU.style.background = isUtang ? 'var(--danger-light)' : 'var(--bg-body)';
        lU.style.color = isUtang ? 'var(--danger-dark)' : 'var(--text-muted)';
        lP.style.border = !isUtang ? '2px solid var(--success-dark)' : '2px solid var(--border-medium)';
        lP.style.background = !isUtang ? 'var(--success-light)' : 'var(--bg-body)';
        lP.style.color = !isUtang ? 'var(--success-dark)' : 'var(--text-muted)';
        document.getElementById('debtTypeHint').textContent = isUtang
            ? 'Hutang = uang yang kamu pinjam / wajib bayar'
            : 'Piutang = uang yang kamu pinjamkan / orang lain yang berhutang ke kamu';
        document.getElementById('debtNamaLabel').textContent = isUtang
            ? 'Nama Pemberi Pinjaman / Konteks'
            : 'Nama Orang yang Berhutang ke Kamu';
        document.getElementById('debtAkunLabel').textContent = isUtang
            ? 'Masuk ke Akun (kamu terima uang)'
            : 'Keluar dari Akun (kamu keluarkan uang)';
        document.getElementById('debtAkunHint').innerHTML = isUtang
            ? 'Uang pinjaman diterima ke akun mana? Saldo akun ini akan <b>bertambah</b>.'
            : 'Uang dipinjamkan dari akun mana? Saldo akun ini akan <b>berkurang</b>.';
    },
    saveDebt() {
        const tipe   = document.querySelector('input[name="debtType"]:checked').value;
        const nama   = document.getElementById('debtNama').value.trim();
        const jumlah = App.Utils.parseCurrency(document.getElementById('debtJumlah').value);
        const tgl    = document.getElementById('debtTanggal').value;
        const akun   = document.getElementById('debtAkun').value;
        const cat    = document.getElementById('debtCatatan').value.trim();
        if(!nama) return App.UI.showToast('Nama wajib diisi!', 'error');
        if(!jumlah || jumlah <= 0) return App.UI.showToast('Masukkan jumlah yang valid', 'error');
        if(!tgl) return App.UI.showToast('Pilih tanggal', 'error');
        const isUtang = tipe === 'utang';
        // Hutang = terima uang (pemasukan), Piutang = keluarkan uang (pengeluaran)
        App.State.transactions.push({
            id: Date.now(), tanggal: tgl, jenisAkun: akun,
            pemasukan:   isUtang ? jumlah : 0,
            pengeluaran: isUtang ? 0 : jumlah,
            kategori: 'lainnya',
            keterangan: cat || (isUtang ? `Terima hutang dari ${nama}` : `Piutang ke ${nama}`),
            _source: isUtang ? 'debt-utang' : 'debt-piutang'
        });
        App.State.debts.push({ id: Date.now() + 1, tipe, nama, sisa: jumlah, originalAmount: jumlah, tanggal: tgl, catatan: cat, akun });
        App.DB.save(); App.UI.renderAll(); App.UI.closeModal('debtModal');
        document.getElementById('debtNama').value = '';
        document.getElementById('debtJumlah').value = '';
        document.getElementById('debtCatatan').value = '';
        App.UI.showToast(`${isUtang ? '🔴 Hutang dicatat — saldo bertambah!' : '🟢 Piutang dicatat — saldo berkurang!'}`, 'success');
    },
    openSettleDebt(id) {
        const d = App.State.debts.find(x => x.id === id); if(!d) return;
        const today = new Date().toISOString().split('T')[0];
        const isUtang = d.tipe === 'utang';
        document.getElementById('settleDebtId').value = id;
        document.getElementById('settleDebtType').value = d.tipe;
        document.getElementById('settleDebtTitle').textContent = isUtang ? '💸 Bayar Hutang' : '✅ Terima Piutang';
        document.getElementById('settleDebtAkunLabel').textContent = isUtang ? 'Bayar dari Akun' : 'Masuk ke Akun';
        const infoEl = document.getElementById('settleDebtInfo');
        infoEl.style.background  = isUtang ? 'rgba(239,68,68,0.07)'  : 'rgba(16,185,129,0.07)';
        infoEl.style.borderColor = isUtang ? 'rgba(239,68,68,0.25)'  : 'rgba(16,185,129,0.25)';
        infoEl.innerHTML = `<div class="text-xs text-muted">${isUtang ? 'Hutang ke' : 'Piutang dari'}</div>
            <div class="font-bold" style="font-size:1rem;">${d.nama}</div>
            <div style="margin-top:0.2rem;"><span class="text-xs text-muted">Sisa: </span><span class="font-bold" style="color:${isUtang?'var(--danger)':'var(--success-dark)'};">${App.Utils.formatCurrency(d.sisa)}</span></div>`;
        document.getElementById('settleDebtJumlah').value = d.sisa.toLocaleString('id-ID');
        document.getElementById('settleDebtTanggal').value = today;
        document.getElementById('settleDebtCatatan').value = isUtang ? `Bayar hutang ke ${d.nama}` : `Terima piutang dari ${d.nama}`;
        document.getElementById('settleDebtFullBtn').onclick = () => App.Handlers.submitSettleDebt('full');
        document.getElementById('settleDebtPartBtn').textContent = isUtang ? '💸 Bayar Sebagian' : '✅ Terima Sebagian';
        document.getElementById('settleDebtPartBtn').onclick = () => App.Handlers.submitSettleDebt('partial');
        App.UI.showModal('settleDebtModal');
    },
    submitSettleDebt(mode) {
        const id      = parseInt(document.getElementById('settleDebtId').value);
        const tipe    = document.getElementById('settleDebtType').value;
        const akun    = document.getElementById('settleDebtAkun').value;
        const tanggal = document.getElementById('settleDebtTanggal').value;
        const catatan = document.getElementById('settleDebtCatatan').value.trim();
        const jumlah  = App.Utils.parseCurrency(document.getElementById('settleDebtJumlah').value);
        const d = App.State.debts.find(x => x.id === id); if(!d) return;
        if(!jumlah || jumlah <= 0) return App.UI.showToast('Masukkan jumlah yang valid', 'error');
        if(jumlah > d.sisa) return App.UI.showToast('Jumlah melebihi sisa!', 'error');
        if(!tanggal) return App.UI.showToast('Pilih tanggal', 'error');
        const isUtang = tipe === 'utang';
        // Catat ke history — hutang = pengeluaran, piutang = pemasukan
        App.State.transactions.push({
            id: Date.now(), tanggal, jenisAkun: akun,
            pemasukan: isUtang ? 0 : jumlah,
            pengeluaran: isUtang ? jumlah : 0,
            kategori: 'lainnya', keterangan: catatan,
            _source: isUtang ? 'debt-utang' : 'debt-piutang'
        });
        const isFullyPaid = mode === 'full' || jumlah >= d.sisa;
        if(isFullyPaid) {
            App.State.debts = App.State.debts.filter(x => x.id !== id);
            App.UI.closeModal('settleDebtModal');
            App.UI.showToast(isUtang ? `🎉 Hutang ke "${d.nama}" LUNAS!` : `🎉 Piutang dari "${d.nama}" LUNAS diterima!`, 'success');
        } else {
            d.sisa -= jumlah;
            App.UI.closeModal('settleDebtModal');
            App.UI.showToast(`✅ ${App.Utils.formatCurrency(jumlah)} tercatat. Sisa: ${App.Utils.formatCurrency(d.sisa)}`, 'success');
        }
        App.DB.save(); App.UI.renderAll();
    },
    async deleteDebt(id) {
        const yes = await App.UI.confirm('Hapus catatan ini tanpa mencatat pembayaran?'); if(!yes) return;
        App.State.debts = App.State.debts.filter(d => d.id !== id);
        App.DB.save(); App.UI.renderDebts();
    },

    addCategory() { const name = document.getElementById('catName').value.trim(); const icon = document.getElementById('catIcon').value.trim(); const id = name.toLowerCase().replace(/\s+/g, '-'); if(!name || !icon) return App.UI.showToast('Isi form!', 'error'); App.State.customCategories.push({id, name, icon}); App.DB.save(); App.UI.renderCategoriesSelect(); App.UI.renderSettings(); App.UI.closeModal('catModal'); },
    async deleteCategory(id) { const yes = await App.UI.confirm('Hapus kategori kustom ini?'); if(!yes) return; App.State.customCategories = App.State.customCategories.filter(c => c.id !== id); App.DB.save(); App.UI.renderCategoriesSelect(); App.UI.renderSettings(); },
    
    toggleRecurring(id) { const r = App.State.recurring.find(x => x.id === id); if(r) { r.status = r.status === 'paused' ? 'active' : 'paused'; App.DB.save(); App.UI.renderSettings(); } },
    async deleteRecurring(id) { const yes = await App.UI.confirm('Hentikan otomasi transaksi ini?'); if(!yes) return; App.State.recurring = App.State.recurring.filter(r => r.id !== id); App.DB.save(); App.UI.renderSettings(); },
    // Transaksi otomatis TIDAK langsung dicatat lagi — harus dikonfirmasi dulu lewat popup notif awal.
    _advanceRecDate(date, rt) {
        const interval = rt.interval || 1;
        if(rt.type === 'daily') date.setDate(date.getDate() + interval);
        else if(rt.type === 'weekly') date.setDate(date.getDate() + interval*7);
        else if(rt.type === 'monthly') date.setMonth(date.getMonth() + interval);
        return date;
    },
    getPendingRecurring() {
        const now = new Date(); now.setHours(0,0,0,0);
        const pending = [];
        App.State.recurring.forEach(rt => {
            if(rt.status === 'paused') return;
            if(rt.endDate && rt.nextExecution > rt.endDate) return; // sudah lewat masa berlaku
            const nextDate = new Date(rt.nextExecution + 'T00:00:00');
            if(now < nextDate) return;
            let count = 0, d = new Date(nextDate);
            while(now >= d && (!rt.endDate || d.toISOString().split('T')[0] <= rt.endDate)) {
                count++;
                this._advanceRecDate(d, rt);
            }
            if(count > 0) pending.push({ rt, count, firstDue: rt.nextExecution });
        });
        return pending;
    },
    confirmRecurring(id) {
        const rt = App.State.recurring.find(r => r.id === id); if(!rt) return 0;
        const now = new Date(); now.setHours(0,0,0,0);
        let nextDate = new Date(rt.nextExecution + 'T00:00:00'); let added = 0;
        while(now >= nextDate && (!rt.endDate || nextDate.toISOString().split('T')[0] <= rt.endDate)) {
            const dateStr = nextDate.toISOString().split('T')[0];
            const exists = App.State.transactions.some(t => t.recurringId === rt.id && t.tanggal === dateStr);
            if(!exists) { App.State.transactions.push({...rt.template, id: Date.now()+added, tanggal: dateStr, recurringId: rt.id}); added++; }
            this._advanceRecDate(nextDate, rt);
        }
        rt.nextExecution = nextDate.toISOString().split('T')[0]; rt.lastExecuted = now.toISOString().split('T')[0];
        if(rt.endDate && rt.nextExecution > rt.endDate) rt.status = 'paused';
        App.DB.save(); App.UI.renderAll();
        if(added > 0) App.UI.showToast(`✨ ${added} transaksi "${rt.template.keterangan || 'otomatis'}" dicatat`, 'success');
        return added;
    },
    skipRecurring(id) {
        const rt = App.State.recurring.find(r => r.id === id); if(!rt) return;
        const now = new Date(); now.setHours(0,0,0,0);
        let nextDate = new Date(rt.nextExecution + 'T00:00:00');
        while(now >= nextDate && (!rt.endDate || nextDate.toISOString().split('T')[0] <= rt.endDate)) { this._advanceRecDate(nextDate, rt); }
        rt.nextExecution = nextDate.toISOString().split('T')[0];
        if(rt.endDate && rt.nextExecution > rt.endDate) rt.status = 'paused';
        App.DB.save();
        App.UI.showToast('Dilewati, tidak dicatat sebagai transaksi', 'info');
    },
    getBudgetAlerts(threshold = 80) {
        const now = new Date();
        return App.State.budgets.map(b => {
            let filterDate;
            if(b.period === 'weekly') { const day = now.getDay(); filterDate = new Date(now); filterDate.setDate(now.getDate() - (day===0?6:day-1)); filterDate.setHours(0,0,0,0); }
            else { filterDate = new Date(now.getFullYear(), now.getMonth(), 1); }
            const isAll = b.category === '__all__';
            const spent = App.State.transactions.filter(t => !t.excludeFromBudget && (isAll || t.kategori === b.category) && new Date(t.tanggal) >= filterDate).reduce((s,t) => s + (t.pengeluaran||0), 0);
            const perc = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const catObj = isAll ? { icon: '🌐', name: 'Semua Kategori (Total Bulanan)' } : ([...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === b.category) || {icon:'📊', name:b.category});
            return { id: b.id, catObj, spent, amount: b.amount, perc, period: b.period };
        }).filter(b => b.perc >= threshold);
    },
    checkStartupAlerts(isRefresh) {
        if (!isRefresh) {
            const dismissedDate = localStorage.getItem('financeAlertDismissedDate');
            const today = new Date().toISOString().split('T')[0];
            if (dismissedDate === today) return false;
        }
        const budgetAlerts = this.getBudgetAlerts(80);
        const pendingRecurring = this.getPendingRecurring();
        const allocAlerts = this.getAllocationStatus().filter(s => s.perc >= 80);
        if(!budgetAlerts.length && !pendingRecurring.length && !allocAlerts.length) {
            if(isRefresh) {
                App.UI.closeModal('financeAlertPopup');
                App.UI.showToast('Semua sudah beres ✅', 'success');
                if(window.AppNotifyQueue) window.AppNotifyQueue.closed('finance-alert');
            }
            return false;
        }

        const fmt = App.Utils.formatCurrency;
        let html = '';

        if(pendingRecurring.length){
            html += `<div class="fap-section-title">🔁 Transaksi Otomatis Menunggu Konfirmasi</div>`;
            pendingRecurring.forEach(p => {
                const t = p.rt.template;
                const jumlah = t.pemasukan > 0 ? t.pemasukan : t.pengeluaran;
                const jenis = t.pemasukan > 0 ? 'text-success' : 'text-danger';
                html += `<div class="fap-item">
                    <div style="flex:1; min-width:0;">
                        <div class="font-bold text-sm">${t.keterangan || '(Tanpa keterangan)'}</div>
                        <div class="text-xs text-muted">${p.count > 1 ? p.count + 'x tertunda • ' : ''}sejak ${new Date(p.firstDue).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</div>
                        <div class="font-bold ${jenis}" style="margin-top:0.2rem;">${t.pemasukan > 0 ? '+' : '-'}${fmt(jumlah)}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.35rem;">
                        <button class="btn btn-sm btn-primary" onclick="App.Handlers.confirmRecurring(${p.rt.id}); App.UI.refreshStartupAlertPopup();">✅ Konfirmasi</button>
                        <button class="btn btn-sm btn-outline" onclick="App.Handlers.skipRecurring(${p.rt.id}); App.UI.refreshStartupAlertPopup();">⏭️ Lewati</button>
                    </div>
                </div>`;
            });
        }

        if(allocAlerts.length){
            html += `<div class="fap-section-title" style="margin-top:${pendingRecurring.length?'1.25rem':'0'};">🎯 Alokasi Hampir/Sudah Habis</div>`;
            allocAlerts.forEach(a => {
                const over = a.remaining < 0;
                html += `<div class="fap-item">
                    <div style="flex:1; min-width:0;">
                        <div class="font-bold text-sm">${a.icon} ${a.label}</div>
                        <div class="text-xs text-muted" style="margin-top:0.15rem;">${fmt(a.spent)} / ${fmt(a.allocated)}</div>
                        <div class="progress-track" style="margin-top:0.4rem;"><div class="progress-fill" style="width:${Math.min(a.perc,100)}%; background:var(--danger);"></div></div>
                        <div class="text-xs text-danger font-semibold" style="margin-top:0.35rem;">${over ? `⚠️ Sudah lebih ${fmt(-a.remaining)}!` : `Tinggal ${(100-a.perc).toFixed(0)}% lagi`}</div>
                    </div>
                </div>`;
            });
        }

        if(budgetAlerts.length){
            html += `<div class="fap-section-title" style="margin-top:${(pendingRecurring.length||allocAlerts.length)?'1.25rem':'0'};">⚠️ Budget Hampir/Sudah Habis</div>`;
            budgetAlerts.forEach(b => {
                const over = b.spent > b.amount;
                html += `<div class="fap-item">
                    <div style="flex:1; min-width:0;">
                        <div class="font-bold text-sm">${b.catObj.icon} ${b.catObj.name} <span class="badge ${b.period==='weekly'?'badge-active':'badge-paused'}">${b.period==='weekly'?'Mingguan':'Bulanan'}</span></div>
                        <div class="text-xs text-muted" style="margin-top:0.15rem;">${fmt(b.spent)} / ${fmt(b.amount)}</div>
                        <div class="progress-track" style="margin-top:0.4rem;"><div class="progress-fill" style="width:${Math.min(b.perc,100)}%; background:var(--danger);"></div></div>
                        <div class="text-xs text-danger font-semibold" style="margin-top:0.35rem;">${over ? `⚠️ Sudah lebih ${fmt(b.spent-b.amount)}!` : `Tinggal ${(100-b.perc).toFixed(0)}% lagi`}</div>
                    </div>
                </div>`;
            });
        }

        document.getElementById('fapBody').innerHTML = html;
        App.UI.showModal('financeAlertPopup');
        return true;
    },
    processRecurring() { /* dipertahankan agar kompatibel; penjadwalan sekarang lewat checkStartupAlerts() + konfirmasi manual */ },

    exportData(type) {
        if(type === 'json' && !App.State.isPremium) { App.UI.showModal('premiumModal'); return; }
        let text = '', filename = '';
        let todosData = null; try { const raw = localStorage.getItem('tugasPro.v2'); if(raw) todosData = JSON.parse(raw); } catch(e){}
        let kuliahData = null; try { const raw = localStorage.getItem('kuliahPro.v1'); if(raw) kuliahData = JSON.parse(raw); } catch(e){}
        if(type === 'json') {
            const dataToExport = { isPremium: App.State.isPremium, transactions: App.State.transactions, recurring: App.State.recurring, customCategories: App.State.customCategories, budgets: App.State.budgets, paylaters: App.State.paylaters, transfers: App.State.transfers, debts: App.State.debts, quickTemplates: App.State.quickTemplates, budgetAllocation: App.State.budgetAllocation, categoryBucketMap: App.State.categoryBucketMap, todos: todosData, kuliah: kuliahData, modules: window.AppModules ? AppModules.collect() : undefined, settings: App.State.settings };
            if(App.Guard) App.Guard.markBackup(); text = JSON.stringify(dataToExport, null, 2); filename = `Backup_KeuanganPro_${new Date().toISOString().split('T')[0]}.json`;
        } else {
            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const lines = [];
            lines.push(`## KEUANGAN PRO FULL BACKUP`);
            lines.push(`## Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`);
            lines.push('');
            lines.push('[TRANSACTIONS]');
            lines.push('Tanggal,Akun,KategoriID,Keterangan,Pemasukan,Pengeluaran');
            App.State.transactions.forEach(t => lines.push(`${t.tanggal},${t.jenisAkun},${t.kategori},${esc(t.keterangan||'')},${t.pemasukan||0},${t.pengeluaran||0}`));
            lines.push('');
            lines.push('[CUSTOM_CATEGORIES]');
            lines.push('ID,Nama,Ikon');
            App.State.customCategories.forEach(c => lines.push(`${c.id},${esc(c.name)},${c.icon}`));
            lines.push('');
            lines.push('[BUDGETS]');
            lines.push('ID,KategoriID,Jumlah,Periode');
            App.State.budgets.forEach(b => lines.push(`${b.id},${b.category},${b.amount},${b.period}`));
            lines.push('');
            lines.push('[PAYLATERS]');
            lines.push('ID,Nama,Jumlah');
            App.State.paylaters.forEach(p => lines.push(`${p.id},${esc(p.name)},${p.amount}`));
            lines.push('');
            lines.push('[TRANSFERS]');
            lines.push('ID,Dari,DariDompet,Ke,KeDompet,Jumlah,Tanggal,Catatan');
            App.State.transfers.forEach(tf => lines.push(`${tf.id},${tf.dari},${tf.dariSubWallet||''},${tf.ke},${tf.keSubWallet||''},${tf.jumlah},${tf.tanggal},${esc(tf.catatan||'')}`));
            lines.push('');
            lines.push('[DEBTS]');
            lines.push('ID,Tipe,Nama,Sisa,OriginalAmount,Tanggal,Catatan');
            (App.State.debts || []).forEach(d => lines.push(`${d.id},${d.tipe},${esc(d.nama)},${d.sisa},${d.originalAmount||d.sisa},${d.tanggal||''},${esc(d.catatan||'')}`));
            lines.push('');
            lines.push('[TODOS]');
            lines.push('ID,Judul,Selesai,Tenggat,Prioritas,Proyek');
            (todosData && Array.isArray(todosData.tasks) ? todosData.tasks : []).forEach(t => lines.push(`${t.id},${esc(t.title||'')},${t.done?1:0},${t.due||''},${t.priority||''},${esc(t.projectId||'')}`));
            text = lines.join('\n');
            filename = `Backup_KeuanganPro_${new Date().toISOString().split('T')[0]}.csv`;
        }
        const blob = new Blob(['\uFEFF' + text], {type: type==='json'?'application/json':'text/csv;charset=utf-8'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    },
    importFile(e) {
        const file = e.target.files[0]; if(!file) return; const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                if(file.name.endsWith('.json')) {
                    const data = JSON.parse(ev.target.result);
                    if(data.transactions) {
                        if(!Array.isArray(data.transactions)) { App.UI.showToast('File backup tidak valid: daftar transaksi rusak', 'error'); e.target.value=''; return; }
                        const mv = window.AppModules ? AppModules.validate(data.modules) : { ok: true, errors: [] };
                        if(!mv.ok) { App.UI.showToast('File backup tidak valid — ' + mv.errors[0], 'error'); e.target.value=''; return; }
                        const hasMods = !!(data.modules && Object.keys(data.modules).length);
                        const yes = await App.UI.confirm('Menimpa data saat ini dengan data Backup?' + (hasMods ? '\nTermasuk data Daily, Catatan Kuliah, Makan, dan Notes.' : '\n(Backup ini tidak berisi Daily/Catatan Kuliah/Makan/Notes — data tersebut tidak diubah.)')); if(!yes) { e.target.value=''; return; }
                        if(hasMods) { AppModules.snapshotBeforeRestore(); AppModules.apply(data.modules, { force: true }); }
                        App.State.isPremium = data.isPremium || App.State.isPremium; App.State.transactions = data.transactions; if(data.customCategories) App.State.customCategories = data.customCategories; if(data.budgets) App.State.budgets = data.budgets; if(data.recurring) App.State.recurring = data.recurring; if(data.paylaters) App.State.paylaters = data.paylaters; if(data.transfers) App.State.transfers = data.transfers; if(data.debts) App.State.debts = data.debts; if(data.quickTemplates) App.State.quickTemplates = data.quickTemplates; if(data.budgetAllocation) App.State.budgetAllocation = data.budgetAllocation; if(data.categoryBucketMap) App.State.categoryBucketMap = {...App.State.categoryBucketMap, ...data.categoryBucketMap}; if(data.settings) App.State.settings = {...App.State.settings, ...data.settings}; App.DB.save(); App.UI.renderAll(); App.UI.renderCategoriesSelect(); if(data.todos && window.TugasProBridge && window.TugasProBridge.applyExternalTodos) window.TugasProBridge.applyExternalTodos(data.todos); if(data.kuliah && window.KuliahProBridge && window.KuliahProBridge.applyExternalData) window.KuliahProBridge.applyExternalData(data.kuliah); App.UI.showToast('Backup berhasil dipulihkan!', 'success');
                    }
                } else if (file.name.endsWith('.csv')) {
                    const content = ev.target.result;
                    const parseCSVLine = (line) => {
                        const result = []; let cur = ''; let inQ = false;
                        for(let i = 0; i < line.length; i++) {
                            if(line[i] === '"') { if(inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
                            else if(line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
                            else cur += line[i];
                        }
                        result.push(cur); return result;
                    };

                    // Deteksi format baru (multi-section) vs lama (transaksi saja)
                    if(content.includes('[TRANSACTIONS]') || content.includes('[CUSTOM_CATEGORIES]')) {
                        const yes = await App.UI.confirm('Import semua data (Transaksi, Kategori Kustom, Budget, Target, Tagihan)?\nData saat ini akan ditimpa.'); if(!yes) { e.target.value=''; return; }
                        const sections = {}; let sec = null; let sLines = [];
                        content.split('\n').forEach(rawLine => {
                            const line = rawLine.trim();
                            if(line.startsWith('##') || line === '') return;
                            if(line.startsWith('[') && line.endsWith(']')) {
                                if(sec) sections[sec] = sLines; sec = line.slice(1,-1); sLines = [];
                            } else if(sec) sLines.push(line);
                        });
                        if(sec) sections[sec] = sLines;

                        if(sections.TRANSACTIONS) {
                            App.State.transactions = [];
                            sections.TRANSACTIONS.slice(1).forEach((line, i) => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 6) App.State.transactions.push({ id: Date.now()+i, tanggal:p[0], jenisAkun:p[1], kategori:p[2], keterangan:p[3], pemasukan:parseInt(p[4])||0, pengeluaran:parseInt(p[5])||0 });
                            });
                        }
                        if(sections.CUSTOM_CATEGORIES) {
                            App.State.customCategories = [];
                            sections.CUSTOM_CATEGORIES.slice(1).forEach(line => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 3) App.State.customCategories.push({ id:p[0], name:p[1], icon:p[2] });
                            });
                        }
                        if(sections.BUDGETS) {
                            App.State.budgets = [];
                            sections.BUDGETS.slice(1).forEach(line => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 4) App.State.budgets.push({ id:parseInt(p[0])||Date.now(), category:p[1], amount:parseInt(p[2])||0, period:p[3] });
                            });
                        }
                        if(sections.PAYLATERS) {
                            App.State.paylaters = [];
                            sections.PAYLATERS.slice(1).forEach(line => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 3) App.State.paylaters.push({ id:parseInt(p[0])||Date.now(), name:p[1], amount:parseInt(p[2])||0 });
                            });
                        }
                        if(sections.TRANSFERS) {
                            App.State.transfers = [];
                            sections.TRANSFERS.slice(1).forEach(line => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 7) App.State.transfers.push({ id:parseInt(p[0])||Date.now(), dari:p[1], dariSubWallet:p[2]||null, ke:p[3], keSubWallet:p[4]||null, jumlah:parseInt(p[5])||0, tanggal:p[6], catatan:p[7]||'' });
                                else if(p.length >= 5) App.State.transfers.push({ id:parseInt(p[0])||Date.now(), dari:p[1], ke:p[2], jumlah:parseInt(p[3])||0, tanggal:p[4], catatan:p[5]||'' });
                            });
                        }
                        if(sections.DEBTS) {
                            App.State.debts = [];
                            sections.DEBTS.slice(1).forEach(line => {
                                if(!line.trim()) return;
                                const p = parseCSVLine(line);
                                if(p.length >= 5) App.State.debts.push({ id:parseInt(p[0])||Date.now(), tipe:p[1], nama:p[2], sisa:parseInt(p[3])||0, originalAmount:parseInt(p[4])||parseInt(p[3])||0, tanggal:p[5]||'', catatan:p[6]||'' });
                            });
                        }
                        App.DB.save(); App.UI.renderAll(); App.UI.renderCategoriesSelect();
                        App.UI.showToast(`✅ Backup CSV lengkap dipulihkan!`, 'success');
                    } else {
                        // Format lama: transaksi saja
                        const lines = content.split('\n').slice(1); let added = 0;
                        lines.forEach(line => {
                            if(!line.trim()) return; const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                            if(parts && parts.length >= 6) { App.State.transactions.push({ id: Date.now() + added, tanggal: parts[0], jenisAkun: parts[1], kategori: parts[2], keterangan: parts[3].replace(/"/g, ''), pemasukan: parseInt(parts[4])||0, pengeluaran: parseInt(parts[5])||0 }); added++; }
                        }); App.DB.save(); App.UI.renderAll(); App.UI.showToast(`${added} Transaksi diimpor`, 'success');
                    }
                }
            } catch(err) { console.error(err); App.UI.showToast('Gagal memproses file', 'error'); } e.target.value = '';
        }; reader.readAsText(file);
    },
    exportReportPDF() {
        if(!window.jspdf || !window.jspdf.jsPDF) return App.UI.showToast('Library gagal dimuat.', 'error');
        App.UI.showToast('Menyiapkan Laporan PDF...', 'info');
        setTimeout(() => {
            const { start, end, label } = App.UI.getReportDateRange();
            const startStr = start.toISOString().split('T')[0], endStr = end.toISOString().split('T')[0];
            const excludedCat = App.UI._reportExcludedCategories || [];
            const tx = App.State.transactions.filter(t => !t.isAdjustment && t.tanggal >= startStr && t.tanggal <= endStr && !excludedCat.includes(t.kategori)).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
            const totIn = tx.reduce((s,t) => s + (t.pemasukan||0), 0);
            const totOut = tx.reduce((s,t) => s + (t.pengeluaran||0), 0);
            const catMap = {}; tx.forEach(t => { if (t.pengeluaran) catMap[t.kategori] = (catMap[t.kategori]||0) + t.pengeluaran; });
            const catRows = Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([id, amt]) => {
                const c = [...App.Config.DefaultCategories, ...App.State.customCategories].find(x => x.id === id) || { name: id };
                return [c.name, `Rp ${App.Utils.formatNumber(amt)}`, `${totOut > 0 ? ((amt/totOut)*100).toFixed(1) : 0}%`];
            });
            const now = new Date();
            const terbit = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const doc = new window.jspdf.jsPDF();
            // Header
            doc.setFillColor(79, 70, 229); doc.rect(0, 0, 210, 32, 'F');
            doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18);
            doc.text('Laporan BYgf', 14, 16);
            doc.setFont('helvetica','normal'); doc.setFontSize(10);
            doc.text(`Periode: ${label}`, 14, 24);

            doc.setTextColor(90); doc.setFontSize(8.5);
            doc.text(`Diterbitkan pada ${terbit}`, 14, 40);
            if (excludedCat.length) {
                const hiddenNames = excludedCat.map(id => (([...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === id))||{}).name || id).join(', ');
                doc.setTextColor(150); doc.text(`Kategori disembunyikan: ${hiddenNames}`, 14, 46);
            }

            // Ringkasan
            let y = 50;
            doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(12);
            doc.text('Ringkasan', 14, y); y += 7;
            doc.setFont('helvetica','normal'); doc.setFontSize(10);
            doc.text(`Total Pemasukan   : Rp ${App.Utils.formatNumber(totIn)}`, 14, y); y += 6;
            doc.text(`Total Pengeluaran : Rp ${App.Utils.formatNumber(totOut)}`, 14, y); y += 6;
            doc.setFont('helvetica','bold');
            doc.text(`Selisih Bersih    : Rp ${App.Utils.formatNumber(totIn - totOut)}`, 14, y); y += 10;

            // Tabel kategori
            doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Rincian per Kategori', 14, y); y += 4;
            doc.autoTable({ head: [['Kategori', 'Jumlah', '% dari Pengeluaran']], body: catRows.length ? catRows : [['(Tidak ada pengeluaran)', '-', '-']], startY: y, theme: 'grid', headStyles: { fillColor: [79,70,229] }, styles: { fontSize: 9 } });
            y = doc.lastAutoTable.finalY + 10;

            // Tabel transaksi
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Rincian Transaksi', 14, y); y += 4;
            const txRows = tx.map(t => {
                const cat = ([...App.Config.DefaultCategories, ...App.State.customCategories].find(c=>c.id===t.kategori)||{}).name || t.kategori;
                return [App.Utils.formatDateStr(t.tanggal), cat, t.keterangan || '-', t.pemasukan ? `Rp ${App.Utils.formatNumber(t.pemasukan)}` : '-', t.pengeluaran ? `Rp ${App.Utils.formatNumber(t.pengeluaran)}` : '-'];
            });
            doc.autoTable({ head: [['Tanggal','Kategori','Keterangan','Pemasukan','Pengeluaran']], body: txRows.length ? txRows : [['-','-','Tidak ada transaksi','-','-']], startY: y, theme: 'grid', headStyles: { fillColor: [79,70,229] }, styles: { fontSize: 8.5 } });

            // Footer tiap halaman
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
                doc.text(`BYgf — Laporan Keuangan · Halaman ${i} dari ${pageCount}`, 14, 290);
            }

            doc.save(`Laporan_KeuanganPro_${startStr}_${endStr}.pdf`);
            App.UI.showToast('Laporan PDF berhasil diunduh!', 'success');
        }, 400);
    },
    exportPDF() {
        if(!App.State.isPremium) { App.UI.showModal('premiumModal'); return; }
        if(!window.jspdf || !window.jspdf.jsPDF) return App.UI.showToast('Library gagal dimuat.', 'error'); App.UI.showToast('Menyiapkan Laporan PDF...', 'info');
        setTimeout(() => {
            const doc = new window.jspdf.jsPDF(); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Laporan BYgf", 14, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100); doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);
            const tableRows = []; let totIn=0, totOut=0; const sortedTx = [...App.State.transactions].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
            sortedTx.forEach(t => { const cat = ([...App.Config.DefaultCategories, ...App.State.customCategories].find(c=>c.id===t.kategori)||{}).name || t.kategori; totIn += (t.pemasukan||0); totOut += (t.pengeluaran||0); tableRows.push([ t.tanggal, cat, t.keterangan || '-', t.pemasukan ? App.Utils.formatNumber(t.pemasukan) : '-', t.pengeluaran ? App.Utils.formatNumber(t.pengeluaran) : '-' ]); });
            doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.text(`Total Pemasukan: Rp ${App.Utils.formatNumber(totIn)}`, 14, 40); doc.text(`Total Pengeluaran: Rp ${App.Utils.formatNumber(totOut)}`, 14, 46); doc.text(`Saldo Tersisa: Rp ${App.Utils.formatNumber(totIn - totOut)}`, 14, 52);
            doc.autoTable({ head: [["Tanggal", "Kategori", "Keterangan", "Pemasukan", "Pengeluaran"]], body: tableRows, startY: 60, theme: 'grid', headStyles: { fillColor: [79, 70, 229] } }); doc.save(`Laporan_KeuanganPro_${Date.now()}.pdf`);
        }, 500);
    }
};
