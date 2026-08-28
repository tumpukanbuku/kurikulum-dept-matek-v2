import json
import os

# 1. Baca referensi dari kurikulum.js lama
references_map = {}
old_js_path = "data/kurikulum.js"
if os.path.exists(old_js_path):
    with open(old_js_path, "r", encoding="utf-8") as f:
        old_content = f.read()
    try:
        old_json_str = old_content.replace("window.kurikulumData = ", "").rstrip(";\n")
        old_data = json.loads(old_json_str)
        for course in old_data:
            if course.get("referensi"):
                references_map[course["kode"]] = course["referensi"]
    except Exception as e:
        print(f"[!] Gagal membaca referensi lama: {e}")

# 2. Baca curriculum.json dari Next.js project
next_json_path = "../katalog-matek/data/curriculum.json"
with open(next_json_path, "r", encoding="utf-8") as f:
    next_data = json.load(f)

# Grouping base courses by code
grouped_courses = {}

for item in next_data["courses"]:
    code = item["code"].strip().upper()
    if not code:
        continue
        
    # Hapus SCFI601110 Fisika Dasar
    if code == "SCFI601110":
        continue
        
    # Hapus Logika dan Himpunan SCMA601100
    if code == "SCMA601100":
        continue
        
    name = item["name"].strip()
    category = item["category"].strip()
    credits = item["credits"]
    semester = item.get("semester", 1)
    
    # Bersihkan prasyarat
    prereq_str = item.get("prerequisite", "Tidak ada").strip()
    prereqs = []
    if prereq_str and prereq_str != "-" and prereq_str.lower() != "tidak ada":
        import re
        codes = re.findall(r'\b([A-Z]{2,4}\d{4,6})\b', prereq_str.upper())
        if codes:
            prereqs = list(set(codes))
        else:
            prereqs = [prereq_str]
    else:
        prereqs = ["Tidak ada"]
        
    description = item.get("description", "").strip()
    program = item["program"].strip()
    
    # Overrides kategori:
    # A. Analisis Fungsional, Matematika Numerik, Teori Komputasi, Topik Khusus 1 (Teori Koding dan Kriptografi) -> Pilihan Matematika
    if code in ["SCMA604135", "SCMA603431", "SCMA604412", "SCMA604991"]:
        category = "Mata Kuliah Pilihan"
        
    # B. Topik Khusus 1,2,3,4 Statistika -> Pilihan Statistika
    if code in ["SCST603145", "SCST603146", "SCST603147", "SCST603148"]:
        category = "Mata Kuliah Pilihan"
        
    # C. Cek kategori default jika Wajib Departemen, Fakultas, Universitas
    if code in [
        "SCMA601001", "SCMA601002", "SCMA601003", 
        "SCMA601047", "SCMA601048", "SCMA601049",
        "SCMA601005", "SCMA601006", "SCMA601007"
    ]:
        category = "Mata Kuliah Wajib Departemen"
    elif code in ["SCCH601101", "SCST601001", "SCPH601110", "SCBI601112"]:
        category = "Mata Kuliah Wajib Fakultas"
    elif code.startswith("UI") or code.startswith("UIGE"):
        category = "Mata Kuliah Wajib Universitas"
        
    # Tentukan daftar prodi (Aturan: Jika Wajib Universitas, Fakultas, atau Departemen, semua prodi include)
    if category in [
        "Mata Kuliah Wajib Universitas",
        "Mata Kuliah Wajib Fakultas",
        "Mata Kuliah Wajib Departemen"
    ]:
        prodi_list = ["Matematika", "Statistika", "Ilmu Aktuaria"]
    else:
        prodi_list = [program]
        
    if code not in grouped_courses:
        grouped_courses[code] = {
            "kode": code,
            "nama": name,
            "sks": credits,
            "semester": semester,
            "kategori": category,
            "prasyarat": prereqs,
            "deskripsi": description,
            "referensi": references_map.get(code, []),
            "prodi": prodi_list
        }
    else:
        # Update prodi list (gabungkan jika bukan wajib univ/fak/dept yang sudah di-force di atas)
        for p in prodi_list:
            if p not in grouped_courses[code]["prodi"]:
                grouped_courses[code]["prodi"].append(p)
        # Update deskripsi jika kosong
        if not grouped_courses[code]["deskripsi"] and description:
            grouped_courses[code]["deskripsi"] = description

# Convert to list
final_courses_list = list(grouped_courses.values())

# Urutkan berdasarkan nama
final_courses_list.sort(key=lambda x: x["nama"])

print(f"[*] Total unique courses: {len(final_courses_list)}")

# Tulis ke data/kurikulum.js
with open("data/kurikulum.js", "w", encoding="utf-8") as f:
    f.write("window.kurikulumData = ")
    json.dump(final_courses_list, f, indent=2, ensure_ascii=False)
    f.write(";\n")
print("[+] Berhasil menulis data/kurikulum.js")

# Tulis juga JSON cadangan
with open("data/kurikulum.json", "w", encoding="utf-8") as f:
    json.dump(final_courses_list, f, indent=2, ensure_ascii=False)
print("[+] Berhasil menulis data/kurikulum.json")
