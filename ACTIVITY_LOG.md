# Activity Log

Catatan kronologis perubahan **TOEFL Audio Tools**. Dokumen ini merangkum apa yang berubah, kapan, dan bagaimana perubahannya diverifikasi. Proyek ini memakai Git; log ini melengkapi riwayat commit dengan konteks dan hasil verifikasi.

Urutan entri: terbaru di atas.

## Format entri

- **Tanggal** — `YYYY-MM-DD`
- **Jenis** — Fitur, Perbaikan, Dokumentasi, atau Verifikasi
- **Perubahan** — ringkasan perilaku yang berubah
- **Verifikasi** — pengecekan yang sudah dilakukan

## 2026-10-25 — Perapian tabel audio

**Jenis:** Perbaikan

- Mengunci layout tabel agar judul panjang tidak melebarkan tabel dan mendorong Part, nomor, status, serta aksi ke luar layar.
- Membatasi kolom judul ke 34% (minimum 240px); judul panjang dipotong dengan ellipsis, sedangkan nama lengkap tetap tersedia lewat tooltip dan mode edit.
- Merapikan header, aksen baris aktif, kontrol Part/nomor, status, dan pemisah aksi tanpa mengubah perilaku tabel.

**Verifikasi:** pengecekan layout Chrome headless (tabel 1102px, tanpa overflow horizontal), `npm run typecheck`, 57 unit test, dan `npm run build`.

## 2026-10-25 — Backup preset sesi (tanpa audio)

**Jenis:** Fitur

- Menambahkan ekspor preset sesi ke JSON dari dialog Pengaturan sesi: nama sesi, jeda, dan metadata audio (nama file asli, nama tampilan, Part, nomor, urutan, durasi, trim). File audio tidak ikut.
- Menambahkan impor preset di halaman utama: sesi baru dibuat dengan track berstatus **Tanpa audio**.
- Impor audio mencocokkan nama file asli dan mengisi blob ke track preset; salinan crop dengan nama sama berbagi satu blob. File yang tidak cocok tetap menjadi track baru.
- Track tanpa audio tidak ikut antrean putar atau mode ujian; rename, Part/nomor, urutan, dan hapus tetap tersedia. Tombol lampirkan audio disediakan untuk file yang namanya berubah.
- Menambahkan validasi format preset (`version: 1`) dan batas ukuran file 2 MB.

**Verifikasi:** 57 unit test lulus (termasuk parser/validator preset dan clamp trim), `npm run typecheck`, dan `npm run build`.

## 2026-10-25 — Persiapan deploy Vercel

**Jenis:** Konfigurasi dan dokumentasi

- Memperluas `.gitignore` untuk mengecualikan artefak lokal: `.npmrc`, `.tmp-install/`, `.tmp-test/`, `.vercel/`, log, coverage, dan file environment.
- Menambahkan panduan deploy Vercel di `INSTALLATION.md`, termasuk pengaturan Node 22.x dan pengujian refresh URL sesi.
- Menambahkan catatan kebutuhan rewrite SPA di `README.md`.

**Verifikasi:** 46 unit test lulus dan `npm run build` berhasil. Konfigurasi Vercel tidak disertakan di repo; commit/push dan deploy produksi dilakukan oleh pengguna.

## 2026-10-25 — Dokumentasi proyek

**Jenis:** Dokumentasi

- Memperluas `README.md`: fitur, alur pemakaian, konvensi nama file, crop duplikat vs ubah asli, sorting, playback, mode ujian, penyimpanan, batasan, troubleshooting, dan struktur proyek.
- Menambahkan `INSTALLATION.md`: prasyarat, instalasi, build, deploy statis, update, uninstall, dan troubleshooting instalasi.
- Menambahkan `ACTIVITY_LOG.md` sebagai catatan perubahan proyek.
- Menyelaraskan istilah UI **“Ubah audio asli”** dengan dokumentasi.

