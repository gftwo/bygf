import { App } from './core.js';

App.UI = {
    confirmResolver: null,
    init() {
        const today = new Date().toISOString().split('T')[0]; document.getElementById('txDate').value = today;
        if(document.getElementById('tfTanggal')) document.getElementById('tfTanggal').value = today;
        if(document.getElementById('debtTanggal')) document.getElementById('debtTanggal').value = today;
        // Filter tanggal dibiarkan kosong agar semua history tampil
        const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        const dateEl = document.getElementById('currentDateStr'); if (dateEl) dateEl.textContent = dateStr;
        this.renderCategoriesSelect();
        // init tx type to 'in'
        this._txType = 'in';
    },
    setTxType(type) {
        this._txType = type;
        const btnIn = document.getElementById('txTypeBtnIn');
        const btnOut = document.getElementById('txTypeBtnOut');
        if(btnIn) btnIn.classList.toggle('active', type === 'in');
        if(btnOut) btnOut.classList.toggle('active', type === 'out');
        // sync hidden fields
        this.syncTxAmount(document.getElementById('txAmountDisplay'));
    },
    syncTxAmount(el) {
        if(!el) return;
        App.Utils.formatInput(el);
        const raw = App.Utils.parseCurrency(el.value);
        const inEl = document.getElementById('txIn');
        const outEl = document.getElementById('txOut');
        const type = this._txType || 'in';
        if(inEl) inEl.value = type === 'in' ? (raw || '') : '';
        if(outEl) outEl.value = type === 'out' ? (raw || '') : '';
    },
    toggleAuthView(showAuth) {
        const authView = document.getElementById('authView'); const appView = document.getElementById('appContainer');
        if(showAuth) { authView.style.display = 'flex'; setTimeout(() => authView.style.opacity = '1', 50); appView.style.display = 'none'; } 
        else { authView.style.opacity = '0'; setTimeout(() => { authView.style.display = 'none'; appView.style.display = 'block'; }, 300); }
    },
    toggleAuth(mode) {
        const loginForm = document.getElementById('loginForm'); const registerForm = document.getElementById('registerForm'); const tabLogin = document.getElementById('tabLogin'); const tabRegister = document.getElementById('tabRegister');
        if (mode === 'login') { loginForm.style.display = 'block'; loginForm.classList.remove('auth-form-slide'); void loginForm.offsetWidth; loginForm.classList.add('auth-form-slide'); registerForm.style.display = 'none'; if (tabLogin) tabLogin.classList.add('active'); if (tabRegister) tabRegister.classList.remove('active'); } 
        else { registerForm.style.display = 'block'; registerForm.classList.remove('auth-form-slide'); void registerForm.offsetWidth; registerForm.classList.add('auth-form-slide'); loginForm.style.display = 'none'; if (tabRegister) tabRegister.classList.add('active'); if (tabLogin) tabLogin.classList.remove('active'); }
        const subtitle = document.getElementById('authSubtitle'); if (subtitle) subtitle.textContent = mode === 'login' ? 'Catat keuangan, tugas, kuliah, makan, dan ide — semua tersinkron.' : 'Buat akun baru untuk mulai mengelola keuangan.';
    },
    togglePwd(inputId, btn) { const input = document.getElementById(inputId); if (!input) return; const isHidden = input.type === 'password'; input.type = isHidden ? 'text' : 'password'; btn.textContent = isHidden ? '🙈' : '👁'; },
    toggleProfileDropdown() {
        const dd = document.getElementById('profileDropdown'); if (!dd) return; const isOpen = dd.classList.contains('open'); if (isOpen) { dd.classList.remove('open'); return; }
        const user = App.State.user;
        if (user) {
            const name = user.displayName || user.email.split('@')[0]; const initials = name.charAt(0).toUpperCase();
            const pdAvatar = document.getElementById('pdAvatar'); const pdName = document.getElementById('pdName'); const pdRole = document.getElementById('pdRole'); const pdTx = document.getElementById('pdTxCount'); const pdBudget = document.getElementById('pdBudgetCount');
            if (pdAvatar) pdAvatar.innerHTML = user.photoURL ? `<img src="${user.photoURL}">` : initials; if (pdName) pdName.textContent = name;
            if (pdRole) pdRole.textContent = 'Pengguna';
            if (pdTx) pdTx.textContent = App.State.transactions.length; if (pdBudget) pdBudget.textContent = App.State.budgets.length;
        }
        dd.classList.add('open'); setTimeout(() => { document.addEventListener('click', function handler(e) { if (!e.target.closest('#profileBtn') && !e.target.closest('#profileDropdown')) { dd.classList.remove('open'); document.removeEventListener('click', handler); } }); }, 10);
    },
    closeProfileDropdown() { const dd = document.getElementById('profileDropdown'); if (dd) dd.classList.remove('open'); },
    showLogoutModal() { const user = App.State.user; if (!user) return; const name = user.displayName || user.email.split('@')[0]; const initials = name.charAt(0).toUpperCase(); const avatarEl = document.getElementById('logoutAvatar'); const nameEl = document.getElementById('logoutName'); if (avatarEl) avatarEl.textContent = initials; if (nameEl) nameEl.textContent = name; this.showModal('logoutModal'); },
    switchTabByName(tabName) { const navItems = document.querySelectorAll('.nav-item'); navItems.forEach(item => { if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${tabName}'`)) { item.click(); } }); },
    updateSyncStatus(status) {
        const dot = document.getElementById('syncStatusDot'); const txt = document.getElementById('syncStatusText'); if (!dot || !txt) return; dot.className = 'sync-dot';
        if (status === 'active') { dot.classList.add('active'); const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }); txt.textContent = App.Auth.isDummy ? `Lokal · ${dateStr}` : `Tersinkronisasi · ${dateStr}`; } 
        else if (status === 'offline') { dot.classList.add('error'); txt.textContent = (App.DB && App.DB.hasPending()) ? 'Offline · belum tersinkron' : 'Offline · data tersimpan di perangkat'; }
        else if (status === 'error') { dot.classList.add('error'); txt.textContent = 'Offline'; } 
        else { txt.textContent = 'Menyinkronkan...'; }
    },
    renderAll() { this.renderBalances(); this.renderPaylaters(); this.renderDebts(); this.renderHistory(); this.renderAdjustmentHistory(); this.renderBudgets(); this.renderTransfers(); this.renderSettings(); App.QuickTemplate.render(); if(document.getElementById('view-laporan').classList.contains('active')) { this.renderAnalytics(); this.renderReport(); } if(document.getElementById('view-alokasi').classList.contains('active')) this.renderAllocation(); },
    renderCategoriesSelect() {
        const all = [...App.Config.DefaultCategories, ...App.State.customCategories];
        const options = all.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
        const ids = ['txCategory', 'filterCategory', 'edit-kategori', 'bCategory'];
        ids.forEach(id => {
            const el = document.getElementById(id); if (!el) return;
            if (id === 'filterCategory') el.innerHTML = '<option value="">Semua Kategori</option>' + options;
            else el.innerHTML = options;
        });
    },
    SUB_WALLETS: [
        { key: 'seabank', icon: '🏦', label: 'SeaBank' },
        { key: 'krombank', icon: '🟣', label: 'KromBank' },
        { key: 'gopay', icon: '🟢', label: 'GoPay' },
        { key: 'dana', icon: '🔵', label: 'DANA' },
        { key: 'shopeepay', icon: '👛', label: 'ShopeePay' }
    ],
    getBalances() { // saldo cash, saldo total, dan saldo tiap sub-dompet (SeaBank = dompet bawaan)
        const bal = { cash: 0, saldo: 0 }, sub = { gopay: 0, dana: 0, shopeepay: 0, seabank: 0, krombank: 0 };
        App.State.transactions.forEach(t => {
            const amt = (t.pemasukan || 0) - (t.pengeluaran || 0);
            if (t.jenisAkun === 'cash') bal.cash += amt; else { bal.saldo += amt; sub[t.subWallet && sub.hasOwnProperty(t.subWallet) ? t.subWallet : 'seabank'] += amt; }
        });
        (App.State.transfers || []).forEach(tf => {
            bal[tf.dari] -= tf.jumlah;
            bal[tf.ke] += tf.jumlah;
            if (tf.dari === 'saldo') { const k = tf.dariSubWallet && sub.hasOwnProperty(tf.dariSubWallet) ? tf.dariSubWallet : 'seabank'; sub[k] -= tf.jumlah; }
            if (tf.ke === 'saldo') { const k = tf.keSubWallet && sub.hasOwnProperty(tf.keSubWallet) ? tf.keSubWallet : 'seabank'; sub[k] += tf.jumlah; }
        });
        return { cash: bal.cash, saldo: bal.saldo, sub };
    },
    // Isi pilihan "Bayar dari / Masuk ke Akun": Cash + tiap dompet, lengkap dengan saldonya. Nilai: 'cash' atau 'saldo:<dompet>'.
    fillPayAccount(selectId, hintId, getAmount, checkEnough) {
        const sel = document.getElementById(selectId); if (!sel) return;
        const b = this.getBalances(), fmt = App.Utils.formatCurrency, prev = sel.value;
        sel.innerHTML = `<option value="cash">💵 Cash / Tunai · ${fmt(b.cash)}</option>` + this.SUB_WALLETS.map(w => `<option value="saldo:${w.key}">${w.icon} ${w.label} · ${fmt(b.sub[w.key])}</option>`).join('');
        sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'cash';
        const upd = () => {
            const hint = document.getElementById(hintId); if (!hint) return;
            const bal = sel.value === 'cash' ? b.cash : b.sub[sel.value.split(':')[1]] || 0, need = getAmount ? getAmount() : 0, low = checkEnough && need > bal;
            hint.textContent = low ? `⚠️ Saldo tidak cukup (kurang ${fmt(need - bal)}) — tetap bisa dicatat, saldo jadi minus.` : `Saldo tersedia: ${fmt(bal)}`;
            hint.style.color = low ? 'var(--danger)' : 'var(--text-muted)';
        };
        sel._upd = upd; sel.onchange = upd; // satu pendengar tetap per kolom jumlah (hindari menumpuk tiap modal dibuka)
        const amt = getAmount && document.getElementById(getAmount.inputId); if (amt && !amt._payBound) { amt._payBound = true; amt.addEventListener('input', () => sel._upd && sel._upd()); } upd();
    },
    renderBalances() {
        if (App.State.isLoading) return;
        const { cash: balCash, saldo: balSaldo, sub: subWallets } = this.getBalances(), bal = { cash: balCash, saldo: balSaldo };
        // Net balance
        const netEl = document.getElementById('homeNetBalance');
        if(netEl) netEl.textContent = App.Utils.formatCurrency(bal.cash + bal.saldo);
        // Mini balance cards
        const balCards = document.getElementById('balanceCards');
        if(balCards) balCards.innerHTML = `
            <div class="home-mini-card bc-cash"><div class="bc-label">💵 Uang Tunai</div><div class="bc-value">${App.Utils.formatCurrency(bal.cash)}</div></div>
            <div class="home-mini-card bc-saldo"><div class="bc-label">🪪 Saldo Bank / E-Wallet</div><div class="bc-value">${App.Utils.formatCurrency(bal.saldo)}</div></div>
        `;
        // Rincian sub-dompet (SeaBank sebagai dompet utama/default)
        const subWalletBox = document.getElementById('subWalletBreakdown');
        if (subWalletBox) {
            const items = this.SUB_WALLETS;
            subWalletBox.innerHTML = items.map(it => `
                <div class="subwallet-item">
                    <span class="subwallet-label">${it.icon} ${it.label}</span>
                    <span class="subwallet-value">${App.Utils.formatCurrency(subWallets[it.key])}</span>
                </div>`).join('') + `<button type="button" class="btn btn-outline btn-sm" style="width:100%; margin-top:0.6rem;" onclick="event.stopPropagation(); App.Handlers.openSyncBalance();">🔄 Sinkronkan Saldo dengan Kenyataan</button>`;
        }
        // Monthly income/expense stats
        const now = new Date(); const thisYM = now.toISOString().slice(0,7);
        let monthIn = 0, monthOut = 0;
        App.State.transactions.forEach(t => { if(t.tanggal && t.tanggal.startsWith(thisYM)) { monthIn += (t.pemasukan||0); monthOut += (t.pengeluaran||0); } });
        const inEl = document.getElementById('homeMonthIn'); const outEl = document.getElementById('homeMonthOut');
        if(inEl) inEl.textContent = App.Utils.formatCurrency(monthIn);
        if(outEl) outEl.textContent = App.Utils.formatCurrency(monthOut);
        // Greeting
        const greetEl = document.getElementById('homeGreeting');
        if(greetEl && App.State.user) {
            const name = (App.State.user.displayName || App.State.user.email.split('@')[0]).split(' ')[0];
            const h = now.getHours();
            const salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
            greetEl.textContent = `${salam}, ${name} 👋`;
        }
    },
    renderPaylaters() {
        const list = document.getElementById('paylaterList'); const totalEl = document.getElementById('paylaterTotalAmount');
        if (App.State.isLoading) return;
        if (!App.State.paylaters.length) { list.innerHTML = `<p class="text-xs text-muted">Belum ada tagihan / pinjaman tercatat.</p>`; if(totalEl) totalEl.textContent = 'Rp 0'; return; }
        let total = 0;
        list.innerHTML = App.State.paylaters.map(p => {
            total += p.amount;
            const orig = p.originalAmount || p.amount;
            const paid = orig - p.amount;
            const perc = orig > 0 ? Math.round((paid / orig) * 100) : 0;
            const hasProgress = paid > 0;
            let dueHtml = '';
            if(p.dueDay) {
                const nd = App.Utils.nextDueDate(p.dueDay), du = App.Utils.daysUntil(nd);
                const tone = du <= 1 ? 'var(--danger-dark)' : du <= 3 ? 'var(--warning-dark, #b45309)' : 'var(--text-muted)';
                dueHtml = `<div style="font-size:0.7rem; margin-top:0.25rem; font-weight:600; color:${tone};">📅 Jatuh tempo tgl ${p.dueDay} · ${du === 0 ? 'hari ini' : du === 1 ? 'besok' : du + ' hari lagi'}${du <= 3 ? ' ⚠️' : ''}</div>`;
            }
            return `<div class="paylater-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:0.875rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                    <div style="margin-top:0.2rem;">
                        <span class="text-danger" style="font-weight:800; font-size:1.05rem;">${App.Utils.formatCurrency(p.amount)}</span>
                        ${hasProgress ? `<span class="text-muted" style="font-size:0.7rem; margin-left:0.4rem;">dari ${App.Utils.formatCurrency(orig)}</span>` : ''}
                    </div>
                    ${dueHtml}
                    ${hasProgress ? `<div class="paylater-progress"><div class="paylater-progress-fill" style="width:${perc}%"></div></div>
                    <div class="text-muted" style="font-size:0.65rem; margin-top:0.2rem;">${perc}% sudah dibayar</div>` : ''}
                </div>
                <div class="paylater-actions">
                    <button class="btn btn-sm" style="background:var(--success-light); color:var(--success-dark); padding:0.35rem 0.65rem; font-size:0.75rem; font-weight:700; border-radius:8px;" onclick="App.Handlers.openPayoffModal(${p.id})" title="Bayar / Lunas">💳 Bayar</button>
                    <button class="btn btn-icon" style="background:var(--bg-body); color:var(--text-main); width:30px; height:30px; font-size:0.75rem;" onclick="App.Handlers.setPaylaterDue(${p.id})" title="Atur jatuh tempo" aria-label="Atur jatuh tempo">📅</button>
                    <button class="btn btn-icon" style="background:var(--danger-light); color:var(--danger-dark); width:30px; height:30px; font-size:0.75rem;" onclick="App.Handlers.deletePaylater(${p.id})" title="Hapus tanpa mencatat pembayaran">🗑️</button>
                </div>
            </div>`;
        }).join('');
        if(totalEl) totalEl.textContent = App.Utils.formatCurrency(total);
    },
    renderDebts() {
        const list = document.getElementById('debtList'); if(!list || App.State.isLoading) return;
        const debts = App.State.debts || [];
        let totalUtang = 0, totalPiutang = 0;
        debts.forEach(d => { if(d.tipe === 'utang') totalUtang += d.sisa; else totalPiutang += d.sisa; });
        const tu = document.getElementById('debtTotalUtang'); const tp = document.getElementById('debtTotalPiutang');
        if(tu) tu.textContent = App.Utils.formatCurrency(totalUtang);
        if(tp) tp.textContent = App.Utils.formatCurrency(totalPiutang);
        if(!debts.length) { list.innerHTML = `<p class="text-xs text-muted" style="text-align:center; padding:1rem 0;">Belum ada catatan utang atau piutang.</p>`; return; }
        list.innerHTML = debts.map(d => {
            const orig = d.originalAmount || d.sisa;
            const paid = orig - d.sisa;
            const perc = orig > 0 ? Math.round((paid/orig)*100) : 0;
            const isUtang = d.tipe === 'utang';
            const colorClass = isUtang ? 'text-danger' : 'text-success';
            const settleLabel = isUtang ? '💸 Bayar' : '✅ Terima';
            return `<div class="debt-item ${d.tipe}">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;">
                        <span class="debt-type-badge ${d.tipe}">${isUtang ? '🔴 HUTANG' : '🟢 PIUTANG'}</span>
                        <span style="font-weight:700; font-size:0.875rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${d.nama}</span>
                    </div>
                    <div style="display:flex; align-items:baseline; gap:0.4rem;">
                        <span class="${colorClass}" style="font-weight:800; font-size:1rem;">${App.Utils.formatCurrency(d.sisa)}</span>
                        ${paid > 0 ? `<span class="text-muted" style="font-size:0.68rem;">dari ${App.Utils.formatCurrency(orig)}</span>` : ''}
                    </div>
                    ${d.catatan ? `<div class="text-muted" style="font-size:0.7rem; margin-top:0.15rem;">${d.catatan}</div>` : ''}
                    ${paid > 0 ? `<div class="debt-progress"><div class="debt-progress-fill" style="width:${perc}%"></div></div>
                    <div class="text-muted" style="font-size:0.63rem; margin-top:0.15rem;">${perc}% ${isUtang ? 'sudah dibayar' : 'sudah diterima'}</div>` : ''}
                </div>
                <div class="debt-actions">
                    <button class="btn btn-sm" style="background:var(--primary-light); color:var(--primary-dark); padding:0.35rem 0.6rem; font-size:0.72rem; font-weight:700; border-radius:8px;" onclick="App.Handlers.openSettleDebt(${d.id})">${settleLabel}</button>
                    <button class="btn btn-icon" style="background:var(--bg-surface-hover); color:var(--text-muted); width:28px; height:28px; font-size:0.7rem;" onclick="App.Handlers.deleteDebt(${d.id})" title="Hapus">🗑️</button>
                </div>
            </div>`;
        }).join('');
    },
    renderHistory() {
        const list = document.getElementById('historyList'); if (App.State.isLoading) return;
        const q = document.getElementById('filterSearch').value.toLowerCase(); const cat = document.getElementById('filterCategory').value;
        const start = document.getElementById('filterStart').value; const end = document.getElementById('filterEnd').value;
        const type = document.getElementById('filterType').value; const acc = document.getElementById('filterAccount').value;
        
        const lockDiv = document.getElementById('historyLock'); let limitDateStr = '';
        if(!App.State.isPremium) { const limitDate = new Date(); limitDate.setMonth(limitDate.getMonth() - App.Config.FreeLimits.historyMonths); limitDateStr = limitDate.toISOString().split('T')[0]; }

        let filtered = App.State.transactions.filter(t => {
            if (t.isAdjustment) return false; // penyesuaian saldo ditampilkan terpisah, bukan di riwayat biasa
            const matchDate = (!start || t.tanggal >= start) && (!end || t.tanggal <= end);
            const matchQ = !q || (t.keterangan||'').toLowerCase().includes(q) || t.kategori.toLowerCase().includes(q);
            const matchCat = !cat || t.kategori === cat;
            const matchType = type === 'all' || (type === 'in' && t.pemasukan > 0) || (type === 'out' && t.pengeluaran > 0);
            let matchAcc = true;
            if (acc) {
                if (acc.includes(':')) { const [accType, sub] = acc.split(':'); matchAcc = t.jenisAkun === accType && t.subWallet === sub; }
                else matchAcc = t.jenisAkun === acc;
            }
            return matchDate && matchQ && matchCat && matchType && matchAcc;
        }).sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

        const hasLocked = !App.State.isPremium && filtered.some(t => t.tanggal < limitDateStr);
        if(hasLocked) {
            // Tampilkan popup (kecuali user sudah centang "jangan tampilkan lagi")
            if(!localStorage.getItem('history_popup_hide')) {
                const popup = document.getElementById('historyPremiumPopup');
                if(popup) popup.classList.add('show');
            }
            filtered = filtered.filter(t => t.tanggal >= limitDateStr);
        }

        if (!filtered.length) { list.innerHTML = `<div class="text-center" style="padding:3rem 1rem;"><div style="font-size:3rem; opacity:0.5; margin-bottom:1rem;">📭</div><p class="text-muted">Tidak ada riwayat.</p></div>`; return; }

        const grouped = {}; filtered.forEach(t => { if(!grouped[t.tanggal]) grouped[t.tanggal] = []; grouped[t.tanggal].push(t); });
        let html = '';
        Object.keys(grouped).sort().reverse().forEach(date => {
            const txs = grouped[date]; let dIn = 0, dOut = 0; txs.forEach(t => { dIn+=(t.pemasukan||0); dOut+=(t.pengeluaran||0); });
            html += `<div style="margin-bottom: 1.5rem;">
                <div style="display:flex; justify-content:space-between; border-bottom: 1px solid var(--border-medium); padding-bottom:0.25rem; margin-bottom: 0.5rem;">
                    <span class="font-bold text-sm">${App.Utils.formatDateStr(date)}</span>
                    <div class="text-xs font-semibold">${dIn > 0 ? `<span class="text-success">+${App.Utils.formatNumber(dIn)}</span>` : ''} ${dIn>0 && dOut>0 ? '<span class="text-muted" style="margin:0 4px;">|</span>' : ''} ${dOut > 0 ? `<span class="text-danger">-${App.Utils.formatNumber(dOut)}</span>` : ''}</div>
                </div><div class="list-group" style="gap:0.5rem;">`;

            txs.forEach(t => {
                const isInc = (t.pemasukan || 0) > 0; const amt = isInc ? t.pemasukan : t.pengeluaran;
                const catObj = [...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === t.kategori) || {icon:'📝', name:t.kategori};
                const accIcon = App.Config.AccountIcons[t.jenisAkun] || '🏦';
                // Badge sumber khusus
                let sourceBadge = '';
                if(t._source === 'paylater')       sourceBadge = `<span class="tx-source-badge tx-source-paylater">💳 Pelunasan Tagihan</span>`;
                else if(t._source === 'debt-utang')   sourceBadge = `<span class="tx-source-badge tx-source-debt-utang">🔴 Bayar Hutang</span>`;
                else if(t._source === 'debt-piutang') sourceBadge = `<span class="tx-source-badge tx-source-debt-piutang">🟢 Terima Piutang</span>`;
                const iconStyle = t._source === 'paylater' ? 'background:#ede9fe;color:#7c3aed;'
                    : t._source === 'debt-utang'   ? 'background:#fee2e2;color:#b91c1c;'
                    : t._source === 'debt-piutang' ? 'background:#d1fae5;color:#065f46;'
                    : isInc ? 'background:var(--success-light);color:var(--success-dark);' : 'background:var(--danger-light);color:var(--danger-dark);';
                
                html += `<div class="list-item" style="padding: 0.8rem 1rem;" onclick="App.Handlers.openEdit(${t.id})">
                        <div class="item-left">
                            <div class="item-icon" style="width:42px;height:42px;font-size:1.25rem;${iconStyle}">${catObj.icon}</div>
                            <div class="item-details">
                                <span class="item-title">${catObj.name}</span>
                                <span class="item-meta">
                                    ${sourceBadge}
                                    ${t.excludeFromBudget ? `<span class="tx-source-badge" style="background:var(--bg-surface-hover); color:var(--text-muted);">🚫 Di luar budget</span>` : ''}
                                    ${t.keterangan ? `<span>${t.keterangan}</span>` : '<span style="opacity:0.5">Tanpa keterangan</span>'}
                                    <span class="acc-badge">${accIcon} ${t.jenisAkun.toUpperCase()}</span>
                                </span>
                            </div>
                        </div>
                        <div class="item-right"><span class="item-amount font-bold ${isInc ? 'text-success' : 'text-danger'}">${isInc ? '+' : '-'}${App.Utils.formatNumber(amt)}</span></div>
                    </div>`;
            });
            html += `</div></div>`;
        });
        list.innerHTML = html;
    },
    renderBudgets() {
        const list = document.getElementById('budgetList'); if (App.State.isLoading) return;
        if (!App.State.budgets.length) { list.innerHTML = `<div class="text-center" style="padding:2rem;"><p>Belum ada limit budget diatur.</p></div>`; return; }

        list.innerHTML = App.State.budgets.map(b => {
            const now = new Date(); let filterDate;
            if(b.period === 'weekly') { const day = now.getDay(); filterDate = new Date(now); filterDate.setDate(now.getDate() - (day===0?6:day-1)); filterDate.setHours(0,0,0,0); } 
            else { filterDate = new Date(now.getFullYear(), now.getMonth(), 1); }
            const isAll = b.category === '__all__';
            const spent = App.State.transactions.filter(t => !t.excludeFromBudget && (isAll || t.kategori === b.category) && new Date(t.tanggal) >= filterDate).reduce((s,t) => s + (t.pengeluaran||0), 0);
            const perc = Math.min((spent / b.amount) * 100, 100);
            const isDanger = perc >= 90;
            const catObj = isAll ? { icon: '🌐', name: 'Semua Kategori' } : ([...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === b.category) || {icon:'📊', name:b.category});

            return `<div class="progress-card">
                <div class="progress-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;"><span style="font-size:1.2rem;">${catObj.icon}</span>
                    <div><div class="font-bold text-sm">${catObj.name} <span class="badge ${b.period==='weekly'?'badge-active':'badge-paused'}">${b.period==='weekly'?'Mingguan':'Bulanan'}</span></div>
                    <div class="text-xs text-muted">${App.Utils.formatCurrency(spent)} / ${App.Utils.formatCurrency(b.amount)}</div></div></div>
                    <button class="btn btn-icon text-danger" style="background:none;" onclick="App.Handlers.deleteBudget(${b.id})">🗑️</button>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width:${perc}%; background:${isDanger?'var(--danger)':'var(--primary)'}"></div></div>
                ${isDanger ? `<div class="text-xs text-danger font-semibold" style="margin-top:0.5rem;">⚠️ Limit budget hampir/sudah habis!</div>` : ''}
            </div>`;
        }).join('');
    },
    renderTransfers() {
        const list = document.getElementById('transfersList'); if (!list || App.State.isLoading) return;
        const transfers = (App.State.transfers || []).slice().sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
        const countEl = document.getElementById('transferHistoryCount'); if (countEl) countEl.textContent = transfers.length;
        if (!transfers.length) { list.innerHTML = `<div class="text-center" style="padding:1.5rem 1rem;"><p class="text-sm text-muted">Belum ada riwayat transfer.</p></div>`; return; }
        list.innerHTML = transfers.map(tf => {
            const subLabel = { gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay', seabank: 'SeaBank', krombank: 'KromBank' };
            const fromIcon = tf.dari === 'cash' ? '💵' : '🪪';
            const toIcon   = tf.ke   === 'cash' ? '💵' : '🪪';
            const fromName = tf.dari === 'cash' ? 'Cash' : ('Saldo' + (tf.dariSubWallet && subLabel[tf.dariSubWallet] ? ' ' + subLabel[tf.dariSubWallet] : ''));
            const toName   = tf.ke   === 'cash' ? 'Cash' : ('Saldo' + (tf.keSubWallet && subLabel[tf.keSubWallet] ? ' ' + subLabel[tf.keSubWallet] : ''));
            return `<div class="list-item" style="padding:0.65rem 0.25rem;">
                <div class="item-left">
                    <div class="item-icon" style="width:34px;height:34px;font-size:0.95rem;background:var(--bg-surface-hover);color:var(--text-muted);">⇄</div>
                    <div class="item-details">
                        <span class="text-sm font-semibold">${fromIcon} ${fromName} → ${toIcon} ${toName}</span>
                        <span class="item-meta">${App.Utils.formatDateStr(tf.tanggal)}${tf.catatan ? ' · ' + tf.catatan : ''}</span>
                    </div>
                </div>
                <div class="item-right" style="display:flex;align-items:center;gap:0.4rem;">
                    <span class="text-sm text-muted font-semibold">${App.Utils.formatCurrency(tf.jumlah)}</span>
                    <button class="btn btn-icon" style="background:none;width:26px;height:26px;font-size:0.75rem;color:var(--text-light);" onclick="App.Handlers.deleteTransfer(${tf.id})" title="Hapus">🗑️</button>
                </div>
            </div>`;
        }).join('');
    },
    renderSettings() {
        if (App.State.isLoading) return;
        const catList = document.getElementById('settingsCatList');
        catList.innerHTML = App.State.customCategories.length ? App.State.customCategories.map(c => `
            <div class="list-item" style="padding: 0.75rem 1rem;">
                <div class="item-left"><span class="item-icon" style="width:30px;height:30px;font-size:1rem;">${c.icon}</span> <span class="font-medium text-sm">${c.name}</span></div>
                <button class="btn btn-icon text-danger" style="background:none;" onclick="App.Handlers.deleteCategory('${c.id}')">🗑️</button>
            </div>
        `).join('') : '<p class="text-xs text-muted">Belum ada kategori kustom.</p>';

        const recList = document.getElementById('settingsRecurringList');
        const unitLabel = { daily: 'Hari', weekly: 'Minggu', monthly: 'Bulan' };
        recList.innerHTML = App.State.recurring.length ? App.State.recurring.map(r => {
            const statusClass = r.status === 'paused' ? 'badge-paused' : 'badge-active'; const isInc = (r.template.pemasukan||0) > 0;
            const interval = r.interval || 1;
            const freqLabel = `Tiap ${interval > 1 ? interval + ' ' : ''}${unitLabel[r.type] || r.type}`;
            const endLabel = r.endDate ? ` • s/d ${App.Utils.formatDateStr(r.endDate)}` : '';
            return `<div class="list-item" style="padding: 1rem;">
                <div class="item-left">
                    <div class="item-icon" style="font-size:1rem;">🔄</div>
                    <div class="item-details"><span class="item-title">${r.template.kategori} <span class="badge ${statusClass}">${r.status}</span></span><span class="item-meta">${freqLabel}${endLabel} • Next: ${App.Utils.formatDateStr(r.nextExecution)}</span></div>
                </div>
                <div style="text-align:right;">
                    <div class="font-bold ${isInc?'text-success':'text-danger'} text-sm">${isInc?'+':'-'}${App.Utils.formatNumber(r.template.pemasukan||r.template.pengeluaran)}</div>
                    <div style="margin-top:0.25rem;"><button class="badge" style="border:none; cursor:pointer;" onclick="App.Handlers.toggleRecurring(${r.id})">${r.status==='paused'?'Resume':'Pause'}</button> <button class="badge badge-paused" style="border:none; cursor:pointer; color:var(--danger);" onclick="App.Handlers.deleteRecurring(${r.id})">Hapus</button></div>
                </div>
            </div>`}).join('') : '<p class="text-sm text-muted text-center" style="padding: 1rem;">Belum ada otomatisasi rutin.</p>';
            
        const btnUpgradeRec = document.getElementById('btnUpgradeRec'); if(btnUpgradeRec) btnUpgradeRec.style.display = App.State.isPremium ? 'none' : 'block';
    },
    _reportPeriod: 'month',
    _reportOffset: 0,
    _reportExcludedCategories: (() => { try { return JSON.parse(localStorage.getItem('kpReportExcludedCat') || '[]'); } catch(e){ return []; } })(),
    toggleReportCategoryFilter() {
        const panel = document.getElementById('repCategoryFilterPanel');
        const show = panel.style.display === 'none';
        panel.style.display = show ? 'block' : 'none';
        if (show) this.renderReportCategoryFilter();
    },
    renderReportCategoryFilter() {
        const box = document.getElementById('repCategoryFilterList'); if (!box) return;
        const allCats = [...App.Config.DefaultCategories, ...App.State.customCategories];
        box.innerHTML = allCats.map(c => {
            const excluded = this._reportExcludedCategories.includes(c.id);
            return `<button type="button" class="rep-cat-chip ${excluded ? 'excluded' : ''}" onclick="App.UI.toggleReportCategoryExclusion('${c.id}')">
                <span>${excluded ? '🚫' : c.icon}</span><span>${c.name}</span>
            </button>`;
        }).join('');
    },
    toggleReportCategoryExclusion(catId) {
        if (this._reportExcludedCategories.includes(catId)) {
            this._reportExcludedCategories = this._reportExcludedCategories.filter(id => id !== catId);
        } else {
            this._reportExcludedCategories.push(catId);
        }
        try { localStorage.setItem('kpReportExcludedCat', JSON.stringify(this._reportExcludedCategories)); } catch(e){}
        this.renderReportCategoryFilter();
        this.renderReport();
    },
    setAllReportCategories(showAll) {
        const allCats = [...App.Config.DefaultCategories, ...App.State.customCategories];
        this._reportExcludedCategories = showAll ? [] : allCats.map(c => c.id);
        try { localStorage.setItem('kpReportExcludedCat', JSON.stringify(this._reportExcludedCategories)); } catch(e){}
        this.renderReportCategoryFilter();
        this.renderReport();
    },
    getPreviousPeriodRange(start, end) {
        const durationMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - durationMs);
        return { start: prevStart, end: prevEnd };
    },
    setReportPeriod(type) {
        this._reportPeriod = type;
        this._reportOffset = 0;
        ['Month', 'Week', 'Custom'].forEach(t => document.getElementById(`repPeriod${t}Btn`).classList.toggle('active', t.toLowerCase() === type));
        document.getElementById('repCustomDateWrap').style.display = type === 'custom' ? 'block' : 'none';
        document.getElementById('repNavWrap').style.display = type === 'custom' ? 'none' : 'flex';
        if (type === 'custom') {
            const from = document.getElementById('repDateFrom'), to = document.getElementById('repDateTo');
            if (!from.value) { const d = new Date(); d.setDate(d.getDate() - 6); from.value = d.toISOString().split('T')[0]; }
            if (!to.value) to.value = new Date().toISOString().split('T')[0];
        }
        this.renderReport();
    },
    shiftReportOffset(dir) {
        this._reportOffset += dir;
        this.renderReport();
    },
    getReportDateRange() {
        const now = new Date(); let start, end, label;
        if (this._reportPeriod === 'week') {
            const day = now.getDay(); start = new Date(now); start.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (this._reportOffset * 7)); start.setHours(0,0,0,0);
            end = new Date(start); end.setDate(start.getDate() + 6);
            label = `${start.toLocaleDateString('id-ID',{day:'numeric',month:'short'})} — ${end.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}`;
        } else if (this._reportPeriod === 'custom') {
            const fromVal = document.getElementById('repDateFrom').value, toVal = document.getElementById('repDateTo').value;
            start = fromVal ? new Date(fromVal + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
            end = toVal ? new Date(toVal + 'T00:00:00') : now;
            label = `${start.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})} — ${end.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}`;
        } else {
            start = new Date(now.getFullYear(), now.getMonth() + this._reportOffset, 1);
            end = new Date(now.getFullYear(), now.getMonth() + this._reportOffset + 1, 0);
            label = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        }
        return { start, end, label };
    },
    renderReport() {
        if (App.State.isLoading) return;
        const { start, end, label } = this.getReportDateRange();
        const startStr = start.toISOString().split('T')[0], endStr = end.toISOString().split('T')[0];
        document.getElementById('repPeriodLabel').textContent = `Periode: ${label}`;

        const excludedCat = this._reportExcludedCategories;
        const filterBtn = document.getElementById('repCategoryFilterBtn');
        if (filterBtn) filterBtn.textContent = excludedCat.length ? `⚙️ Filter Kategori (${excludedCat.length} disembunyikan)` : '⚙️ Filter Kategori';

        const tx = App.State.transactions.filter(t => !t.isAdjustment && t.tanggal >= startStr && t.tanggal <= endStr && !excludedCat.includes(t.kategori));
        const txAll = App.State.transactions.filter(t => !t.isAdjustment && t.tanggal >= startStr && t.tanggal <= endStr);
        const totIn = tx.reduce((s,t) => s + (t.pemasukan||0), 0);
        const totOut = tx.reduce((s,t) => s + (t.pengeluaran||0), 0);

        // Perbandingan vs periode sebelumnya
        const prevRange = this.getPreviousPeriodRange(start, end);
        const prevStartStr = prevRange.start.toISOString().split('T')[0], prevEndStr = prevRange.end.toISOString().split('T')[0];
        const prevTx = App.State.transactions.filter(t => !t.isAdjustment && t.tanggal >= prevStartStr && t.tanggal <= prevEndStr && !excludedCat.includes(t.kategori));
        const prevIn = prevTx.reduce((s,t) => s + (t.pemasukan||0), 0);
        const prevOut = prevTx.reduce((s,t) => s + (t.pengeluaran||0), 0);
        const pctChangeHtml = (curr, prev, goodIfUp) => {
            if (prev === 0 && curr === 0) return '';
            if (prev === 0) return `<div class="text-xs" style="margin-top:0.15rem; opacity:0.85;">Baru dibanding periode lalu</div>`;
            const pct = ((curr - prev) / prev) * 100;
            const up = pct >= 0;
            const good = up === goodIfUp;
            const color = good ? 'var(--success)' : (pct === 0 ? 'inherit' : 'var(--danger)');
            return `<div class="text-xs" style="margin-top:0.15rem; opacity:0.9; color:${color};">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% dari periode lalu</div>`;
        };

        document.getElementById('repSummaryCards').innerHTML = `
            <div class="home-mini-card bc-cash"><div class="bc-label">⬆ Pemasukan</div><div class="bc-value">${App.Utils.formatCurrency(totIn)}</div>${pctChangeHtml(totIn, prevIn, true)}</div>
            <div class="home-mini-card bc-saldo"><div class="bc-label">⬇ Pengeluaran</div><div class="bc-value">${App.Utils.formatCurrency(totOut)}</div>${pctChangeHtml(totOut, prevOut, false)}</div>
            <div class="home-mini-card bc-cash" style="grid-column:1/-1;"><div class="bc-label">💰 Selisih Bersih</div><div class="bc-value">${totIn - totOut >= 0 ? '+' : ''}${App.Utils.formatCurrency(totIn - totOut)}</div>${pctChangeHtml(totIn-totOut, prevIn-prevOut, true)}</div>
        `;

        // Agregasi harian
        const dayMs = 86400000;
        const dayCount = Math.round((end - start) / dayMs) + 1;
        const dailyLabels = [], dailyData = [];
        let maxDay = null, maxAmt = -1;
        for (let i = 0; i < dayCount; i++) {
            const d = new Date(start.getTime() + i * dayMs);
            const ds = d.toISOString().split('T')[0];
            const sum = tx.filter(t => t.tanggal === ds).reduce((s,t) => s + (t.pengeluaran||0), 0);
            dailyLabels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: dayCount > 31 ? 'short' : undefined }));
            dailyData.push(sum);
            if (sum > maxAmt) { maxAmt = sum; maxDay = d; }
        }
        const borosLabel = document.getElementById('repBorosLabel');
        borosLabel.textContent = (maxAmt > 0) ? `Paling boros: ${maxDay.toLocaleDateString('id-ID',{day:'numeric',month:'long'})} (${App.Utils.formatCurrency(maxAmt)})` : 'Belum ada pengeluaran di periode ini';

        const ctxDaily = document.getElementById('chartDaily');
        if (ctxDaily && typeof Chart !== 'undefined') {
            if (App.State.charts.daily) App.State.charts.daily.destroy();
            App.State.charts.daily = new Chart(ctxDaily, {
                type: 'bar',
                data: { labels: dailyLabels, datasets: [{ label: 'Pengeluaran', data: dailyData, backgroundColor: dailyData.map(v => v === maxAmt && v > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(99,102,241,0.5)'), borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => App.Utils.formatCurrency(v) } } } }
            });
        }

        // Per kategori (dihitung dari semua transaksi periode ini, termasuk yang disembunyikan,
        // supaya kategori yang dikecualikan tetap bisa dilihat totalnya sebagai 1 baris gabungan)
        const catMapAll = {};
        txAll.forEach(t => { if (t.pengeluaran) catMapAll[t.kategori] = (catMapAll[t.kategori] || 0) + t.pengeluaran; });
        const visibleEntries = Object.entries(catMapAll).filter(([id]) => !excludedCat.includes(id)).sort((a,b) => b[1] - a[1]);
        const excludedEntries = Object.entries(catMapAll).filter(([id]) => excludedCat.includes(id));
        const excludedTotal = excludedEntries.reduce((s,[,amt]) => s + amt, 0);
        const grandTotOut = visibleEntries.reduce((s,[,amt]) => s + amt, 0) + excludedTotal;

        const catBox = document.getElementById('repCategoryList');
        if (!visibleEntries.length && !excludedTotal) {
            catBox.innerHTML = `<p class="text-sm text-muted text-center" style="padding:1rem 0;">Belum ada pengeluaran di periode ini.</p>`;
        } else {
            let html = visibleEntries.map(([catId, amt]) => {
                const catObj = [...App.Config.DefaultCategories, ...App.State.customCategories].find(c => c.id === catId) || { icon: '📦', name: catId };
                const perc = grandTotOut > 0 ? (amt / grandTotOut) * 100 : 0;
                return `<div style="margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                        <span class="text-sm font-semibold">${catObj.icon} ${catObj.name}</span>
                        <span class="text-sm font-semibold">${App.Utils.formatCurrency(amt)} <span class="text-muted" style="font-weight:400;">(${perc.toFixed(0)}%)</span></span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${perc}%; background:var(--primary);"></div></div>
                </div>`;
            }).join('');
            if (excludedTotal > 0) {
                const perc = grandTotOut > 0 ? (excludedTotal / grandTotOut) * 100 : 0;
                html += `<div class="rep-cat-excluded-row">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                        <span class="text-sm font-semibold text-muted">🚫 Dikecualikan <span style="font-weight:400;">(${excludedEntries.length} kategori)</span></span>
                        <span class="text-sm font-semibold text-muted">${App.Utils.formatCurrency(excludedTotal)} <span style="font-weight:400;">(${perc.toFixed(0)}%)</span></span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${perc}%; background:var(--text-light);"></div></div>
                    <p class="text-xs text-muted" style="margin-top:0.4rem;">Tidak dihitung di ringkasan &amp; grafik di atas. <button type="button" onclick="App.UI.toggleReportCategoryFilter()" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; padding:0; font-size:inherit;">Atur kategori</button></p>
                </div>`;
            }
            catBox.innerHTML = html;
        }
    },
    renderAnalytics() {
        if (App.State.isLoading || typeof Chart === 'undefined') return;
        const tData = App.State.transactions; const d = new Date(); const currentMonth = d.toISOString().substring(0,7);
        const textColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#f8fafc' : '#0f172a'; const gridColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#e2e8f0';
        
        let expMap = {}; tData.forEach(t => { if(t.pengeluaran > 0 && t.tanggal.substring(0,7) === currentMonth) { expMap[t.kategori] = (expMap[t.kategori]||0) + t.pengeluaran; } });
        const catLabels = Object.keys(expMap).map(k => ([...App.Config.DefaultCategories, ...App.State.customCategories].find(c=>c.id===k)||{}).name || k);
        const cColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
        
        if (App.State.charts.cat) App.State.charts.cat.destroy();
        App.State.charts.cat = new Chart(document.getElementById('chartCategory'), { type: 'doughnut', data: { labels: catLabels, datasets: [{ data: Object.values(expMap), backgroundColor: cColors, borderWidth: 0, hoverOffset: 10 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {color: textColor, font: {family: 'Plus Jakarta Sans'}} } }, cutout: '70%', animation: { animateScale: true } } });

        let trendMap = {}; for(let i=5; i>=0; i--) { let dt = new Date(d.getFullYear(), d.getMonth() - i, 1); trendMap[dt.toISOString().substring(0,7)] = {i:0, e:0}; }
        tData.forEach(t => { const m = t.tanggal.substring(0,7); if (trendMap[m]) { trendMap[m].i += (t.pemasukan||0); trendMap[m].e += (t.pengeluaran||0); } });
        
        const keys = Object.keys(trendMap).sort(); const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        if (App.State.charts.trend) App.State.charts.trend.destroy();
        App.State.charts.trend = new Chart(document.getElementById('chartTrend'), { type: 'bar', data: { labels: keys.map(k => `${monthNames[parseInt(k.split('-')[1])-1]} ${k.substring(2,4)}`), datasets: [ { label: 'In', data: keys.map(k=>trendMap[k].i), backgroundColor: '#10b981', borderRadius: 4 }, { label: 'Out', data: keys.map(k=>trendMap[k].e), backgroundColor: '#ef4444', borderRadius: 4 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: {color: textColor} } }, scales: { x: { grid: {display: false}, ticks: {color: textColor} }, y: { border: {display: false}, grid: {color: gridColor}, ticks: {color: textColor} } } } });
    },
    switchTab(id, btn) {
        document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
        document.getElementById('view-'+id).classList.add('active');
        if (btn) {
            const container = btn.closest('.side-nav') || btn.closest('.sub-tab-strip');
            if (container) container.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        for (const [g, cfg] of Object.entries(this.NavGroups)) { if (cfg.subs.some(s => s.id === id)) { this._lastSubTab[g] = id; break; } }
        if(id === 'laporan') setTimeout(() => { this.renderAnalytics(); this.renderReport(); }, 100);
        if(id === 'alokasi') setTimeout(() => this.renderAllocation(), 100);
        const fab = document.getElementById('adjustmentFAB'); if (fab) fab.style.display = (id === 'history') ? 'flex' : 'none';
        if(window.AppModules) AppModules.onShow(id);
    },
    NavGroups: {
        home: { subs: [{ id: 'home-today', icon: '🏠', label: 'Hari Ini' }] },
        keuangan: { subs: [
            { id: 'input', icon: '✍️', label: 'Input' },
            { id: 'history', icon: '🕰️', label: 'Riwayat' },
            { id: 'planning', icon: '🗂️', label: 'Kelola' },
            { id: 'alokasi', icon: '🎯', label: 'Alokasi' },
            { id: 'goal-home', icon: '🐷', label: 'Target' }
        ]},
        kuliah: { subs: [{ id: 'kuliah', icon: '🎓', label: 'Kuliah' }, { id: 'ck-dashboard', icon: '📓', label: 'Ringkasan' }, { id: 'ck-catat', icon: '✍️', label: 'Catat' }, { id: 'ck-rangkuman', icon: '📚', label: 'Rangkuman' }, { id: 'ck-arsip', icon: '🗂️', label: 'Arsip' }] },
        daily: { subs: [{ id: 'daily-home', icon: '🗓️', label: 'Tugas' }, { id: 'daily-kalender', icon: '📅', label: 'Kalender' }] },
        makan: { subs: [{ id: 'mk-jadwal', icon: '🍽️', label: 'Jadwal' }, { id: 'mk-catat', icon: '📝', label: 'Catat' }, { id: 'mk-riwayat', icon: '🍜', label: 'Riwayat' }, { id: 'mk-statistik', icon: '📊', label: 'Statistik' }, { id: 'mk-extra', icon: '✨', label: 'Tambahan' }] },
        notes: { subs: [{ id: 'jr-today', icon: '📔', label: 'Hari Ini' }, { id: 'jr-history', icon: '📖', label: 'Riwayat' }, { id: 'nt-list', icon: '🗒️', label: 'Catatan Bebas' }, { id: 'nt-dashboard', icon: '🏠', label: 'Ringkasan' }] },
        vault: { subs: [{ id: 'vault-home', icon: '🔐', label: 'Brankas' }] },
        laporan: { subs: [{ id: 'laporan', icon: '📄', label: 'Laporan' }] },
        settings: { subs: [{ id: 'settings', icon: '⚙️', label: 'Setelan' }] }
    },
    _activeGroup: 'home',
    _lastSubTab: {},
    switchMainGroup(group) {
        if (!this.NavGroups[group]) group = 'keuangan';
        if (App.State.isAdmin) group = 'vault'; else if (group === 'vault') group = 'home'; // admin hanya Brankas; Brankas khusus admin
        this._activeGroup = group;
        const groupId = 'navGroup' + group.charAt(0).toUpperCase() + group.slice(1);
        document.querySelectorAll('.side-nav .nav-item').forEach(b => b.classList.remove('active'));
        const groupBtn = document.getElementById(groupId); if (groupBtn) groupBtn.classList.add('active');

        if (!this.NavGroups[group]) group = 'keuangan'; // grup lama (mis. 'tugas') sudah digabung ke Task
        const cfg = this.NavGroups[group];
        const strip = document.getElementById('subTabStrip');
        if (cfg.subs.length > 1) {
            strip.style.display = 'flex';
            strip.innerHTML = cfg.subs.map(s => `<button type="button" class="sub-tab-pill" id="subtab-${s.id}" onclick="App.UI.switchTab('${s.id}', this)">${s.icon} ${s.label}</button>`).join('');
        } else {
            strip.style.display = 'none'; strip.innerHTML = '';
        }
        const targetSub = this._lastSubTab[group] || cfg.subs[0].id;
        this._lastSubTab[group] = targetSub;
        const subBtn = document.getElementById('subtab-' + targetSub) || groupBtn;
        this.switchTab(targetSub, subBtn);
    },
    showModal(id) { document.getElementById(id).classList.add('show'); },
    openChangelog() {
        const list = document.getElementById('changelogList');
        list.innerHTML = App.Config.Changelog.map((c, i) => `
            <div class="changelog-item ${i === 0 ? 'latest' : ''}">
                <div class="changelog-version">
                    <span class="badge">${c.version}</span>
                    <span class="text-xs text-muted">${c.date}</span>
                    ${i === 0 ? '<span class="text-xs font-bold text-primary">Terbaru</span>' : ''}
                </div>
                <ul>${c.items.map(it => `<li>${it}</li>`).join('')}</ul>
            </div>`).join('');
        App.UI.showModal('changelogModal');
    },
    toggleRunningBalanceDetail() {
        const el = document.getElementById('editRunningBalanceDetail');
        if (el) el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
    },
    toggleSubWalletBreakdown() {
        const el = document.getElementById('subWalletBreakdown'); const icon = document.getElementById('subWalletToggleIcon');
        if (!el) return;
        const show = el.style.display === 'none' || !el.style.display;
        el.style.display = show ? 'block' : 'none';
        if (icon) icon.style.transform = show ? 'rotate(180deg)' : 'rotate(0deg)';
    },
    toggleTransferHistory() {
        const el = document.getElementById('transfersList'); const icon = document.getElementById('transferHistoryToggleIcon');
        if (!el) return;
        const show = el.style.display === 'none' || !el.style.display;
        el.style.display = show ? 'block' : 'none';
        if (icon) icon.style.transform = show ? 'rotate(180deg)' : 'rotate(0deg)';
    },
    openAdjustmentPanel() { document.getElementById('adjustmentPanelOverlay').classList.add('show'); },
    closeAdjustmentPanel() { document.getElementById('adjustmentPanelOverlay').classList.remove('show'); },
    renderAdjustmentHistory() {
        const list = document.getElementById('adjustmentHistoryList'); if (!list || App.State.isLoading) return;
        const adj = App.State.transactions.filter(t => t.isAdjustment).sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
        const badge = document.getElementById('adjustmentFABBadge');
        if (badge) { if (adj.length) { badge.textContent = adj.length > 9 ? '9+' : adj.length; badge.classList.add('show'); } else { badge.classList.remove('show'); } }
        if (!adj.length) { list.innerHTML = `<div class="text-center" style="padding:1.5rem 1rem;"><p class="text-sm text-muted">Belum ada riwayat penyesuaian.</p></div>`; return; }
        list.innerHTML = adj.map(t => {
            const isPlus = t.pemasukan > 0;
            const amt = isPlus ? t.pemasukan : t.pengeluaran;
            return `<div class="list-item" style="padding:0.65rem 0.25rem;">
                <div class="item-left">
                    <div class="item-icon" style="width:34px;height:34px;font-size:0.95rem;background:var(--bg-surface-hover);color:var(--text-muted);">🔄</div>
                    <div class="item-details">
                        <span class="text-sm font-semibold">${t.keterangan}</span>
                        <span class="item-meta">${App.Utils.formatDateStr(t.tanggal)}</span>
                    </div>
                </div>
                <div class="item-right" style="gap:0.6rem;">
                    <span class="text-sm font-semibold ${isPlus ? 'text-success' : 'text-danger'}">${isPlus ? '+' : '-'}${App.Utils.formatCurrency(amt)}</span>
                    <div class="adj-item-actions">
                        <button onclick="App.UI.closeAdjustmentPanel(); App.Handlers.openEdit(${t.id});" title="Edit">✏️</button>
                        <button onclick="App.Handlers.deleteAdjustment(${t.id})" title="Hapus">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },
    toggleAllocSettings() {
        const el = document.getElementById('allocSettingsPanel'); if (!el) return;
        const show = el.style.display === 'none' || !el.style.display;
        if (show) {
            const alloc = App.State.budgetAllocation;
            document.getElementById('allocTotal').value = alloc.total.toLocaleString('id-ID');
            const isDefault = alloc.splits.pokok === 50 && alloc.splits.kuliah === 20 && alloc.splits.fleksibel === 30;
            document.getElementById('allocCustomPct').checked = !isDefault;
            document.getElementById('allocPctFields').style.display = isDefault ? 'none' : 'block';
            document.getElementById('allocPctPokok').value = alloc.splits.pokok;
            document.getElementById('allocPctKuliah').value = alloc.splits.kuliah;
            document.getElementById('allocPctFleksibel').value = alloc.splits.fleksibel;
            this.updateAllocPctHint();
        }
        el.style.display = show ? 'block' : 'none';
    },
    updateAllocPctHint() {
        const p = parseInt(document.getElementById('allocPctPokok').value) || 0;
        const k = parseInt(document.getElementById('allocPctKuliah').value) || 0;
        const f = parseInt(document.getElementById('allocPctFleksibel').value) || 0;
        const total = p + k + f;
        const hint = document.getElementById('allocPctTotalHint');
        hint.textContent = `Total: ${total}% ${total === 100 ? '✅' : '(harus pas 100%)'}`;
        hint.className = 'text-xs ' + (total === 100 ? 'text-success' : 'text-danger');
    },
    toggleAllocCategoryMap() {
        const el = document.getElementById('allocCategoryMapList'); const icon = document.getElementById('allocCategoryMapToggleIcon');
        if (!el) return;
        const show = el.style.display === 'none' || !el.style.display;
        if (show) {
            const all = [...App.Config.DefaultCategories, ...App.State.customCategories];
            el.innerHTML = all.map(c => {
                const current = App.State.categoryBucketMap[c.id] || 'fleksibel';
                const opts = App.Handlers.allocBucketDefs.map(d => `<option value="${d.key}" ${current === d.key ? 'selected' : ''}>${d.icon} ${d.label}</option>`).join('') + `<option value="none" ${current === 'none' ? 'selected' : ''}>🚫 Di Luar Budget</option>`;
                return `<div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.55rem 0; border-bottom:1px solid var(--border-light);">
                    <span class="text-sm font-semibold">${c.icon} ${c.name}</span>
                    <select style="width:auto; padding:0.4rem 0.6rem; font-size:0.78rem;" onchange="App.Handlers.setCategoryBucket('${c.id}', this.value)">${opts}</select>
                </div>`;
            }).join('');
        }
        el.style.display = show ? 'block' : 'none';
        if (icon) icon.style.transform = show ? 'rotate(180deg)' : 'rotate(0deg)';
    },
    renderAllocation() {
        if (App.State.isLoading) return;
        const status = App.Handlers.getAllocationStatus();
        const box = document.getElementById('allocProgressCards'); if (!box) return;

        // Ringkasan total gabungan
        const totalAlloc = status.reduce((s,x) => s + x.allocated, 0);
        const totalSpent = status.reduce((s,x) => s + x.spent, 0);
        const totalPerc = totalAlloc > 0 ? (totalSpent / totalAlloc) * 100 : 0;
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(lastDay - now.getDate() + 1, 1);
        const totalRemaining = totalAlloc - totalSpent;
        const dailyAllowance = totalRemaining > 0 ? totalRemaining / daysLeft : 0;
        const summaryColor = totalPerc >= 100 ? 'var(--danger)' : totalPerc >= 80 ? 'var(--warning)' : 'var(--success)';

        const summaryBox = document.getElementById('allocSummaryHeader');
        if (summaryBox) {
            summaryBox.innerHTML = `
                <div class="text-xs text-muted font-semibold" style="text-transform:uppercase; letter-spacing:0.03em;">Total Bulan Ini</div>
                <div class="font-bold" style="font-size:1.65rem; margin:0.25rem 0; color:${summaryColor};">${App.Utils.formatCurrency(totalSpent)}</div>
                <div class="text-xs text-muted">dari ${App.Utils.formatCurrency(totalAlloc)} (${totalPerc.toFixed(0)}%)</div>
                <div class="progress-track" style="margin:0.75rem 0 0.6rem;"><div class="progress-fill" style="width:${Math.min(totalPerc,100)}%; background:${summaryColor};"></div></div>
                <div class="text-xs font-semibold" style="color:${summaryColor};">${totalRemaining >= 0 ? `💡 Aman ${dailyAllowance > 0 ? App.Utils.formatCurrency(dailyAllowance) + '/hari' : ''} sampai akhir bulan (${daysLeft} hari lagi)` : `⚠️ Sudah lebih ${App.Utils.formatCurrency(-totalRemaining)} dari total budget`}</div>
            `;
        }

        // Donut chart pembagian pos
        const ctxDonut = document.getElementById('chartAllocDonut');
        if (ctxDonut && typeof Chart !== 'undefined') {
            if (App.State.charts.allocDonut) App.State.charts.allocDonut.destroy();
            App.State.charts.allocDonut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: { labels: status.map(s => s.label), datasets: [{ data: status.map(s => s.allocated), backgroundColor: ['#6366f1', '#f59e0b', '#10b981'], borderWidth: 3, borderColor: getComputedStyle(document.body).getPropertyValue('--bg-surface') }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
            });
        }

        box.innerHTML = status.map(s => {
            const percClamped = Math.min(s.perc, 100);
            const barColor = s.perc >= 100 ? 'var(--danger)' : s.perc >= 80 ? 'var(--warning)' : 'var(--success)';
            return `<div class="progress-card">
                <div class="progress-header">
                    <div><div class="font-bold text-sm">${s.icon} ${s.label}</div>
                    <div class="text-xs text-muted">${App.Utils.formatCurrency(s.spent)} / ${App.Utils.formatCurrency(s.allocated)}</div></div>
                    <span class="font-bold text-sm" style="color:${barColor};">${s.perc.toFixed(0)}%</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width:${percClamped}%; background:${barColor};"></div></div>
                <div class="text-xs ${s.remaining < 0 ? 'text-danger' : 'text-muted'} font-semibold" style="margin-top:0.5rem;">${s.remaining < 0 ? `⚠️ Sudah lebih ${App.Utils.formatCurrency(-s.remaining)}` : `Sisa ${App.Utils.formatCurrency(s.remaining)}`}</div>
            </div>`;
        }).join('');

        // Saran budget harian per pos
        const dailyBox = document.getElementById('allocDailyTips');
        if (dailyBox) {
            dailyBox.innerHTML = `<div class="fap-section-title">📅 Jatah Harian Sisa Bulan Ini (${daysLeft} hari lagi)</div>` + status.map(s => {
                const daily = s.remaining > 0 ? s.remaining / daysLeft : 0;
                return `<div class="subwallet-item"><span class="subwallet-label">${s.icon} ${s.label}</span><span class="subwallet-value">${daily > 0 ? App.Utils.formatCurrency(daily) + '/hari' : 'Rp 0/hari'}</span></div>`;
            }).join('');
        }

        // Rekomendasi otomatis
        const insightBox = document.getElementById('allocInsightCard');
        const over = status.filter(s => s.remaining < 0);
        const under = status.filter(s => s.perc < 50);
        if (insightBox) {
            if (over.length && under.length) {
                insightBox.style.display = 'block';
                insightBox.innerHTML = `<p class="text-sm"><b>💡 Saran:</b> ${over[0].label} udah lebih ${App.Utils.formatCurrency(-over[0].remaining)}, tapi ${under[0].label} masih longgar (baru ${under[0].perc.toFixed(0)}%). Coba geser dikit alokasinya bulan depan.</p>`;
            } else if (over.length) {
                insightBox.style.display = 'block';
                insightBox.innerHTML = `<p class="text-sm"><b>⚠️ Perhatian:</b> ${over.map(o=>o.label).join(', ')} udah kebablasan bulan ini.</p>`;
            } else {
                insightBox.style.display = 'none';
            }
        }
        this.renderAllocTrendChart();
    },
    renderAllocTrendChart() {
        const ctx = document.getElementById('chartAllocTrend'); if (!ctx || typeof Chart === 'undefined') return;
        const labels = [], planned = [], actual = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            labels.push(d.toLocaleDateString('id-ID', { month: 'short' }));
            const status = App.Handlers.getAllocationStatus(-i);
            planned.push(App.State.budgetAllocation.total);
            actual.push(status.reduce((s, x) => s + x.spent, 0));
        }
        if (App.State.charts.allocTrend) App.State.charts.allocTrend.destroy();
        App.State.charts.allocTrend = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Rencana', data: planned, backgroundColor: 'rgba(99,102,241,0.25)', borderRadius: 6 },
                { label: 'Realisasi', data: actual, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 6 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => App.Utils.formatCurrency(v) } } } }
        });
    },
    toggleAllocMonthlyReport() {
        const el = document.getElementById('allocMonthlyReportList'); const icon = document.getElementById('allocMonthlyReportToggleIcon');
        if (!el) return;
        const show = el.style.display === 'none' || !el.style.display;
        if (show) this.renderAllocMonthlyReport();
        el.style.display = show ? 'block' : 'none';
        if (icon) icon.style.transform = show ? 'rotate(180deg)' : 'rotate(0deg)';
    },
    renderAllocMonthlyReport() {
        const box = document.getElementById('allocMonthlyReportList'); if (!box) return;
        const now = new Date();
        let html = '';
        for (let i = 0; i <= 5; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const status = App.Handlers.getAllocationStatus(-i);
            const totalAlloc = status.reduce((s,x) => s + x.allocated, 0);
            const totalSpent = status.reduce((s,x) => s + x.spent, 0);
            const sisa = totalAlloc - totalSpent;
            const isCurrent = i === 0;
            html += `<div class="progress-card" style="margin-bottom:0.75rem;">
                <div class="progress-header">
                    <div><div class="font-bold text-sm">${monthLabel} ${isCurrent ? '<span class="badge badge-active">Berjalan</span>' : ''}</div>
                    <div class="text-xs text-muted">Terpakai ${App.Utils.formatCurrency(totalSpent)} dari ${App.Utils.formatCurrency(totalAlloc)}</div></div>
                </div>
                <div style="margin-top:0.6rem; padding-top:0.6rem; border-top:1px dashed var(--border-light);">
                    ${status.map(s => `<div class="subwallet-item"><span class="subwallet-label">${s.icon} ${s.label}</span><span class="subwallet-value ${s.remaining<0?'text-danger':'text-success'}">${s.remaining<0?'Lebih '+App.Utils.formatCurrency(-s.remaining):'Sisa '+App.Utils.formatCurrency(s.remaining)}</span></div>`).join('')}
                </div>
                <div class="text-sm font-bold" style="margin-top:0.6rem; text-align:right; color:${sisa<0?'var(--danger)':'var(--success)'};">${sisa<0?`⚠️ Total lebih ${App.Utils.formatCurrency(-sisa)}`:`✅ Total sisa ${App.Utils.formatCurrency(sisa)}`}</div>
            </div>`;
        }
        box.innerHTML = html;
    },
    refreshStartupAlertPopup() {
        const wasOpen = document.getElementById('financeAlertPopup').classList.contains('show');
        if(wasOpen) App.Handlers.checkStartupAlerts(true);
    },
    closeStartupAlertPopup() {
        const dontShow = document.getElementById('fapDontShowToday');
        if (dontShow && dontShow.checked) { const today = new Date().toISOString().split('T')[0]; localStorage.setItem('financeAlertDismissedDate', today); }
        this.closeModal('financeAlertPopup');
        if(window.AppNotifyQueue) window.AppNotifyQueue.closed('finance-alert');
    },
    closeModal(id) { document.getElementById(id).classList.remove('show'); },
    showToast(msg, type='success') {
        const c = document.getElementById('toastContainer'); const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<div class="toast-icon">${type==='success'?'✅':type==='error'?'❌':'💡'}</div><div class="toast-body">${msg}</div>`; c.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3000);
    },
    confirm(msg, title = 'Konfirmasi') {
        return new Promise(resolve => { document.getElementById('confirmTitle').textContent = title; document.getElementById('confirmMsg').textContent = msg; this.showModal('confirmModal'); const btnYes = document.getElementById('btnConfirmYes'); const newBtn = btnYes.cloneNode(true); btnYes.parentNode.replaceChild(newBtn, btnYes); newBtn.onclick = () => this.resolveConfirm(true); this.confirmResolver = resolve; });
    },
    resolveConfirm(res) { this.closeModal('confirmModal'); if(this.confirmResolver) this.confirmResolver(res); this.confirmResolver = null; }
};
