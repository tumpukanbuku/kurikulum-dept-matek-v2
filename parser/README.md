# Panduan Ekstraksi Data PDF Kurikulum ke Firebase

Folder ini berisi berkas script Python untuk mengekstrak informasi mata kuliah secara otomatis dari file PDF kurikulum Program Studi Matematika, Statistika, dan Ilmu Aktuaria FMIPA UI, kemudian mengunggahnya ke database Cloud Firestore.

---

## Persiapan Lingkungan (Prasyarat)

1. **Python 3**: Pastikan Anda sudah menginstal Python versi 3.8 ke atas di komputer Anda.
2. **Kredensial Gemini API**:
   - Dapatkan API Key Gemini secara gratis melalui [Google AI Studio](https://aistudio.google.com/).
   - Buat berkas baru bernama `.env` di dalam folder ini (`parser/`), lalu isi dengan kunci Anda:
     ```env
     GEMINI_API_KEY=Kunci_API_Gemini_Anda_Di_Sini
     ```
3. **Kredensial Firebase Admin SDK**:
   - Buka [Firebase Console](https://console.firebase.google.com/).
   - Masuk ke proyek Anda, klik ikon gerigi ⚙️ -> **Project settings**.
   - Pilih tab **Service accounts**.
   - Klik tombol **Generate new private key** (Buat kunci privat baru) di bagian bawah.
   - Unduh file JSON tersebut, ubah namanya menjadi `service-account.json`, lalu simpan berkas tersebut ke dalam folder utama proyek (`arsip-kurikulum-matek/service-account.json`) atau folder ini.

---

## Instalasi Dependensi

Buka terminal di komputer Anda, masuk ke direktori proyek ini, lalu jalankan perintah instalasi berikut:

```bash
pip install -r parser/requirements.txt
```

---

## Cara Menjalankan Ekstraksi

Script `parse_pdf.py` memproses halaman PDF secara berurutan dan mengirimkannya ke Gemini API untuk menstrukturkan data ke dalam format JSON sebelum disimpan ke Firestore.

> [!TIP]
> **Tips Hemat Kuota & Waktu**: Jangan mengekstrak seluruh halaman PDF jika halaman tersebut hanya berisi Kata Pengantar, Daftar Isi, atau Tata Tertib. Cari tahu rentang halaman mana yang khusus berisi **Daftar Deskripsi Mata Kuliah** (misalnya halaman 45 sampai 120), lalu gunakan argumen `--start` dan `--end`.

### Contoh Perintah Ekstraksi

#### 1. Untuk Program Studi Matematika
Misalnya deskripsi mata kuliah ada di halaman 20 sampai 80:
```bash
python parser/parse_pdf.py --pdf "C:/path/ke/kurikulum-matematika.pdf" --prodi Matematika --start 20 --end 80
```

#### 2. Untuk Program Studi Statistika
```bash
python parser/parse_pdf.py --pdf "C:/path/ke/kurikulum-statistika.pdf" --prodi Statistika --start 15 --end 60
```

#### 3. Untuk Program Studi Ilmu Aktuaria
```bash
python parser/parse_pdf.py --pdf "C:/path/ke/kurikulum-aktuaria.pdf" --prodi "Ilmu Aktuaria" --start 30 --end 75
```

---

## Hasil Ekstraksi
1. **Cloud Firestore**: Data akan langsung masuk ke koleksi `courses` di Firebase Anda. Jika ada mata kuliah beririsan (misalnya kalkulus yang diambil ketiga prodi), script secara otomatis akan **menggabungkan** nama prodi di kolom `prodi` sehingga data tetap rapi dan tidak duplikat.
2. **Backup Lokal (`extracted_courses.json`)**: Script juga akan menulis/menambah backup data ke file JSON lokal di folder kerja Anda. File ini bisa digunakan jika Anda ingin menyalin data secara offline langsung ke frontend.
