import re
import json
import os

configs = [
    {
        "prodi": "Matematika",
        "file": "data/raw_matematika.txt"
    },
    {
        "prodi": "Statistika",
        "file": "data/raw_statistika.txt"
    },
    {
        "prodi": "Ilmu Aktuaria",
        "file": "data/raw_aktuaria.txt"
    }
]

def clean_text(text):
    # Hapus page headers
    text = re.sub(r'=== HALAMAN \d+ ===', '', text)
    # Hapus baris kosong berlebih
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Hapus baris yang hanya berisi nomor halaman (angka tunggal)
        if re.match(r'^\s*\d+\s*$', line):
            continue
        cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)

def parse_courses_from_text(text, prodi_name):
    # Pola untuk mencocokkan setiap mata kuliah
    # Mencari pola angka 1 diikuti "Nama Mata Kuliah" sampai sebelum angka 1 berikutnya (atau akhir teks)
    pattern = re.compile(
        r'(?:^|\n)\s*1\.?\s*Nama\s+Mata\s+Kuliah\s*:(.*?)(?=(?:\n\s*1\.?\s*Nama\s+Mata\s+Kuliah\s*:|\Z))', 
        re.DOTALL | re.IGNORECASE
    )
    
    matches = pattern.findall(text)
    courses = []
    
    print(f"[*] Menemukan {len(matches)} potongan mata kuliah di {prodi_name}")
    
    for idx, match in enumerate(matches):
        # Helper regex to extract field content
        def get_field(field_num_regex, next_field_num_regex, text_block):
            field_pattern = re.compile(
                r'(?:\n|^)\s*' + field_num_regex + r'\.?\s*(.*?)(?=(?:\n\s*' + next_field_num_regex + r'\.?\s*|\Z))',
                re.DOTALL | re.IGNORECASE
            )
            f_match = field_pattern.search(text_block)
            if f_match:
                return f_match.group(1).strip()
            return ""

        # Raw fields extraction
        nama_raw = re.split(r'\n\s*2\b', match)[0].replace(':', '').strip()
        kode_raw = get_field(r'2', r'3', match).replace(':', '').strip()
        sks_str = get_field(r'3', r'4', match).replace(':', '').strip()
        semester_str = get_field(r'4', r'5', match).replace(':', '').strip()
        prasyarat_str = get_field(r'5', r'6', match).replace(':', '').strip()
        deskripsi_raw = get_field(r'7', r'8', match).replace(':', '').strip()
        
        # Cek Referensi di Aktuaria (biasanya nomor 12)
        referensi_str = ""
        ref_match = re.search(r'(?:\n|^)\s*12\.?\s*(?:Referensi Wajib|Referensi)?\s*:(.*?)(?=\Z)', match, re.DOTALL | re.IGNORECASE)
        if ref_match:
            referensi_str = ref_match.group(1).strip()
            
        # 1. Bersihkan Kode (Hanya ambil kode berformat huruf + angka, misal UIGE600003 atau SCMA601001)
        code_match = re.search(r'\b([A-Z]{2,4}\d{4,6})\b', kode_raw.upper())
        if code_match:
            kode = code_match.group(1)
        else:
            # Fallback jika tidak ketemu pola kode
            kode = re.sub(r'^(Kode Mata Kuliah|Kode MK|Kode)\s*', '', kode_raw, flags=re.IGNORECASE).strip()
            kode = kode.split('\n')[0].strip().upper()
            
        if not kode or len(kode) < 4:
            continue
            
        # 2. Bersihkan Nama
        nama = re.sub(r'^(Nama Mata Kuliah|Nama MK|Nama)\s*', '', nama_raw, flags=re.IGNORECASE).strip()
        nama = re.sub(r'\s+', ' ', nama)
        # Hapus prefix angka jika ada
        nama = re.sub(r'^\d+\.?\s*', '', nama)
        
        # 3. Bersihkan SKS
        sks = 3 # Default
        sks_match = re.search(r'(\d+)', sks_str)
        if sks_match:
            sks = int(sks_match.group(1))
            
        # 4. Bersihkan Semester
        semester = 1
        sem_match = re.search(r'(\d+)', semester_str)
        if sem_match:
            semester = int(sem_match.group(1))
            
        # 5. Bersihkan Prasyarat
        prasyarat_str = re.sub(r'^(Prasyarat|Prasyarat MK)\s*', '', prasyarat_str, flags=re.IGNORECASE).strip()
        prasyarat = []
        if prasyarat_str and prasyarat_str != "-" and prasyarat_str.lower() != "tidak ada":
            # Cari kode-kode mata kuliah di dalam teks prasyarat
            codes = re.findall(r'\b([A-Z]{2,4}\d{4,6})\b', prasyarat_str.upper())
            if codes:
                prasyarat = list(set(codes))
            else:
                # Jika tidak ada kode tapi ada deskripsi teks, simpan deskripsinya
                prasyarat_clean = re.sub(r'\s+', ' ', prasyarat_str)
                if prasyarat_clean.lower() not in ["-", "tidak ada", "none"]:
                    prasyarat = [prasyarat_clean]
        else:
            prasyarat = ["Tidak ada"]
            
        # 6. Bersihkan Deskripsi (Hapus prefix "Deskripsi Mata Kuliah/Silabus" dll)
        deskripsi = re.sub(r'^(Deskripsi Mata Kuliah/Silabus|Deskripsi Mata Kuliah|Deskripsi|Silabus)\s*', '', deskripsi_raw, flags=re.IGNORECASE).strip()
        deskripsi = re.sub(r'\s+', ' ', deskripsi)
        # Bersihkan bagian akhir jika terpotong oleh "Tabel" atau "Halaman" yang tersisa
        deskripsi = re.split(r'\bTabel \d+', deskripsi, flags=re.IGNORECASE)[0].strip()
        
        # 7. Bersihkan Referensi
        referensi = []
        if referensi_str:
            # Hapus tulisan Tabel yang tidak sengaja terbawa di akhir referensi
            referensi_str_clean = re.split(r'\bTabel \d+', referensi_str, flags=re.IGNORECASE)[0].strip()
            
            # Memisahkan berdasarkan pola [1], [2], dll.
            ref_items = re.split(r'\[\d+\]', referensi_str_clean)
            for item in ref_items:
                item_clean = re.sub(r'\s+', ' ', item).strip()
                if item_clean:
                    referensi.append(item_clean)
        
        # Tentukan Kategori Berdasarkan Kode atau Nama
        kategori = "Mata Kuliah Wajib Prodi"
        
        # Univ: UIGE atau UI
        if kode.startswith("UI") or kode.startswith("UIGE"):
            kategori = "Mata Kuliah Wajib Universitas"
        # Fak: SCBI, SCCH, SCPH
        elif kode.startswith("SCBI") or kode.startswith("SCCH") or kode.startswith("SCPH"):
            kategori = "Mata Kuliah Wajib Fakultas"
        # Dept: SCMA umum
        elif kode in [
            "SCMA601001", "SCMA601002", "SCMA601003", 
            "SCMA601047", "SCMA601048", "SCMA601049",
            "SCMA601005", "SCMA601006", "SCMA601007"
        ]:
            kategori = "Mata Kuliah Wajib Departemen"
        # Khusus Pengantar Sains Data adalah Wajib Fakultas
        elif kode == "SCST601001":
            kategori = "Mata Kuliah Wajib Fakultas"
            
        courses.append({
            "kode": kode,
            "nama": nama,
            "sks": sks,
            "semester": semester,
            "kategori": kategori,
            "prasyarat": prasyarat,
            "deskripsi": deskripsi,
            "referensi": referensi,
            "prodi": [prodi_name]
        })
        
    return courses

