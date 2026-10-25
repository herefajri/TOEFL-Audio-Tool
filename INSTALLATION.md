# Installation

Panduan memasang, menjalankan, dan men-deploy **TOEFL Audio Tools** di komputer lokal.

Aplikasi ini tidak membutuhkan backend, database eksternal, akun, atau environment variable. Semua audio dan metadata disimpan di IndexedDB browser.

## Prasyarat

- **Node.js 20.19+** atau **22.12+** (disarankan Node 22/24 LTS).
- **npm** (biasanya ikut terpasang bersama Node.js).
- **Chrome atau Edge versi terbaru** untuk pengalaman terbaik.
- Ruang disk yang cukup untuk `node_modules`, build, dan file audio.

Cek versi yang terpasang:

```bash
node -v
npm -v
```

Jika Node.js belum ada, unduh dari <https://nodejs.org/>. Pilih versi LTS.

## Instalasi cepat

1. Buka folder proyek. Di Windows PowerShell:

   ```powershell
   cd "D:\Project web\TOEFL-Audio-Tool"
   ```

2. Pasang dependency:

   ```bash
   npm install
   ```

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

4. Buka alamat yang ditampilkan Vite, biasanya:

   ```text
   http://localhost:5173
   ```

5. Buat sesi baru dan impor audio.

### Memakai port lain

Jika port default sedang dipakai:

```bash
npm run dev -- --port 5174
```

Atau tentukan host dan port secara eksplisit:

```bash
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

> **Penting:** data IndexedDB terikat ke **origin** (protokol + host + port). `http://localhost:5173`, `http://127.0.0.1:5199`, dan `http://localhost:5174` adalah tiga penyimpanan yang berbeda. Gunakan satu alamat secara konsisten agar sesi yang sudah dibuat tetap terlihat.

## Build produksi

```bash
npm run build
```

Perintah ini menjalankan pengecekan TypeScript/Vue lalu menghasilkan build statis di folder `dist/`.

Pratinjau hasil build secara lokal:

```bash
npm run preview
```

Buka alamat yang ditampilkan Vite Preview.

## Deploy statis

Folder `dist/` dapat di-host di Netlify, Vercel, server Nginx, atau hosting statis lain. Karena aplikasi memakai Vue Router dengan history mode, semua route harus diarahkan ke `index.html`.

### Vercel

Vercel perlu rewrite SPA ke `index.html`. Tambahkan konfigurasi rewrite tersebut (misalnya lewat `vercel.json` di root repo) sebelum deploy.

1. Push repo ke GitHub.
2. Di Vercel, pilih **Add New → Project**, lalu impor repo.
3. Framework Preset: **Vite** (biasanya terdeteksi otomatis).
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Node.js: **22.x**.
7. Deploy. Tidak ada environment variable yang perlu diisi.

Setelah deploy, buka URL produksi dan refresh langsung di `/session/<id>` untuk memastikan rewrite SPA bekerja. Data IndexedDB di domain Vercel terpisah dari data `localhost`.

### Netlify

Contoh Netlify: buat `public/_redirects` agar file ikut tersalin ke `dist/` saat build:

```text
/*  /index.html  200
```

Contoh Nginx:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Gunakan HTTPS di produksi. Selain lebih aman, browser umumnya membatasi Storage API pada konteks yang tidak aman.

## Verifikasi instalasi

Jalankan tiga pengecekan berikut setelah `npm install`:

```bash
npm run typecheck
npm run test:run
npm run build
```

Yang diharapkan:

- Typecheck selesai tanpa error.
- Semua unit test lulus.
- Build menghasilkan `dist/index.html` dan aset di `dist/assets/`.

Untuk uji manual singkat:

1. Buka aplikasi.
2. Buat sesi.
3. Impor satu file MP3 atau WAV.
4. Putar audio.
5. Crop audio dan pilih **Simpan sebagai audio baru**.
6. Pastikan audio asli dan salinan `(potongan)` muncul.
7. Buka **Mode ujian** dan coba `Space`, `←`, `→`, dan `Esc`.

## Update aplikasi

1. Ganti file proyek dengan versi terbaru.
2. Jalankan `npm install` bila dependency berubah.
3. Jalankan `npm run typecheck`, `npm run test:run`, dan `npm run build`.
4. Muat ulang aplikasi di browser.

Selama origin, profil browser, dan site data tidak berubah, sesi yang sudah tersimpan tetap ada.

## Uninstall dan hapus data

- Hapus folder proyek untuk menghapus kode dan `node_modules`.
- Untuk menghapus data aplikasi, buka pengaturan situs di browser, lalu hapus **site data** untuk origin aplikasi.
- Menghapus site data juga menghapus semua sesi, metadata, dan audio yang tersimpan di IndexedDB.
- File audio asli di disk tidak terpengaruh.

## Troubleshooting instalasi

| Gejala | Kemungkinan penyebab | Solusi |
| --- | --- | --- |
| `npm install` gagal | Node terlalu lama, koneksi, atau cache rusak | Pastikan Node 20.19+/22.12+, coba `npm install` lagi, lalu cek pesan error. |
| `npm run dev` tidak bisa dibuka | Port dipakai proses lain | Gunakan `--port 5174` atau hentikan proses yang memakai port tersebut. |
| Halaman blank | Build/dev error atau cache lama | Buka DevTools Console, jalankan `npm run typecheck`, lalu hard refresh. |
| Error `vue-tsc` setelah upgrade TypeScript | TypeScript 7 belum kompatibel dengan `vue-tsc` versi proyek | Gunakan TypeScript `~5.9.3` seperti di `package.json`. |
| Route 404 setelah deploy | Hosting tidak punya fallback SPA | Arahkan semua route ke `index.html`. |
| Data hilang setelah ganti alamat | Origin berubah (host/port/protokol) | Kembali ke origin lama, atau impor ulang audio. |
| Audio tidak bisa diputar | Codec tidak didukung browser atau blob hilang | Konversi ke MP3/WAV; jika data situs terhapus, impor ulang. |
| Penyimpanan penuh | Kuota browser/disk | Hapus sesi yang tidak dipakai dan kosongkan ruang disk. |

## Catatan pengembangan

- Tidak ada `.env` yang perlu dibuat.
- Tidak ada server API yang perlu dijalankan.
- Perintah `npm run test` menjalankan Vitest dalam mode watch; gunakan `npm run test:run` untuk sekali jalan.
- Unit test mencakup parser nama file, sorting, format, dan validasi audio.
- File audio besar (mendekati 300 MB) membutuhkan waktu impor dan ruang IndexedDB yang lebih besar.
