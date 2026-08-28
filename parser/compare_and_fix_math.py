import json
import os
import re

# 1. Parse data tabel matematika pilihan dari input user
table_text = """
1  | SCMA603125  | Topologi                                  | 3   | 5        | Analisis 1
2  | SCMA603126  | Persamaan Diferensial Stokastik           | 3   | 5        | Persamaan Diferensial Biasa, Statistika Matematika 1
3  | SCMA603127  | Riset Operasi                             | 3   | 5        | Pemrograman Matematika
4  | SCMA603128  | Komputasi Intelegensia                    | 3   | 5        | Sains Data
5  | SCMA603129  | Perancangan & Analisis Algoritma          | 3   | 5        | Algoritma dan Pemrograman
6  | SCMA603130  | Aljabar Linier 2                          | 3   | 5        | Aljabar Linier 1, Aljabar
7  | SCMA603131  | Kriptografi                               | 3   | 6        | Aljabar Linier 1, Matematika Diskrit, Aljabar
8  | SCMA603132  | Komputasi Paralel                         | 3   | 6        | Struktur Data
9  | SCMA603133  | Matematika Numerik                        | 3   | 6        | Metode Numerik
10 | SCMA603134  | Persamaan Diferensial Stokastik Numerik   | 3   | 6        | Persamaan Diferensial Stokastik, Statistika Matematika 1
11 | SCMA603135  | Sistem Dinamik                            | 3   | 6        | Persamaan Diferensial Biasa, Praktikum PDB
12 | SCMA603136  | Optimasi pada Jaringan                    | 3   | 6        | Pemrograman Matematika, Matematika Diskrit
13 | SCMA603137  | Topik Khusus 1                            | 3   | 6        | -
14 | SCMA603138  | Topik Khusus 2                            | 3   | 6        | -
15 | SCMA604139  | Analisis Fungsional                       | 3   | 7        | Analisis 1, Aljabar
16 | SCMA604140  | Teori Ukur dan Integrasi                  | 3   | 7        | Analisis 2
17 | SCMA604141  | Teori Kontrol Optimal                     | 3   | 7        | Pemrograman Matematika, Persamaan Diferensial Biasa, Praktikum PDB
18 | SCMA604142  | Teori Komputasi                           | 3   | 7        | Algoritma dan Pemrograman, Matematika Diskrit
19 | SCMA604143  | Bioinformatika                            | 3   | 7        | Pengantar Sains Data, Algoritma dan Pemrograman
20 | SCMA604144  | Biomatematika                             | 3   | 7        | Pemodelan Matematis
21 | SCMA604145  | Topik Khusus 3                            | 3   | 7        | -
22 | SCMA604146  | Topik Khusus 4                            | 3   | 7        | -
"""

table_courses = []
for line in table_text.strip().split("\n"):
    if not line.strip():
        continue
    parts = [p.strip() for p in line.split("|")]
    if len(parts) >= 6:
        num = parts[0]
        code = parts[1].upper()
        name = parts[2]
        sks = int(parts[3])
        semester = int(parts[4])
        
        prereq_raw = parts[5]
        prereqs = []
        if prereq_raw and prereq_raw != "-" and prereq_raw.lower() != "tidak ada":
            prereqs = [p.strip() for p in prereq_raw.split(",")]
        else:
            prereqs = ["Tidak ada"]
            
        table_courses.append({
            "kode": code,
            "nama": name,
            "sks": sks,
            "semester": semester,
            "prasyarat": prereqs
        })

print(f"[*] Berhasil mem-parse {len(table_courses)} matkul dari tabel user.")

# 2. Baca data kurikulum.json lama
json_path = "data/kurikulum.json"
with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Buat mapping nama matkul yang mirip untuk perbaikan kode
def normalize_name(n):
    n = n.lower().replace(" & ", " dan ").replace("-", " ")
    n = re.sub(r'\(.*?\)', '', n)
    return re.sub(r'\s+', ' ', n).strip()

updated_courses = []
matched_table_codes = set()

