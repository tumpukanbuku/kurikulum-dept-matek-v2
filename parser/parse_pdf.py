#!/usr/bin/env python3
import os
import re
import json
import argparse
import sys
from typing import List, Optional
import typing_extensions as typing

# Dependensi eksternal
try:
    import pdfplumber
    import google.generativeai as genai
    from dotenv import load_dotenv
    load_dotenv()
except ImportError as e:
    print(f"Error: Dependensi kurang ({e.name}). Silakan jalankan: pip install pdfplumber google-generativeai python-dotenv")
    sys.exit(1)

# ==========================================================================
# Schema Definisi dengan Typing untuk Gemini Structured Output
# ==========================================================================
class Course(typing.TypedDict):
    kode: str            # Kode Mata Kuliah, contoh: "MA1101"
    nama: str            # Nama Mata Kuliah, contoh: "Kalkulus I"
    sks: int             # Jumlah SKS, contoh: 4
    kategori: str        # Kategori mata kuliah (salah satu dari 5 pilihan)
    prasyarat: List[str] # Array kode prasyarat (contoh: ["MA1101"]) atau ["Tidak ada"]
    deskripsi: str       # Deskripsi mata kuliah (bisa mengandung LaTeX, contoh: $A\mathbf{x} = \lambda\mathbf{x}$)
    referensi: List[str] # Array berisi buku acuan/referensi kuliah

class ExtractedCourses(typing.TypedDict):
    courses: List[Course]

# ==========================================================================
# Fungsi Ekstraksi Text dari PDF
# ==========================================================================
def extract_text_from_pages(pdf_path: str, start_page: int, end_page: int) -> List[dict]:
    pages_data = []
    print(f"[*] Membuka file PDF: {pdf_path}")
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        # 1-indexed conversion
        start = max(1, start_page)
        end = min(total_pages, end_page) if end_page > 0 else total_pages
        
        print(f"[*] Mengekstrak teks dari halaman {start} sampai {end} (Total halaman PDF: {total_pages})")
        
        for p_idx in range(start - 1, end):
            page = pdf.pages[p_idx]
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({
                    "page_number": p_idx + 1,
                    "text": text
                })
            else:
                print(f"[!] Halaman {p_idx + 1} kosong atau berupa gambar bergambar saja (skip).")
                
    return pages_data

