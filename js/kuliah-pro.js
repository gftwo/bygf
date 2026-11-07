    (function(){
        "use strict";
        const KP_LS = 'kuliahPro.v1';
        const DAY_NAMES = ['Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu','Minggu'];
        const DAY_SHORT = ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'];
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

        const uid = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

        // ---- date utils ----
        function dayShort(h){ return DAY_SHORT[h] || 'Tanpa jadwal'; }
        function pad2(n){ return String(n).padStart(2,'0'); }
        function isoDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
        function parseISODate(s){ if(!s) return null; const parts = s.split('-').map(Number); const dt = new Date(parts[0], parts[1]-1, parts[2]); dt.setHours(0,0,0,0); return dt; }
        function addDays(d, n){ const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt; }
        function jsIdxToKpIdx(jsDay){ return (jsDay + 6) % 7; } // Senin=0 ... Minggu=6
        function mondayOf(d){ const dt = new Date(d); dt.setHours(0,0,0,0); const idx = jsIdxToKpIdx(dt.getDay()); return addDays(dt, -idx); }
        function fmtDateLabel(d){ if(!d) return '-'; return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
        function fmtDeadline(iso){
            if(!iso) return '-';
            const d = new Date(iso);
            if(isNaN(d.getTime())) return '-';
            return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        function escapeHtml(s){
            return String(s==null?'':s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }

        // ---- storage ----
        function emptyState(){ return { courses:[], overrides:{}, attendance:{}, tasks:[] }; }
        function loadState(){
            try{
                const raw = localStorage.getItem(KP_LS);
                if(!raw) return emptyState();
                const s = JSON.parse(raw);
                return {
                    courses: Array.isArray(s.courses) ? s.courses : [],
                    overrides: (s.overrides && typeof s.overrides === 'object') ? s.overrides : {},
                    attendance: (s.attendance && typeof s.attendance === 'object') ? s.attendance : {},
                    tasks: Array.isArray(s.tasks) ? s.tasks : []
                };
            }catch(e){ return emptyState(); }
        }
        function saveState(){
            try{ localStorage.setItem(KP_LS, JSON.stringify(state)); }catch(e){}
            updateNavBadge();
            try { if(window.KuliahProBridge && window.KuliahProBridge.notifyChange) window.KuliahProBridge.notifyChange(); } catch(e){ console.warn('KuliahProBridge sync gagal (diabaikan):', e); }
        }

        // ── Jembatan ke sistem simpan/sync akun Keuangan Pro ──
        // (biar jadwal, absensi, dan tugas kuliah ikut sinkron ke akun, bukan cuma tersimpan di HP)
        window.KuliahProBridge = window.KuliahProBridge || {};
        window.KuliahProBridge.notifyChange = function(){
            try { if(window.App && App.DB && typeof App.DB.save === 'function') App.DB.save(); } catch(e){ console.warn('Gagal sync data Kuliah ke akun (diabaikan):', e); }
        };
        // Dipanggil saat data kuliah datang dari akun (login / sinkron real-time / restore backup)
        window.KuliahProBridge.applyExternalData = function(dataObj){
            if(!dataObj) return;
            try {
                // Firebase Realtime Database membuang array/objek kosong saat disimpan — pulihkan
                // field yang hilang biar render gak crash, sama seperti pola di Tugas Pro.
                const clean = {
                    courses: Array.isArray(dataObj.courses) ? dataObj.courses : [],
                    overrides: (dataObj.overrides && typeof dataObj.overrides === 'object') ? dataObj.overrides : {},
                    attendance: (dataObj.attendance && typeof dataObj.attendance === 'object') ? dataObj.attendance : {},
                    tasks: Array.isArray(dataObj.tasks) ? dataObj.tasks : []
                };
                localStorage.setItem(KP_LS, JSON.stringify(clean));
                state = clean;
                renderWeekStrip(); renderScheduleList(); updateNavBadge();
                const absensiPane = document.getElementById('kpPane-absensi');
                if(absensiPane && absensiPane.style.display !== 'none') renderAbsensi();
                const tugasPane = document.getElementById('kpPane-tugas');
                if(tugasPane && tugasPane.style.display !== 'none') renderTasks();
            } catch(e){}
        };
        window.KuliahProBridge.refresh = function(){
            state = loadState();
            renderWeekStrip(); renderScheduleList(); updateNavBadge();
        };

        let state = loadState();
        let currentWeekStart = mondayOf(new Date());
        let selectedDayIdx = jsIdxToKpIdx(new Date().getDay());
        let scopeChoice = 'week';

        // ---- occurrence helpers (gabungan jadwal dasar + override per-minggu) ----
        function overrideKey(courseId, dateISO){ return courseId + '_' + dateISO; }
        function courseById(id){ return state.courses.find(c => c.id === id); }

        function getOccurrencesForDate(date){
            const dISO = isoDate(date);
            const kpIdx = jsIdxToKpIdx(date.getDay());
            return state.courses
                .filter(c => c.hari === kpIdx)
                .map(c => {
                    const ov = state.overrides[overrideKey(c.id, dISO)];
                    const merged = Object.assign({}, c, ov || {});
                    return {
                        courseId: c.id,
                        dateISO: dISO,
                        nama: merged.nama,
                        jamMulai: merged.jamMulai,
                        jamSelesai: merged.jamSelesai,
                        sks: merged.sks,
                        lokasi: merged.lokasi,
                        mode: merged.mode,
                        isLibur: !!(ov && ov.libur),
                        isOverridden: !!ov
                    };
                })
                .sort((a,b) => (a.jamMulai||'').localeCompare(b.jamMulai||''));
        }

        // ---- render: header total sks ----
        function updateTotalSks(){
            const el = document.getElementById('kpTotalSks');
            if(!el) return;
            const total = state.courses.reduce((sum,c) => sum + (Number(c.sks)||0), 0);
            el.textContent = `${total} SKS / minggu`;
        }

        // ---- render: week & day strip ----
        function renderWeekStrip(){
            const label = document.getElementById('kpWeekLabel');
            const monday = currentWeekStart;
            const sunday = addDays(monday, 6);
            if(label) label.textContent = `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} — ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;

            const strip = document.getElementById('kpDayStrip');
            if(!strip) return;
            const todayISOStr = isoDate(new Date());
            strip.innerHTML = '';
            for(let i=0;i<7;i++){
                const d = addDays(monday, i);
                const dISO = isoDate(d);
                const occ = getOccurrencesForDate(d).filter(o => !o.isLibur);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'kp-day-btn' + (i===selectedDayIdx ? ' active' : '') + (dISO===todayISOStr ? ' is-today' : '') + (occ.length ? ' has-class' : '');
                btn.innerHTML = `<span class="kp-day-name">${DAY_SHORT[i]}</span><span class="kp-day-num">${d.getDate()}</span><span class="kp-day-dot"></span>`;
                btn.addEventListener('click', () => { selectedDayIdx = i; renderWeekStrip(); renderScheduleList(); });
                strip.appendChild(btn);
            }
        }

        function shiftWeek(n){
            currentWeekStart = addDays(currentWeekStart, n*7);
            renderWeekStrip(); renderScheduleList();
        }

        function renderUnscheduled(){
            const wrap = document.getElementById('kpUnscheduled');
            if(!wrap) return;
            const list = state.courses.filter(c => c.hari < 0);
            wrap.style.display = list.length ? 'block' : 'none';
            if(!list.length){ wrap.innerHTML = ''; return; }
            wrap.innerHTML = `<h3 class="font-bold" style="margin:0 0 .25rem;">Belum dijadwalkan</h3><p class="text-muted text-xs" style="margin:0 0 .75rem;">Matkul ini dipakai di Catatan Kuliah. Ubah untuk menentukan hari & jamnya.</p>` +
                list.map(c => `<div class="kp-class-card"><div class="kp-class-main"><div class="kp-class-title">${escapeHtml(c.nama)}</div></div><div class="kp-class-actions"><button type="button" class="kp-icon-btn" title="Ubah" onclick="KuliahPro.openCourseModal('${c.id}','')">✏️</button></div></div>`).join('');
        }

        function renderScheduleList(){
            const listEl = document.getElementById('kpScheduleList');
            const labelEl = document.getElementById('kpSelectedDayLabel');
            if(!listEl) return;
            const date = addDays(currentWeekStart, selectedDayIdx);
            if(labelEl) labelEl.textContent = `${DAY_NAMES[selectedDayIdx]}, ${fmtDateLabel(date)}`;

            renderUnscheduled();
            const occ = getOccurrencesForDate(date);
            if(!occ.length){
                listEl.innerHTML = `<div class="kp-empty">Belum ada matkul di hari ini. Yuk tambahkan 👆</div>`;
                updateTotalSks();
                return;
            }
            listEl.innerHTML = occ.map(o => {
                const modeBadge = o.isLibur ? `<span class="kp-tag kp-tag-muted">🏖️ Libur</span>`
                    : (o.mode === 'online' ? `<span class="kp-tag" style="background:var(--success-light);color:var(--success-dark);">💻 Online</span>` : `<span class="kp-tag" style="background:var(--primary-light);color:var(--primary-dark);">🏫 Offline</span>`);
                const overrideBadge = (o.isOverridden && !o.isLibur) ? `<span class="kp-tag kp-tag-warning">Diubah minggu ini</span>` : '';
                return `<div class="kp-class-card ${o.isLibur?'is-libur':''} ${o.isOverridden && !o.isLibur ? 'is-override':''}">
                    <div class="kp-class-main">
                        <div class="kp-class-title">${escapeHtml(o.nama)} ${modeBadge} ${overrideBadge}</div>
                        <div class="kp-class-meta">
                            <span>⏰ ${o.jamMulai||'-'} - ${o.jamSelesai||'-'}</span>
                            <span>📚 ${o.sks||0} SKS</span>
                            <span>📍 ${escapeHtml(o.lokasi||'-')}</span>
                        </div>
                    </div>
                    <div class="kp-class-actions">
                        <button type="button" class="kp-icon-btn" title="Ubah" onclick="KuliahPro.openCourseModal('${o.courseId}','${o.dateISO}')">✏️</button>
                        <button type="button" class="kp-icon-btn" title="${o.isLibur?'Batalkan libur':'Liburkan minggu ini'}" onclick="KuliahPro.toggleLiburWeek('${o.courseId}','${o.dateISO}')">${o.isLibur?'↩️':'🏖️'}</button>
                    </div>
                </div>`;
            }).join('');
            updateTotalSks();
        }

        // ---- Tabs ----
        function switchTab(tab, btn){
            document.querySelectorAll('.kp-itab').forEach(b => b.classList.remove('active'));
            if(btn) btn.classList.add('active');
            const panes = { jadwal:'kpPane-jadwal', absensi:'kpPane-absensi', tugas:'kpPane-tugas' };
            Object.keys(panes).forEach(k => {
                const el = document.getElementById(panes[k]);
                if(el) el.style.display = (k===tab) ? 'block' : 'none';
            });
            if(tab === 'absensi') renderAbsensi();
            if(tab === 'tugas') renderTasks();
        }

        // ---- Course CRUD ----
        function setScope(scope, el){
            scopeChoice = scope;
            document.querySelectorAll('#kpCourseScopeWrap .kp-scope-opt').forEach(o => o.classList.remove('active'));
            if(el) el.classList.add('active');
            document.getElementById('kpCourseScope').value = scope;
        }

        function openCourseModal(courseId, dateISO){
            document.getElementById('kpCourseId').value = courseId || '';
            document.getElementById('kpCourseEditDate').value = dateISO || '';
            const scopeWrap = document.getElementById('kpCourseScopeWrap');
            const deleteBtn = document.getElementById('kpCourseDeleteBtn');
            const hariSelect = document.getElementById('kpCourseHari');

            if(courseId){
                const c = courseById(courseId);
                if(!c) return;
                document.getElementById('kpCourseModalTitle').textContent = 'Ubah Matkul';
                document.getElementById('kpCourseNama').value = c.nama;
                hariSelect.value = c.hari;
                hariSelect.disabled = !(c.hari < 0);

                let jamMulai = c.jamMulai, jamSelesai = c.jamSelesai, sks = c.sks, mode = c.mode, lokasi = c.lokasi;
                if(dateISO){
                    const ov = state.overrides[overrideKey(courseId, dateISO)];
                    if(ov){
                        jamMulai = ov.jamMulai ?? jamMulai;
                        jamSelesai = ov.jamSelesai ?? jamSelesai;
                        sks = ov.sks ?? sks;
                        mode = ov.mode ?? mode;
                        lokasi = ov.lokasi ?? lokasi;
                    }
                }
                document.getElementById('kpCourseJamMulai').value = jamMulai || '';
                document.getElementById('kpCourseJamSelesai').value = jamSelesai || '';
                document.getElementById('kpCourseSks').value = sks || 2;
                document.getElementById('kpCourseMode').value = mode || 'offline';
                document.getElementById('kpCourseLokasi').value = lokasi || '';

                scopeWrap.style.display = dateISO ? 'block' : 'none';
                if(dateISO) setScope('week', scopeWrap.querySelector('.kp-scope-opt[data-scope="week"]'));
                deleteBtn.style.display = 'inline-flex';
            } else {
                document.getElementById('kpCourseModalTitle').textContent = 'Tambah Matkul';
                document.getElementById('kpCourseNama').value = '';
                hariSelect.value = selectedDayIdx;
                hariSelect.disabled = false;
                document.getElementById('kpCourseJamMulai').value = '';
                document.getElementById('kpCourseJamSelesai').value = '';
                document.getElementById('kpCourseSks').value = 2;
                document.getElementById('kpCourseMode').value = 'offline';
                document.getElementById('kpCourseLokasi').value = '';
                scopeWrap.style.display = 'none';
                deleteBtn.style.display = 'none';
            }
            App.UI.showModal('kpCourseModal');
        }

        function saveCourse(e){
            e.preventDefault();
            const id = document.getElementById('kpCourseId').value;
            const editDate = document.getElementById('kpCourseEditDate').value;
            const nama = document.getElementById('kpCourseNama').value.trim();
            const hari = parseInt(document.getElementById('kpCourseHari').value, 10);
            const jamMulai = document.getElementById('kpCourseJamMulai').value;
            const jamSelesai = document.getElementById('kpCourseJamSelesai').value;
            const sks = parseInt(document.getElementById('kpCourseSks').value, 10) || 0;
            const mode = document.getElementById('kpCourseMode').value;
            const lokasi = document.getElementById('kpCourseLokasi').value.trim();

            if(!nama){ App.UI.showToast('Nama matkul wajib diisi', 'error'); return; }
            if(jamMulai && jamSelesai && jamSelesai <= jamMulai){ App.UI.showToast('Jam selesai harus setelah jam mulai', 'error'); return; }

            if(!id){
                state.courses.push({ id: uid(), nama, hari, jamMulai, jamSelesai, sks, mode, lokasi });
                saveState();
                App.UI.showToast('Matkul ditambahkan!', 'success');
            } else if(editDate && scopeChoice === 'week'){
                state.overrides[overrideKey(id, editDate)] = Object.assign({}, state.overrides[overrideKey(id, editDate)], { jamMulai, jamSelesai, sks, mode, lokasi, libur:false });
                saveState();
                App.UI.showToast('Perubahan disimpan untuk minggu ini saja.', 'success');
            } else {
                const c = courseById(id);
                if(c){ if(c.hari < 0 && hari >= 0) c.hari = hari; c.nama = nama; c.jamMulai = jamMulai; c.jamSelesai = jamSelesai; c.sks = sks; c.mode = mode; c.lokasi = lokasi; }
                if(editDate) delete state.overrides[overrideKey(id, editDate)];
                saveState();
                App.UI.showToast('Perubahan disimpan untuk seterusnya.', 'success');
            }
            App.UI.closeModal('kpCourseModal');
            renderWeekStrip(); renderScheduleList();
        }

        async function deleteCourse(){
            const id = document.getElementById('kpCourseId').value;
            if(!id) return;
            const yes = await App.UI.confirm('Hapus matkul ini beserta seluruh jadwalnya? Riwayat absensi, tugas, dan Catatan Kuliah terkait tidak akan terhapus.');
            if(!yes) return;
            state.courses = state.courses.filter(c => c.id !== id);
            Object.keys(state.overrides).forEach(k => { if(k.indexOf(id+'_')===0) delete state.overrides[k]; });
            saveState();
            App.UI.closeModal('kpCourseModal');
            renderWeekStrip(); renderScheduleList();
            App.UI.showToast('Matkul dihapus', 'success');
        }

        function toggleLiburWeek(courseId, dateISO){
            const key = overrideKey(courseId, dateISO);
            const ov = state.overrides[key];
            if(ov && ov.libur){
                delete ov.libur;
                if(Object.keys(ov).length===0) delete state.overrides[key];
            } else {
                state.overrides[key] = Object.assign({}, ov, { libur:true });
            }
            saveState();
            renderWeekStrip(); renderScheduleList();
        }

        // ---- Attendance ----
        function attendKey(courseId, dateISO){ return courseId + '_' + dateISO; }
        function reasonLabel(r){
            return { sakit:'Sakit', izin:'Izin', alpa:'Alpa', libur:'Libur', lainnya:'Lainnya' }[r] || '-';
        }

        function renderAbsensi(){
            const dateInput = document.getElementById('kpAbsenDate');
            if(!dateInput.value) dateInput.value = isoDate(new Date());
            dateInput.onchange = renderAbsenToday;
            renderAbsenToday();
            renderAbsenFilter();
            renderAbsenTable();
        }

        function renderAbsenToday(){
            const dateInput = document.getElementById('kpAbsenDate');
            const dISO = dateInput.value || isoDate(new Date());
            const d = parseISODate(dISO);
            const occ = getOccurrencesForDate(d);
            const wrap = document.getElementById('kpAbsenToday');
            if(!occ.length){
                wrap.innerHTML = `<div class="kp-empty">Tidak ada matkul terjadwal di tanggal ini.</div>`;
                return;
            }
            wrap.innerHTML = occ.map(o => {
                const rec = state.attendance[attendKey(o.courseId, o.dateISO)];
                let statusHtml = '';
                if(rec){
                    const cls = rec.status === 'hadir' ? 'kp-status-hadir' : (rec.reason==='libur' ? 'kp-status-libur' : 'kp-status-tidak');
                    const txt = rec.status === 'hadir' ? '✅ Hadir' : ('❌ ' + reasonLabel(rec.reason));
                    statusHtml = `<span class="kp-attend-status ${cls}">${txt}</span>`;
                }
                return `<div class="kp-attend-row">
                    <div class="kp-attend-info">
                        <div style="font-weight:700;font-size:0.9rem;">${escapeHtml(o.nama)}</div>
                        <div class="text-xs text-muted">⏰ ${o.jamMulai||'-'}-${o.jamSelesai||'-'} · ${o.mode==='online'?'💻 Online':'🏫 Offline'}</div>
                    </div>
                    <div class="kp-attend-actions">
                        ${statusHtml}
                        <button type="button" class="btn btn-sm btn-secondary" onclick="KuliahPro.markHadir('${o.courseId}','${o.dateISO}')">✅ Hadir</button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="KuliahPro.openAttendanceModal('${o.courseId}','${o.dateISO}')">❌ Tidak Hadir</button>
                    </div>
                </div>`;
            }).join('');
        }

        function markHadir(courseId, dateISO){
            state.attendance[attendKey(courseId, dateISO)] = { status:'hadir' };
            saveState();
            renderAbsenToday(); renderAbsenTable();
            App.UI.showToast('Ditandai hadir ✅', 'success');
        }

        function openAttendanceModal(courseId, dateISO){
            const c = courseById(courseId);
            const occ = getOccurrencesForDate(parseISODate(dateISO)).find(o => o.courseId === courseId);
            document.getElementById('kpAttendKey').value = attendKey(courseId, dateISO);
            document.getElementById('kpAttendCourseLabel').textContent = `${c ? c.nama : 'Matkul'} — ${fmtDateLabel(parseISODate(dateISO))}`;
            document.getElementById('kpAttendReason').value = (occ && occ.isLibur) ? 'libur' : 'sakit';
            document.getElementById('kpAttendNote').value = '';
            App.UI.showModal('kpAttendanceModal');
        }

        function saveAttendanceReason(e){
            e.preventDefault();
            const key = document.getElementById('kpAttendKey').value;
            const reason = document.getElementById('kpAttendReason').value;
            const note = document.getElementById('kpAttendNote').value.trim();
            state.attendance[key] = { status:'tidak_hadir', reason, note };
            saveState();
            App.UI.closeModal('kpAttendanceModal');
            renderAbsenToday(); renderAbsenTable();
            App.UI.showToast('Kehadiran dicatat', 'success');
        }

        function renderAbsenFilter(){
            const sel = document.getElementById('kpAbsenFilter');
            const cur = sel.value;
            sel.innerHTML = '<option value="">Semua Matkul</option>' + state.courses.map(c => `<option value="${c.id}">${escapeHtml(c.nama)}</option>`).join('');
            sel.value = cur || '';
            sel.onchange = renderAbsenTable;
        }

        function allAttendanceRecords(){
            return Object.keys(state.attendance).map(k => {
                const idx = k.lastIndexOf('_');
                const courseId = k.slice(0, idx);
                const dateISO = k.slice(idx+1);
                return Object.assign({ key:k, courseId, dateISO }, state.attendance[k]);
            }).sort((a,b) => b.dateISO.localeCompare(a.dateISO));
        }

        function renderAttendStats(){
            const wrap = document.getElementById('kpAttendStats'); if(!wrap) return;
            const st = attendanceStats();
            if(!st.length){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
            wrap.style.display = 'block';
            wrap.innerHTML = `<h3 class="font-bold" style="margin:0 0 .25rem;">Statistik kehadiran</h3><p class="text-muted text-xs" style="margin:0 0 .75rem;">Libur tidak dihitung. Peringatan muncul bila kehadiran di bawah 75% atau tidak hadir 3 kali atau lebih.</p>` + st.map(x => {
                const pct = x.pct === null ? 0 : x.pct, color = x.warn ? 'var(--danger,#ef4444)' : 'var(--success,#10b981)';
                return `<div class="kp-stat-row"><div class="kp-stat-top"><b>${escapeHtml(x.nama)}</b><span style="color:${color};font-weight:700;">${x.pct === null ? '—' : x.pct + '%'}${x.warn ? ' ⚠️' : ''}</span></div><div class="kp-stat-bar" role="progressbar" aria-label="Kehadiran ${escapeHtml(x.nama)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%;background:${color};"></div></div><div class="text-xs text-muted">Hadir ${x.hadir} · Sakit ${x.sakit} · Izin ${x.izin} · Alpa ${x.alpa}${x.lainnya ? ' · Lainnya ' + x.lainnya : ''}${x.libur ? ' · Libur ' + x.libur : ''}</div></div>`;
            }).join('');
        }

        function renderAbsenTable(){
            renderAttendStats();
            const filter = document.getElementById('kpAbsenFilter').value;
            let recs = allAttendanceRecords();
            if(filter) recs = recs.filter(r => r.courseId === filter);
            const tbody = document.getElementById('kpAbsenTableBody');
            if(!recs.length){
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-sm text-muted" style="padding:1.5rem;">Belum ada catatan kehadiran.</td></tr>`;
                renderAbsenSummary(recs);
                return;
            }
            tbody.innerHTML = recs.map(r => {
                const c = courseById(r.courseId);
                const statusTag = r.status==='hadir' ? '<span class="kp-tag" style="background:var(--success-light);color:var(--success-dark);">Hadir</span>' : '<span class="kp-tag kp-tag-danger">Tidak Hadir</span>';
                const alasan = r.status==='hadir' ? '-' : (reasonLabel(r.reason) + (r.note ? ' — ' + r.note : ''));
                return `<tr>
                    <td>${fmtDateLabel(parseISODate(r.dateISO))}</td>
                    <td>${escapeHtml(c ? c.nama : '(dihapus)')}</td>
                    <td>${statusTag}</td>
                    <td>${escapeHtml(alasan)}</td>
                    <td><button type="button" class="kp-icon-btn" title="Hapus" onclick="KuliahPro.deleteAttendance('${r.key}')">🗑️</button></td>
                </tr>`;
            }).join('');
            renderAbsenSummary(recs);
        }

        function renderAbsenSummary(recs){
            if(!recs){
                const filter = document.getElementById('kpAbsenFilter').value;
                recs = allAttendanceRecords();
                if(filter) recs = recs.filter(r => r.courseId === filter);
            }
            const relevant = recs.filter(r => r.reason !== 'libur');
            const hadir = relevant.filter(r => r.status==='hadir').length;
            const tidak = relevant.filter(r => r.status!=='hadir').length;
            const total = hadir + tidak;
            const pct = total ? Math.round((hadir/total)*100) : 0;
            const wrap = document.getElementById('kpAbsenSummary');
            if(!wrap) return;
            wrap.innerHTML = `
                <div class="kp-summary-box"><div class="kp-summary-num" style="color:var(--success-dark);">${hadir}</div><div class="kp-summary-lbl">Hadir</div></div>
                <div class="kp-summary-box"><div class="kp-summary-num" style="color:var(--danger-dark);">${tidak}</div><div class="kp-summary-lbl">Tidak Hadir</div></div>
                <div class="kp-summary-box"><div class="kp-summary-num">${pct}%</div><div class="kp-summary-lbl">Persentase</div></div>`;
        }

        async function deleteAttendance(key){
            const yes = await App.UI.confirm('Hapus catatan kehadiran ini?');
            if(!yes) return;
            delete state.attendance[key];
            saveState();
            renderAbsenToday(); renderAbsenTable();
        }

        // ---- Tasks ----
        function fillCourseSelect(selectEl, selectedId){
            selectEl.innerHTML = '<option value="">Umum / Tidak terkait</option>' + state.courses
                .slice().sort((a,b)=> a.hari - b.hari || (a.jamMulai||'').localeCompare(b.jamMulai||''))
                .map(c => `<option value="${c.id}" ${c.id===selectedId?'selected':''}>${escapeHtml(c.nama)} (${dayShort(c.hari)})</option>`).join('');
        }

        function openTaskModal(taskId){
            const t = taskId ? state.tasks.find(x => x.id === taskId) : null;
            fillCourseSelect(document.getElementById('kpTaskCourse'), t ? t.courseId : '');
            document.getElementById('kpTaskId').value = taskId || '';
            const deleteBtn = document.getElementById('kpTaskDeleteBtn');
            if(t){
                document.getElementById('kpTaskModalTitle').textContent = 'Ubah Tugas';
                document.getElementById('kpTaskJudul').value = t.judul;
                document.getElementById('kpTaskDeadline').value = t.deadline ? t.deadline.slice(0,16) : '';
                document.getElementById('kpTaskKeterangan').value = t.keterangan || '';
                deleteBtn.style.display = 'inline-flex';
            } else {
                document.getElementById('kpTaskModalTitle').textContent = 'Tambah Tugas';
                document.getElementById('kpTaskJudul').value = '';
                document.getElementById('kpTaskDeadline').value = '';
                document.getElementById('kpTaskKeterangan').value = '';
                deleteBtn.style.display = 'none';
            }
            App.UI.showModal('kpTaskModal');
        }

        function saveTask(e){
            e.preventDefault();
            const id = document.getElementById('kpTaskId').value;
            const judul = document.getElementById('kpTaskJudul').value.trim();
            const courseId = document.getElementById('kpTaskCourse').value;
            const deadline = document.getElementById('kpTaskDeadline').value;
            const keterangan = document.getElementById('kpTaskKeterangan').value.trim();
            if(!judul){ App.UI.showToast('Judul tugas wajib diisi', 'error'); return; }
            if(!deadline){ App.UI.showToast('Deadline wajib diisi', 'error'); return; }

            if(id){
                const t = state.tasks.find(x => x.id === id);
                if(t){ t.judul=judul; t.courseId=courseId; t.deadline=deadline; t.keterangan=keterangan; t.notifiedH2=false; }
            } else {
                state.tasks.push({ id: uid(), judul, courseId, deadline, keterangan, done:false, notifiedH2:false });
            }
            saveState();
            App.UI.closeModal('kpTaskModal');
            renderTasks();
            App.UI.showToast('Tugas tersimpan!', 'success');
        }

        async function deleteTask(){
            const id = document.getElementById('kpTaskId').value;
            if(!id) return;
            const yes = await App.UI.confirm('Hapus tugas ini?');
            if(!yes) return;
            state.tasks = state.tasks.filter(t => t.id !== id);
            saveState();
            App.UI.closeModal('kpTaskModal');
            renderTasks();
            App.UI.showToast('Tugas dihapus', 'success');
        }

        function toggleTaskDone(id){
            const t = state.tasks.find(t => t.id === id);
            if(!t) return;
            t.done = !t.done;
            t.completedAt = t.done ? Date.now() : null;
            saveState();
            renderTasks();
        }

        function taskStatusInfo(t){
            if(t.done) return { tag:'<span class="kp-tag" style="background:var(--success-light);color:var(--success-dark);">Selesai</span>', urgent:false };
            const now = new Date();
            const dl = new Date(t.deadline);
            const diffMs = dl - now;
            const diffDays = diffMs / 86400000;
            if(diffMs < 0) return { tag:'<span class="kp-tag kp-tag-danger">Terlambat</span>', urgent:true };
            if(diffDays <= 2) return { tag:'<span class="kp-tag kp-tag-warning">H-2</span>', urgent:true };
            return { tag:'<span class="kp-tag kp-tag-muted">Aktif</span>', urgent:false };
        }

        function renderTasks(){
            const list = document.getElementById('kpTaskList');
            if(!list) return;
            const tasks = state.tasks.slice().sort((a,b) => {
                if(a.done !== b.done) return a.done ? 1 : -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
            if(!tasks.length){
                list.innerHTML = `<div class="kp-empty">Belum ada tugas. Tambahkan biar gak lupa deadline 📚</div>`;
                updateTaskBadge();
                return;
            }
            list.innerHTML = tasks.map(t => {
                const c = t.courseId ? courseById(t.courseId) : null;
                const info = taskStatusInfo(t);
                return `<div class="kp-task-item ${t.done ? 'is-done':''}">
                    <div class="kp-task-check ${t.done?'checked':''}" onclick="KuliahPro.toggleTaskDone('${t.id}')">${t.done?'✓':''}</div>
                    <div style="flex:1;min-width:0;">
                        <div class="kp-task-title">${escapeHtml(t.judul)}</div>
                        <div class="kp-task-meta">${info.tag} <span>⏰ ${fmtDeadline(t.deadline)}</span> ${c ? `<span>📖 ${escapeHtml(c.nama)}</span>`:''} ${t.done && t.completedAt ? `<span>✅ Selesai ${fmtDeadline(t.completedAt)}</span>` : ''}</div>
                        ${t.keterangan ? `<div class="kp-task-note">${escapeHtml(t.keterangan)}</div>` : ''}
                    </div>
                    <div class="kp-task-actions">
                        <button type="button" class="kp-icon-btn" title="Ubah" onclick="KuliahPro.openTaskModal('${t.id}')">✏️</button>
                    </div>
                </div>`;
            }).join('');
            updateTaskBadge();
        }

        function urgentTaskCount(){
            return state.tasks.filter(t => !t.done && taskStatusInfo(t).urgent).length;
        }

        function updateTaskBadge(){
            const badge = document.getElementById('kpTaskTabBadge');
            if(!badge) return;
            const count = urgentTaskCount();
            if(count>0){ badge.textContent = count>9?'9+':count; badge.style.display='inline-flex'; } else badge.style.display='none';
        }

        function updateNavBadge(){
            const badge = document.getElementById('kpNavBadge');
            if(!badge) return;
            const count = urgentTaskCount();
            if(count>0){ badge.textContent = count>9?'9+':count; badge.classList.add('show'); } else badge.classList.remove('show');
            updateTaskBadge();
        }

        // ---- init ----
        function init(){
            renderWeekStrip();
            renderScheduleList();
            updateNavBadge();
        }

        if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();

        // ---- API untuk modul Catatan Kuliah (daftar matkul tunggal) ----
        function getCourses(){
            const seen = new Set(), out = [];
            state.courses.forEach(c => { const k = String(c.nama||'').trim().toLowerCase(); if(!k || seen.has(k)) return; seen.add(k); out.push({ id: c.id, name: String(c.nama).trim() }); });
            return out;
        }
        function ensureCourse(name){ // cari berdasarkan nama; buat bila belum ada (tanpa jadwal). Hanya menyimpan lokal — sinkron akun mengikuti simpanan berikutnya.
            const nm = String(name||'').trim(), k = nm.toLowerCase();
            const found = state.courses.find(c => String(c.nama||'').trim().toLowerCase() === k);
            if(found) return found.id;
            const id = uid();
            state.courses.push({ id, nama: nm, hari: -1, jamMulai: '', jamSelesai: '', sks: 0, mode: 'offline', lokasi: '' });
            try{ localStorage.setItem(KP_LS, JSON.stringify(state)); }catch(e){}
            renderScheduleList();
            return id;
        }

        function todaySchedule(){
            const t = new Date(), iso = isoDate(t);
            return getOccurrencesForDate(t).map(o => { const rec = state.attendance[attendKey(o.courseId, iso)]; return { courseId: o.courseId, nama: o.nama, jamMulai: o.jamMulai, jamSelesai: o.jamSelesai, lokasi: o.lokasi, mode: o.mode, libur: o.isLibur, status: rec ? rec.status : '' }; });
        }
        function getTasks(){ return state.tasks.map(t => ({ id: t.id, judul: t.judul, courseId: t.courseId, deadline: t.deadline, done: !!t.done, matkul: (courseById(t.courseId) || {}).nama || '' })); }
        // Statistik kehadiran per matkul (libur tidak dihitung). Peringatan bila kehadiran < 75% atau tidak hadir >= 3 kali.
        function attendanceStats(){
            const by = {};
            Object.keys(state.attendance).forEach(k => {
                const i = k.lastIndexOf('_'); const cid = k.slice(0, i), rec = state.attendance[k];
                if(!rec || !courseById(cid)) return;
                const b = by[cid] || (by[cid] = { hadir: 0, sakit: 0, izin: 0, alpa: 0, lainnya: 0, libur: 0 });
                if(rec.status === 'hadir') b.hadir++;
                else if(rec.reason === 'libur') b.libur++;
                else b[['sakit','izin','alpa'].includes(rec.reason) ? rec.reason : 'lainnya']++;
            });
            return getCourses().map(c => {
                // gabungkan semua slot matkul bernama sama
                const ids = state.courses.filter(x => String(x.nama||'').trim().toLowerCase() === c.name.toLowerCase()).map(x => x.id);
                const sum = { hadir: 0, sakit: 0, izin: 0, alpa: 0, lainnya: 0, libur: 0 };
                ids.forEach(id => { const b = by[id]; if(b) Object.keys(sum).forEach(k => sum[k] += b[k]); });
                const absen = sum.sakit + sum.izin + sum.alpa + sum.lainnya, total = sum.hadir + absen;
                const pct = total ? Math.round(sum.hadir / total * 100) : null;
                return Object.assign({ id: c.id, nama: c.name, total, absen, pct, warn: total > 0 && (pct < 75 || absen >= 3) }, sum);
            }).filter(x => x.total > 0 || x.libur > 0);
        }

        // Kuliah mendatang (untuk pengingat HP): `days` hari ke depan dari hari ini; libur dilewati; status absensi ikut disertakan.
        function upcomingClasses(days){
            const out = [], base = new Date(); base.setHours(0,0,0,0);
            for(let i = 0; i < (days || 7); i++){
                const d = new Date(base); d.setDate(base.getDate() + i);
                getOccurrencesForDate(d).forEach(o => {
                    if(o.isLibur || !o.jamMulai) return;
                    const rec = state.attendance[attendKey(o.courseId, o.dateISO)];
                    out.push({ courseId:o.courseId, dateISO:o.dateISO, nama:o.nama, jamMulai:o.jamMulai, jamSelesai:o.jamSelesai, lokasi:o.lokasi||'', mode:o.mode, recorded: !!rec });
                });
            }
            return out;
        }
        window.KuliahPro = {
            getCourses, ensureCourse, todaySchedule, getTasks, attendanceStats, upcomingClasses,
            switchTab, shiftWeek, openCourseModal, saveCourse, deleteCourse, setScope, toggleLiburWeek,
            markHadir, openAttendanceModal, saveAttendanceReason, deleteAttendance,
            openTaskModal, saveTask, deleteTask, toggleTaskDone
        };
    })();
