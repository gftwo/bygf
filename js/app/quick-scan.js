import { App } from './core.js';

App.QuickScan = {
    drafts: [],
    _tesseractLoading: null,
    _uidCounter: 0,

    open() {
        this.drafts = [];
        document.getElementById('scanDraftList').innerHTML = '';
        document.getElementById('scanFooter').style.display = 'none';
        document.getElementById('scanOverallProgress').style.display = 'none';
        document.getElementById('scanFileInput').value = '';
        App.UI.showModal('scanModal');
    },
    close() { App.UI.closeModal('scanModal'); },

    loadTesseract() {
        if (window.Tesseract) return Promise.resolve();
        if (this._tesseractLoading) return this._tesseractLoading;
        this._tesseractLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Gagal memuat pustaka OCR. Cek koneksi internet.'));
            document.head.appendChild(s);
        });
        return this._tesseractLoading;
    },

    async handleFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;

        const overall = document.getElementById('scanOverallProgress');
        const overallText = document.getElementById('scanOverallProgressText');
        overall.style.display = 'flex';

        try {
            overallText.textContent = 'Menyiapkan mesin pembaca teks...';
            await this.loadTesseract();
        } catch (e) {
            overall.style.display = 'none';
            App.UI.showToast(e.message || 'Gagal memuat OCR', 'error');
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            overallText.textContent = `Membaca gambar ${i + 1} dari ${files.length}...`;
            const draftId = 'sd' + (this._uidCounter++);
            const imgUrl = URL.createObjectURL(file);
            const draft = {
                _id: draftId, active: true, status: 'processing',
                imgUrl, type: 'out', amount: 0, date: App.Utils.todayISO ? App.Utils.todayISO() : new Date().toISOString().split('T')[0],
                account: 'saldo', category: 'lainnya', note: ''
            };
            this.drafts.push(draft);
            this.renderDrafts();

            try {
                const result = await window.Tesseract.recognize(file, 'eng');
                const text = (result && result.data && result.data.text) || '';
                const parsed = this.parseReceiptText(text);
                Object.assign(draft, parsed, { status: parsed.amount > 0 ? 'ok' : 'warn' });
            } catch (e) {
                draft.status = 'warn';
                draft.note = draft.note || '(Gagal membaca otomatis, isi manual)';
            }
            this.renderDrafts();
        }

        overall.style.display = 'none';
        document.getElementById('scanFooter').style.display = 'flex';
        document.getElementById('scanFileInput').value = '';
    },

    parseAmountStr(s) {
        s = (s || '').replace(/[^\d.,]/g, '');
        if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/[.,]/g, '');
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
    },

    parseReceiptText(rawText) {
        const text = (rawText || '').replace(/\r/g, '');
        const lower = text.toLowerCase();
        const out = { amount: 0, date: null, type: 'out', note: '' };

        // --- Nominal ---
        let amount = 0;
        const rpMatches = [...text.matchAll(/Rp\.?\s?([\d.,]{4,})/gi)];
        if (rpMatches.length) {
            const nums = rpMatches.map(m => this.parseAmountStr(m[1])).filter(n => n > 0);
            if (nums.length) amount = Math.max(...nums);
        }
        if (!amount) {
            const numMatches = [...text.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b/g)];
            const nums = numMatches.map(m => this.parseAmountStr(m[0])).filter(n => n >= 1000);
            if (nums.length) amount = Math.max(...nums);
        }
        out.amount = amount;

        // --- Tanggal ---
        const months = { jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05', jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10', nov: '11', des: '12', dec: '12' };
        let dateStr = null;
        let m = lower.match(/(\d{1,2})\s+(jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)\s+(\d{4})/);
        if (m) {
            const mm = months[m[2].slice(0, 3)];
            if (mm) dateStr = `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
        }
        if (!dateStr) {
            m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (m) {
                let yr = m[3].length === 2 ? '20' + m[3] : m[3];
                let day = parseInt(m[1], 10), mon = parseInt(m[2], 10);
                // sebagian format Barat DD/MM/YYYY, tapi jaga-jaga kalau ketuker
                if (mon > 12 && day <= 12) { const tmp = day; day = mon; mon = tmp; }
                dateStr = `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
        if (!dateStr && /hari ini|today/i.test(lower)) dateStr = new Date().toISOString().split('T')[0];
        if (!dateStr && /kemarin|yesterday/i.test(lower)) { const d = new Date(); d.setDate(d.getDate() - 1); dateStr = d.toISOString().split('T')[0]; }
        out.date = dateStr || new Date().toISOString().split('T')[0];

        // --- Jenis (pemasukan/pengeluaran) ---
        const inKeywords = ['diterima', 'terima dari', 'top up berhasil', 'top-up berhasil', 'masuk', 'kredit', 'received', 'pengembalian dana', 'refund', 'gaji', 'cashback'];
        const outKeywords = ['terkirim', 'kirim ke', 'transfer ke', 'pembelian', 'bayar', 'pembayaran', 'debit', 'membayar', 'tarik tunai', 'beli'];
        let type = 'out';
        if (inKeywords.some(k => lower.includes(k))) type = 'in';
        if (outKeywords.some(k => lower.includes(k))) type = 'out';
        if (/[-−]\s?Rp/i.test(text)) type = 'out';
        if (/\+\s?Rp/i.test(text)) type = 'in';
        out.type = type;

        // --- Keterangan: prioritaskan "Ke [tujuan]" daripada "Dari [asal]" ---
        const skipWords = ['berhasil', 'transaksi', 'rincian', 'detail', 'struk', 'bukti', 'notifikasi', 'status', 'lihat', 'bagikan', 'simpan', 'unduh', 'riwayat', 'saldo',
            'gopay', 'dana', 'ovo', 'shopeepay', 'linkaja', 'bca', 'mobile banking', 'm-banking', 'mandiri', 'livin', 'jenius', 'bri', 'bni', 'flip', 'jago', 'blu', 'seabank', 'permata', 'cimb', 'octo'];
        const connectorOnly = /^(terkirim|kirim|transfer|dikirim|pembayaran|bayar)\s*(ke|kepada)?$|^(diterima|terima|masuk)\s*(dari)?$/i;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let note = '';

        // 1) Cari pola eksplisit "Ke ..." / "Kepada ..." / "Terkirim ke ..." dulu (tujuan lebih penting)
        for (const line of lines) {
            const m = line.match(/(?:^|terkirim\s+|dikirim\s+|kirim\s+)(?:ke|kepada)\s*[:\-]?\s*(.+)/i);
            if (m && m[1] && m[1].trim().length >= 2) { note = 'Ke ' + m[1].trim(); break; }
        }

        // 2) Kalau belum ketemu, ambil baris pertama yang masuk akal — tapi lewati baris "Dari ..." (asal), bukan tujuan
        if (!note) {
            for (const line of lines) {
                const l = line.toLowerCase();
                if (line.length < 3) continue;
                if (/^rp/i.test(line) || /^\d/.test(line)) continue;
                if (connectorOnly.test(line)) continue;
                if (/^dari\b/i.test(line)) continue; // skip "Dari: ..." — bukan tujuan
                if (skipWords.some(w => l === w || l.startsWith(w + ' ') || l.includes(' ' + w))) continue;
                note = line; break;
            }
        }

        // 3) Kalau tetap kosong (misal transaksi masuk yang cuma punya info "Dari"), baru pakai itu sebagai fallback terakhir
        if (!note) {
            for (const line of lines) {
                const m = line.match(/^dari\s*[:\-]?\s*(.+)/i);
                if (m && m[1] && m[1].trim().length >= 2) { note = line.trim(); break; }
            }
        }

        out.note = note.slice(0, 60);

        return out;
    },

    renderDrafts() {
        const list = document.getElementById('scanDraftList');
        document.getElementById('scanCommitCount').textContent = this.drafts.filter(d => d.active).length;
        list.innerHTML = this.drafts.map((d, i) => {
            if (d.status === 'processing') {
                return `<div class="scan-draft-card" id="draft-${d._id}">
                    <img class="scan-draft-thumb" src="${d.imgUrl}">
                    <div class="scan-draft-body">
                        <span class="scan-draft-status processing">⏳ Membaca...</span>
                        <div class="text-xs text-muted">Mohon tunggu sebentar</div>
                    </div>
                </div>`;
            }
            const statusBadge = d.status === 'ok' ? `<span class="scan-draft-status ok">✅ Terdeteksi</span>` : `<span class="scan-draft-status warn">⚠️ Cek manual</span>`;
            return `<div class="scan-draft-card ${d.active ? '' : 'excluded'}" id="draft-${d._id}">
                <img class="scan-draft-thumb" src="${d.imgUrl}">
                <div class="scan-draft-body">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                            <input type="checkbox" ${d.active ? 'checked' : ''} onchange="App.QuickScan.updateDraft(${i},'active',this.checked)">
                            ${statusBadge}
                        </label>
                        <button type="button" class="scan-draft-remove" onclick="App.QuickScan.removeDraft(${i})" title="Hapus">🗑️</button>
                    </div>
                    <div class="scan-type-mini">
                        <button type="button" class="${d.type === 'in' ? 'active in' : ''}" onclick="App.QuickScan.updateDraft(${i},'type','in')">⬆ Pemasukan</button>
                        <button type="button" class="${d.type === 'out' ? 'active out' : ''}" onclick="App.QuickScan.updateDraft(${i},'type','out')">⬇ Pengeluaran</button>
                    </div>
                    <div class="scan-draft-grid">
                        <input type="text" inputmode="numeric" placeholder="Nominal" value="${d.amount ? d.amount.toLocaleString('id-ID') : ''}" onchange="App.QuickScan.updateDraft(${i},'amount',App.QuickScan.parseAmountStr(this.value))">
                        <input type="date" value="${d.date}" onchange="App.QuickScan.updateDraft(${i},'date',this.value)">
                        <select onchange="App.QuickScan.updateDraft(${i},'account',this.value)">
                            <option value="saldo" ${d.account === 'saldo' ? 'selected' : ''}>🪪 Saldo Bank/E-Wallet</option>
                            <option value="cash" ${d.account === 'cash' ? 'selected' : ''}>💵 Cash / Tunai</option>
                        </select>
                        <select onchange="App.QuickScan.updateDraft(${i},'category',this.value)">
                            ${[...App.Config.DefaultCategories, ...App.State.customCategories].map(c => `<option value="${c.id}" ${d.category === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
                        </select>
                        <input type="text" placeholder="Keterangan" value="${(d.note || '').replace(/"/g, '&quot;')}" style="grid-column: 1 / -1;" onchange="App.QuickScan.updateDraft(${i},'note',this.value)">
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    updateDraft(idx, field, value) {
        const d = this.drafts[idx]; if (!d) return;
        d[field] = value;
        if (field === 'active') this.renderDrafts();
        else {
            document.getElementById('scanCommitCount').textContent = this.drafts.filter(x => x.active).length;
            // hindari render ulang penuh biar fokus input tidak lepas, kecuali ganti tipe (butuh update tombol aktif)
            if (field === 'type') this.renderDrafts();
        }
    },

    removeDraft(idx) {
        this.drafts.splice(idx, 1);
        this.renderDrafts();
    },

    commitAll() {
        const chosen = this.drafts.filter(d => d.active);
        if (!chosen.length) return App.UI.showToast('Tidak ada transaksi yang dipilih', 'error');
        const invalid = chosen.filter(d => !d.amount || d.amount <= 0);
        if (invalid.length) return App.UI.showToast(`${invalid.length} transaksi belum ada nominal, isi dulu ya`, 'error');

        chosen.forEach((d, n) => {
            const tx = {
                id: Date.now() + n, tanggal: d.date, jenisAkun: d.account,
                pemasukan: d.type === 'in' ? d.amount : 0,
                pengeluaran: d.type === 'out' ? d.amount : 0,
                kategori: d.category, keterangan: d.note || '(dari scan mutasi)'
            };
            App.State.transactions.push(tx);
        });
        App.DB.save();
        App.UI.renderAll();
        App.UI.showToast(`${chosen.length} transaksi berhasil ditambahkan!`, 'success');
        this.close();
        this.drafts = [];
    }
};