**Verifikasi:** pengecekan isi dokumentasi dan link antar-dokumen.

## 2026-10-25 — Crop membuat salinan audio

**Jenis:** Fitur

- Crop sekarang default menyimpan potongan sebagai **audio baru** dengan nama `Nama Asli (potongan)`.
- Audio asli tetap ada dan tidak diubah.
- Salinan ditempatkan tepat setelah audio asli; urutan track setelahnya digeser otomatis.
- Salinan memakai blob audio yang sama, sehingga tidak menggandakan file di IndexedDB.
- Dialog crop menyediakan pilihan **Simpan sebagai audio baru** (default) atau **Ubah audio asli**.
- Opsi **Ubah audio asli** hanya mengubah rentang putar track; blob asli tetap utuh dan bisa dikembalikan lewat **Reset potongan tersimpan**.
- Penghapusan track memeriksa referensi blob: audio tidak dihapus selama masih dipakai salinan lain.
- Pembersihan data yatim tidak lagi menghapus blob yang masih direferensikan track lain.

**Verifikasi:** typecheck, unit test, build, dan browser smoke test untuk crop duplikat, mode ubah asli, hapus audio asli, reload, lalu memutar salinan.

## 2026-10-25 — Dukungan audio `.mpeg`/`.mpg`

**Jenis:** Fitur

- Menambahkan ekstensi `.mpeg` dan `.mpg` ke filter impor.
- Menormalkan MIME audio sebelum disimpan/diputar agar ekspor WhatsApp `.mpeg` yang berisi MP3 dapat digunakan.
- Parser nama file mengabaikan tanggal dan waktu, sehingga nama seperti `WhatsApp Audio 2025-12-05 at 5.21.13 PM.mpeg` tidak menghasilkan Part/No palsu.
- Memperbarui teks UI dan README untuk format yang didukung.

**Verifikasi:** impor file `.mpeg` WhatsApp nyata berdurasi 3:52, metadata terbaca sebagai `OTHER` tanpa nomor, dan playback berjalan.

## 2026-10-25 — Rilis awal V1

**Jenis:** Fitur

- Scaffold Vue 3 + Vite + TypeScript + Tailwind CSS v4.
- Penyimpanan lokal IndexedDB untuk sesi, track, dan blob audio.
- Halaman sesi: buat, ganti nama, hapus, dan ringkasan penyimpanan.
- Workspace: impor banyak file, drag-and-drop, pencarian, statistik, dan pengaturan sesi.
- Crop awal/akhir non-destruktif dengan WaveSurfer: waveform, zoom, preview, loop, dan nudge.
- Edit nama, Part, dan nomor audio.
- Urutan manual dan auto-sort berdasarkan Part/nomor dengan pratinjau, peringatan, dan undo.
- Pemutar berantai: preload, auto-advance, jeda antar audio, loop, dan volume tersimpan.
- Mode ujian overlay dengan wake lock dan shortcut keyboard.
- Hapus dengan undo 12 detik dan pembersihan data yatim.

**Verifikasi:** typecheck, 46 unit test, build produksi, dan browser smoke test untuk impor, sorting, crop, playback, auto-advance, serta mode ujian.

## Rencana berikutnya

- [ ] Deploy produksi ke Vercel dan smoke test URL produksi.
- [ ] `USAGES.md` — panduan pengguna dengan screenshot dan FAQ.
- [ ] `SOP.md` — checklist operasional persiapan dan pelaksanaan sesi ujian.
- [ ] Ekspor/impor proyek atau backup lokal.
- [ ] Konversi otomatis MP2/MPEG video via FFmpeg.wasm bila diperlukan.

## Cara menambah entri

Tambahkan entri baru di atas entri terbaru dengan format yang sama. Tulis perubahan sebagai perilaku yang dapat diamati pengguna, bukan daftar file. Cantumkan verifikasi yang benar-benar dijalankan.
