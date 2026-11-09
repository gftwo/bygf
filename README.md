# BYgf — Catatan Pribadi & Keseharian

Website pribadi untuk mencatat keuangan, kuliah, tugas, makanan, jurnal, dan keseharian.
Dihosting di **GitHub Pages**, data tersimpan di **Firebase Realtime Database** per akun,
dan tersedia sebagai **aplikasi Android (APK)** yang dibangun otomatis lewat GitHub Actions.

**Versi saat ini: v9.10.1**

---

## Daftar Isi
- [Ringkasan Fitur](#ringkasan-fitur)
- [Struktur Proyek](#struktur-proyek)
- [Aplikasi Android (APK)](#aplikasi-android-apk)
- [Riwayat Perubahan](#riwayat-perubahan)
  - [v9.10.1](#v9101) · [v9.10](#v910) · [v9.9.1](#v991) · [v9.9](#v99) · [v9.8](#v98) · [v9.7](#v97) · [v9.6](#v96) · [v9.5](#v95) · [v9.4](#v94) · [v9.3](#v93) · [v9.2](#v92) · [v9.1](#v91) · [v9.0](#v90)
- [Catatan Keamanan](#catatan-keamanan)
- [Catatan Pengembangan](#catatan-pengembangan)

---

## Ringkasan Fitur

| Area | Isi |
|---|---|
| 🏠 Beranda | Layar "Hari Ini": jadwal kuliah, tugas, jadwal makan, saldo, jurnal, maskot Bybi, lencana |
| 💰 Keuangan | Catat transaksi (Cash / Saldo + 5 e-wallet), riwayat, Quick Respons, tagihan & cicilan, utang-piutang, alokasi budget 50/20/30, target tabungan, transaksi otomatis |
| 🎓 Kuliah | Jadwal, absensi, tugas kuliah, catatan kuliah (ringkasan, rangkuman, arsip) |
| ✅ Tugas | Kartu "Hari ini", proyek, tag, subtugas, pengulangan, kalender |
| 🍽️ Makan | Jadwal & jurnal makanan, roda "Makan apa?" |
| 📝 Notes | Jurnal harian (rating, hal baik, masalah, pelajaran, rencana) + catatan bebas |
| 📊 Laporan | Bulanan/mingguan/custom, grafik, per kategori, export PDF |
| 🔐 Brankas | Khusus akun admin: penyimpan kata sandi terenkripsi |
| ⚙️ Setelan | 6 tema, kategori kustom, pengingat HP, pengaman & cadangan data |

---

## Struktur Proyek

```
index.html            halaman utama
sw.js                 service worker (cache offline)
manifest.json         manifest PWA
css/                  gaya (tema, shell, modul, beranda)
js/app/               inti aplikasi (state, db, ui, handlers, auth, notify, guard, …)
js/modules/           modul fitur (daily, vault, fun, home, goals, …)
native/               jembatan plugin Capacitor (notifikasi lokal)
.github/workflows/    build APK otomatis (android.yml)
PANDUAN_APK.md        panduan membangun APK
```

---

## Aplikasi Android (APK)

APK dibangun oleh GitHub Actions dari kode yang sama (Capacitor 6, Java 17, build debug).
Langkah lengkap ada di [`PANDUAN_APK.md`](PANDUAN_APK.md). Setelah mengganti file, jalankan ulang
workflow agar APK memuat versi terbaru. Notifikasi sistem hanya berjalan di APK.

---

## Riwayat Perubahan

### v9.10.1
*November 2026 — perbaikan lanjutan v9.10*
- **Quick Respons:** kartu kembali tampil penuh (chip selalu terlihat). Yang disembunyikan hanya form "Tambah / ubah template" di dalam jendela **Kelola**.
- **Brankas:** bisa **menambah & menghapus kategori sendiri** (tombol "+ Kategori"). Kategori kustom tersimpan terenkripsi bersama sandi; menghapus kategori memindahkan sandinya ke *Other*. Maksimal 30, nama ganda ditolak.

### v9.10
*November 2026*
- **Pengingat di HP:** daftar jenis pengingat terlipat; pratinjau jadwal dan teks keterangan panjang dihapus.
- **Brankas:** kategori menjadi **Facebook, Instagram, Gmail, Game, Other**. Logo FB/IG/Gmail diambil dari web (layanan favicon Google), emoji sebagai cadangan saat offline. Kategori lama otomatis menjadi *Other*.
- **Dasbor (Keuangan → Input):** statistik di bawah kartu saldo; form dan panel samping dalam 2 kolom di layar lebar.
- **Tab Tugas:** kartu **"☀️ Hari ini"** di paling atas (tugas hari ini + yang terlambat).
- **Pengaman Data + Import & Export** digabung menjadi satu bagian terlipat: "Pengaman & Cadangan Data".
- **Bayar Tagihan & Utang-Piutang:** pilih **Cash atau e-wallet** (SeaBank, KromBank, GoPay, DANA, ShopeePay) lengkap dengan saldo masing-masing dan peringatan bila saldo kurang; transaksi tercatat ke dompet terpilih.
- **Statistik kehadiran** dihapus (perhitungannya tetap dipakai untuk lencana).

### v9.9.1
*November 2026*
- Layar pembuka animasi logo saat aplikasi dibuka; tampilan mentah (HTML sebelum gaya termuat) tidak terlihat lagi.

### v9.9
*November 2026*
- **Brankas Sandi** menggantikan panel Admin dan hanya untuk akun admin (akun admin kini hanya melihat Brankas). Enkripsi AES-256-GCM, kunci turunan PBKDF2 (250.000 iterasi), kunci utama tidak disimpan di mana pun, kunci otomatis, salin sandi dengan penghapusan clipboard, generator sandi acak.
- **Keamanan:** sandi akun tidak lagi disimpan polos di database; sandi polos peninggalan versi lama dihapus otomatis saat login.
- **Mode offline:** aplikasi tetap terbuka dan formulir tetap bisa diisi tanpa internet; perubahan tersimpan di perangkat dan dikirim otomatis saat online (ada penanda "belum tersinkron").
- **Fitur lucu:** maskot **Bybi** (mood & streak harian), **9 lencana** dengan konfeti, kartu "Hari ini di masa lalu", roda **"Makan apa?"**, dan satu kejutan tersembunyi.

### v9.8
*November 2026*
- **Pengingat di HP (Android):** notifikasi tetap muncul walau aplikasi ditutup — keuangan harian, tagihan & cicilan, transaksi otomatis, tugas, deadline tugas kuliah, 30 menit sebelum kuliah, catat absen, laporan mingguan.
- Setelan → "Pengingat di HP": atur jam dan nyalakan/matikan tiap jenis.
- Proyek **Capacitor + GitHub Actions** untuk membangun APK.
- **Tagihan & Cicilan** punya tanggal jatuh tempo bulanan dengan penanda hari tersisa.
- **Notes:** draf jurnal tidak hilang saat aplikasi ditutup, baris ganda di Riwayat diperbaiki, label rating terbaca di tema gelap.

### v9.7
*November 2026*
- **Beranda "Hari Ini"** sebagai halaman awal: kuliah, tugas, makan, saldo, jurnal.
- **Pencarian global:** tekan `/` atau `Ctrl+K`, atau ikon kaca pembesar.
- **Target Tabungan** (setoran, penarikan, riwayat, kebutuhan per bulan).
- Statistik kehadiran per mata kuliah dengan peringatan batas absen *(dihapus di v9.10)*.
- Tugas kuliah tampil di tab Tugas; catatan makanan bisa dicatat sebagai pengeluaran.
- **Pengaman data:** snapshot otomatis mingguan, pengingat backup file, pengingat jurnal.
- Bisa dibuka offline (service worker).

### v9.6
*November 2026*
- Catatan Kuliah dipindah ke tab Kuliah (Ringkasan, Catat, Rangkuman, Arsip); mata kuliah disamakan dan matkul lama digabung otomatis tanpa kehilangan catatan.
- **Notes jadi jurnal harian** (rating, hal baik, masalah, pelajaran, rencana besok, catatan bebas); catatan lama ada di "Catatan Bebas".
- Notifikasi di luar aplikasi dihapus sementara; pengingat berupa popup di dalam aplikasi.

### v9.5
*November 2026 (termasuk v9.5b)*
- Tab Task diganti nama menjadi **Tugas**; sapaan, tombol Notifikasi, sub-tab Statistik dan Fokus dihapus.
- Teks penjelasan di tab Kuliah, Makan, Setelan dirapikan.
- Dua tema baru: **Laut** (terang, menu di atas) dan **Senja** (gelap hangat, rel ikon).
- Notifikasi browser dan toast deadline dihapus; pengingat berupa popup saat masuk.

### v9.4
*November 2026*
- **Brand kit baru:** ikon aplikasi, logo "by", wordmark "bygf", ikon navigasi SVG yang mengikuti warna tema.

### v9.3
*November 2026*
- Kode Tugas Pro lama dihapus (fiturnya sudah ada di tab Task); data lama di akun tetap aman.
- Ikon aplikasi baru (termasuk maskable untuk Android) dan favicon.
- Tampilan popup dan halaman di keempat tema diperiksa dan dirapikan.

### v9.2
*November 2026*
- **Task & Daily digabung** menjadi satu tab: proyek, tag, subtugas, jam pengingat, pengulangan, kalender, statistik, fokus.
- Data Tugas Pro lama dipindahkan otomatis (sekali) ke akun; semua tersimpan di Firebase per akun.
- **Navigasi bawah di HP:** 4 tab utama + tombol "Lainnya".
- Perbaikan tampilan: gaya dasar global, kartu Laporan, profil di tema gelap.

### v9.1
*Penyesuaian tampilan per modul (tahap 2 redesain)*
- Hanya lapisan CSS (`css/bygf-modules.css`) tanpa mengubah logika: warna profil di header, kartu Laporan, dan komponen modul mengikuti token tema.

### v9.0
*Redesain tahap 1*
- **Empat tema** (Editorial, Gelap Modern/Neon, Minimal, Playful) lewat token desain; semua tab ikut berubah tanpa menyentuh logika (`css/bygf-themes.css`).
- **Shell baru:** navigasi, header, halaman login, dan komponen dasar (`css/bygf-shell.css`).
- Ikon PWA 192/512 dan `manifest.json` yang benar.

> Catatan: rincian v9.0 dan v9.1 disusun dari isi berkas dan komentar kodenya karena keduanya tidak tercatat di changelog dalam aplikasi. Sebelum v9.0, riwayat v8.1–v8.9 ada di halaman "Lihat Riwayat Update" di Setelan.

---

## Catatan Keamanan
- Kunci Firebase web (`apiKey`, dll.) memang publik; keamanan data bergantung pada **Firebase Security Rules** (batasi tiap akun hanya ke `users/{uid}`).
- Isi Brankas **hanya** tersimpan sebagai ciphertext (di perangkat, Firebase, dan backup JSON). Lupa kunci utama = isi tidak bisa dipulihkan.
- Jangan menyimpan kredensial pribadi di kode atau di repo.
- Bila memakai Netlify, tambahkan domainnya ke **Firebase → Authentication → Authorized domains**.

## Catatan Pengembangan
- Aplikasi statis (ES modules + skrip klasik), tanpa langkah build untuk versi web.
- Data per akun disimpan sebagai satu blob di `users/{uid}/appData`; perubahan harus tetap kompatibel dengan data lama.
- Setiap rilis: naikkan versi di footer `index.html`, `VERSION` di `sw.js`, dan tambahkan entri di `js/app/config.js` (Changelog).
