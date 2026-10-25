# TOEFL Audio Tools

Aplikasi browser lokal untuk menyiapkan audio latihan TOEFL Listening: impor, potong awal/akhir, rapikan urutan, dan putar berurutan sebagai satu sesi. Tidak ada server, upload, akun, atau cloud — audio dan metadata disimpan di IndexedDB browser.

Cocok untuk 20–60 file berdurasi 1–3 menit yang sudah berisi directions dan jeda jawaban. Aplikasi tidak membuat narasi atau jeda soal.

## Dokumentasi

- [INSTALLATION.md](INSTALLATION.md) — instalasi, build, deploy, update, dan troubleshooting.
- [ACTIVITY_LOG.md](ACTIVITY_LOG.md) — catatan perubahan dan verifikasi.

## Daftar isi

- [Dokumentasi](#dokumentasi)
- [Fitur](#fitur)
- [Menjalankan](#menjalankan)
- [Alur pemakaian](#alur-pemakaian)
- [Konvensi nama file](#konvensi-nama-file)
- [Crop: duplikat atau ubah asli](#crop-duplikat-atau-ubah-asli)
- [Urutan dan auto-sort](#urutan-dan-auto-sort)
- [Pemutaran dan mode ujian](#pemutaran-dan-mode-ujian)
- [Penyimpanan lokal](#penyimpanan-lokal)
- [Backup preset (tanpa audio)](#backup-preset-tanpa-audio)
- [Batasan](#batasan)
- [Troubleshooting](#troubleshooting)
- [Pengembangan](#pengembangan)
- [Struktur proyek](#struktur-proyek)
- [Teknologi](#teknologi)

## Fitur

- **Impor MP3, WAV, dan MPEG audio** (`.mpeg`/`.mpg`) lewat tombol atau drag-and-drop. Maksimal 300 MB per file.
- **Parser nama file** untuk membaca Part dan nomor audio secara otomatis. Metadata selalu bisa dikoreksi manual.
- **Potong awal/akhir non-destruktif** dengan waveform, zoom, preview, loop, dan tombol nudge 1 detik. Secara default, potongan disimpan sebagai audio baru sehingga audio asli tetap ada.
- **Edit metadata**: nama audio, Part (`A`/`B`/`C`/`FULL`/`OTHER`), dan nomor audio.
- **Urutan manual** lewat drag-and-drop atau panah atas/bawah saat fokus di ikon geser.
- **Urutkan otomatis** berdasarkan Part lalu nomor, dengan pratinjau, peringatan, dan undo.
- **Pemutar berantai** dengan preload, auto-advance, jeda antar audio 0–30 detik, volume tersimpan, dan loop satu audio.
- **Mode ujian** berupa overlay layar penuh dengan kontrol besar, wake lock, posisi audio, dan shortcut keyboard.
- **Pencarian** berdasarkan nama, nama file asli, Part, atau nomor.
- **Hapus dengan undo** (12 detik) dan pembersihan data yatim saat aplikasi dibuka.
- **Penyimpanan lokal** memakai IndexedDB; aplikasi meminta penyimpanan persisten bila browser mendukung.
- **Backup preset tanpa audio** — ekspor pengaturan sesi dan metadata audio ke JSON, impor di perangkat lain, lalu cocokkan file audio berdasarkan nama.

## Menjalankan

Prasyarat: Node.js **20.19+** atau **22.12+** (disarankan Node 22/24) dan npm.

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite (biasanya `http://localhost:5173`). Gunakan Chrome atau Edge versi terbaru.

Panduan langkah demi langkah, deploy, dan troubleshooting ada di [INSTALLATION.md](INSTALLATION.md).

Perintah lain:

| Perintah | Fungsi |
| --- | --- |
| `npm run typecheck` | Cek TypeScript dan template Vue. |
| `npm run test:run` | Jalankan unit test sekali. |
| `npm run test` | Unit test mode watch. |
| `npm run build` | Typecheck lalu build produksi ke `dist/`. |
| `npm run preview` | Pratinjau hasil build produksi. |

Build menghasilkan situs statis. Karena router memakai history mode, hosting perlu fallback SPA ke `index.html` agar URL sesi tidak 404. Contoh pengaturan rewrite SPA untuk Vercel, Netlify, dan Nginx ada di [INSTALLATION.md](INSTALLATION.md).

## Alur pemakaian

1. Di halaman utama, buat sesi baru.
2. Di dalam sesi, impor satu atau banyak file MP3, WAV, atau MPEG audio. Nama seperti `Part A 01.mp3` akan dibaca otomatis; koreksi Part/nomor bila perlu.
3. Klik ikon gunting pada audio untuk memotong bagian awal/akhir. Pilih **Simpan sebagai audio baru** (default, audio asli tetap ada) atau **Ubah audio asli**, lalu simpan.
4. Atur urutan secara manual, atau gunakan **Urutkan otomatis**.
5. Atur **Jeda antar audio** di pengaturan sesi (default 0 detik).
6. Klik **Putar semua** atau tombol putar pada satu audio. Untuk suasana ujian, buka **Mode ujian**.

Saat pencarian aktif, daftar hanya menampilkan hasil yang cocok dan pengurutan manual dinonaktifkan. Tombol putar pada satu audio akan memulai antrean dari hasil pencarian tersebut; **Putar semua** selalu memakai seluruh audio di sesi.

## Konvensi nama file

Parser membaca nama file secara best-effort. Beberapa contoh:

| Contoh nama | Part | No. | Keterangan |
| --- | --- | --- | --- |
| `Part A 01.mp3` | A | 1 | Format paling umum. |
| `part_c_03.mp3` | C | 3 | Huruf kecil dan underscore. |
| `A1.mp3` | A | 1 | Huruf dan nomor rapat. |
| `C 07.wav` | C | 7 | Huruf, spasi, nomor. |
| `Part A - 01 - Conversation.mp3` | A | 1 | Deskripsi setelah nomor diabaikan. |
| `Part A.mp3` | A | — | File part utuh tanpa nomor. |
| `Full Test.mp3` | FULL | — | Full set. |
| `Lecture 05.mp3` | OTHER | 5 | Nomor tetap dibaca. |
| `WhatsApp Audio 2025-12-05 at 5.21.13 PM.mpeg` | OTHER | — | Tanggal dan jam diabaikan. |

Catatan:

- Nama tampilan diambil dari nama file tanpa ekstensi.
- Nama yang sama akan mendapat akhiran `(2)`, `(3)`, dan seterusnya.
- Part/No yang salah bisa langsung diubah di tabel. Auto-sort memakai metadata yang sedang tersimpan.
- Tanggal dan waktu sengaja diabaikan agar nama ekspor WhatsApp tidak menghasilkan nomor palsu.

## Crop: duplikat atau ubah asli

Buka dialog crop lewat ikon gunting. Geser area hijau atau tarik ujung kiri/kanannya, lalu gunakan **Putar seleksi**, **Ulangi**, zoom, tombol 1 detik, **Di kursor**, atau **Penuh** untuk mengatur pilihan. Klik waveform untuk memindahkan kursor.

Saat menyimpan, ada dua pilihan:

- **Simpan sebagai audio baru** — default. Aplikasi membuat track baru bernama `Nama Asli (potongan)` tepat setelah audio asli. Audio asli tidak berubah. Track baru memakai blob audio yang sama, jadi tidak menggandakan file di penyimpanan.
- **Ubah audio asli** — hanya mengubah rentang putar track asli. File audio asli tetap utuh; gunakan **Reset potongan tersimpan** di dialog crop untuk mengembalikan rentang ke durasi penuh.

Menghapus salah satu salinan tidak menghapus audio selama salinan lainnya masih ada. Crop hanya memotong bagian awal dan akhir; belum ada cut di tengah, split, atau penggabungan menjadi satu file.

## Urutan dan auto-sort

- **Manual**: drag ikon di kolom paling kiri, atau fokuskan ikon tersebut lalu tekan panah atas/bawah.
- **Otomatis**: urutan disusun berdasarkan Part (`A` → `B` → `C` → `FULL` → `OTHER`), lalu nomor terkecil, lalu nama secara natural. Audio tanpa nomor diletakkan setelah audio bernomor.
- **Pratinjau**: dialog auto-sort menampilkan hasil sebelum diterapkan. Jika urutan sudah sesuai, tombol terapkan dinonaktifkan.
- **Peringatan**: nomor duplikat, campuran file part utuh dan per soal, beberapa Full Set, audio tanpa nomor, serta Full Set yang bercampur dengan file lain.
- **Undo**: setelah menerapkan auto-sort, gunakan tombol **Batalkan** pada toast untuk mengembalikan urutan sebelumnya.

## Pemutaran dan mode ujian

- **Putar semua** memulai antrean dari audio pertama. Tombol putar pada satu baris memulai antrean dari audio tersebut.
- **Preload** menyiapkan audio berikutnya agar perpindahan lebih cepat.
- **Auto-advance** aktif secara default dan bisa dimatikan lewat tombol **Otomatis** di player bar.
- **Jeda antar audio** diatur per sesi, 0–30 detik. Saat jeda berjalan, muncul hitungan mundur dengan tombol **Lewati**.
- **Loop** mengulang audio aktif.
- **Volume** tersimpan di browser dan dipakai lagi saat aplikasi dibuka.
- Tombol sebelumnya akan mengulang audio aktif jika posisinya sudah lebih dari 3 detik; jika belum, ia pindah ke audio sebelumnya (atau mengulang audio pertama).

**Mode ujian** membuka overlay layar penuh, meminta wake lock, dan memaksa auto-advance aktif selama sesi. Setelah keluar, pengaturan auto-advance sebelumnya dikembalikan.

Shortcut di mode ujian:

| Tombol | Fungsi |
| --- | --- |
| `Space` | Putar atau jeda. |
| `←` | Audio sebelumnya. |
| `→` | Audio berikutnya. |
| `Esc` | Keluar dari mode ujian. |

Keluar dari overlay tidak otomatis menghentikan audio. Gunakan tombol jeda jika perlu.

## Penyimpanan lokal

- Audio dan metadata tersimpan di **IndexedDB** pada profil browser ini. Tidak ada data yang dikirim ke server.
- Data tidak otomatis tersinkron ke perangkat atau browser lain.
- Menghapus data situs (site data), memakai mode Incognito, atau berganti profil browser akan menghilangkan data.
- Jangan membersihkan data situs untuk alamat aplikasi ini jika masih membutuhkan sesi yang tersimpan.
- Kapasitas tergantung kuota browser dan ruang disk. Aplikasi meminta penyimpanan persisten bila didukung, tetapi browser tetap dapat mengosongkannya dalam kondisi tertentu.
- Menghapus sesi akan menghapus semua track dan audio di dalamnya secara permanen.
- Menghapus satu track memberi undo 12 detik. Jika tab ditutup sebelum undo, track yang masih berstatus terhapus akan dibersihkan otomatis pada pembersihan berikutnya saat aplikasi dibuka.
- Belum ada fitur ekspor/impor proyek lengkap dengan audio atau backup cloud di V1. Yang tersedia adalah **backup preset tanpa audio** (lihat bagian berikut); simpan file audio asli tetap aman di disk.

## Backup preset (tanpa audio)

Preset memindahkan **pengaturan dan metadata**, bukan file audio. Cocok untuk menyiapkan sesi di komputer lain tanpa mengunggah apa pun.

1. Buka **Pengaturan** sesi → **Unduh preset**. File `preset-*.json` berisi nama sesi, jeda, serta nama file asli, nama tampilan, Part, nomor, urutan, durasi, dan potongan setiap audio.
2. Salin file preset dan file audio asli ke perangkat lain (USB, Drive, WhatsApp, dan sebagainya).
3. Di halaman utama perangkat tujuan, klik **Impor preset**, lalu pilih file JSON. Sesi baru dibuat dan setiap audio tampil dengan status **Tanpa audio**.
4. Impor file audio seperti biasa. File yang nama aslinya sama akan otomatis mengisi baris preset; satu file juga mengisi beberapa baris hasil crop dengan nama asli yang sama. File yang tidak cocok tetap ditambahkan sebagai audio baru.
5. Jika nama file berubah, gunakan tombol **Lampirkan file audio** pada baris tersebut.

Catatan:

- Track yang belum punya audio tidak ikut **Putar semua** atau **Mode ujian**, tetapi tetap bisa di-rename, diubah Part/nomornya, diurutkan, dan dihapus.
- Pencocokan memakai nama file asli yang persis. Jaga nama file tetap sama saat menyalin.
- Preset memakai format JSON dengan `version: 1`; file yang tidak valid atau lebih besar dari 2 MB ditolak.
- Preset tidak menggantikan backup audio. File audio tetap harus disalin terpisah.

## Batasan

- Hanya memotong bagian awal dan akhir; belum ada cut di tengah, split, atau merge menjadi satu file.
- Format yang didukung: MP3, WAV, dan file `.mpeg`/`.mpg` yang audionya dapat didekode browser (misalnya ekspor WhatsApp `.mpeg` yang berisi MP3). Maksimal 300 MB per file.
- MPEG video atau MP2 yang tidak didukung browser belum dikonversi otomatis. Konversi ke MP3/WAV terlebih dahulu.
- Tidak ada backend, autentikasi, cloud sync, atau multi-user.
- Backup preset tidak menyertakan file audio; audio harus disalin terpisah dan dicocokkan berdasarkan nama file.
- Fokus desktop Chrome/Edge. Tampilan responsif, tetapi pengalaman terbaik ada di layar lebar.
- Audio harus dapat didekode oleh browser. File yang rusak atau codec tidak didukung akan ditolak saat impor.
- Aplikasi tidak membuat narasi, directions, atau jeda soal; semua harus sudah ada di file audio.

## Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
| --- | --- | --- |
| File dilewati saat impor | Ekstensi/MIME tidak didukung | Gunakan MP3 atau WAV; untuk `.mpeg`/`.mpg`, pastikan isinya audio yang bisa didekode browser. |
| Muncul “Format audio tidak didukung browser” | Codec tidak tersedia atau file rusak | Konversi ke MP3/WAV, lalu impor ulang. |
| `.mpeg` dari WhatsApp gagal | File berisi MP2/video MPEG, bukan MP3 | Konversi audionya ke MP3/WAV. |
| Muncul “Durasi audio tidak terbaca” | File rusak atau metadata tidak valid | Coba putar di pemutar lain; ekspor ulang atau konversi. |
| Muncul “File audio tidak ditemukan” | Blob di IndexedDB sudah terhapus | Impor ulang file asli. |
| Audio berhenti di akhir track | Auto-advance mati, atau track terakhir | Nyalakan tombol **Otomatis**; pastikan masih ada track berikutnya. |
| Urutan tidak bisa digeser | Pencarian sedang aktif | Hapus kata kunci pencarian. |
| Data hilang | Site data dibersihkan, Incognito, atau ganti profil | Gunakan profil browser biasa dan simpan file asli di disk. |
| Penyimpanan penuh | Kuota browser atau disk | Hapus sesi yang tidak dipakai, kosongkan ruang disk, atau gunakan file lebih kecil. |
| Auto-sort memberi peringatan nomor duplikat | Ada dua track dengan Part/No sama | Perbaiki nomor, hapus salinan, atau abaikan jika memang disengaja. |

## Pengembangan

```bash
npm install
npm run dev        # server pengembangan
npm run typecheck  # cek TypeScript + template Vue
npm run test:run   # unit test
npm run build      # build produksi ke dist/
npm run preview    # pratinjau build
```

Unit test saat ini mencakup parser nama file, sorting, format durasi, dan validasi audio. Tidak ada environment variable, server API, atau database eksternal yang perlu disiapkan.

Build statis dapat di-host di layanan seperti Netlify, Vercel, atau server statis biasa. Pastikan semua route diarahkan ke `index.html` karena aplikasi memakai history mode.

## Struktur proyek

```text
src/
  components/
    home/        daftar sesi dan form sesi
    ui/          komponen UI dasar (modal, tombol, badge, dll.)
    workspace/   tabel audio, player bar, crop, auto-sort, pengaturan, mode ujian
  composables/   live query, storage estimate, scroll lock, document title
  db/            skema Dexie dan operasi proyek/audio
  lib/           parser nama file, sorting, format, validasi audio, storage
  router/        route halaman utama dan sesi
  stores/        state pemutar audio
  views/         HomeView dan WorkspaceView
```

## Teknologi

Vue 3, Vite, TypeScript, Tailwind CSS v4, Pinia, Vue Router, Dexie (IndexedDB), WaveSurfer.js, VueUse, vue-sonner, dan Lucide.
