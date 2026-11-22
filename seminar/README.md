# Sistem Penilaian Sidang Tugas Akhir PRODISTIK

MAN 2 Kota Probolinggo. Frontend statis (HTML/CSS/JS) + Google Apps Script + Google Spreadsheet.

## Struktur

```
prodistik-sidang/
├── index.html          # penguji
├── admin.html          # admin (token)
├── monitoring.html     # progres sidang
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js       # <- isi API_URL di sini
│       ├── api.js          # pemanggil API + helper
│       ├── examiner.js
│       ├── admin.js
│       └── monitoring.js
├── README.md
└── PRD.md              # salin PRD_PRODISTIK_Sidang.md ke sini
```

## Pasang

1. Apps Script: Deploy > New deployment > Web app. Execute as: **Me**. Who has access: **Anyone**.
   (Akses "Anyone" hanya membuka URL API. Data tetap dilindungi validasi di Code.gs.)
2. Salin URL `/exec` ke `assets/js/config.js` (`API_URL`).
3. Push ke GitHub, lalu di Vercel: Add New Project > pilih repo > Framework Preset **Other** > Deploy.
4. Setiap mengubah Code.gs, buat **New version** pada deployment yang sama agar URL tidak berubah.

## Kontrak API yang diharapkan frontend

Semua request: `POST` ke `API_URL`, header `Content-Type: text/plain`, body JSON `{ "action": "...", ...params }`.
Di Code.gs baca dengan `JSON.parse(e.postData.contents)`. Respons: `{ "success": true|false, "message": "...", "data": ... }`.

Key respons tidak peka huruf besar/kecil dan garis bawah (`ID_PENGUJI`, `idPenguji`, `idpenguji` sama saja).

| Action | Parameter | `data` yang dibaca frontend |
|---|---|---|
| `getPengujiAktif` | – | `[{idPenguji, namaPenguji}]` |
| `getPesertaPenguji` | `idPenguji, tanggal` | `[{idPenugasan, idSidang, tanggal, jenisSidang, namaSiswa, kelasAsal, kelasProdistik, sesi, sudahDinilai}]` |
| `getIndikator` | `jenisSidang` | `[{no, namaIndikator, deskripsi, bobot, nilaiMin, nilaiMax}]` |
| `getPenilaian` | `idPenugasan, idPenguji` | `{judulTA, nilai:[..]}` atau `null` |
| `savePenilaian` | `idPenugasan, idSidang, idPenguji, judulTA, nilai:[..]` | `{nilaiAkhir}` (opsional) |
| `getMonitoringSidang` | `tanggal, jenisSidang, status, keyword` | `[{namaSiswa, kelasAsal, kelasProdistik, jenisSidang, sesi, jumlahNilai, jumlahPenguji, status}]` |
| `getRingkasanMonitoring` | sama | `{total, belumDimulai, proses, selesai, belumAdaPenguji}` |
| `adminLogin` | `token` | apa saja (sukses = token valid) |
| `adminGetData` | `token, tabel` (`PENGUJI`, `PESERTA_SIDANG`, `PENUGASAN_PENGUJI`, `INDIKATOR`, `PENGATURAN`) | array baris sheet |
| `adminSavePenguji` / `adminSavePeserta` / `adminSavePenugasan` / `adminSaveIndikator` | `token, mode ("create"\|"update"), data:{NAMA_KOLOM: nilai}` | – |
| `adminGetPenilaian` | `token, tanggal` | array baris sheet PENILAIAN |
| `adminGetLog` | `token, limit` | array baris sheet LOG_AKTIVITAS |

Status monitoring: `BELUM DIMULAI`, `PROSES PENILAIAN`, `SELESAI`, `BELUM ADA PENGUJI`.

Jika Code.gs Anda memakai nama action/field yang berbeda, ubah di satu tempat: nama action di `examiner.js`,
`monitoring.js`, `admin.js`; bentuk field form admin di `TABS` pada `admin.js`.

## Catatan keamanan

- Pilihan nama penguji bukan autentikasi. Backend harus memastikan `idPenguji` benar-benar punya penugasan pada `idPenugasan`. Tambahkan PIN penguji pada versi berikutnya.
- Token admin diketik saat login, disimpan di `sessionStorage`, dan divalidasi (hash) di Code.gs. Jangan taruh token di repo.
- Nilai akhir yang sah selalu dihitung backend; angka di layar penguji hanya perkiraan.
- Halaman monitoring tidak menampilkan nilai maupun judul TA, dan endpoint-nya juga tidak boleh mengirimkannya.