# ==========================================================================
# Membaca & Menulis data/kurikulum.js Lokal
# ==========================================================================
def read_local_js_data(js_path: str) -> List[dict]:
    if not os.path.exists(js_path):
        return []
        
    try:
        with open(js_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Cari JSON array menggunakan regex
        match = re.search(r'window\.kurikulumData\s*=\s*(\[.*\]);', content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    except Exception as e:
        print(f"[!] Gagal membaca data lokal di {js_path}: {e}")
        
    return []

def write_local_js_data(js_path: str, data: List[dict]):
    try:
        # Buat direktori data jika belum ada
        os.makedirs(os.path.dirname(js_path), exist_ok=True)
        
        with open(js_path, "w", encoding="utf-8") as f:
            f.write("window.kurikulumData = ")
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write(";\n")
        print(f"[+] Berhasil menulis data terbaru ke: {js_path}")
    except Exception as e:
        print(f"[!] Gagal menulis ke berkas {js_path}: {e}")

# ==========================================================================
# Main Parser Logic
# ==========================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Parser PDF Kurikulum FMIPA UI ke data/kurikulum.js menggunakan Gemini API."
    )
    parser.add_argument("--pdf", required=True, help="Path ke file PDF kurikulum prodi")
    parser.add_argument("--prodi", required=True, choices=["Matematika", "Statistika", "Ilmu Aktuaria"], help="Nama prodi dari PDF kurikulum")
    parser.add_argument("--start", type=int, default=1, help="Halaman awal pemrosesan PDF (default: 1)")
    parser.add_argument("--end", type=int, default=-1, help="Halaman akhir pemrosesan PDF (default: seluruhnya)")
    parser.add_argument("--js-path", default="data/kurikulum.js", help="Path ke berkas data/kurikulum.js tujuan")
    
    args = parser.parse_args()

    # Cek Gemini API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[!] Error: Environment variable GEMINI_API_KEY tidak ditemukan.")
        print("[!] Silakan buat berkas .env dengan isi: GEMINI_API_KEY=your-api-key-here")
        sys.exit(1)
        
    genai.configure(api_key=api_key)

    # Ekstraksi Teks PDF
    pages_data = extract_text_from_pages(args.pdf, args.start, args.end)
    if not pages_data:
        print("[!] Tidak ada teks yang berhasil diekstrak dari PDF.")
        sys.exit(1)

    print(f"[*] Mulai memproses {len(pages_data)} halaman dengan Gemini API...")
    
    # Inisialisasi Model Gemini (2.5-flash)
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    # Baca data lokal saat ini
    merged_data = read_local_js_data(args.js_path)
    print(f"[*] Berhasil memuat {len(merged_data)} entri mata kuliah dari {args.js_path}")

    prompt_instruction = """
    Tugas Anda adalah mengekstrak informasi detail mata kuliah dari teks dokumen kurikulum akademik di bawah ini.
    
    PANDUAN EKSTRAKSI:
    1. Ekstrak semua informasi mata kuliah yang tercantum (kode, nama, sks, kategori, prasyarat, deskripsi, referensi).
    2. Jika halaman tidak mengandung mata kuliah (misalnya halaman pengantar, daftar isi, dll), kembalikan array "courses" kosong: {"courses": []}.
    3. Untuk field "kategori", klasifikasikan nilai secara ketat menjadi salah satu dari 5 string berikut:
       - "Mata Kuliah Wajib Universitas"
       - "Mata Kuliah Wajib Fakultas"
       - "Mata Kuliah Wajib Departemen"
       - "Mata Kuliah Wajib Prodi"
       - "Mata Kuliah Pilihan"
    4. Untuk field "prasyarat", masukkan KODE mata kuliah prasyarat saja (contoh: ["MA1101"]). Jika tidak ada prasyarat, isi ["Tidak ada"].
    5. Pertahankan ekspresi rumus matematika/statistika di dalam "deskripsi" dengan menggunakan format LaTeX standard. Gunakan single dollar ($) untuk matematika inline (seperti $f(x)$) dan double dollar ($$) untuk blok matematika (seperti $$\\int f(x)dx$$).
    6. Hilangkan spasi berlebih dan pastikan teks deskripsi rapi.
    
    Teks halaman dokumen:
    ---
    """

    new_courses_count = 0
    updated_courses_count = 0

    for page in pages_data:
        p_num = page["page_number"]
        p_text = page["text"]
        
        print(f"[*] Memproses Halaman {p_num}...")
        
        try:
            # Call Gemini dengan Structured Output
            response = model.generate_content(
                f"{prompt_instruction}\n{p_text}",
                generation_config={
                    "response_mime_type": "application/json",
                    "response_schema": ExtractedCourses
                }
            )
            
            # Parsing response JSON
            result = json.loads(response.text)
            courses = result.get("courses", [])
            
            if courses:
                print(f"   [+] Menemukan {len(courses)} mata kuliah di Halaman {p_num}:")
                for c in courses:
                    kode = c['kode'].strip().upper()
                    print(f"       - {kode}: {c['nama']} ({c['sks']} SKS)")
                    
                    # Merge data prodi
                    match_idx = next((i for i, item in enumerate(merged_data) if item["kode"] == kode), None)
                    if match_idx is not None:
                        # Gabungkan prodi tanpa duplikat
                        existing_prodi = merged_data[match_idx].get("prodi", [])
                        if args.prodi not in existing_prodi:
                            new_prodi = existing_prodi + [args.prodi]
                        else:
                            new_prodi = existing_prodi
                        
                        # Update data terbaru sambil mempertahankan array prodi gabungan
                        merged_data[match_idx] = c.copy()
                        merged_data[match_idx]["prodi"] = new_prodi
                        updated_courses_count += 1
                    else:
                        # Buat entri baru
                        new_c = c.copy()
                        new_c["prodi"] = [args.prodi]
                        merged_data.append(new_c)
                        new_courses_count += 1
            else:
                print(f"   [-] Tidak ada mata kuliah di Halaman {p_num}.")
                
        except Exception as e:
            print(f"   [!] Gagal memproses Halaman {p_num}: {e}")

    # Tulis data kembali ke data/kurikulum.js
    if new_courses_count > 0 or updated_courses_count > 0:
        write_local_js_data(args.js_path, merged_data)
        print(f"[+] Selesai! Ditambahkan: {new_courses_count}, Diperbarui: {updated_courses_count} entri. Total di file: {len(merged_data)}")
    else:
        print("[*] Selesai. Tidak ada perubahan data baru untuk ditulis.")

if __name__ == "__main__":
    main()
