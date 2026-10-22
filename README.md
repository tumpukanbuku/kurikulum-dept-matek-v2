# Peta Belajar & Perencana Semester

Halaman baru ada di [`pathway.html`](./pathway.html). Fitur ini memakai data yang sama dengan katalog utama dari `data/kurikulum.js`; `index.html` dan alur katalog yang sudah ada tidak diubah.

## What's new

- **Tampilan Radian.** Menggunakan palet rose/crimson, font Outfit dan Plus Jakarta Sans, logo Radian di kanan atas, dan pilihan tema terang/gelap seperti situs katalog..
- **Peta belajar untuk Matematika, Statistika, dan Ilmu Aktuaria.** Mata kuliah wajib dikelompokkan dalam delapan kolom semester yang lebih lega dan disusun mengikuti relasi prasyarat agar jalurnya lebih mudah dibaca. Kartu ringkas setinggi sekitar 82 px; kartu memanjang saat detail dibuka. Pilih kartu untuk melihat jalur dua arah, termasuk relasi ke mata kuliah pilihan. Garis memakai rute siku-siku dengan belokan halus; panah ke mata kuliah pilihan masuk dari sisi kiri kartu melalui koridor di bawah peta agar tidak melintasi kartu semester lain. Arah panah menunjukkan relasi prasyarat ke lanjutan. Reduksi jalur transitif (X → Y → Z menghilangkan koneksi langsung X → Z) diterapkan ke semua mata kuliah dalam prodi, termasuk mata kuliah pilihan, tanpa mengubah data prasyarat. Klik label prasyarat untuk langsung membuka detail mata kuliah terkait.
- **Perencana multi-semester.** Pilih program studi, tandai mata kuliah yang sudah lulus, lalu susun beberapa semester. IP dan batas SKS ditetapkan untuk setiap semester. Mata kuliah yang direncanakan pada semester sebelumnya dapat menjadi prasyarat untuk semester berikutnya.
- **Penyimpanan lokal.** Rencana, mata kuliah lulus, dan pilihan program tersimpan otomatis di browser (`localStorage`) dan dapat dilanjutkan saat halaman dibuka kembali pada browser/perangkat yang sama. Tombol **Simpan rencana** memberi konfirmasi penyimpanan; **Semester berikutnya** membuat rencana semester baru.
- **Pemeriksaan prasyarat.** Mata kuliah dengan prasyarat mata kuliah hanya dapat ditambahkan setelah prasyarat ditandai lulus atau sudah direncanakan di semester sebelumnya. Prasyarat berbentuk jumlah SKS dihitung dari SKS mata kuliah yang ditandai lulus dan rencana semester sebelumnya.
- **Peringatan mata kuliah lintas prodi.** Mata kuliah di luar prodi yang dipilih tetap dapat direncanakan, tetapi ditandai sebagai lintas prodi.
- **Batas SKS otomatis berdasarkan IP:**

  | IP | Batas SKS |
  | --- | ---: |
  | 3,50–4,00 | 24 |
  | 3,00–3,49 | 21 |
  | 2,50–2,99 | 18 |
  | 2,00–2,49 | 15 |
  | Di bawah 2,00 | 12 |

## Cara membuka

Buka `pathway.html` di browser. Bila browser membatasi pemuatan file data lokal, jalankan server statis dari folder proyek, misalnya `python -m http.server 8000`, lalu buka `http://localhost:8000/pathway.html`.

## Catatan data dan batasan

- Data mata kuliah bersumber dari `data/kurikulum.js` dan tidak disalin ke berkas baru.
- Mata kuliah berkategori pilihan dan mata kuliah tanpa semester ditempatkan di bagian **Mata kuliah pilihan** di bawah peta.
- Beberapa prasyarat pada data sumber berupa ketentuan non-mata-kuliah, memiliki nama yang tidak cocok persis dengan katalog, atau memerlukan pemeriksaan manual. Ketentuan seperti ini ditampilkan untuk diverifikasi dan perlu dicentang secara manual di perencana; aplikasi tidak menandainya terpenuhi secara otomatis.
- SKS yang dihitung sebagai telah lulus berasal dari mata kuliah dalam katalog yang ditandai pengguna. Mata kuliah transfer/ekuivalensi dan ketentuan akademik lain perlu dikonfirmasi ke program studi.
- Data rencana dan status kelulusan disimpan hanya di penyimpanan browser lokal, tidak dikirim ke server. Data tidak tersinkron antar browser/perangkat; tombol **Hapus rencana** menghapus semua progres dan rencana yang tersimpan di browser tersebut.
- Halaman ini adalah alat bantu perencanaan, bukan persetujuan KRS. Penawaran kelas dan aturan resmi tetap perlu dikonfirmasi kepada program studi.
