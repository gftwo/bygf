import { ref, get, remove, update } from './firebase.js';
import { App } from './core.js';

App.Admin = {
    usersData: null,
    init() { this.loadData(); },
    async loadData() {
        if(!App.State.isAdmin) return;
        const table = document.getElementById('adminUserTable');
        if (table) table.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem; color:var(--text-muted);">⏳ Memuat data...</td></tr>';

        if (App.Auth.isDummy) {
            document.getElementById('adminDummyBanner').style.display = 'flex';
            document.getElementById('adminMode').textContent = 'Lokal';
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('dummy_db_')) {
                    const uid = key.replace('dummy_db_', '');
                    try {
                        const db = JSON.parse(localStorage.getItem(key));
                        const profileEmail = uid.replace('dummy_', '') + '@keuangan.pro';
                        data[uid] = { profile: { name: db.displayName || uid.replace('dummy_', ''), email: profileEmail }, appData: db };
                    } catch(e) {}
                }
            }
            const currentUser = App.State.user;
            if (currentUser && !data[currentUser.uid]) {
                data[currentUser.uid] = { profile: { name: currentUser.displayName || currentUser.email.split('@')[0], email: currentUser.email }, appData: App.Auth.isDummy ? JSON.parse(localStorage.getItem('dummy_db_' + currentUser.uid) || '{}') : {} };
            }
            this.usersData = data; this.renderDashboard(); this.renderUsers(); return;
        }

        document.getElementById('adminMode').textContent = 'Firebase';
        try {
            const snap = await get(ref(App.DB.dbInstance, 'users'));
            this.usersData = snap.val() || {}; this.renderDashboard(); this.renderUsers();
        } catch (e) {
            if (table) table.innerHTML = '<tr><td colspan="5" class="text-center text-danger" style="padding:2rem;">Gagal mengambil data Firebase. Pastikan Rules Database sudah diubah.</td></tr>';
        }
    },
    renderDashboard() {
        if (!this.usersData) return;
        const uids = Object.keys(this.usersData); let totPremium = 0, totTx = 0;
        uids.forEach(uid => { const dataNode = this.usersData[uid].appData; if (dataNode) { if (dataNode.isPremium) totPremium++; totTx += (dataNode.transactions || []).length; } });
        document.getElementById('adminTotUsers').textContent = uids.length; document.getElementById('adminTotPremium').textContent = totPremium; document.getElementById('adminTotTx').textContent = totTx;
    },
    renderUsers() {
        if (!this.usersData) return;
        const table = document.getElementById('adminUserTable'); const query = (document.getElementById('adminSearch').value || '').toLowerCase();
        const uids = Object.keys(this.usersData); let html = '';

        uids.forEach(uid => {
            const user = this.usersData[uid]; const profile = user.profile || {}; const appData = user.appData || {};
            const isPrem = appData.isPremium || false; const txCount = (appData.transactions || []).length;
            const realUsername = (profile.email || '').replace('@keuangan.pro', ''); const displayName = profile.name || realUsername || 'Unknown';
            const initials = displayName.charAt(0).toUpperCase(); const isCurrentUser = App.State.user && uid === App.State.user.uid; const isAdminUser = profile.email === 'admin@keuangan.pro';

            if (query && !displayName.toLowerCase().includes(query) && !realUsername.toLowerCase().includes(query)) return;

            const statusBadge = isAdminUser
                ? `<span class="badge badge-admin">Admin</span>`
                : isPrem
                    ? `<span class="badge badge-active">Premium 👑</span>`
                    : `<span class="badge badge-paused">Reguler</span>`;
            
            const userPwd = profile.password || appData.password || '***';

            html += `
                <tr>
                    <td>
                        <div class="admin-user-card">
                            <div class="admin-user-avatar" style="${isPrem ? 'background:var(--warning-light); color:var(--warning-dark);' : ''}">${initials}</div>
                            <div>
                                <div class="font-bold" style="font-size:0.875rem;">${displayName} ${isCurrentUser ? '<span style="font-size:0.65rem; background:var(--primary-light); color:var(--primary); padding:1px 5px; border-radius:4px; font-weight:700;">Kamu</span>' : ''}</div>
                                <div class="text-xs text-muted">UID: ${uid.substring(0, 10)}...</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="text-sm">@${realUsername || '-'}</span></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.35rem;">
                            <span class="font-mono text-sm" style="color: var(--warning-dark); font-weight:700; user-select:all; cursor:text;">${userPwd}</span>
                            <button class="admin-action-btn" style="background:var(--warning-light); color:var(--warning-dark); width:22px; height:22px; font-size:0.65rem; flex-shrink:0;" onclick="navigator.clipboard.writeText('${userPwd}').then(()=>App.UI.showToast('Password disalin!','success'))" title="Salin">📋</button>
                        </div>
                    </td>
                    <td><span class="font-bold text-sm">${txCount}</span><span class="text-xs text-muted"> transaksi</span></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; gap:0.4rem; align-items:center;">
                            <button class="admin-action-btn aab-view" onclick="App.Admin.showDetail('${uid}')" title="Lihat Detail">🔍</button>
                            ${!isAdminUser ? `<button class="admin-action-btn aab-premium" onclick="App.Admin.togglePremium('${uid}', ${!isPrem})" title="${isPrem ? 'Cabut Premium' : 'Beri Premium'}">${isPrem ? '⬇️' : '👑'}</button>` : ''}
                            ${!isCurrentUser && !isAdminUser ? `<button class="admin-action-btn aab-delete" onclick="App.Admin.deleteUser('${uid}')" title="Hapus Data">🗑️</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        if (!html) html = '<tr><td colspan="6" class="text-center" style="padding:2rem; color:var(--text-muted);">Tidak ada pengguna ditemukan.</td></tr>';
        table.innerHTML = html;
    },
    showDetail(uid) {
        if (!this.usersData || !this.usersData[uid]) return;
        const user = this.usersData[uid];
        const profile = user.profile || {};
        const appData = user.appData || {};
        const realUsername = (profile.email || '').replace('@keuangan.pro', '');
        const isPrem = appData.isPremium || false;
        const txCount = (appData.transactions || []).length;
        const goalCount = (appData.goals || []).length;
        const budgetCount = (appData.budgets || []).length;
        const isAdminUser = profile.email === 'admin@keuangan.pro';
        const isCurrentUser = App.State.user && uid === App.State.user.uid;
        const userPwd = profile.password || appData.password || '***';

        let totIn = 0, totOut = 0;
        (appData.transactions || []).forEach(t => { totIn += (t.pemasukan||0); totOut += (t.pengeluaran||0); });

        document.getElementById('adminDetailContent').innerHTML = `
            <div style="text-align:center; padding: 1rem 0 1.25rem;">
                <div style="width:64px; height:64px; border-radius:50%; margin: 0 auto 0.75rem; background:${isPrem ? 'var(--warning-light)' : 'var(--primary-light)'}; color:${isPrem ? 'var(--warning-dark)' : 'var(--primary)'}; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:700; border:2px solid ${isPrem ? 'var(--warning)' : 'var(--primary)'};">
                    ${(profile.name || realUsername || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="font-bold" style="font-size:1.1rem;">${profile.name || '-'}</div>
                <div class="text-sm text-muted">@${realUsername}</div>
            </div>
            <div class="admin-detail-row"><span class="text-muted">Status</span><span>${isPrem ? '<span class="badge badge-active">Premium 👑</span>' : isAdminUser ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-paused">Reguler</span>'}</span></div>
            <div class="admin-detail-row"><span class="text-muted">Password</span><div style="display:flex;align-items:center;gap:0.5rem;"><span class="font-bold font-mono" style="color: var(--warning-dark); user-select:all; cursor:text;">${userPwd}</span><button class="btn btn-sm" style="background:var(--warning-light);color:var(--warning-dark);padding:0.2rem 0.6rem;font-size:0.7rem;border-radius:6px;" onclick="navigator.clipboard.writeText('${userPwd}').then(()=>App.UI.showToast('Password disalin!','success'))">📋 Salin</button></div></div>
            <div class="admin-detail-row"><span class="text-muted">Total Transaksi</span><span class="font-bold">${txCount}</span></div>
            <div class="admin-detail-row"><span class="text-muted">Total Pemasukan</span><span class="font-bold text-success">Rp ${App.Utils.formatNumber(totIn)}</span></div>
            <div class="admin-detail-row"><span class="text-muted">Total Pengeluaran</span><span class="font-bold text-danger">Rp ${App.Utils.formatNumber(totOut)}</span></div>
            <div class="admin-detail-row"><span class="text-muted">Target Aktif</span><span class="font-bold">${goalCount}</span></div>
            <div class="admin-detail-row"><span class="text-muted">Budget Aktif</span><span class="font-bold">${budgetCount}</span></div>
            <div class="admin-detail-row" style="border:none;"><span class="text-muted text-xs">UID</span><span class="text-xs" style="font-family:monospace; word-break:break-all;">${uid}</span></div>
        `;
        const actionsEl = document.getElementById('adminDetailActions'); actionsEl.innerHTML = '';
        if (!isAdminUser) {
            const btn1 = document.createElement('button'); btn1.className = 'btn btn-sm ' + (isPrem ? 'btn-secondary' : 'btn-premium');
            btn1.textContent = isPrem ? '⬇️ Cabut Premium' : '👑 Beri Premium';
            btn1.onclick = () => { App.Admin.togglePremium(uid, !isPrem); App.UI.closeModal('adminDetailModal'); }; actionsEl.appendChild(btn1);
        }
        if (!isCurrentUser && !isAdminUser) {
            const btn2 = document.createElement('button'); btn2.className = 'btn btn-sm btn-danger'; btn2.textContent = '🗑️ Hapus Data';
            btn2.onclick = () => { App.UI.closeModal('adminDetailModal'); App.Admin.deleteUser(uid); }; actionsEl.appendChild(btn2);
        }
        App.UI.showModal('adminDetailModal');
    },
    togglePremium(uid, newState) {
        if (!App.State.isAdmin) return;
        if (App.Auth.isDummy) {
            const key = 'dummy_db_' + uid;
            try {
                const db = JSON.parse(localStorage.getItem(key) || '{}'); db.isPremium = newState; localStorage.setItem(key, JSON.stringify(db));
                if (App.State.user && uid === App.State.user.uid) { App.State.isPremium = newState; App.Premium.applyState(); App.UI.renderAll(); }
                App.UI.showToast(`Status Premium ${newState ? 'diberikan' : 'dicabut'}.`, 'success'); this.loadData();
            } catch(e) {}
            return;
        }
        update(ref(App.DB.dbInstance, `users/${uid}/appData`), {isPremium: newState}).then(() => {
            App.UI.showToast(`Status Premium diperbarui.`, 'success');
            this.loadData();
        });
    },
    async deleteUser(uid) {
        if (!App.State.isAdmin) return;
        const yes = await App.UI.confirm('Hapus SELURUH data pengguna ini secara permanen?');
        if (!yes) return;

        if (App.Auth.isDummy) {
            localStorage.removeItem('dummy_db_' + uid);
            App.UI.showToast('Data pengguna berhasil dihapus.', 'success');
            this.loadData();
            return;
        }

        remove(ref(App.DB.dbInstance, `users/${uid}`)).then(() => {
            App.UI.showToast('Data pengguna berhasil dihapus.', 'success');
            this.loadData();
        });
    }
};
