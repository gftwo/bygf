import { App } from './core.js';

App.Config = {
    // ⚠️  GANTI dengan VAPID Key dari Firebase Console →
    //    Project Settings → Cloud Messaging → Web Push certificates
    VapidKey: 'GANTI_DENGAN_VAPID_KEY_KAMU',
    Firebase: { 
        apiKey: "AIzaSyCI32Fl3oFo8MqcFfaWOae73vbP-aKqqSw",
        authDomain: "bygf-6f77.firebaseapp.com",
        databaseURL: "https://bygf-6f77-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "bygf-6f77",
        storageBucket: "bygf-6f77.firebasestorage.app",
        messagingSenderId: "127025825709",
        appId: "1:127025825709:web:e6b75daea1f707c674c324",
        measurementId: "G-SWW4R8FHC1"
    },
    // Updated Default Categories based on user request image
    DefaultCategories: [
        { id: 'lainnya', name: 'Lainnya', icon: '📦' },
        { id: 'jajan', name: 'Jajan', icon: '🍿' },
        { id: 'uang_mingguan', name: 'Uang Mingguan', icon: '💵' },
        { id: 'shopping', name: 'Shopping', icon: '🛍️' },
        { id: 'gift', name: 'Gift', icon: '🎁' }
    ],
    AccountIcons: { cash: '💵', saldo: '🪪' },
    Changelog: [
        { version: 'v9.9', date: 'November 2026', items: [
            'Brankas Sandi menggantikan panel Admin: simpan kata sandi pribadi, terenkripsi AES-256 dengan kunci utama milikmu (tidak disimpan di mana pun), kunci otomatis, salin sandi dengan penghapusan clipboard, dan generator sandi acak',
            'Keamanan: sandi akun tidak lagi disimpan polos di database; sandi polos peninggalan versi lama dihapus otomatis saat login',
            'Mode offline: aplikasi tetap terbuka dan formulir tetap bisa diisi tanpa internet; perubahan tersimpan di perangkat dan dikirim otomatis saat online kembali (ada penanda "belum tersinkron")',
            'Fitur lucu: maskot Bybi (mood & streak harian), 9 lencana dengan konfeti, kartu "Hari ini di masa lalu", roda "Makan apa?", dan satu kejutan tersembunyi',
        ] },
        { version: 'v9.8', date: 'November 2026', items: [
            'Pengingat di HP (aplikasi Android): notifikasi tetap muncul walau aplikasi ditutup — isi keuangan harian, tagihan & cicilan, transaksi otomatis, tugas, deadline tugas kuliah, 30 menit sebelum kuliah, catat absen, dan laporan mingguan',
            'Setelan → "Pengingat di HP": pilih jam dan nyalakan/matikan tiap jenis; ada pratinjau jadwal (juga di browser)',
            'Tagihan & Cicilan kini punya tanggal jatuh tempo bulanan dengan penanda hari tersisa',
            'Notes: draf jurnal tidak hilang saat aplikasi ditutup, baris ganda di Riwayat diperbaiki, label rating terbaca di tema gelap',
        ] },
        { version: 'v9.7', date: 'November 2026', items: [
            'Beranda "Hari Ini": jadwal kuliah, tugas, jadwal makan, saldo, dan jurnal dalam satu layar (jadi halaman awal)',
            'Pencarian global: tekan / atau Ctrl+K, atau ikon kaca pembesar di atas',
            'Target Tabungan (tab Keuangan → Target) dengan setoran, penarikan, riwayat, dan kebutuhan per bulan',
            'Statistik kehadiran per mata kuliah dengan peringatan batas absen',
            'Tugas kuliah tampil di tab Tugas; catatan makanan bisa dicatat sebagai pengeluaran di Keuangan',
            'Pengaman data: snapshot otomatis mingguan, pengingat backup file, dan pengingat jurnal di popup dalam aplikasi',
            'Bisa dibuka offline (service worker, tanpa notifikasi push)'
        ] },
        { version: 'v9.6', date: 'November 2026', items: [
            'Catatan Kuliah dipindah ke tab Kuliah (Ringkasan, Catat, Rangkuman, Arsip); sub-tab Tugas, Alat, dan Mata Kuliah dihapus',
            'Daftar mata kuliah Catatan Kuliah kini sama dengan tab Kuliah; matkul lama digabung otomatis berdasarkan nama dan catatan tetap utuh',
            'Notes kini jurnal harian: rating hari ini, hal baik, masalah, pelajaran, rencana besok, dan catatan bebas; catatan lama ada di "Catatan Bebas"',
            'Semua notifikasi di luar aplikasi dihapus; pengingat hanya berupa popup di dalam aplikasi'
        ] },
        { version: 'v9.5', date: 'November 2026', items: [
            'Tab Task diganti nama menjadi Tugas; sapaan, tombol Notifikasi, serta sub-tab Statistik dan Fokus dihapus',
            'Teks penjelasan di tab Kuliah, Makan, dan Setelan dihapus agar lebih ringkas',
            'Dua tema baru: Laut (terang, menu di atas) dan Senja (gelap hangat, rel ikon)',
            'Notifikasi browser dan toast deadline dihapus; pengingat kini hanya berupa popup di dalam aplikasi saat masuk'
        ] },
        { version: 'v9.4', date: 'November 2026', items: [
            'Brand kit baru: ikon aplikasi, logo "by", wordmark "bygf", dan ikon navigasi SVG (ikut warna tema)'
        ] },
        { version: 'v9.3', date: 'November 2026', items: [
            'Kode Tugas Pro lama dihapus (fitur sudah ada di tab Task); data lama di akun tetap aman',
            'Ikon aplikasi baru (termasuk ikon maskable untuk Android) dan favicon',
            'Tampilan popup dan halaman di keempat tema diperiksa dan dirapikan'
        ] },
        { version: 'v9.2', date: 'November 2026', items: [
            'Task & Daily digabung menjadi satu tab "Task": proyek, tag, subtugas, jam pengingat, pengulangan, kalender, statistik, dan fokus',
            'Data Tugas Pro lama dipindahkan otomatis (sekali) ke akun; semua tersimpan di Firebase per akun',
            'Navigasi bawah baru di HP: 4 tab utama + tombol "Lainnya"',
            'Perbaikan tampilan: gaya dasar global dikembalikan, kartu Laporan, profil di tema gelap'
        ] },
        { version: 'v8.9', date: 'November 2026', items: [
            'Empat tab baru: Daily (to-do + pengingat + tugas berulang), Catatan Kuliah, Makan (jadwal & jurnal makanan), dan Notes (editor catatan umum)',
            'Data tab baru tersinkron ke akun Firebase yang sama dan ikut Backup/Restore JSON (dengan validasi & konfirmasi sebelum menimpa)',
            'Perbaikan: shortcut "N" di Tugas Pro tidak lagi membajak ketikan di tab lain',
            'Kode dipecah ke folder css/ dan js/ supaya lebih mudah dirawat'
        ] },
        { version: 'v8.8', date: 'September 2026', items: [
            'Perbaikan bug besar: nambah/ubah data di tab Kuliah (absen, tugas, dll) sebelumnya selalu "nyeret" balik ke tab Keuangan — sekarang gak lagi',
            'Tab Task: tugas yang diselesaikan hari ini sekarang tetap muncul di grup "Selesai" pada tampilan Hari Ini, gak ngilang gitu aja',
            'Tab Task: benerin render pas pertama buka tab (dulu kadang harus pencet filter dulu biar tugas kelihatan)',
            '"Kecualikan dari Budget" dihapus dari form Tambah Transaksi — cukup diatur & ditandai di Riwayat/Edit transaksi'
        ]},
        { version: 'v8.7', date: 'September 2026', items: [
            'Tab Kuliah (jadwal, absensi/kehadiran, tugas kuliah) sekarang ikut sinkron ke akun — sebelumnya cuma tersimpan di HP masing-masing',
            'Backup Manual (.json) sekarang lengkap: transfer, utang/piutang, template cepat, dan data Kuliah ikut ke-backup & ke-restore',
            'Perbaikan bug Tugas Pro: tugas berulang yang ditandai selesai lewat halaman edit sekarang ikut maju ke jadwal berikutnya, sama seperti lewat checklist',
            'Tugas (Pro & Kuliah) yang sudah selesai sekarang nampilin kapan tepatnya diselesaikan',
            'Popup "Jadwal Kamu Hari Ini" sekarang gabungin tugas Tugas Pro & deadline tugas Kuliah dalam satu tampilan'
        ]},
        { version: 'v8.6', date: 'September 2026', items: [
            'Filter Riwayat sekarang bisa per sub-dompet spesifik (SeaBank, KromBank, GoPay, DANA, ShopeePay) atau semua Saldo',
            '2 tema baru: Biru Abu (slate) & Kuning Abu (stone/amber)',
            'Alokasi: Laporan Akhir Bulan per pos lengkap sisa/lebihnya',
            'Laporan: bisa geser bulan/minggu pakai tombol ◀ ▶',
            'Bersihin beberapa kalimat deskripsi yang dianggap gak perlu',
            'Footer versi dirapikan + halaman arsip update (ini!) ditambahkan'
        ]},
        { version: 'v8.5', date: 'Agustus 2026', items: [
            'Tab baru "Laporan": filter Bulanan/Mingguan/Custom, grafik pengeluaran harian (nunjukin tanggal paling boros), breakdown per kategori, export PDF proper (kop, tanggal terbit, tabel kategori & transaksi)',
            'Riwayat Penyesuaian Saldo dipisah jadi tombol mengambang di tab Riwayat, sekarang bisa diedit & dihapus',
            'Tab Alokasi: ringkasan total gabungan, donut chart pembagian pos, saran jatah harian sisa bulan berjalan',
            'Pemetaan kategori bisa dikecualikan total dari Alokasi ("Di Luar Budget")',
            'Kategori custom sekarang langsung kepake begitu app kebuka, gak perlu nambah transaksi dulu'
        ]},
        { version: 'v8.4', date: 'Agustus 2026', items: [
            'Tambah KromBank sebagai sub-dompet',
            'Hapus kategori Sekolah',
            'Notifikasi budget/transaksi otomatis: ada opsi "Jangan tampilkan lagi hari ini"',
            'Transfer antar sub-dompet Saldo (misal SeaBank ke GoPay) sekarang bisa',
            'Ikon sub-dompet disesuaikan sama logo aslinya (SeaBank, ShopeePay)'
        ]},
        { version: 'v8.3', date: 'Agustus 2026', items: [
            'Tab Alokasi Budget baru: pembagian 50/20/30 (Kebutuhan Pokok, Kuliah & Transport, Fleksibel & Hiburan)',
            'Transaksi bisa ditandai "Kecualikan dari Budget"'
        ]},
        { version: 'v8.2', date: 'Agustus 2026', items: [
            'Sub-dompet e-wallet (GoPay, DANA, ShopeePay, SeaBank) buat akun Saldo, rincian per dompet di Dashboard',
            'Transfer prioritas Saldo → Cash sebagai default',
            'Fitur Quick Respons: template transaksi cepat, sekali tap tinggal isi nominal',
            'Fitur Sinkronkan Saldo: rekonsiliasi saldo di app vs kenyataan',
            'Fitur Target Impian dihapus'
        ]},
        { version: 'v8.1', date: 'Juli 2026', items: [
            'Popup "Perlu Perhatian" pas buka app: alert budget hampir habis + konfirmasi transaksi otomatis sebelum beneran tercatat',
            'Transaksi otomatis (recurring) sekarang fleksibel: interval custom (misal tiap 3 bulan), tanggal mulai & berakhir'
        ]},
        { version: 'v8.0', date: 'Juli 2026', items: [
            'Detail transaksi di Riwayat nunjukin sisa saldo saat itu (cash & saldo terpisah, ada tombol rincian)',
            'Perbaikan bug perhitungan saldo yang gak sinkron sama transfer'
        ]},
        { version: 'v7.x', date: 'Juli 2026', items: [
            'Fitur Input Cepat dari Screenshot: baca mutasi otomatis dari galeri (OCR), bisa banyak sekaligus',
            'Perbaikan bug Tugas Pro: render crash pas data sync, drag-handle bikin tap gak kebaca di HP',
            'Sistem antrian notifikasi: popup gantian gak numpuk, 1x tampil per reload'
        ]},
        { version: 'v6.x', date: 'Juni 2026', items: [
            'Tugas Pro digabung jadi satu file sama Keuangan Pro',
            'Sistem tema custom: 6 preset (Klasik, Midnight, Sunset, Forest, Mono, Aurora)',
            'Fitur premium & sistem notifikasi push dihapus total, semua fitur gratis buat semua orang',
            'Intro video dihapus'
        ]}
    ],
    FreeLimits: { budget: 3, recurring: 3, historyMonths: 3 }
};
