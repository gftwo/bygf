import { App } from './core.js';

// Tema BYgf: tiap tema punya warna, font, bentuk, DAN tata letak navigasi sendiri (lihat css/bygf-*.css).
App.Theme = {
    presets: ['editorial', 'neon', 'minimal', 'playful', 'laut', 'senja'],
    presetDefaultHue: { editorial: 14, neon: 265, minimal: 240, playful: 335, laut: 190, senja: 24 },
    metaColor: { editorial: '#2a2018', neon: '#06060d', minimal: '#ffffff', playful: '#ffc93c', laut: '#ffffff', senja: '#120b19' },
    // Pilihan tema lama (tersimpan di akun) dipetakan ke tema baru terdekat
    legacyMap: { klasik: 'minimal', mono: 'minimal', biru: 'minimal', kuning: 'editorial', sunset: 'editorial', forest: 'editorial', midnight: 'neon', aurora: 'neon' },
    resolve(name) {
        if (this.presets.includes(name)) return name;
        return this.legacyMap[name] || 'editorial';
    },
    init() {
        const saved = App.State.settings.themePreset;
        const name = this.resolve(saved);
        this.changePreset(name, false);
        // hue aksen hanya dipakai jika tersimpan; tema baru yang dimigrasi memakai hue bawaannya
        const hue = (saved === name && App.State.settings.accentHue) ? App.State.settings.accentHue : this.presetDefaultHue[name];
        this.changeAccent(hue, false);
        if (saved !== name) { App.State.settings.themePreset = name; App.State.settings.accentHue = hue; }
    },
    // Mode terang/gelap kini ditentukan oleh tema (neon = gelap). Dipertahankan agar kode lama yang memanggilnya tidak error.
    toggle(isDark, save = true) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); try { localStorage.setItem('bygf.splashTheme', isDark ? 'dark' : 'light'); } catch (e) { /* abaikan */ }
        if (save) { App.State.settings.theme = isDark ? 'dark' : 'light'; App.DB.save(); }
        if (App.State.charts.cat) App.UI.renderAnalytics();
    },
    changePreset(name, save = true) {
        name = this.resolve(name);
        const isDark = name === 'neon' || name === 'senja';
        document.documentElement.setAttribute('data-theme-preset', name);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); try { localStorage.setItem('bygf.splashTheme', isDark ? 'dark' : 'light'); } catch (e) { /* abaikan */ }
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        const card = document.getElementById('preset-' + name); if (card) card.classList.add('active');
        const darkRow = document.getElementById('darkModeRow'); if (darkRow) darkRow.style.display = 'none';
        const meta = document.getElementById('metaThemeColor'); if (meta) meta.setAttribute('content', this.metaColor[name]);
        if (save) {
            App.State.settings.themePreset = name;
            App.State.settings.theme = isDark ? 'dark' : 'light';
            this.changeAccent(this.presetDefaultHue[name], true);
            App.DB.save();
        }
        if (App.State.charts.cat) App.UI.renderAnalytics();
    },
    changeAccent(hue, save = true) {
        document.documentElement.style.setProperty('--hue-primary', hue);
        if (save) { App.State.settings.accentHue = hue; App.DB.save(); }
    }
};