# Iterasi data yang ada untuk mencocokkan & memperbarui
for course in data:
    course_code = course["kode"].upper()
    course_name_norm = normalize_name(course["nama"])
    
    # Hanya match jika matkul tersebut memang prodi Matematika atau kodenya berawalan SCMA
    is_math_related = "Matematika" in course["prodi"] or course_code.startswith("SCMA")
    
    matched = None
    
    if is_math_related:
        # Cari kecocokan kode terlebih dahulu
        for tc in table_courses:
            if tc["kode"] == course_code:
                matched = tc
                break
                
        # Jika tidak ketemu kode, cari kecocokan nama yang dinormalisasi
        if not matched:
            for tc in table_courses:
                tc_name_norm = normalize_name(tc["nama"])
                
                # Cegah pencocokan silang antara topik khusus yang salah
                # (misal Topik Khusus 1 Matematika vs Topik Khusus 1 Statistika/Aktuaria)
                # Jika nama mengandung 'topik khusus', kodenya harus mengandung angka indeks yang sama
                if "topik khusus" in tc_name_norm:
                    # Ambil angka di belakang topik khusus
                    tc_num = re.search(r'topik khusus (\d+)', tc_name_norm)
                    course_num = re.search(r'topik khusus (\d+)', course_name_norm)
                    if tc_num and course_num and tc_num.group(1) != course_num.group(1):
                        continue
                        
                if (tc_name_norm == course_name_norm or 
                    (len(tc_name_norm) > 10 and tc_name_norm in course_name_norm) or 
                    (len(course_name_norm) > 10 and course_name_norm in tc_name_norm)):
                    matched = tc
                    break
                
    if matched:
        print(f"[+] Match ditemukan: {course_code} ({course['nama']}) -> {matched['kode']} ({matched['nama']})")
        # Perbarui data
        course["kode"] = matched["kode"]
        course["nama"] = matched["nama"]
        course["sks"] = matched["sks"]
        course["semester"] = matched["semester"]
        course["prasyarat"] = matched["prasyarat"]
        course["kategori"] = "Mata Kuliah Pilihan"
        if "Matematika" not in course["prodi"]:
            course["prodi"].append("Matematika")
            
        matched_table_codes.add(matched["kode"])
        
    updated_courses.append(course)

# 3. Cari matkul dari tabel yang belum ada di dataset, lalu tambahkan sebagai matkul pilihan baru
for tc in table_courses:
    if tc["kode"] not in matched_table_codes:
        print(f"[NEW] Menambahkan matkul pilihan baru: {tc['kode']} - {tc['nama']}")
        new_course = {
            "kode": tc["kode"],
            "nama": tc["nama"],
            "sks": tc["sks"],
            "semester": tc["semester"],
            "kategori": "Mata Kuliah Pilihan",
            "prasyarat": tc["prasyarat"],
            "deskripsi": f"Mata Kuliah Pilihan Program Studi Matematika FMIPA UI.",
            "referensi": [],
            "prodi": ["Matematika"]
        }
        updated_courses.append(new_course)

# Urutkan ulang berdasarkan nama
updated_courses.sort(key=lambda x: x["nama"])

# Tulis ke data/kurikulum.js
with open("data/kurikulum.js", "w", encoding="utf-8") as f:
    f.write("window.kurikulumData = ")
    json.dump(updated_courses, f, indent=2, ensure_ascii=False)
    f.write(";\n")
print("[+] Berhasil menulis data/kurikulum.js")

# Tulis ke data/kurikulum.json
with open("data/kurikulum.json", "w", encoding="utf-8") as f:
    json.dump(updated_courses, f, indent=2, ensure_ascii=False)
print("[+] Berhasil menulis data/kurikulum.json")

# Tulis juga ke NextJS curriculum.json di kedua lokasi!
next_paths = [
    "../katalog-matek/data/curriculum.json",
    "C:/Users/Adrian/Downloads/katalog-matek-source/katalog-matek/data/curriculum.json"
]

for path in next_paths:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            next_json = json.load(f)
            
        next_courses = []
        for nc in next_json["courses"]:
            if nc["program"] == "Matematika":
                nc_code = nc["code"].upper()
                nc_name_norm = normalize_name(nc["name"])
                
                matched = None
                for tc in table_courses:
                    if tc["kode"] == nc_code:
                        matched = tc
                        break
                if not matched:
                    for tc in table_courses:
                        tc_name_norm = normalize_name(tc["nama"])
                        if tc_name_norm == nc_name_norm:
                            matched = tc
                            break
                            
                if matched:
                    nc["code"] = matched["kode"]
                    nc["name"] = matched["nama"]
                    nc["credits"] = matched["sks"]
                    nc["semester"] = matched["semester"]
                    nc["prerequisite"] = ", ".join(matched["prasyarat"])
                    nc["category"] = "Mata Kuliah Pilihan"
                
                next_courses.append(nc)
            else:
                next_courses.append(nc)
                
        # Cek apakah ada yang belum dimasukkan di NextJS courses list untuk Matematika
        for tc in table_courses:
            exists_in_next = any(x["code"] == tc["kode"] and x["program"] == "Matematika" for x in next_courses)
            if not exists_in_next:
                next_courses.append({
                    "id": f"matematika-{tc['kode'].lower()}",
                    "program": "Matematika",
                    "name": tc["name"],
                    "code": tc["kode"],
                    "credits": tc["sks"],
                    "semester": tc["semester"],
                    "prerequisite": ", ".join(tc["prasyarat"]),
                    "description": "Mata Kuliah Pilihan Program Studi Matematika FMIPA UI.",
                    "category": "Mata Kuliah Pilihan",
                    "source": "[MAT] Ringkasan Kurikulum 2024.pdf",
                    "sourcePage": 114
                })
                
        next_json["courses"] = next_courses
        
        # Hitung statistik baru
        unique_codes = set(c["code"] for c in next_courses)
        next_json["meta"]["recordCount"] = len(next_courses)
        next_json["meta"]["uniqueCourseCount"] = len(unique_codes)
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(next_json, f, indent=2, ensure_ascii=False)
        print(f"[+] Berhasil memperbarui NextJS: {path}")
