// Dibundel ke www/native-plugins.js oleh scripts/build-www.js (hanya untuk APK; situs web GitHub Pages tidak memuat file ini).
// Mengimpor plugin mendaftarkannya ke Capacitor.Plugins, sehingga kode aplikasi (tanpa bundler) bisa memakai window.Capacitor.Plugins.<Nama>.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';
import { Badge } from '@capawesome/capacitor-badge';
window.Capacitor = window.Capacitor || Capacitor;
window.Capacitor.Plugins = window.Capacitor.Plugins || {};
const P = window.Capacitor.Plugins;
P.LocalNotifications = P.LocalNotifications || LocalNotifications;
P.App = P.App || App;                  // tautan dari widget (bygf://…) + penjadwalan ulang saat aplikasi dibuka kembali
P.Filesystem = P.Filesystem || Filesystem;   // cadangan otomatis ke folder HP
P.Badge = P.Badge || Badge;            // angka di ikon aplikasi
P.BygfNative = P.BygfNative || registerPlugin('BygfNative');   // widget, sidik jari Brankas, pengaturan baterai (Java: BygfNativePlugin)
