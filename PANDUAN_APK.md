# Panduan: Membuat APK Android BYgf (pengingat tetap muncul walau app ditutup)

Situs web di GitHub Pages **tetap berjalan seperti biasa**. APK hanyalah "pembungkus" yang memuat file yang sama + mesin notifikasi lokal.
Semua langkah di bawah gratis. Kamu hanya butuh akun GitHub dan HP Android.

## A. Unggah file ke GitHub (sekali tiap rilis)
1. Ekstrak zip ini, lalu unggah **seluruh isinya** ke repo `gftwo/BYgf` (timpa file lama).
   Pastikan folder tersembunyi `.github/workflows/android.yml` ikut terunggah (di web GitHub: *Add file → Upload files*, seret folder; atau pakai GitHub Desktop / git).
2. Tunggu GitHub Pages terbit seperti biasa (versi web otomatis ikut v9.8).

## B. Bangun APK
1. Buka repo di GitHub → tab **Actions** → pilih **"Build APK Android"** → **Run workflow**.
2. Tunggu ±5–10 menit sampai centang hijau.
3. Buka hasil run → bagian **Artifacts** → unduh **BYgf-apk** (zip berisi `app-debug.apk`) → ekstrak.
   (Jika merah/gagal: salin pesan error di langkah yang gagal dan kirim ke saya.)

## C. Pasang di HP
1. Kirim `app-debug.apk` ke HP (Drive/WhatsApp/kabel), buka, izinkan **"Pasang dari sumber tidak dikenal"** bila diminta.
2. Buka BYgf, login seperti biasa (akun & data sama dengan versi web).

## D. Aktifkan pengingat (wajib sekali)
1. Masuk **Setelan → Pengingat di HP** → ketuk **Aktifkan pengingat** → pilih **Izinkan** notifikasi.
2. Ketuk **Izin alarm tepat waktu** → nyalakan "Alarm & pengingat" untuk BYgf (Android 12+), supaya notifikasi tepat jam.
3. Ketuk **Tes notifikasi**, lalu **tutup aplikasi** — notifikasi harus muncul dalam 5 detik.
4. Atur jam & jenis pengingat sesuai selera.

## E. Agar tidak dimatikan sistem HP (penting di Xiaomi/Oppo/Vivo/Realme/Samsung)
- Pengaturan HP → Aplikasi → BYgf → Baterai → **Tanpa batasan / Unrestricted** (matikan optimasi baterai).
- Xiaomi/Oppo/Vivo: aktifkan **Mulai otomatis (Autostart)** untuk BYgf dan kunci app di tampilan recent apps.

## Cara kerja & batasan (jujur)
- Jadwal dihitung **di HP** dari data terakhir yang tersinkron, untuk 35 hari ke depan, dan dihitung ulang setiap kamu membuka/menyimpan data. Jika data diubah dari perangkat lain, jadwal di HP baru ikut berubah saat BYgf dibuka di HP itu.
- Jika kamu tidak membuka app >5 minggu, pengingat akan habis; buka app sekali untuk mengisi ulang.
- Pengingat keuangan hari itu otomatis dilewati kalau kamu sudah mencatat transaksi hari itu.
- Tidak ada notifikasi untuk: Alokasi, Rencana Budget, jadwal makan, jurnal malam, dan backup.
- APK ini ditandatangani mode *debug* (cukup untuk pemakaian pribadi). Memasang APK versi baru di atas yang lama berjalan normal selama dibuat dari repo yang sama.
- Pembaruan: ulangi langkah A–C; data tidak hilang (tersimpan di Firebase).
- Login Firebase memakai alamat `https://localhost` di dalam app; bila login gagal, di Firebase Console → Authentication → Settings → Authorized domains pastikan `localhost` ada (biasanya sudah ada).
