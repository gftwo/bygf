/* ==========================================================================
   Muat pustaka berat hanya saat dipakai (Chart.js & jsPDF) supaya aplikasi cepat dibuka.
   - Chart: `new Chart(...)` tetap berfungsi. Sebelum pustaka siap, objek sementara menunggu lalu menggambar grafik; destroy()/update() aman dipanggil kapan saja.
   - PDF : LazyLibs.pdf() mengembalikan Promise yang selesai saat jsPDF + autoTable siap.
   Diskrip klasik (bukan modul) agar tersedia sebelum js/app/main.js berjalan.
   ========================================================================== */
(function () {
    'use strict';
    const SRC = {
        chart: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
        jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
    };
    const cache = {};
    function script(url) {
        return new Promise((ok, fail) => {
            const s = document.createElement('script'); s.src = url; s.async = true; s.referrerPolicy = 'no-referrer';
            s.onload = () => ok(); s.onerror = () => { s.remove(); fail(new Error('gagal memuat ' + url)); };
            document.head.appendChild(s);
        });
    }
    function once(name, fn) { if (!cache[name]) cache[name] = fn().catch(e => { delete cache[name]; throw e; }); return cache[name]; }
    const L = window.LazyLibs = {
        chartReady: !!window.Chart && !window.Chart.__lazyStub,
        chart: () => once('chart', async () => { if (window.Chart && !window.Chart.__lazyStub) return; await script(SRC.chart); L.chartReady = true; }),
        pdf: () => once('pdf', async () => { if (!(window.jspdf && window.jspdf.jsPDF)) await script(SRC.jspdf); if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) await script(SRC.autotable); })
    };
    if (window.Chart) return;   // pustaka sudah dimuat (mis. tag <script> lama): tidak perlu pengganti
    class ChartStub {
        constructor(ctx, cfg) {
            this._dead = false; this._real = null; const Real = () => window.Chart;
            this._ready = L.chart().then(() => { if (this._dead || Real().__lazyStub) return; this._real = new (Real())(ctx, cfg); }).catch(e => console.warn('Grafik gagal dimuat:', e));
        }
        update(...a) { this._ready.then(() => this._real && this._real.update(...a)); }
        destroy() { this._dead = true; if (this._real) { this._real.destroy(); this._real = null; } }
    }
    ChartStub.__lazyStub = true; window.Chart = ChartStub;
})();
