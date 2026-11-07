import { App } from './core.js';

App.Utils = {
    formatNumber: (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num || 0),
    formatCurrency: (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0),
    parseCurrency: (str) => parseInt(str.toString().replace(/\D/g, '')) || 0,
    formatInput(el) { let val = el.value.replace(/\D/g, ''); el.value = val ? parseInt(val).toLocaleString('id-ID') : ''; },
    formatDateStr: (dStr) => { if(!dStr) return '-'; return new Date(dStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); },
    // Jatuh tempo bulanan: tanggal `dueDay` (1–31, dipotong ke akhir bulan pendek). Mengembalikan ISO tanggal terdekat >= from.
    nextDueDate(dueDay, from) {
        const d = parseInt(dueDay); if(!(d >= 1 && d <= 31)) return null;
        const base = from ? new Date(from + 'T00:00:00') : new Date(); base.setHours(0, 0, 0, 0);
        const at = (y, m) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
        let c = at(base.getFullYear(), base.getMonth()); if(c < base) c = at(base.getFullYear(), base.getMonth() + 1);
        const pad = n => String(n).padStart(2, '0'); return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
    },
    daysUntil(iso) { const a = new Date(iso + 'T00:00:00'), b = new Date(); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 86400000); }
};
