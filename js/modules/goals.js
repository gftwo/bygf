/* ==========================================================================
   MODUL TARGET TABUNGAN (ARSIP DATA) — fitur Target dihapus dari tampilan sejak v9.11
   Data: AppModules 'goals' = { goals: [{ id, name, icon, target, saved, deadline, note, created, history:[{ id, at, amount, note }] }] }
   Modul ini sengaja tetap terdaftar tanpa tampilan agar data target lama ikut tersimpan, tersinkron, dan
   masuk backup (AppModules.collect hanya menyimpan modul yang terdaftar). Jangan dihapus tanpa migrasi data.
   ========================================================================== */
(function () {
    'use strict';
    const KEY = 'goals', ICONS = ['🎯', '💻', '📱', '✈️', '🎓', '🏠', '🚲', '🎧', '👟', '🎁', '💍', '🛟'];
    const { uid } = Mx;
    const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const num = v => Math.max(0, Math.round(Number(v) || 0));
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

    function normalize(raw) {
        return { goals: arr(raw && raw.goals).filter(g => g && typeof g === 'object' && g.name).map(g => ({
            id: String(g.id || uid()), name: String(g.name).slice(0, 60), icon: ICONS.includes(g.icon) ? g.icon : '🎯', target: num(g.target), saved: num(g.saved),
            deadline: isDate(g.deadline) ? g.deadline : '', note: String(g.note || '').slice(0, 200), created: g.created || new Date().toISOString(),
            history: arr(g.history).filter(h => h && h.at && Number.isFinite(Number(h.amount))).map(h => ({ id: String(h.id || uid()), at: h.at, amount: Math.round(Number(h.amount)), note: String(h.note || '').slice(0, 80) })).slice(0, 100)
        })) };
    }
    function validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['format data tidak valid'];
        const e = []; if (raw.goals != null && typeof raw.goals !== 'object') e.push('daftar target tidak valid');
        arr(raw.goals).forEach((g, i) => { if (!g || typeof g !== 'object' || !g.name) e.push(`target #${i + 1} tidak punya nama`); });
        return e.slice(0, 5);
    }
    AppModules.register(KEY, { label: 'Target Tabungan (arsip)', views: [], normalize, validate });
})();
