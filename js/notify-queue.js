// Antrian popup/notifikasi otomatis: setiap popup cuma boleh tampil 1x per reload halaman,
// dan kalau ada beberapa yang mau muncul, ditampilkan GANTIAN (satu ketutup baru yang lain muncul), bukan numpuk.
window.AppNotifyQueue = {
    queue: [], activeId: null, resolved: new Set(),
    register(id, checkAndShowFn) {
        if (this.resolved.has(id)) return; // sudah pernah muncul/ditutup sesi ini, gak diulang sampai reload
        this.queue.push({ id, checkAndShowFn });
        this._tryNext();
    },
    _tryNext() {
        if (this.activeId) return; // masih ada yang tampil, tunggu ditutup dulu
        const next = this.queue.shift();
        if (!next) return;
        this.resolved.add(next.id);
        const shown = next.checkAndShowFn();
        if (shown) this.activeId = next.id; else this._tryNext();
    },
    closed(id) {
        if (this.activeId === id) this.activeId = null;
        this._tryNext();
    }
};