# Main execution
all_parsed_courses = []
for config in configs:
    prodi = config["prodi"]
    filepath = config["file"]
    
    if not os.path.exists(filepath):
        print(f"[!] File {filepath} tidak ditemukan.")
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        raw_content = f.read()
        
    cleaned_content = clean_text(raw_content)
    parsed = parse_courses_from_text(cleaned_content, prodi)
    
    # Merge dengan all_parsed_courses
    for new_c in parsed:
        match_idx = next((i for i, item in enumerate(all_parsed_courses) if item["kode"] == new_c["kode"]), None)
        if match_idx is not None:
            # Gabungkan prodi
            existing_prodi = all_parsed_courses[match_idx]["prodi"]
            if prodi not in existing_prodi:
                all_parsed_courses[match_idx]["prodi"].append(prodi)
            # Jika deskripsi lokal kosong tapi yang baru ada, update
            if not all_parsed_courses[match_idx]["deskripsi"] and new_c["deskripsi"]:
                all_parsed_courses[match_idx]["deskripsi"] = new_c["deskripsi"]
            # Gabungkan referensi
            existing_ref = all_parsed_courses[match_idx]["referensi"]
            for ref in new_c["referensi"]:
                if ref not in existing_ref:
                    all_parsed_courses[match_idx]["referensi"].append(ref)
        else:
            all_parsed_courses.append(new_c)

print(f"[+] Total mata kuliah hasil ekstraksi & penggabungan: {len(all_parsed_courses)}")

# Tulis ke data/kurikulum.js
js_out_path = "data/kurikulum.js"
with open(js_out_path, "w", encoding="utf-8") as f:
    f.write("window.kurikulumData = ")
    json.dump(all_parsed_courses, f, indent=2, ensure_ascii=False)
    f.write(";\n")
print(f"[+] Berhasil menulis data/kurikulum.js")
