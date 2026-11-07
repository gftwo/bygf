// Dibundel ke www/native-plugins.js oleh scripts/build-www.js (hanya untuk APK; situs web GitHub Pages tidak memuat file ini).
// Mengimpor plugin mendaftarkannya ke Capacitor.Plugins, sehingga kode aplikasi (tanpa bundler) bisa memakai window.Capacitor.Plugins.LocalNotifications.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
window.Capacitor = window.Capacitor || Capacitor;
window.Capacitor.Plugins = window.Capacitor.Plugins || {};
window.Capacitor.Plugins.LocalNotifications = window.Capacitor.Plugins.LocalNotifications || LocalNotifications;
