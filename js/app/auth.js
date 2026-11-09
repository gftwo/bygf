import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, ref, update } from './firebase.js';
import { App } from './core.js';

App.Auth = {
    instance: null,
    isDummy: false,
    init(app) {
        try {
            this.instance = getAuth(app);
            onAuthStateChanged(this.instance, (user) => {
                this.handleUserChange(user);
            });
        } catch (e) {
            this.isDummy = true;
            const localUser = localStorage.getItem('dummy_user_v8');
            if (localUser) this.handleUserChange(JSON.parse(localUser));
            else this.handleUserChange(null);
        }
    },
    handleUserChange(user) {
        if (user) {
            App.State.user = user;
            App.State.isAdmin = user.email === 'admin@keuangan.pro' || user.uid === 'dummy_admin'; // Brankas Sandi hanya untuk admin
            
            const name = user.displayName || user.email.split('@')[0];
            document.getElementById('userDisplayName').textContent = name;
            document.getElementById('userAvatar').innerHTML = user.photoURL ? `<img src="${user.photoURL}">` : name.charAt(0).toUpperCase();
            
            if (App.Auth.isDummy) {
                const key = 'dummy_db_' + user.uid;
                try {
                    const existing = JSON.parse(localStorage.getItem(key) || '{}');
                    let dirty = false; if (!existing.displayName) { existing.displayName = name; dirty = true; } if ('password' in existing) { delete existing.password; dirty = true; } if (dirty) localStorage.setItem(key, JSON.stringify(existing));
                } catch(e) {}
            }

            App.UI.toggleAuthView(false);
            if (window.AppModules) AppModules.setUser(user.uid);
            App.DB.listen(user.uid);

            if(App.DB.dbInstance && !this.isDummy) {
                update(ref(App.DB.dbInstance, `users/${user.uid}/profile`), {
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    photoURL: user.photoURL || '',
                    lastLogin: new Date().toISOString(),
                    password: null // keamanan: hapus sandi polos yang tersimpan oleh versi lama (null = hapus kunci di Firebase)
                }).catch(err => console.log(err));
            }

            // Akun admin hanya melihat Brankas Sandi; akun biasa melihat semua tab kecuali Brankas.
            const isVault = el => el.id === 'navGroupVault' || el.dataset.group === 'vault';
            document.querySelectorAll('.nav-item, .sn-rail-btn').forEach(el => { el.style.display = (App.State.isAdmin ? isVault(el) : !isVault(el)) ? 'flex' : 'none'; });
            document.body.classList.toggle('role-admin', !!App.State.isAdmin);
            const railAvatar = document.querySelector('.sn-rail-avatar'); if(railAvatar) railAvatar.style.display = 'flex';
            document.getElementById('btnPdSettings').style.display = 'flex';
            setTimeout(() => { 
                if (App.State.isAdmin) { App.UI.switchMainGroup('vault'); return; }
                const inputTab = document.querySelector('.nav-item[onclick*="input"]'); 
                if(inputTab) App.UI.switchTab('input', inputTab); 
            }, 50);
        } else {
            App.State.user = null; App.State.isAdmin = false; document.body.classList.remove('role-admin');
            if (window.AppModules) AppModules.setUser(null);
            App.UI.toggleAuthView(true);
            if (window.BGSplash) BGSplash.hide(); // belum login: tampilkan layar masuk
        }
    },
    async handleLogin(e) {
        e.preventDefault();
        const btn = document.getElementById('btnLogin'); btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span>Memproses...';
        const username = document.getElementById('loginUsername').value.toLowerCase().replace(/\s/g, '');
        const password = document.getElementById('loginPassword').value;
        const email = username + '@keuangan.pro'; 
        
        if (this.isDummy) {
            setTimeout(() => {
                const dummyUser = { uid: "dummy_" + username, email: email, displayName: username };
                localStorage.setItem('dummy_user_v8', JSON.stringify(dummyUser)); this.handleUserChange(dummyUser);
                App.UI.showToast('Login Lokal Berhasil!', 'success'); btn.disabled = false; btn.textContent = 'Masuk';
            }, 800);
            return;
        }

        try {
            await signInWithEmailAndPassword(this.instance, email, password);
            App.UI.showToast('Login berhasil!', 'success');
        } catch (error) { App.UI.showToast('Login gagal. Periksa kembali Username dan Password Anda.', 'error'); }
        btn.disabled = false; btn.textContent = 'Masuk';
    },
    async handleRegister(e) {
        e.preventDefault();
        const btn = document.getElementById('btnRegister'); btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span>Memproses...';
        const name = document.getElementById('regName').value;
        const username = document.getElementById('regUsername').value.toLowerCase().replace(/\s/g, '');
        const password = document.getElementById('regPassword').value;
        const email = username + '@keuangan.pro';

        if (this.isDummy) {
            setTimeout(() => {
                const dummyUser = { uid: "dummy_" + username, email: email, displayName: name };
                localStorage.setItem('dummy_user_v8', JSON.stringify(dummyUser));

                this.handleUserChange(dummyUser);
                App.UI.showToast('Registrasi Lokal Berhasil!', 'success');
                btn.disabled = false; btn.textContent = 'Buat Akun';
            }, 800);
            return;
        }

        try {
            const res = await createUserWithEmailAndPassword(this.instance, email, password);
            await updateProfile(res.user, { displayName: name });

            App.UI.showToast('Registrasi berhasil!', 'success');
            this.handleUserChange({...res.user, displayName: name});
        } catch (error) {
            if (error.code === 'auth/weak-password') {
                App.UI.showToast('Firebase Online minimal harus 6 karakter sandi.', 'error');
            } else {
                App.UI.showToast('Registrasi gagal. Username mungkin sudah terdaftar.', 'error');
            }
        }
        btn.disabled = false; btn.textContent = 'Buat Akun';
    },
    handleLogout() {
        App.UI.closeModal('logoutModal');
        App.State._navInitDone = false;
        if (this.isDummy) {
            localStorage.removeItem('dummy_user_v8');
            App.UI.showToast('Berhasil keluar. Sampai jumpa! 👋', 'info');
            App.State.transactions = []; App.State.recurring = []; App.State.budgets = []; App.State.paylaters = [];
            if(App.DB.listener) App.DB.listener(); this.handleUserChange(null);
            return;
        }
        signOut(this.instance).then(() => {
            App.UI.showToast('Berhasil keluar. Sampai jumpa! 👋', 'info');
            App.State.transactions = []; App.State.recurring = []; App.State.budgets = []; App.State.paylaters = [];
            if(App.DB.listener) App.DB.listener();
        });
    }
};
