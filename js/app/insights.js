import { App } from './core.js';

App.Insights = {
    generate() {
        const c = document.getElementById('insightsContainer'); const tx = App.State.transactions;
        if(tx.length < 5) return c.innerHTML = `<div class="insight-card"><p class="text-sm">Catat lebih banyak transaksi agar sistem dapat menganalisis polamu.</p></div>`;
        const d = new Date(); const thisMonthStr = d.toISOString().substring(0,7); const lastMonthStr = new Date(d.getFullYear(), d.getMonth()-1, 1).toISOString().substring(0,7);
        let outThis = 0, outLast = 0, inThis = 0; let catMap = {};
        tx.forEach(t => { const m = t.tanggal.substring(0,7); if(m === thisMonthStr) { outThis += (t.pengeluaran||0); inThis += (t.pemasukan||0); if(t.pengeluaran>0) catMap[t.kategori] = (catMap[t.kategori]||0) + t.pengeluaran; } else if(m === lastMonthStr) { outLast += (t.pengeluaran||0); } });
        let html = '';
        if(App.State.isPremium) {
            document.getElementById('insightLock').classList.remove('show');
            if (outLast > 0) { const diff = outThis - outLast; const perc = Math.abs((diff / outLast) * 100).toFixed(1); if(diff > 0) html += `<div class="insight-card" style="border-left-color: var(--danger);"><div class="font-bold text-sm mb-1">🚨 Pengeluaran Naik</div><p class="text-xs">Naik <b>${perc}%</b> dibanding bulan lalu.</p></div>`; else html += `<div class="insight-card" style="border-left-color: var(--success);"><div class="font-bold text-sm mb-1">🎉 Lebih Hemat</div><p class="text-xs">Turun <b>${perc}%</b> dibanding bulan lalu.</p></div>`; }
        } else { document.getElementById('insightLock').classList.add('show'); }
        let maxCat = '', maxAmt = 0; Object.keys(catMap).forEach(k => { if(catMap[k]>maxAmt){ maxAmt=catMap[k]; maxCat=k; } });
        if(maxCat && outThis > 0) { const catObj = [...App.Config.DefaultCategories, ...App.State.customCategories].find(c=>c.id===maxCat) || {name:maxCat}; const percCat = ((maxAmt / outThis)*100).toFixed(1); html += `<div class="insight-card"><div class="font-bold text-sm mb-1">🔍 Kategori Boros</div><p class="text-xs"><b>${percCat}%</b> habis untuk <b>${catObj.name}</b>.</p></div>`; }
        if (inThis > 0) { const saved = inThis - outThis; if(saved < (inThis * 0.1)) html += `<div class="insight-card" style="border-left-color: var(--warning);"><div class="font-bold text-sm mb-1">💡 Saran Keuangan</div><p class="text-xs">Tabungan bulan ini <10% pendapatan. Sisihkan di awal!</p></div>`; else html += `<div class="insight-card" style="border-left-color: var(--primary);"><div class="font-bold text-sm mb-1">✅ Rasio Sehat</div><p class="text-xs">Arus kas positif bulan ini, pertahankan ya!</p></div>`; }
        c.innerHTML = html;
    }
};
