# Firebase Security Rules BYgf

Berkas: `firebase/database.rules.json` (Realtime Database).

Isi aturan:
- Semua data tertutup secara bawaan.
- Tiap akun hanya boleh membaca/menulis `users/{uid}` miliknya sendiri.
- Akun admin (`admin@keuangan.pro`) boleh membaca daftar `users` dan mengubah/menghapus akun lain (dipakai panel admin: ubah Premium, hapus akun).
- Hanya dua cabang yang boleh ada di `users/{uid}`: `appData` dan `profile`. Kunci lain ditolak.

## Cara menerapkan (manual, sekali)
1. Firebase Console → Build → Realtime Database → tab **Rules**.
2. **Salin dulu isi Rules yang sekarang** ke tempat aman (untuk jaga-jaga kembali).
3. Tempel isi `database.rules.json`, klik **Publish**.
4. Uji: masuk di web dan di APK, ubah satu data, muat ulang → harus tetap tersimpan. Buka panel admin → daftar akun harus tampil.
5. Bila ada yang gagal ("permission denied" di konsol browser), kembalikan Rules lama lalu kabari.

## Catatan
- Aturan ini belum diuji di emulator Firebase (tidak tersedia di lingkungan pengembangan). Uji langkah 4 sebelum yakin.
- Panel admin masih membaca `profile.password` / `appData.password`. Jika ada kata sandi teks biasa tersimpan, itu masalah terpisah (belum diputuskan).
