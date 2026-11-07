// ── Tugas Pro: Notifikasi jadwal hari ini ──
(function(){
    "use strict";
    const LS_KEY = 'tugasPro.v2';
    const DISMISS_KEY = 'todoReminderDismissedDate';

    function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    function parseISO(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }

    // Tugas kini disimpan di modul Task (AppModules 'daily'); bentuknya dipetakan ke format popup ini.
    function loadTasks(){
        try {
            const d = window.AppModules && AppModules.get('daily');
            if(!d || !Array.isArray(d.tasks)) return [];
            const pm = { high:'high', medium:'med', low:'low' };
            return d.tasks.map(t => ({ id:t.id, title:t.title, done:t.done, due:t.date || null, priority:pm[t.priority] || 'none' }));
        } catch(e){ return []; }
    }

    function getAgenda(){
        const now = new Date(); now.setHours(0,0,0,0);
        const tasks = loadTasks().filter(t => !t.done && t.due);
        const overdue = [], today = [];
        tasks.forEach(t => {
            const d = parseISO(t.due);
            if(!d) return;
            if(d < now) overdue.push(t);
            else if(d.getTime() === now.getTime()) today.push(t);
        });
        const rank = { high:0, med:1, low:2, none:3 };
        const bySort = (a,b) => (rank[a.priority]??3) - (rank[b.priority]??3);
        overdue.sort(bySort); today.sort(bySort);
        return { overdue, today };
    }

    function priorityColor(p){
        return p==='high' ? '#ef4444' : p==='med' ? '#f59e0b' : p==='low' ? '#3b82f6' : '#94a3b8';
    }

    // ── Tugas Kuliah (deadline) ikut ditampilkan di popup harian, biar satu tempat aja ──
    function loadKuliahTasks(){
        try {
            const raw = localStorage.getItem('kuliahPro.v1');
            if(!raw) return [];
            const s = JSON.parse(raw);
            return (s && Array.isArray(s.tasks)) ? s.tasks : [];
        } catch(e){ return []; }
    }
    function getKuliahAgenda(){
        const now = new Date();
        const startToday = new Date(); startToday.setHours(0,0,0,0);
        const overdue = [], today = [];
        loadKuliahTasks().filter(t => !t.done && t.deadline).forEach(t => {
            const dl = new Date(t.deadline);
            if(isNaN(dl.getTime())) return;
            const item = { title: t.judul, priority: dl < now ? 'high' : 'med', source: 'kuliah' };
            if(dl < now) overdue.push(item);
            else { const dlDay = new Date(dl); dlDay.setHours(0,0,0,0); if(dlDay.getTime() === startToday.getTime()) today.push(item); }
        });
        return { overdue, today };
    }

    function updateNavBadge(){
        const badge = document.getElementById('todoNavBadge');
        if(!badge) return;
        const { overdue, today } = getAgenda();
        const count = overdue.length + today.length;
        if(count > 0){ badge.textContent = count > 9 ? '9+' : String(count); badge.classList.add('show'); }
        else { badge.classList.remove('show'); }
    }

    // ── Jembatan ke sistem simpan/sync akun Keuangan Pro ──
    window.TugasProBridge = window.TugasProBridge || {};
    window.TugasProBridge.notifyChange = function(){
        try {
            updateNavBadge();
            if(window.App && App.DB && typeof App.DB.save === 'function') App.DB.save();
        } catch(e){ console.warn('Gagal sync data Tugas Pro ke akun (diabaikan):', e); }
    };
    // Dipanggil saat data tugas datang dari akun (login / sinkron real-time)
    window.TugasProBridge.applyExternalTodos = function(todosObj){
        if(!todosObj) return;
        try {
            // Firebase Realtime Database membuang array kosong ([]) saat disimpan.
            // Pulihkan field yang hilang biar render tugas gak crash (penyebab tugas lain "ikut hilang"
            // atau error "Cannot read properties of undefined" saat menambah tugas baru).
            if(!Array.isArray(todosObj.tasks)) todosObj.tasks = [];
            else {
                todosObj.tasks.forEach(t => {
                    if(!Array.isArray(t.subtasks)) t.subtasks = [];
                    if(!Array.isArray(t.tags)) t.tags = [];
                    else t.tags = t.tags.filter(Boolean);
                    t.subtasks.forEach(s => { if(typeof s.title !== 'string') s.title = ''; });
                });
            }
            if(!Array.isArray(todosObj.projects)) todosObj.projects = [];
            localStorage.setItem(LS_KEY, JSON.stringify(todosObj));
            updateNavBadge();
        } catch(e){}
    };

    let lastHasTugas = false, lastHasKuliah = false;
    function renderPopup(){
        const agendaTugas = getAgenda();
        const agendaKuliah = getKuliahAgenda();
        const overdue = [...agendaTugas.overdue.map(t=>({...t, source:t.source||'tugas'})), ...agendaKuliah.overdue];
        const today = [...agendaTugas.today.map(t=>({...t, source:t.source||'tugas'})), ...agendaKuliah.today];
        const rank = { high:0, med:1, low:2, none:3 };
        const bySort = (a,b) => (rank[a.priority]??3) - (rank[b.priority]??3);
        overdue.sort(bySort); today.sort(bySort);

        const listEl = document.getElementById('trpList');
        const subEl = document.getElementById('trpSubtitle');
        if(!listEl || !subEl) return false;
        listEl.innerHTML = '';
        const total = overdue.length + today.length;
        lastHasTugas = agendaTugas.overdue.length + agendaTugas.today.length > 0;
        lastHasKuliah = agendaKuliah.overdue.length + agendaKuliah.today.length > 0;

        if(total === 0){
            subEl.textContent = 'Tidak ada jadwal yang perlu dikejar 🎉';
            const empty = document.createElement('div');
            empty.className = 'trp-empty';
            empty.textContent = 'Semua aman. Nikmati harimu!';
            listEl.appendChild(empty);
            return false;
        }

        subEl.textContent = `${total} tugas menunggu — ${today.length} hari ini, ${overdue.length} terlewat`;

        const renderItem = (t, tag) => {
            const row = document.createElement('div');
            row.className = 'trp-item';
            const srcIcon = t.source === 'kuliah' ? '🎓 ' : '';
            row.innerHTML = `<span class="trp-dot" style="background:${priorityColor(t.priority)}"></span>`
                + `<span class="trp-item-title"></span>`
                + `<span class="trp-item-tag ${tag==='over'?'over':'today'}">${tag==='over' ? 'Terlewat' : 'Hari ini'}</span>`;
            row.querySelector('.trp-item-title').textContent = srcIcon + (t.title || '(Tanpa judul)');
            return row;
        };

        overdue.slice(0, 6).forEach(t => listEl.appendChild(renderItem(t, 'over')));
        today.slice(0, 8).forEach(t => listEl.appendChild(renderItem(t, 'now')));

        return true;
    }

    function openTodoTab(){
        if(window.App && App.UI && App.UI.switchMainGroup){
            if(!lastHasTugas && lastHasKuliah) App.UI.switchMainGroup('kuliah');
            else App.UI.switchMainGroup('daily');
        }
    }

    function closePopup(){
        const popup = document.getElementById('todoReminderPopup');
        if(popup) popup.classList.remove('show');
    }

    function initReminder(){
        updateNavBadge();

        const popup = document.getElementById('todoReminderPopup');
        if(!popup) return;

        const dismissedDate = localStorage.getItem(DISMISS_KEY);
        if(dismissedDate === todayISO()) return; // sudah ditutup hari ini

        const dontShow = document.getElementById('trpDontShowToday');
        document.getElementById('trpClose').onclick = () => {
            if(dontShow && dontShow.checked) localStorage.setItem(DISMISS_KEY, todayISO());
            closePopup();
            if(window.AppNotifyQueue) window.AppNotifyQueue.closed('todo-reminder');
        };
        document.getElementById('trpOpenTodo').onclick = () => {
            if(dontShow && dontShow.checked) localStorage.setItem(DISMISS_KEY, todayISO());
            closePopup();
            openTodoTab();
            if(window.AppNotifyQueue) window.AppNotifyQueue.closed('todo-reminder');
        };

        const showFn = () => {
            const hasAgenda = renderPopup();
            if(!hasAgenda) return false;
            popup.classList.add('show');
            return true;
        };

        setTimeout(() => {
            if(window.AppNotifyQueue) window.AppNotifyQueue.register('todo-reminder', showFn);
            else showFn();
        }, 500);
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', initReminder);
    } else {
        initReminder();
    }
})();
